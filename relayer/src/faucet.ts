import { ethers } from 'ethers';
import { getChain } from './chains.js';
import { isFunded, saveFunding } from './faucetStore.js';

const FAUCET_AVAX_AMOUNT = ethers.parseEther('1.0');
const FAUCET_USDC_AMOUNT = 5_000_000n; // 5 USDC (6 decimals)
const TRADERJOE_TEST_USDC = '0xB6076C93701D6a07266c31066B298AeC6dd65c2d';
const FUJI_CHAIN_ID = 43113;

export interface FundResult {
  success: boolean;
  alreadyFunded?: boolean;
  avaxTxHash?: string | null;
  usdcTxHash?: string | null;
  error?: string;
}

export async function fundWallet(walletAddress: string): Promise<FundResult> {
  if (isFunded(walletAddress)) {
    return { success: true, alreadyFunded: true };
  }

  const chain = getChain(FUJI_CHAIN_ID);
  if (!chain) {
    return { success: false, error: 'Fuji chain not registered' };
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    return { success: false, error: 'Relayer private key not configured' };
  }

  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  let avaxTxHash: string | null = null;
  let usdcTxHash: string | null = null;

  // Step 1: Send 1 AVAX
  try {
    console.log(`[faucet] Sending 1 AVAX to ${walletAddress}...`);
    const avaxTx = await signer.sendTransaction({
      to: walletAddress,
      value: FAUCET_AVAX_AMOUNT,
    });
    const avaxReceipt = await avaxTx.wait();
    avaxTxHash = avaxReceipt?.hash || avaxTx.hash;
    console.log(`[faucet] AVAX sent: ${avaxTxHash}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[faucet] Failed to send AVAX: ${msg}`);
    return { success: false, error: `Failed to send AVAX: ${msg}` };
  }

  // Step 2: Mint 5 USDC (TraderJoe test token — public mint)
  try {
    console.log(`[faucet] Minting 5 USDC to ${walletAddress}...`);
    const usdcContract = new ethers.Contract(
      TRADERJOE_TEST_USDC,
      ['function mint(address to, uint256 amount)'],
      signer
    );
    const usdcTx = await usdcContract.mint(walletAddress, FAUCET_USDC_AMOUNT);
    const usdcReceipt = await usdcTx.wait();
    usdcTxHash = usdcReceipt?.hash || usdcTx.hash;
    console.log(`[faucet] USDC minted: ${usdcTxHash}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[faucet] mint() failed, trying transfer() fallback: ${msg}`);

    // Fallback: transfer from relayer's own USDC balance
    try {
      const usdcContract = new ethers.Contract(
        TRADERJOE_TEST_USDC,
        ['function transfer(address to, uint256 amount) returns (bool)'],
        signer
      );
      const transferTx = await usdcContract.transfer(walletAddress, FAUCET_USDC_AMOUNT);
      const transferReceipt = await transferTx.wait();
      usdcTxHash = transferReceipt?.hash || transferTx.hash;
      console.log(`[faucet] USDC transferred (fallback): ${usdcTxHash}`);
    } catch (fallbackErr) {
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error';
      console.error(`[faucet] USDC fallback also failed: ${fallbackMsg}`);
      // AVAX sent — save partial result to prevent re-funding
    }
  }

  // Save even if USDC failed (prevents infinite AVAX sends)
  saveFunding(walletAddress, {
    fundedAt: new Date().toISOString(),
    avaxTxHash,
    usdcTxHash,
  });

  return { success: true, avaxTxHash, usdcTxHash };
}
