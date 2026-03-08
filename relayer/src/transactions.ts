import { ethers } from 'ethers';
import { getAllChains } from './chains.js';

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

// Explorer API base URLs per chain
const EXPLORER_API: Record<number, string> = {
  43113: 'https://api-testnet.snowtrace.io/api',
  43114: 'https://api.snowtrace.io/api',
  4337: 'https://api.routescan.io/v2/network/mainnet/evm/4337/etherscan/api',
};

// Known wallet method selectors
const WALLET_METHODS: Record<string, string> = {
  '0xda0980c7': 'execute',
  '0xfa70c138': 'executeWithWebAuthn',
  '0x198ae7ef': 'executeAsRelayer',
  '0xc908f766': 'deployWallet',
};

const walletIface = new ethers.Interface([
  'function execute(address target, uint256 value, bytes data, bytes signature)',
  'function executeWithWebAuthn(address target, uint256 value, bytes data, bytes authenticatorData, string clientDataJSON, bytes signature)',
  'function executeAsRelayer(address target, uint256 value, bytes data)',
]);

/** Decode wallet contract calldata to extract the real target and value. */
function decodeWalletCall(input: string): { target: string; value: string; txType: string } | null {
  const selector = input.slice(0, 10);
  const methodName = WALLET_METHODS[selector];
  if (!methodName || methodName === 'deployWallet') return null;

  try {
    const decoded = walletIface.decodeFunctionData(methodName, input);
    return {
      target: decoded[0] as string,
      value: (decoded[1] as bigint).toString(),
      txType: 'send',
    };
  } catch {
    return null;
  }
}

// In-memory cache for current session (survives redeploys for active session)
const sessionTxs: Map<string, TransactionRecord[]> = new Map();

/** Store a transaction from the current session (instant UI feedback). */
export function addTransaction(record: TransactionRecord): void {
  const key = record.walletAddress.toLowerCase();
  if (!sessionTxs.has(key)) {
    sessionTxs.set(key, []);
  }
  sessionTxs.get(key)!.push(record);
}

interface ExplorerTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  txreceipt_status: string;
  functionName: string;
  methodId: string;
  input: string;
}

/** Fetch transaction history from block explorer APIs. */
async function fetchOnChainTxs(walletAddress: string, limit: number): Promise<TransactionRecord[]> {
  const chains = getAllChains();
  const results: TransactionRecord[] = [];

  await Promise.all(
    chains.map(async (chain) => {
      const apiUrl = EXPLORER_API[chain.chainId];
      if (!apiUrl) return;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const url = `${apiUrl}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) return;

        const data: { status: string; result: ExplorerTx[] } = await res.json();
        if (data.status !== '1' || !Array.isArray(data.result)) return;

        for (const tx of data.result) {
          // Only show user-facing transactions (execute calls on the wallet)
          const decoded = tx.input ? decodeWalletCall(tx.input) : null;

          // Skip internal/service txs (deployWallet, unknown contract calls)
          if (!decoded) continue;

          const status = tx.isError === '0' && tx.txreceipt_status === '1' ? 'confirmed' : 'failed';

          results.push({
            id: `${chain.chainId}:${tx.hash}`,
            walletAddress,
            target: decoded.target,
            value: decoded.value,
            chainId: chain.chainId,
            chainName: chain.name,
            nativeSymbol: chain.nativeSymbol,
            explorerUrl: chain.explorerUrl,
            hash: tx.hash,
            status,
            timestamp: parseInt(tx.timeStamp, 10) * 1000,
            txType: 'send',
          });
        }
      } catch {
        // Explorer unavailable — skip this chain
      }
    })
  );

  return results;
}

/** Get transactions: merges on-chain history with current session records. */
export async function getTransactions(walletAddress: string, limit = 20): Promise<TransactionRecord[]> {
  const onChain = await fetchOnChainTxs(walletAddress, limit);

  // Merge session transactions (not yet indexed by explorer)
  const key = walletAddress.toLowerCase();
  const session = sessionTxs.get(key) || [];

  // Deduplicate by hash
  const seen = new Set<string>();
  const merged: TransactionRecord[] = [];

  // Session txs first (they have richer metadata like txType, smartRoute)
  for (const tx of session) {
    if (!seen.has(tx.hash)) {
      seen.add(tx.hash);
      merged.push(tx);
    }
  }
  for (const tx of onChain) {
    if (!seen.has(tx.hash)) {
      seen.add(tx.hash);
      merged.push(tx);
    }
  }

  // Sort newest first
  merged.sort((a, b) => b.timestamp - a.timestamp);
  return merged.slice(0, limit);
}
