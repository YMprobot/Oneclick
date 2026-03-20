import { ethers } from 'ethers';
import { getAllChains } from './chains.js';

export interface SmartRouteStep {
  type: 'swap' | 'transfer' | 'execute';
  description: string;
  hash: string;
}

export interface SwapDetails {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
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
  swapDetails?: SwapDetails;
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

// Known DEX router addresses — if a wallet call targets one of these, it's a swap
const KNOWN_ROUTERS = new Set([
  '0xb4315e873dbcf96ffd0acd8ea43f689d8c20fb30', // TraderJoe LBRouter (Fuji + Mainnet)
]);

// Token address → symbol mapping for swap decoding
const TOKEN_SYMBOLS: Record<string, string> = {
  '0xd00ae08403b9bbb9124bb305c09058e32c39a48c': 'AVAX',  // WAVAX Fuji
  '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7': 'AVAX',  // WAVAX Mainnet
  '0xb6076c93701d6a07266c31066b298aec6dd65c2d': 'USDC',  // USDC Fuji (TraderJoe)
  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': 'USDC',  // USDC Mainnet
  '0xab231a5744c8e6c45481754928ccffffd4aa0732': 'USDT',  // USDT Fuji
  '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7': 'USDT',  // USDT Mainnet
};

// LBRouter function signatures for decoding inner calldata
const routerIface = new ethers.Interface([
  'function swapExactNATIVEForTokens(uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline)',
  'function swapExactTokensForNATIVE(uint256 amountIn, uint256 amountOutMinNATIVE, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline)',
]);

interface DecodedWalletCall {
  target: string;
  value: string;
  txType: string;
  swapDetails?: SwapDetails;
}

/** Try to decode LBRouter calldata to extract swap token path */
function decodeSwapDetails(innerData: string, nativeValue: bigint): SwapDetails | undefined {
  try {
    // Try swapExactNATIVEForTokens (AVAX → Token)
    const decoded = routerIface.decodeFunctionData('swapExactNATIVEForTokens', innerData);
    const tokenPath: string[] = decoded[1].tokenPath;
    if (tokenPath.length >= 2) {
      const toTokenAddr = tokenPath[tokenPath.length - 1].toLowerCase();
      const toSymbol = TOKEN_SYMBOLS[toTokenAddr] || 'TOKEN';
      return {
        fromToken: 'AVAX',
        toToken: toSymbol,
        fromAmount: (Number(nativeValue) / 1e18).toFixed(4),
        toAmount: '',
      };
    }
  } catch {
    // Not this function
  }

  try {
    // Try swapExactTokensForNATIVE (Token → AVAX)
    const decoded = routerIface.decodeFunctionData('swapExactTokensForNATIVE', innerData);
    const amountIn: bigint = decoded[0];
    const tokenPath: string[] = decoded[2].tokenPath;
    if (tokenPath.length >= 2) {
      const fromTokenAddr = tokenPath[0].toLowerCase();
      const fromSymbol = TOKEN_SYMBOLS[fromTokenAddr] || 'TOKEN';
      const decimals = ['USDC', 'USDT'].includes(fromSymbol) ? 6 : 18;
      return {
        fromToken: fromSymbol,
        toToken: 'AVAX',
        fromAmount: (Number(amountIn) / 10 ** decimals).toFixed(2),
        toAmount: '',
      };
    }
  } catch {
    // Not this function
  }

  return undefined;
}

/** Decode wallet contract calldata to extract the real target and value. */
function decodeWalletCall(input: string): DecodedWalletCall | null {
  const selector = input.slice(0, 10);
  const methodName = WALLET_METHODS[selector];
  if (!methodName || methodName === 'deployWallet') return null;

  try {
    const decoded = walletIface.decodeFunctionData(methodName, input);
    const target = decoded[0] as string;
    const value = decoded[1] as bigint;
    const innerData = decoded[2] as string;
    const isSwap = KNOWN_ROUTERS.has(target.toLowerCase());

    let swapDetails: SwapDetails | undefined;
    if (isSwap && innerData && innerData.length > 10) {
      swapDetails = decodeSwapDetails(innerData, value);
    }

    return {
      target,
      value: value.toString(),
      txType: isSwap ? 'swap' : 'send',
      swapDetails,
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
            txType: decoded.txType as TransactionRecord['txType'],
            swapDetails: decoded.swapDetails,
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
