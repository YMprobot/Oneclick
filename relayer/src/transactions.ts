import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const TRANSACTIONS_FILE = join(DATA_DIR, 'transactions.json');

export interface SmartRouteStep {
  type: 'swap' | 'transfer' | 'execute';
  description: string;
  hash: string;
}

export interface TransactionRecord {
  id: string;
  walletAddress: string;
  target: string;
  value: string;
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  explorerUrl: string;
  hash: string;
  status: 'confirmed' | 'failed';
  timestamp: number;
  txType?: 'send' | 'swap' | 'smart-swap-send';
  smartRoute?: SmartRouteStep[];
}

const transactions: Map<string, TransactionRecord[]> = new Map();

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromDisk(): void {
  ensureDataDir();
  if (!existsSync(TRANSACTIONS_FILE)) {
    return;
  }
  try {
    const raw = readFileSync(TRANSACTIONS_FILE, 'utf-8');
    const data: Record<string, TransactionRecord[]> = JSON.parse(raw);
    for (const [address, records] of Object.entries(data)) {
      transactions.set(address, records);
    }
    const totalCount = Array.from(transactions.values()).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[transactions] Loaded ${totalCount} transactions for ${transactions.size} wallets from disk`);
  } catch (err) {
    console.error('[transactions] Failed to load transactions from disk:', err);
  }
}

function saveToDisk(): void {
  ensureDataDir();
  const data: Record<string, TransactionRecord[]> = {};
  for (const [address, records] of transactions.entries()) {
    data[address] = records;
  }
  try {
    writeFileSync(TRANSACTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[transactions] Failed to save transactions to disk:', err);
  }
}

// Load existing data on module init
loadFromDisk();

export function addTransaction(record: TransactionRecord): void {
  const key = record.walletAddress.toLowerCase();
  if (!transactions.has(key)) {
    transactions.set(key, []);
  }
  transactions.get(key)!.push(record);
  saveToDisk();
}

export function getTransactions(walletAddress: string, limit = 20): TransactionRecord[] {
  const key = walletAddress.toLowerCase();
  const records = transactions.get(key) || [];
  return records.slice(-limit).reverse();
}
