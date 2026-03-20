'use client';

import { useState } from 'react';
import { RELAYER_URL } from '@/lib/constants';
import { Spinner } from '@/components/Spinner';

interface TestModeCardProps {
  walletAddress: string;
  onActivated: () => void;
}

export function TestModeCard({ walletAddress, onActivated }: TestModeCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${RELAYER_URL}/faucet/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to activate Test Mode');
        return;
      }

      // Success or alreadyFunded — both are fine
      onActivated();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-lg">
          🎯
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Try OneClick for free</h3>
          <p className="text-sm text-gray-400 mt-1">
            Get test tokens and learn how to send, swap, and use Smart Route — all in under 2 minutes.
          </p>
        </div>
      </div>

      <button
        onClick={handleActivate}
        disabled={loading}
        className="w-full rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Setting up...
          </span>
        ) : (
          'Activate Test Mode'
        )}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Uses practice tokens with no real value
      </p>
    </div>
  );
}
