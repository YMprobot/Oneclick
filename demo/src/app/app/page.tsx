'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { createPasskey, signIn } from '@/lib/webauthn';
import { RELAYER_URL } from '@/lib/constants';
import { Spinner } from '@/components/Spinner';

export default function LoginPage() {
  const router = useRouter();
  const { setWallet } = useWallet();
  const [loading, setLoading] = useState<'create' | 'signin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deployAndRedirect(passkey: { credentialId: string; pubKeyX: string; pubKeyY: string }) {
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
  }

  async function handleCreateWallet() {
    setLoading('create');
    setError(null);

    try {
      const passkey = await createPasskey('oneclick-user');
      await deployAndRedirect(passkey);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create passkey';
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  async function handleSignIn() {
    setLoading('signin');
    setError(null);

    try {
      const passkey = await signIn();
      await deployAndRedirect(passkey);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-8 shadow-2xl shadow-red-500/5">
        <Link href="/" className="inline-block mb-4 text-sm text-gray-500 hover:text-gray-300 transition-colors">← Back</Link>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">OneClick</h1>
          <p className="mt-2 text-gray-400">One fingerprint. Every chain.</p>
        </div>

        <button
          onClick={handleCreateWallet}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-red-500 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading === 'create' ? (
            <>
              <Spinner />
              Creating wallet...
            </>
          ) : (
            <>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 10V3m0 0C10.343 3 9 4.343 9 6m3-3c1.657 0 3 1.343 3 3" />
                <path d="M7 10V8a5 5 0 0110 0v2" />
                <rect x="5" y="10" width="14" height="11" rx="2" />
              </svg>
              Create New Wallet
            </>
          )}
        </button>

        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="mt-3 w-full flex items-center justify-center gap-3 rounded-xl border border-gray-600 bg-transparent px-8 py-4 text-lg font-semibold text-white transition-colors hover:border-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading === 'signin' ? (
            <>
              <Spinner />
              Signing in...
            </>
          ) : (
            <>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                <path d="M12 14c-3 0-5.5 1.5-6 4h12c-.5-2.5-3-4-6-4z" />
                <path d="M15 8c0-1.657-.343-3-1-3" />
              </svg>
              Sign In to Existing Wallet
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
