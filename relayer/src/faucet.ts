import { ethers } from 'ethers';
import { getChain } from './chains.js';
import { isFunded, saveFunding } from './faucetStore.js';

const FAUCET_AVAX_AMOUNT = ethers.parseEther('1.0');
const FUJI_CHAIN_ID = 43113;

export interface FundResult {
  success: boolean;
  alreadyFunded?: boolean;
  avaxTxHash?: string | null;
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

  saveFunding(walletAddress, {
    fundedAt: new Date().toISOString(),
    avaxTxHash,
    usdcTxHash: null,
  });

  return { success: true, avaxTxHash };
}
