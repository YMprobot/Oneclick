'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { createPasskey } from '@/lib/webauthn';
import { RELAYER_URL } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const { setWallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateWallet() {
    setLoading(true);
    setError(null);

    try {
      const passkey = await createPasskey('oneclick-user');

      let address = '';

      try {
        const res = await fetch(`${RELAYER_URL}/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubKeyX: passkey.pubKeyX,
            pubKeyY: passkey.pubKeyY,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          address = data.walletAddress || '';
        }
      } catch {
        // Relayer unavailable — proceed with local wallet data
      }

      setWallet({
        address,
        pubKeyX: passkey.pubKeyX,
        pubKeyY: passkey.pubKeyY,
        credentialId: passkey.credentialId,
        isConnected: true,
      });

      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create passkey';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-8 shadow-2xl shadow-red-500/5">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">OneClick</h1>
          <p className="mt-2 text-gray-400">One fingerprint. Every chain.</p>
        </div>

        <button
          onClick={handleCreateWallet}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-red-500 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating wallet...
            </>
          ) : (
            <>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 10V3m0 0C10.343 3 9 4.343 9 6m3-3c1.657 0 3 1.343 3 3" />
                <path d="M7 10V8a5 5 0 0110 0v2" />
                <rect x="5" y="10" width="14" height="11" rx="2" />
              </svg>
              Create Wallet with Fingerprint
            </>
          )}
        </button>

        {error && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}

        <p className="mt-8 text-center text-xs text-gray-600">
          Powered by Avalanche
        </p>
      </div>
    </main>
  );
}
