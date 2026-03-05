'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { RELAYER_URL } from '@/lib/constants';
import { Header } from '@/components/Header';
import { BalanceCard } from '@/components/BalanceCard';
import { CopyAddress } from '@/components/CopyAddress';
import { QuickActions } from '@/components/QuickActions';
import { TransactionList } from '@/components/TransactionList';

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

const MOCK_BALANCES: ChainBalance[] = [
  { chainName: 'Fuji C-Chain', chainId: 43113, balance: '2.5000', nativeSymbol: 'AVAX' },
];

export default function DashboardPage() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState('0.0000');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const fetchData = useCallback(async () => {
    if (!wallet?.address) {
      setBalances(MOCK_BALANCES);
      setTotalBalance(MOCK_BALANCES[0].balance);
      setIsDemoMode(true);
      setIsLoading(false);
      return;
    }

    try {
      const [balanceRes, chainsRes, txRes] = await Promise.all([
        fetch(`${RELAYER_URL}/balance?walletAddress=${wallet.address}`),
        fetch(`${RELAYER_URL}/chains`),
        fetch(`${RELAYER_URL}/transactions?walletAddress=${wallet.address}`),
      ]);

      if (balanceRes.ok && chainsRes.ok) {
        const balanceData: { chainId: number; balance: string }[] = await balanceRes.json();
        const chainsData: { chainId: number; name: string; nativeSymbol?: string }[] = await chainsRes.json();

        const balanceMap = new Map<number, string>();
        for (const entry of balanceData) {
          balanceMap.set(entry.chainId, entry.balance);
        }

        const chainBalances: ChainBalance[] = chainsData.map((chain) => {
          const weiBalance = balanceMap.get(chain.chainId) || '0';
          const tokenBalance = Number(weiBalance) / 1e18;
          return {
            chainName: chain.name,
            chainId: chain.chainId,
            balance: tokenBalance.toFixed(4),
            nativeSymbol: chain.nativeSymbol || 'AVAX',
          };
        });

        if (chainBalances.length > 0) {
          setBalances(chainBalances);
          const total = chainBalances.reduce((sum, c) => sum + parseFloat(c.balance), 0);
          setTotalBalance(total.toFixed(4));
          setIsDemoMode(false);
        } else {
          setBalances(MOCK_BALANCES);
          setTotalBalance(MOCK_BALANCES[0].balance);
          setIsDemoMode(true);
        }
      } else {
        throw new Error('Relayer response not ok');
      }

      if (txRes.ok) {
        const txData: TransactionRecord[] = await txRes.json();
        setTransactions(txData);
      }
    } catch {
      setBalances(MOCK_BALANCES);
      setTotalBalance(MOCK_BALANCES[0].balance);
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    if (!wallet) {
      router.push('/');
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [wallet, router, fetchData]);

  if (!wallet) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {isDemoMode && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-center text-sm text-yellow-400">
            Demo mode — connect relayer for live data
          </div>
        )}

        {/* Wallet hero card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-red-500/5">
          <div className="mb-1 text-center">
            {isLoading ? (
              <div className="mx-auto h-12 w-48 animate-pulse rounded bg-gray-800" />
            ) : (
              <p className="text-5xl font-bold">{totalBalance}</p>
            )}
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
              />
            ))
          )}
        </div>

        {/* Quick actions */}
        <QuickActions />

        {/* Recent activity */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Recent Transactions</h2>
          <TransactionList transactions={transactions} />
        </div>
      </main>
    </div>
  );
}
