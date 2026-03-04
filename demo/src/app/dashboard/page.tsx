'use client';

import { useWallet } from '@/context/WalletContext';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { wallet, disconnect } = useWallet();
  const router = useRouter();

  if (!wallet) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No wallet connected</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-xl bg-red-500 px-6 py-3 font-semibold text-white hover:bg-red-600 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  function handleDisconnect() {
    disconnect();
    router.push('/');
  }

  const shortAddress = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : 'Pending deployment';

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={handleDisconnect}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Disconnect
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Wallet Address</p>
            <p className="font-mono text-sm">{shortAddress}</p>
          </div>

          <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Balance</p>
            <p className="text-3xl font-bold">0.00 <span className="text-lg text-gray-400">AVAX</span></p>
          </div>

          <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Public Key</p>
            <p className="font-mono text-xs text-gray-400 break-all">
              x: {wallet.pubKeyX}
            </p>
            <p className="font-mono text-xs text-gray-400 break-all mt-1">
              y: {wallet.pubKeyY}
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-600">
          Powered by Avalanche
        </p>
      </div>
    </main>
  );
}
