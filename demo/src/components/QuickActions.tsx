'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';

export function QuickActions() {
  const router = useRouter();
  const { wallet } = useWallet();
  const [showReceive, setShowReceive] = useState(false);

  const address = wallet?.address || '';

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/send')}
          className="flex-1 rounded-xl bg-red-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-600"
        >
          Send
        </button>
        <button
          onClick={() => setShowReceive((v) => !v)}
          className="flex-1 rounded-xl bg-gray-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
        >
          Receive
        </button>
        <button
          disabled
          title="Coming soon"
          className="flex-1 rounded-xl bg-gray-800 px-6 py-3 font-semibold text-white opacity-50 cursor-not-allowed"
        >
          Cross-chain
        </button>
      </div>

      {showReceive && address && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-2 text-xs text-gray-500 uppercase tracking-wider">Your Address</p>
          <p className="break-all font-mono text-sm text-gray-300">{address}</p>
        </div>
      )}
    </div>
  );
}
