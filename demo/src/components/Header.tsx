'use client';

import { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useRouter } from 'next/navigation';

export function Header() {
  const { wallet, disconnect } = useWallet();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  function handleDisconnect() {
    disconnect();
    router.push('/');
  }

  async function handleCopyAddress() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = wallet.address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shortAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : 'No wallet';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-lg font-bold tracking-tight transition-colors hover:text-red-400"
        >
          OneClick
        </button>
        {wallet && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyAddress}
              className="rounded-full bg-gray-800 px-3 py-1 font-mono text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              {copied ? 'Copied!' : shortAddress}
            </button>
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
