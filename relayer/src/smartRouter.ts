import { ethers } from 'ethers';
import { getTokenBalance } from './balanceChecker.js';
import { ChainConfig } from './chains.js';

export interface TransactionStep {
  type: 'approve' | 'swap' | 'transfer' | 'execute';
  target: string;
  value: string;
  data: string;
  description: string;
}

export interface SwapDetails {
  fromToken: string;
  toToken: string;
  estimatedAmountIn: string;
  estimatedAmountOut: string;
}

export interface TransactionPlan {
  steps: TransactionStep[];
  needsSwap: boolean;
  swapDetails?: SwapDetails;
}

const TRANSFER_SELECTOR = '0xa9059cbb'; // transfer(address,uint256)
const transferInterface = new ethers.Interface([
  'function transfer(address to, uint256 amount)',
]);

/**
 * Analyze a transaction request and determine if auto-swap is needed.
 *
 * Logic:
 * 1. If sending native AVAX -> check native balance, no swap needed
 * 2. If sending ERC20 -> check ERC20 balance
 *    a. If enough ERC20 -> direct transfer
 *    b. If NOT enough ERC20 -> check AVAX balance -> auto-swap AVAX->ERC20 first
 * 3. Generic contract call -> execute as-is
 */
export async function planTransaction(
  provider: ethers.JsonRpcProvider,
  walletAddress: string,
  target: string,
  value: string,
  data: string,
  chainConfig: ChainConfig
): Promise<TransactionPlan> {
  const steps: TransactionStep[] = [];

  // Case 1: Sending native AVAX (data is "0x" or empty, value > 0)
  if ((!data || data === '0x') && BigInt(value) > 0n) {
    steps.push({
      type: 'transfer',
      target,
      value,
      data: '0x',
      description: `Send ${ethers.formatEther(value)} ${chainConfig.nativeSymbol}`,
    });
    return { steps, needsSwap: false };
  }

  // Case 2: Check if this is an ERC20 transfer
  const isERC20Transfer =
    data.startsWith(TRANSFER_SELECTOR) &&
    chainConfig.swap?.tokens?.some(
      (t) => t.address.toLowerCase() === target.toLowerCase()
    );

  if (isERC20Transfer && chainConfig.swap) {
    const decoded = transferInterface.decodeFunctionData('transfer', data);
    const transferAmount: bigint = decoded[1];

    // Check current ERC20 balance
    const { balance: tokenBalance, decimals } = await getTokenBalance(
      provider,
      target,
      walletAddress
    );

    const token = chainConfig.swap.tokens.find(
      (t) => t.address.toLowerCase() === target.toLowerCase()
    );
    const tokenSymbol = token?.symbol || 'TOKEN';

    if (tokenBalance >= transferAmount) {
      // Enough balance, direct transfer
      steps.push({
        type: 'execute',
        target,
        value: '0',
        data,
        description: `Transfer ${ethers.formatUnits(transferAmount, decimals)} ${tokenSymbol}`,
      });
      return { steps, needsSwap: false };
    }

    // Not enough! Need to swap AVAX -> this token first
    const shortfall = transferAmount - tokenBalance;

    // Add 30% buffer for price movement & DEX slippage (testnet pools are thin)
    const swapAmountNeeded = shortfall + (shortfall * 30n) / 100n;

    // Estimate AVAX needed using approximate price ($25)
    const avaxPriceUsd = 25;
    const usdNeeded =
      Number(swapAmountNeeded) / 10 ** decimals;
    const avaxNeeded = usdNeeded / avaxPriceUsd;
    // Add 20% buffer on AVAX side too (testnet DEX liquidity is low)
    const avaxWithBuffer = avaxNeeded * 1.2;
    const avaxWei = BigInt(
      Math.ceil(avaxWithBuffer * 1e18)
    );

    const swapDetails: SwapDetails = {
      fromToken: chainConfig.nativeSymbol,
      toToken: tokenSymbol,
      estimatedAmountIn: ethers.formatEther(avaxWei),
      estimatedAmountOut: ethers.formatUnits(swapAmountNeeded, decimals),
    };

    // Step 1: Swap AVAX -> Token
    steps.push({
      type: 'swap',
      target: chainConfig.swap.routerAddress,
      value: avaxWei.toString(),
      data: '', // will be built during execution
      description: `Auto-swap ${ethers.formatEther(avaxWei)} ${chainConfig.nativeSymbol} -> ${ethers.formatUnits(swapAmountNeeded, decimals)} ${tokenSymbol}`,
    });

    // Step 2: Transfer the token
    steps.push({
      type: 'execute',
      target,
      value: '0',
      data,
      description: `Transfer ${ethers.formatUnits(transferAmount, decimals)} ${tokenSymbol}`,
    });

    return { steps, needsSwap: true, swapDetails };
  }

  // Case 3: Generic contract call — just execute as-is
  steps.push({
    type: 'execute',
    target,
    value,
    data,
    description: 'Execute transaction',
  });
  return { steps, needsSwap: false };
}
