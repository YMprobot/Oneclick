'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useRouter } from 'next/navigation';

export function Header() {
  const { wallet, testModeActive, disconnect } = useWallet();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleDisconnect = useCallback(() => {
    disconnect();
    router.push('/app');
  }, [disconnect, router]);

  const handleCopyAddress = useCallback(async () => {
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
  }, [wallet?.address]);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPopover]);

  const shortAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : 'No wallet';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800/50 bg-gray-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-lg font-bold tracking-tight transition-colors hover:text-red-400"
        >
          OneClick
        </button>
        {wallet && (
          <div className="flex items-center gap-2">
            {/* Test Mode Badge */}
            {testModeActive && (
              <div className="relative" ref={popoverRef}>
                <button
                  onClick={() => setShowPopover(!showPopover)}
                  className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/25"
                >
                  Test Mode
                </button>

                {showPopover && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-xl">
                    <h4 className="text-sm font-semibold text-white mb-2">You&apos;re in Test Mode</h4>
                    <p className="text-xs text-gray-400 mb-3">
                      Using Avalanche Fuji testnet. Tokens have no real value
                      and are for learning purposes only.
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      To use real assets, connect to Avalanche C-Chain mainnet.
                    </p>
                    <button
                      onClick={() => setShowPopover(false)}
                      className="rounded-lg bg-gray-800 px-4 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
                    >
                      Got it
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCopyAddress}
              className="rounded-full bg-gray-800/60 px-3 py-1 font-mono text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            >
              {copied ? 'Copied!' : shortAddress}
            </button>
            <button
              onClick={handleDisconnect}
              className="text-sm text-gray-500 transition-colors hover:text-white"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
