'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { RELAYER_URL } from '@/lib/constants';
import { Header } from '@/components/Header';
import { BalanceCard } from '@/components/BalanceCard';
import { CopyAddress } from '@/components/CopyAddress';
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

const COINGECKO_IDS: Record<number, string> = {
  43113: 'avalanche-2',
  43114: 'avalanche-2',
  4337: 'beam-2',
};

export default function DashboardPage() {
  const { wallet, hydrated } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState('0.0000');
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
      const [balanceRes, chainsRes, txRes, priceRes] = await Promise.all([
        fetch(`${RELAYER_URL}/balance?walletAddress=${wallet.address}`),
        fetch(`${RELAYER_URL}/chains`),
        fetch(`${RELAYER_URL}/transactions?walletAddress=${wallet.address}`),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2,beam-2&vs_currencies=usd')
          .catch(() => null),
      ]);

      // Parse CoinGecko prices
      if (priceRes?.ok) {
        try {
          const priceData = await priceRes.json();
          const priceMap: Record<number, number> = {};
          for (const [chainIdStr, geckoId] of Object.entries(COINGECKO_IDS)) {
            priceMap[Number(chainIdStr)] = priceData[geckoId]?.usd || 0;
          }
          setPrices(priceMap);
        } catch {
          // CoinGecko parse error — skip USD display
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

        setBalances(chainBalances.length > 0 ? chainBalances : []);
        const total = chainBalances.reduce((sum, c) => sum + parseFloat(c.balance), 0);
        setTotalBalance(total.toFixed(4));

        // Fetch token balances for each chain (uses already-parsed chainsData)
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
                // Skip token balances for this chain
              }
            })
          );
          setTokenBalances(tokenResults);
        }
      } else {
        console.error('Relayer response not ok:', {
          balance: balanceRes.status,
          chains: chainsRes.status,
        });
        throw new Error('Relayer response not ok');
      }

      if (txRes.ok) {
        const txData: TransactionRecord[] = await txRes.json();
        setTransactions(txData);
      }
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
      // Show empty state instead of fake data
      setBalances([]);
      setTotalBalance('0.0000');
    } finally {
      setIsLoading(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    if (!hydrated) return;
    if (!wallet) {
      router.push('/');
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [wallet, hydrated, router, fetchData]);

  if (!hydrated || !wallet) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Wallet hero card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-red-500/5">
          <div className="mb-1 text-center">
            {isLoading ? (
              <div className="mx-auto h-12 w-48 animate-pulse rounded bg-gray-800" />
            ) : (() => {
              const totalUsd = balances.reduce((sum, b) => {
                const price = prices[b.chainId] || 0;
                return sum + parseFloat(b.balance) * price;
              }, 0);
              const hasPrices = Object.keys(prices).length > 0 && totalUsd > 0;

              return hasPrices ? (
                <>
                  <p className="text-4xl font-bold">${totalUsd.toFixed(2)}</p>
                  <p className="mt-1 text-sm text-gray-400">{totalBalance} tokens</p>
                </>
              ) : (
                <p className="text-5xl font-bold">{totalBalance}</p>
              );
            })()}
          </div>
          <p className="mb-5 text-center text-sm text-gray-500">Total across all chains</p>

          <div className="mb-4 flex justify-center">
            <CopyAddress address={wallet.address} />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {balances.map((chain) => (
              <span
                key={chain.chainId}
                className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300"
              >
                ⛰️ {chain.chainName}
              </span>
            ))}
            {isLoading && (
              <div className="h-6 w-28 animate-pulse rounded-full bg-gray-800" />
            )}
          </div>
        </div>

        {/* Chain balances grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {isLoading ? (
            <>
              <div className="h-28 animate-pulse rounded-2xl border border-gray-800 bg-gray-900" />
              <div className="h-28 animate-pulse rounded-2xl border border-gray-800 bg-gray-900" />
            </>
          ) : (
            balances.map((chain) => (
              <BalanceCard
                key={chain.chainId}
                chainName={chain.chainName}
                chainId={chain.chainId}
                balance={chain.balance}
                nativeSymbol={chain.nativeSymbol}
                isLoading={false}
                usdPrice={prices[chain.chainId]}
                tokens={tokenBalances[chain.chainId]}
              />
            ))
          )}
        </div>

        {/* Quick actions */}
        <QuickActions onReceive={() => setShowReceiveModal(true)} />

        {showReceiveModal && (
          <ReceiveModal
            address={wallet.address}
            onClose={() => setShowReceiveModal(false)}
          />
        )}

        {/* Recent activity */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Recent Transactions</h2>
          <TransactionList transactions={transactions} />
        </div>
      </main>
    </div>
  );
}
