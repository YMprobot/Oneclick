'use client';

import { useWallet } from '@/context/WalletContext';
import { useRouter } from 'next/navigation';

export function Header() {
  const { wallet, disconnect } = useWallet();
  const router = useRouter();

  function handleDisconnect() {
    disconnect();
    router.push('/');
  }

  const shortAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : 'No wallet';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <span className="text-lg font-bold tracking-tight">OneClick</span>
        {wallet && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gray-800 px-3 py-1 font-mono text-xs text-gray-300">
              {shortAddress}
            </span>
            <button
              onClick={handleDisconnect}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
