import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const WALLETS_FILE = join(DATA_DIR, 'wallets.json');

interface WalletKeys {
  pubKeyX: string;
  pubKeyY: string;
}

// Maps wallet address (lowercase) -> { pubKeyX, pubKeyY }
const wallets: Map<string, WalletKeys> = new Map();

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromDisk(): void {
  ensureDataDir();
  if (!existsSync(WALLETS_FILE)) {
    return;
  }
  try {
    const raw = readFileSync(WALLETS_FILE, 'utf-8');
    const data: Record<string, WalletKeys> = JSON.parse(raw);
    for (const [address, keys] of Object.entries(data)) {
      wallets.set(address, keys);
    }
    console.log(`[walletStore] Loaded ${wallets.size} wallets from disk`);
  } catch (err) {
    console.error('[walletStore] Failed to load wallets from disk:', err);
  }
}

function saveToDisk(): void {
  ensureDataDir();
  const data: Record<string, WalletKeys> = {};
  for (const [address, keys] of wallets.entries()) {
    data[address] = keys;
  }
  try {
    writeFileSync(WALLETS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[walletStore] Failed to save wallets to disk:', err);
  }
}

// Load existing data on module init
loadFromDisk();

export function storeWallet(address: string, pubKeyX: string, pubKeyY: string): void {
  wallets.set(address.toLowerCase(), { pubKeyX, pubKeyY });
  saveToDisk();
}

export function getWalletKeys(address: string): WalletKeys | undefined {
  return wallets.get(address.toLowerCase());
}
