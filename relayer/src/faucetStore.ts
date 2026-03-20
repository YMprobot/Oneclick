import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const FAUCET_FILE = join(DATA_DIR, 'faucet.json');

export interface FundingRecord {
  fundedAt: string;
  avaxTxHash: string | null;
  usdcTxHash: string | null;
}

type FaucetData = Record<string, FundingRecord>;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData(): FaucetData {
  ensureDataDir();
  if (!existsSync(FAUCET_FILE)) return {};
  try {
    return JSON.parse(readFileSync(FAUCET_FILE, 'utf-8')) as FaucetData;
  } catch {
    return {};
  }
}

function saveData(data: FaucetData): void {
  ensureDataDir();
  try {
    writeFileSync(FAUCET_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[faucetStore] Failed to save:', err);
  }
}

export function isFunded(address: string): boolean {
  const data = loadData();
  return address.toLowerCase() in data;
}

export function getFunding(address: string): FundingRecord | null {
  const data = loadData();
  return data[address.toLowerCase()] || null;
}

export function saveFunding(address: string, record: FundingRecord): void {
  const data = loadData();
  data[address.toLowerCase()] = record;
  saveData(data);
}
