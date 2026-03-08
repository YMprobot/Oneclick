'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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

export default function DashboardPage() {
  const { wallet, hydrated } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [tokenBalances, setTokenBalances] = useState<Record<number, TokenBalance[]>>({});

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
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [wallet, hydrated, router, fetchData]);

  // Build unified asset list
  const { assets, totalUsd, segments } = useMemo(() => {
    const assetMap = new Map<string, Asset>();

    // Native tokens per chain
    for (const chain of balances) {
      const bal = parseFloat(chain.balance);
      if (bal <= 0) continue;
      const price = prices[chain.chainId] || 0;
      const usd = bal * price;
      const symbol = chain.nativeSymbol;

      const existing = assetMap.get(symbol);
      if (existing) {
        const prevAmount = parseFloat(existing.amount);
        assetMap.set(symbol, {
          ...existing,
          amount: (prevAmount + bal).toFixed(4),
          usdValue: existing.usdValue + usd,
        });
      } else {
        assetMap.set(symbol, {
          symbol,
          amount: bal.toFixed(4),
          usdValue: usd,
          color: symbol,
        });
      }
    }

    // ERC20 tokens
    for (const [chainIdStr, tokens] of Object.entries(tokenBalances)) {
      const chainId = Number(chainIdStr);
      for (const t of tokens) {
        const bal = Number(t.balance) / Math.pow(10, t.decimals);
        if (bal <= 0) continue;
        // Stablecoins = $1 per token
        const isStable = ['USDC', 'USDT', 'DAI'].includes(t.symbol);
        const usd = isStable ? bal : bal * (prices[chainId] || 0);

        const existing = assetMap.get(t.symbol);
        if (existing) {
          const prevAmount = parseFloat(existing.amount);
          assetMap.set(t.symbol, {
            ...existing,
            amount: (prevAmount + bal).toFixed(2),
            usdValue: existing.usdValue + usd,
          });
        } else {
          assetMap.set(t.symbol, {
            symbol: t.symbol,
            amount: bal.toFixed(2),
            usdValue: usd,
            color: t.symbol,
          });
        }
      }
    }

    const assets = Array.from(assetMap.values()).sort((a, b) => b.usdValue - a.usdValue);
    const totalUsd = assets.reduce((sum, a) => sum + a.usdValue, 0);

    const segments = assets
      .filter((a) => a.usdValue > 0)
      .map((a) => ({
        label: a.symbol,
        percent: totalUsd > 0 ? (a.usdValue / totalUsd) * 100 : 0,
        color: a.symbol,
      }));

    return { assets, totalUsd, segments };
  }, [balances, prices, tokenBalances]);

  if (!hydrated || !wallet) return null;

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <main className="mx-auto max-w-lg px-4 pt-8">
        {/* Greeting + Balance */}
        <div className="mb-6">
          <p className="mb-1 text-sm text-gray-400">{getGreeting()}</p>
          {isLoading ? (
            <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-800" />
          ) : (
            <p className="text-4xl font-bold tracking-tight">
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>

        {/* Distribution bar */}
        {!isLoading && segments.length > 0 && (
          <div className="mb-8">
            <DistributionBar segments={segments} />
          </div>
        )}

        {/* Quick actions */}
        <div className="mb-6">
          <QuickActions onReceive={() => setShowReceiveModal(true)} />
        </div>

        {/* Asset list */}
        <div className="mb-6 rounded-2xl border border-gray-800/50 bg-gray-900/50 p-2">
          {isLoading ? (
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
