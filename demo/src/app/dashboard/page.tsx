'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { RELAYER_URL } from '@/lib/constants';
import { BottomNav } from '@/components/BottomNav';
import { AssetList } from '@/components/AssetList';
import type { Asset } from '@/components/AssetList';
import { DistributionBar } from '@/components/DistributionBar';
import { QuickActions } from '@/components/QuickActions';
import { ReceiveModal } from '@/components/ReceiveModal';
import { TransactionList } from '@/components/TransactionList';
import { Spinner } from '@/components/Spinner';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { ComingSoonCards } from '@/components/ComingSoonCards';

interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
}

interface ChainBalance {
  chainName: string;
  chainId: number;
  balance: string;
  nativeSymbol: string;
}

interface TransactionRecord {
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Timeout in ms before showing deploy error. */
const DEPLOY_TIMEOUT_MS = 60_000;

export default function DashboardPage() {
  const { wallet, hydrated, setTestModeActive } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [tokenBalances, setTokenBalances] = useState<Record<number, TokenBalance[]>>({});
  const [deployTimedOut, setDeployTimedOut] = useState(false);

  const isDeploying = wallet?.address === '';
  const deployTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deploy timeout: if address stays empty for 60s, show error
  useEffect(() => {
    if (isDeploying) {
      deployTimerRef.current = setTimeout(() => {
        setDeployTimedOut(true);
      }, DEPLOY_TIMEOUT_MS);
    } else {
      // Address resolved — clear timer and reset
      if (deployTimerRef.current) {
        clearTimeout(deployTimerRef.current);
        deployTimerRef.current = null;
      }
      setDeployTimedOut(false);
    }

    return () => {
      if (deployTimerRef.current) {
        clearTimeout(deployTimerRef.current);
      }
    };
  }, [isDeploying]);

  const fetchData = useCallback(async () => {
    if (!wallet?.address) {
      setIsLoading(false);
      return;
    }

    try {
      const [balanceRes, chainsRes, txRes, pricesRes] = await Promise.all([
        fetch(`${RELAYER_URL}/balance?walletAddress=${wallet.address}`),
        fetch(`${RELAYER_URL}/chains`),
        fetch(`${RELAYER_URL}/transactions?walletAddress=${wallet.address}`),
        fetch(`${RELAYER_URL}/prices`).catch(() => null),
      ]);

      if (pricesRes?.ok) {
        try {
          const pricesData: { prices: Record<string, number> } = await pricesRes.json();
          const priceMap: Record<number, number> = {};
          for (const [chainIdStr, price] of Object.entries(pricesData.prices)) {
            priceMap[Number(chainIdStr)] = price;
          }
          setPrices(priceMap);
        } catch {
          // Price parse error — skip
        }
      }

      if (balanceRes.ok && chainsRes.ok) {
        const balanceData: { chainId: number; balance: string }[] = await balanceRes.json();
        const chainsData: { chainId: number; name: string; nativeSymbol?: string }[] = await chainsRes.json();

        const balanceMap = new Map<number, string>();
        for (const entry of balanceData) {
          balanceMap.set(entry.chainId, entry.balance);
        }

        const chainBalances: ChainBalance[] = chainsData.map((chain) => {
          const weiBalance = balanceMap.get(chain.chainId) || '0';
          const nativeBalance = Number(weiBalance) / 1e18;
          return {
            chainName: chain.name,
            chainId: chain.chainId,
            balance: nativeBalance.toFixed(4),
            nativeSymbol: chain.nativeSymbol || 'AVAX',
          };
        });

        setBalances(chainBalances);

        if (wallet?.address && chainsData.length > 0) {
          const tokenResults: Record<number, TokenBalance[]> = {};
          await Promise.all(
            chainsData.map(async (chain) => {
              try {
                const tokenRes = await fetch(
                  `${RELAYER_URL}/token-balances?walletAddress=${wallet.address}&chainId=${chain.chainId}`
                );
                if (tokenRes.ok) {
                  const data: TokenBalance[] = await tokenRes.json();
                  if (data.length > 0) {
                    tokenResults[chain.chainId] = data;
                  }
                }
              } catch {
                // Skip
              }
            })
          );
          setTokenBalances(tokenResults);
        }
      }

      if (txRes.ok) {
        const txData: TransactionRecord[] = await txRes.json();
        setTransactions(txData);
      }
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
      setBalances([]);
    } finally {
      setIsLoading(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    if (!hydrated) return;
    if (!wallet) {
      router.push('/app');
      return;
    }
    // Don't fetch data while deploying (address is empty)
    if (!wallet.address) return;

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [wallet, hydrated, router, fetchData]);

  // Build per-chain asset list (no aggregation — each token on each chain is a separate row)
  const { assets, totalUsd, segments } = useMemo(() => {
    const list: Asset[] = [];

    // Native tokens — one row per chain
    for (const chain of balances) {
      const bal = parseFloat(chain.balance);
      if (bal <= 0) continue;
      const price = prices[chain.chainId] || 0;
      list.push({
        symbol: chain.nativeSymbol,
        amount: bal.toFixed(4),
        usdValue: bal * price,
        color: chain.nativeSymbol,
        chainName: chain.chainName,
      });
    }

    // ERC20 tokens — one row per token per chain
    for (const [chainIdStr, tokens] of Object.entries(tokenBalances)) {
      const chainId = Number(chainIdStr);
      const chain = balances.find((b) => b.chainId === chainId);
      for (const t of tokens) {
        const bal = Number(t.balance) / Math.pow(10, t.decimals);
        if (bal <= 0) continue;
        const isStable = ['USDC', 'USDT', 'DAI'].includes(t.symbol);
        const usd = isStable ? bal : bal * (prices[chainId] || 0);
        list.push({
          symbol: t.symbol,
          amount: bal.toFixed(2),
          usdValue: usd,
          color: t.symbol,
          chainName: chain?.chainName,
        });
      }
    }

    list.sort((a, b) => b.usdValue - a.usdValue);
    const totalUsd = list.reduce((sum, a) => sum + a.usdValue, 0);

    // Distribution bar segments — aggregate by symbol for the bar
    const symbolTotals = new Map<string, number>();
    for (const a of list) {
      symbolTotals.set(a.symbol, (symbolTotals.get(a.symbol) || 0) + a.usdValue);
    }
    const segments = Array.from(symbolTotals.entries())
      .filter(([, usd]) => usd > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([symbol, usd]) => ({
        label: symbol,
        percent: totalUsd > 0 ? (usd / totalUsd) * 100 : 0,
        color: symbol,
      }));

    return { assets: list, totalUsd, segments };
  }, [balances, prices, tokenBalances]);

  if (!hydrated || !wallet) return null;

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <main className="mx-auto max-w-lg px-4 pt-8">
        {/* Deploy in progress banner */}
        {isDeploying && !deployTimedOut && (
          <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Spinner />
              <p className="text-sm font-medium text-blue-400">Setting up your wallet...</p>
            </div>
            <p className="text-xs text-gray-500">This usually takes a few seconds</p>
          </div>
        )}

        {/* Deploy timeout error */}
        {isDeploying && deployTimedOut && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center">
            <p className="text-sm font-medium text-red-400 mb-1">Something went wrong</p>
            <p className="text-xs text-gray-500 mb-4">Wallet setup is taking too long. Please try again.</p>
            <button
              onClick={() => router.push('/app')}
              className="rounded-xl bg-red-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
            >
              Back to login
            </button>
          </div>
        )}

        {/* Greeting + Balance */}
        <div className="mb-6">
          <p className="mb-1 text-sm text-gray-400">{getGreeting()}</p>
          {isLoading || isDeploying ? (
            <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-800" />
          ) : (
            <p className="text-4xl font-bold tracking-tight">
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>

        {/* Distribution bar */}
        {!isLoading && !isDeploying && segments.length > 0 && (
          <div className="mb-8">
            <DistributionBar segments={segments} />
          </div>
        )}

        {/* Quick actions — disabled while deploying */}
        <div className="mb-6">
          <QuickActions onReceive={() => setShowReceiveModal(true)} disabled={isDeploying} />
        </div>

        {/* Onboarding checklist — shows only for empty wallets */}
        {!isLoading && !isDeploying && (
          <OnboardingChecklist
            walletAddress={wallet.address}
            hasAssets={totalUsd > 0}
            hasTransactions={transactions.length > 0}
            onReceive={() => setShowReceiveModal(true)}
            onTestModeActivated={() => {
              fetchData();
              setTestModeActive(true);
            }}
          />
        )}

        {/* Asset list */}
        <div className="mb-6 rounded-2xl border border-gray-800/50 bg-gray-900/50 p-2">
          {isLoading || isDeploying ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gray-800" />
                  <div className="flex-1">
                    <div className="h-4 w-16 animate-pulse rounded bg-gray-800" />
                    <div className="mt-1 h-3 w-24 animate-pulse rounded bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AssetList assets={assets} />
          )}
        </div>

        {/* Coming Soon features */}
        {!isLoading && !isDeploying && <ComingSoonCards />}

        {/* Recent transactions */}
        <div className="rounded-2xl border border-gray-800/50 bg-gray-900/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Activity</h2>
          <TransactionList transactions={transactions} />
        </div>

        {showReceiveModal && (
          <ReceiveModal
            address={wallet.address}
            onClose={() => setShowReceiveModal(false)}
          />
        )}
      </main>

      <BottomNav />
    </div>
  );
}
