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
}

const transactions: Map<string, TransactionRecord[]> = new Map();

export function addTransaction(record: TransactionRecord): void {
  const key = record.walletAddress.toLowerCase();
  if (!transactions.has(key)) {
    transactions.set(key, []);
  }
  transactions.get(key)!.push(record);
}

export function getTransactions(walletAddress: string, limit = 20): TransactionRecord[] {
  const key = walletAddress.toLowerCase();
  const records = transactions.get(key) || [];
  return records.slice(-limit).reverse();
}
