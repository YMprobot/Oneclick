'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { signChallenge } from '@/lib/webauthn';
import { RELAYER_URL } from '@/lib/constants';
import { avaxToWei, generateFakeTxHash } from '@/lib/utils';
import { Header } from '@/components/Header';
import { TransactionStatus } from '@/components/TransactionStatus';

type FlowStatus = 'idle' | 'preparing' | 'signing' | 'submitting' | 'success' | 'error';

interface ChainOption {
  name: string;
  chainId: number;
  nativeSymbol: string;
  explorerUrl: string;
}

const DEFAULT_CHAINS: ChainOption[] = [
  { name: 'Avalanche C-Chain', chainId: 43114, nativeSymbol: 'AVAX', explorerUrl: 'https://snowtrace.io' },
  { name: 'BEAM', chainId: 4337, nativeSymbol: 'BEAM', explorerUrl: 'https://subnets.avax.network/beam' },
  { name: 'Fuji C-Chain', chainId: 43113, nativeSymbol: 'AVAX', explorerUrl: 'https://testnet.snowtrace.io' },
];

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export default function SendPage() {
  const { wallet, hydrated } = useWallet();
  const router = useRouter();

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [chainId, setChainId] = useState(43114);
  const [chains, setChains] = useState<ChainOption[]>(DEFAULT_CHAINS);

  const [status, setStatus] = useState<FlowStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [toError, setToError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [availableBalance, setAvailableBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!wallet) {
      router.push('/');
      return;
    }

    fetch(`${RELAYER_URL}/chains`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: ChainOption[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setChains(data.map((c) => ({
            name: c.name,
            chainId: c.chainId,
            nativeSymbol: c.nativeSymbol || 'AVAX',
            explorerUrl: c.explorerUrl || '',
          })));
        }
      })
      .catch(() => {
        // Keep default chains
      });
  }, [wallet, hydrated, router]);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    setIsLoadingBalance(true);
    try {
      const res = await fetch(
        `${RELAYER_URL}/balance?walletAddress=${wallet.address}&chainId=${chainId}`
      );
      if (res.ok) {
        const data: { chainId: number; balance: string }[] = await res.json();
        if (data.length > 0) {
          const weiBalance = data[0].balance;
          const tokenBalance = Number(weiBalance) / 1e18;
          setAvailableBalance(tokenBalance.toFixed(4));
        }
      }
    } catch {
      setAvailableBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [wallet?.address, chainId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const GAS_BUFFER = 0.001;

  function handleMax() {
    if (!availableBalance) return;
    const max = parseFloat(availableBalance) - GAS_BUFFER;
    if (max > 0) {
      setAmount(max.toFixed(4));
      setAmountError('');
    }
  }

  if (!hydrated || !wallet) return null;

  function validate(): boolean {
    let valid = true;

    if (!isValidAddress(to)) {
      setToError('Enter a valid 0x address (42 characters)');
      valid = false;
    } else {
      setToError('');
    }

    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setAmountError('Enter an amount greater than 0');
      valid = false;
    } else {
      setAmountError('');
    }

    return valid;
  }

  function resetForm() {
    setTo('');
    setAmount('');
    setChainId(43114);
    setStatus('idle');
    setTxHash('');
    setErrorMessage('');
    setIsDemoMode(false);
    setToError('');
    setAmountError('');
    setAvailableBalance(null);
  }

  async function handleSend() {
    if (!wallet || !validate()) return;

    const weiValue = avaxToWei(amount);

    // Step A: Prepare
    setStatus('preparing');
    setIsDemoMode(false);
    let demoMode = false;

    let challengeHex: string;
    try {
      const res = await fetch(`${RELAYER_URL}/prepare-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          target: to,
          value: weiValue,
          data: '0x',
          chainId,
        }),
      });

      if (!res.ok) throw new Error('Failed to prepare transaction');
      const data = await res.json();
      challengeHex = data.challenge;
    } catch {
      // Demo mode: generate a fake challenge
      demoMode = true;
      setIsDemoMode(true);
      challengeHex = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Step B: Sign with passkey
    setStatus('signing');
    try {
      const cleanHex = challengeHex.startsWith('0x') ? challengeHex.slice(2) : challengeHex;
      const challengeBytes = new Uint8Array(
        cleanHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      const signature = await signChallenge(wallet.credentialId, challengeBytes);

      // Step C: Submit
      setStatus('submitting');

      if (demoMode) {
        // Simulate network delay, then show success
        await new Promise((resolve) => setTimeout(resolve, 800));
        setTxHash(generateFakeTxHash());
        setStatus('success');
        return;
      }

      const execRes = await fetch(`${RELAYER_URL}/execute-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          target: to,
          value: weiValue,
          data: '0x',
          chainId,
          signature: {
            r: signature.r,
            s: signature.s,
            authenticatorData: signature.authenticatorData,
            clientDataJSON: signature.clientDataJSON,
          },
        }),
      });

      if (!execRes.ok) {
        const errorBody = await execRes.json().catch(() => null);
        throw new Error(errorBody?.error || `Transaction failed (${execRes.status})`);
      }
      const result = await execRes.json();
      setTxHash(result.hash);
      setIsDemoMode(false);
      setStatus('success');
    } catch (err) {
      console.error('Transaction failed:', err);
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setErrorMessage(msg);
      setStatus('error');
    }
  }

  const isProcessing = status !== 'idle' && status !== 'success' && status !== 'error';

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-red-500/5">
          <h1 className="mb-6 text-2xl font-bold">Send Transaction</h1>

          {status === 'idle' && (
            <div className="space-y-5">
              {/* To address */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">To Address</label>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); setToError(''); }}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                {toError && <p className="mt-1 text-xs text-red-400">{toError}</p>}
              </div>

              {/* Amount */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-gray-400">Amount</label>
                  {isLoadingBalance ? (
                    <span className="text-xs text-gray-500">Loading balance...</span>
                  ) : availableBalance !== null ? (
                    <span className="text-xs text-gray-400">
                      Available: {availableBalance} {chains.find((c) => c.chainId === chainId)?.nativeSymbol || 'AVAX'}
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                    placeholder="0.0"
                    step="0.0001"
                    min="0"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 pr-28 text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {availableBalance !== null && parseFloat(availableBalance) > GAS_BUFFER && (
                      <button
                        type="button"
                        onClick={handleMax}
                        className="rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/30"
                      >
                        MAX
                      </button>
                    )}
                    <span className="text-sm text-gray-400">
                      {chains.find((c) => c.chainId === chainId)?.nativeSymbol || 'AVAX'}
                    </span>
                  </div>
                </div>
                {amountError && <p className="mt-1 text-xs text-red-400">{amountError}</p>}
              </div>

              {/* Chain select */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">Chain</label>
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                >
                  {chains.map((c) => (
                    <option key={c.chainId} value={c.chainId}>
                      ⛰️ {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit */}
              <button
                onClick={handleSend}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-500 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 10V3m0 0C10.343 3 9 4.343 9 6m3-3c1.657 0 3 1.343 3 3" />
                  <path d="M7 10V8a5 5 0 0110 0v2" />
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                </svg>
                Sign &amp; Send
              </button>
            </div>
          )}

          {status !== 'idle' && (
            <div className="space-y-6">
              <TransactionStatus
                status={status}
                txHash={txHash}
                errorMessage={errorMessage}
                explorerUrl={chains.find((c) => c.chainId === chainId)?.explorerUrl}
              />

              {isDemoMode && status === 'success' && (
                <p className="text-center text-xs text-yellow-400">
                  Demo mode — transaction simulated
                </p>
              )}

              {(status === 'success' || status === 'error') && (
                <div className="flex gap-3">
                  <button
                    onClick={resetForm}
                    className="flex-1 rounded-xl bg-gray-800 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
                  >
                    {status === 'error' ? 'Try Again' : 'Send Another'}
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 rounded-xl bg-gray-800 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
                  >
                    Dashboard
                  </button>
                </div>
              )}

              {isProcessing && (
                <p className="text-center text-xs text-gray-500">
                  Do not close this page while the transaction is processing.
                </p>
              )}
            </div>
          )}
        </div>

        {status === 'idle' && (
          <button
            onClick={() => router.push('/dashboard')}
            className="block w-full text-center text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            ← Back to Dashboard
          </button>
        )}
      </main>
    </div>
  );
}
