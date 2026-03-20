import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import { getChain } from './chains.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const FAUCET_FILE = join(DATA_DIR, 'faucet.json');

const FAUCET_AVAX_AMOUNT = '1000000000000000000'; // 1 AVAX in wei
const FAUCET_USDC_AMOUNT = '5000000'; // 5 USDC (6 decimals)
const TRADERJOE_TEST_USDC = '0xB6076C93701D6a07266c31066B298AeC6dd65c2d';
const FUJI_CHAIN_ID = 43113;

interface FaucetRecord {
  fundedAt: string;
  txHashAvax: string | null;
  txHashUsdc: string | null;
}

interface FaucetData {
  fundedWallets: Record<string, FaucetRecord>;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFaucetData(): FaucetData {
  ensureDataDir();
  if (!existsSync(FAUCET_FILE)) {
    return { fundedWallets: {} };
  }
  try {
    const raw = readFileSync(FAUCET_FILE, 'utf-8');
    return JSON.parse(raw) as FaucetData;
  } catch {
    return { fundedWallets: {} };
  }
}

function saveFaucetData(data: FaucetData): void {
  ensureDataDir();
  try {
    writeFileSync(FAUCET_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[faucet] Failed to save faucet data:', err);
  }
}

export function isWalletFunded(walletAddress: string): boolean {
  const data = loadFaucetData();
  return walletAddress.toLowerCase() in data.fundedWallets;
}

export function getFaucetRecord(walletAddress: string): FaucetRecord | undefined {
  const data = loadFaucetData();
  return data.fundedWallets[walletAddress.toLowerCase()];
}

export interface FundResult {
  success: boolean;
  alreadyFunded?: boolean;
  avaxTxHash?: string | null;
  usdcTxHash?: string | null;
  error?: string;
}

export async function fundWallet(walletAddress: string): Promise<FundResult> {
  const addr = walletAddress.toLowerCase();

  // Check if already funded
  if (isWalletFunded(addr)) {
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
      value: BigInt(FAUCET_AVAX_AMOUNT),
    });
    const avaxReceipt = await avaxTx.wait();
    avaxTxHash = avaxReceipt?.hash || avaxTx.hash;
    console.log(`[faucet] AVAX sent: ${avaxTxHash}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[faucet] Failed to send AVAX: ${msg}`);
    return { success: false, error: `Failed to send AVAX: ${msg}` };
  }

  // Step 2: Mint 5 USDC (TraderJoe test token)
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
    console.error(`[faucet] Failed to mint USDC (trying transfer fallback): ${msg}`);

    // Fallback: transfer USDC from relayer's own balance
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
      console.error(`[faucet] USDC fallback transfer also failed: ${fallbackMsg}`);
      // AVAX was sent — save partial result so user can't re-trigger AVAX sends
    }
  }

  // Save to faucet.json (even if USDC failed)
  const data = loadFaucetData();
  data.fundedWallets[addr] = {
    fundedAt: new Date().toISOString(),
    txHashAvax: avaxTxHash,
    txHashUsdc: usdcTxHash,
  };
  saveFaucetData(data);

  return {
    success: true,
    avaxTxHash,
    usdcTxHash,
  };
}
