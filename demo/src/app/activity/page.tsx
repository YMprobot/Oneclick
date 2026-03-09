'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { RELAYER_URL } from '@/lib/constants';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { TransactionList } from '@/components/TransactionList';
import { Spinner } from '@/components/Spinner';

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
  txType?: 'send' | 'swap' | 'smart-swap-send';
  smartRoute?: { type: 'swap' | 'transfer' | 'execute'; description: string; hash: string }[];
}

export default function ActivityPage() {
  const { wallet, hydrated } = useWallet();
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!wallet?.address) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${RELAYER_URL}/transactions?walletAddress=${wallet.address}&limit=50`
      );
      if (res.ok) {
        const data: TransactionRecord[] = await res.json();
        setTransactions(data);
      }
    } catch {
      // Fetch failed — keep current state
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
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 15000);
    return () => clearInterval(interval);
  }, [wallet, hydrated, router, fetchTransactions]);

  if (!hydrated || !wallet) return null;

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <Header />

      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Activity</h1>

        <div className="rounded-2xl border border-gray-800/50 bg-gray-900/50 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-6 w-6 text-red-500" />
            </div>
          ) : (
            <TransactionList transactions={transactions} />
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
