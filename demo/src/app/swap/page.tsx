'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { signChallenge } from '@/lib/webauthn';
import { RELAYER_URL } from '@/lib/constants';
import { avaxToWei, fromSmallestUnit, toSmallestUnit } from '@/lib/utils';
import { Header } from '@/components/Header';
import { TransactionStatus } from '@/components/TransactionStatus';
import { Spinner } from '@/components/Spinner';

type FlowStatus = 'idle' | 'preparing' | 'signing' | 'submitting' | 'success' | 'error';

interface ChainOption {
  name: string;
  chainId: number;
  nativeSymbol: string;
  explorerUrl: string;
  swap?: {
    routerAddress: string;
    tokens: { symbol: string; address: string; decimals: number }[];
  };
}

interface SwapQuote {
  estimatedOutput: string;
  estimatedOutputRaw: string;
  minimumOutput: string;
  minimumOutputRaw: string;
  slippage: number;
  priceImpact: string;
  route: string;
}

const SLIPPAGE_OPTIONS = [0.005, 0.01, 0.02, 0.05];

const DEFAULT_SWAP_CHAINS: ChainOption[] = [
  {
    name: 'Fuji C-Chain',
    chainId: 43113,
    nativeSymbol: 'AVAX',
    explorerUrl: 'https://testnet.snowtrace.io',
    swap: {
      routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
      tokens: [
        { symbol: 'USDC', address: '0xB6076C93701D6a07266c31066B298AeC6dd65c2d', decimals: 6 },
        { symbol: 'USDT', address: '0xAb231A5744C8E6c45481754928cCfFFFD4aa0732', decimals: 6 },
      ],
    },
  },
  {
    name: 'Avalanche C-Chain',
    chainId: 43114,
    nativeSymbol: 'AVAX',
    explorerUrl: 'https://snowtrace.io',
    swap: {
      routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
      tokens: [
        { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
        { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6 },
      ],
    },
  },
];

export default function SwapPage() {
  const { wallet, hydrated } = useWallet();
  const router = useRouter();

  const [chains, setChains] = useState<ChainOption[]>(DEFAULT_SWAP_CHAINS);
  const [chainId, setChainId] = useState<number>(43113);
  const [fromToken, setFromToken] = useState('AVAX');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.01);

  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, { balance: string; decimals: number }>>({});
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const [status, setStatus] = useState<FlowStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const currentChain = chains.find((c) => c.chainId === chainId);
  const swapTokens = currentChain?.swap?.tokens || [];
  const nativeSymbol = currentChain?.nativeSymbol || 'AVAX';

  // Available tokens for selection: native + swap tokens
  const availableTokens = [nativeSymbol, ...swapTokens.map((t) => t.symbol)];

  // Fetch swap-capable chains
  useEffect(() => {
    if (!hydrated) return;
    if (!wallet) {
      router.push('/app');
      return;
    }

    fetch(`${RELAYER_URL}/chains`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: ChainOption[]) => {
        const swapChains = data.filter((c) => c.swap);
        if (swapChains.length > 0) {
          setChains(swapChains);
          setChainId((prev) => {
            if (swapChains.some((c) => c.chainId === prev)) return prev;
            return swapChains[0].chainId;
          });
        }
      })
      .catch(() => {});
  }, [wallet, hydrated, router, chainId]);

  // Reset tokens when chain changes
  useEffect(() => {
    if (!currentChain) return;
    const ns = currentChain.nativeSymbol || 'AVAX';
    const firstToken = currentChain.swap?.tokens?.[0]?.symbol || 'USDC';
    setFromToken(ns);
    setToToken(firstToken);
    setQuote(null);
    setAmount('');
  }, [chainId, currentChain]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!wallet?.address || !chainId) return;
    setIsLoadingBalance(true);
    try {
      const [balRes, tokenRes] = await Promise.all([
        fetch(`${RELAYER_URL}/balance?walletAddress=${wallet.address}&chainId=${chainId}`),
        fetch(`${RELAYER_URL}/token-balances?walletAddress=${wallet.address}&chainId=${chainId}`),
      ]);

      if (balRes.ok) {
        const balData: { balance: string }[] = await balRes.json();
        if (balData.length > 0) {
          const bal = Number(balData[0].balance) / 1e18;
          setNativeBalance(bal.toFixed(4));
        }
      }

      if (tokenRes.ok) {
        const tokenData: { symbol: string; balance: string; decimals: number }[] = await tokenRes.json();
        const map: Record<string, { balance: string; decimals: number }> = {};
        for (const t of tokenData) {
          map[t.symbol] = { balance: fromSmallestUnit(t.balance, t.decimals), decimals: t.decimals };
        }
        setTokenBalances(map);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingBalance(false);
    }
  }, [wallet?.address, chainId]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Fetch quote when amount changes
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !chainId || !fromToken || !toToken) {
      setQuote(null);
      return;
    }

    const isFromNative = fromToken === nativeSymbol;
    const fromTokenConfig = swapTokens.find((t) => t.symbol === fromToken);
    const fromDecimals = isFromNative ? 18 : (fromTokenConfig?.decimals || 6);
    const amountRaw = isFromNative ? avaxToWei(amount) : toSmallestUnit(amount, fromDecimals);

    setIsLoadingQuote(true);
    const controller = new AbortController();

    fetch(`${RELAYER_URL}/swap/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId, fromToken, toToken, amount: amountRaw }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SwapQuote | null) => {
        if (data) setQuote(data);
      })
      .catch(() => {})
      .finally(() => setIsLoadingQuote(false));

    return () => controller.abort();
  }, [amount, chainId, fromToken, toToken, nativeSymbol, swapTokens]);

  function getBalance(token: string): string | null {
    if (token === nativeSymbol) return nativeBalance;
    return tokenBalances[token]?.balance || null;
  }

  function handleMax() {
    const bal = getBalance(fromToken);
    if (!bal) return;
    if (fromToken === nativeSymbol) {
      const max = parseFloat(bal) - 0.001;
      if (max > 0) setAmount(max.toFixed(4));
    } else {
      setAmount(bal);
    }
  }

  function handleReverse() {
    const prevFrom = fromToken;
    setFromToken(toToken);
    setToToken(prevFrom);
    setAmount('');
    setQuote(null);
  }

  async function handleSwap() {
    if (!wallet || !amount || parseFloat(amount) <= 0) return;

    const isFromNative = fromToken === nativeSymbol;
    const fromTokenConfig = swapTokens.find((t) => t.symbol === fromToken);
    const fromDecimals = isFromNative ? 18 : (fromTokenConfig?.decimals || 6);
    const amountRaw = isFromNative ? avaxToWei(amount) : toSmallestUnit(amount, fromDecimals);

    // Step A: Prepare — get challenge from relayer
    setStatus('preparing');

    let challengeHex: string;
    try {
      const res = await fetch(`${RELAYER_URL}/prepare-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          target: currentChain?.swap?.routerAddress || '0x0000000000000000000000000000000000000000',
          value: isFromNative ? amountRaw : '0',
          data: '0x',
          chainId,
          pubKeyX: wallet.pubKeyX,
          pubKeyY: wallet.pubKeyY,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || `Relayer error (${res.status})`);
      }
      const data = await res.json();
      challengeHex = data.challenge;
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
      const msg = isNetworkError
        ? 'Relayer unavailable — make sure the relayer is running'
        : err instanceof Error ? err.message : 'Failed to prepare swap';
      setErrorMessage(msg);
      setStatus('error');
      return;
    }

    // Step B: Sign with passkey
    setStatus('signing');
    try {
      const cleanHex = challengeHex.startsWith('0x') ? challengeHex.slice(2) : challengeHex;
      const challengeBytes = new Uint8Array(
        cleanHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      const signature = await signChallenge(wallet.credentialId, challengeBytes);

      // Step C: Execute swap
      setStatus('submitting');

      const execRes = await fetch(`${RELAYER_URL}/swap/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId,
          walletAddress: wallet.address,
          pubKeyX: wallet.pubKeyX,
          pubKeyY: wallet.pubKeyY,
          fromToken,
          toToken,
          amount: amountRaw,
          slippage,
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
        throw new Error(errorBody?.error || `Swap failed (${execRes.status})`);
      }

      const result = await execRes.json();
      setTxHash(result.txHash);
      setStatus('success');
    } catch (err) {
      console.error('Swap failed:', err);
      const msg = err instanceof Error ? err.message : 'Swap failed';
      setErrorMessage(msg);
      setStatus('error');
    }
  }

  function resetForm() {
    setAmount('');
    setQuote(null);
    setStatus('idle');
    setTxHash('');
    setErrorMessage('');
    fetchBalances();
  }

  if (!hydrated || !wallet) return null;

  const isProcessing = status !== 'idle' && status !== 'success' && status !== 'error';
  const fromBalance = getBalance(fromToken);
  const toBalance = getBalance(toToken);
  const canSwap = amount && parseFloat(amount) > 0 && fromToken !== toToken;

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-red-500/5">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Swap</h1>
            {/* Slippage settings */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Slippage</span>
              <div className="flex gap-1">
                {SLIPPAGE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlippage(s)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                      slippage === s
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {(s * 100).toFixed(1)}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {status === 'idle' && (
            <div className="space-y-3">
              {/* Chain selector */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">Chain</label>
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                >
                  {chains.map((c) => (
                    <option key={c.chainId} value={c.chainId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From token */}
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-400">From</span>
                  {isLoadingBalance ? (
                    <span className="text-xs text-gray-500">Loading...</span>
                  ) : fromBalance !== null ? (
                    <span className="text-xs text-gray-400">
                      Balance: {fromBalance} {fromToken}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.001"
                    min="0"
                    className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-gray-600"
                  />
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {fromBalance !== null && parseFloat(fromBalance) > 0 && (
                      <button
                        onClick={handleMax}
                        className="rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/30"
                      >
                        MAX
                      </button>
                    )}
                    <select
                      value={fromToken}
                      onChange={(e) => {
                        setFromToken(e.target.value);
                        if (e.target.value === toToken) {
                          const other = availableTokens.find((t) => t !== e.target.value);
                          if (other) setToToken(other);
                        }
                        setQuote(null);
                      }}
                      className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-semibold text-white outline-none"
                    >
                      {availableTokens.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Swap direction arrow */}
              <div className="flex justify-center">
                <button
                  onClick={handleReverse}
                  className="rounded-full border border-gray-700 bg-gray-800 p-2 text-gray-400 transition-colors hover:border-red-500 hover:text-red-400"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 16V4m0 12l-3-3m3 3l3-3" />
                    <path d="M17 8v12m0-12l3 3m-3-3l-3 3" />
                  </svg>
                </button>
              </div>

              {/* To token */}
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-400">To</span>
                  {toBalance !== null && (
                    <span className="text-xs text-gray-400">
                      Balance: {toBalance} {toToken}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-2xl font-semibold">
                    {isLoadingQuote ? (
                      <span className="text-gray-500">Loading...</span>
                    ) : quote ? (
                      <span className="text-white">{quote.estimatedOutput}</span>
                    ) : (
                      <span className="text-gray-600">0.0</span>
                    )}
                  </div>
                  <select
                    value={toToken}
                    onChange={(e) => {
                      setToToken(e.target.value);
                      if (e.target.value === fromToken) {
                        const other = availableTokens.find((t) => t !== e.target.value);
                        if (other) setFromToken(other);
                      }
                      setQuote(null);
                    }}
                    className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-semibold text-white outline-none"
                  >
                    {availableTokens
                      .filter((t) => t !== fromToken)
                      .map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Quote details */}
              {quote && (
                <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-3 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Rate</span>
                    <span>{quote.route}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Minimum received</span>
                    <span>{quote.minimumOutput} {toToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Slippage tolerance</span>
                    <span>{(slippage * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price impact</span>
                    <span>{quote.priceImpact}%</span>
                  </div>
                </div>
              )}

              {/* Swap button */}
              <button
                onClick={handleSwap}
                disabled={!canSwap}
                className={`flex w-full items-center justify-center gap-3 rounded-xl py-4 text-lg font-semibold transition-colors ${
                  canSwap
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'cursor-not-allowed bg-gray-800 text-gray-500'
                }`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 10V3m0 0C10.343 3 9 4.343 9 6m3-3c1.657 0 3 1.343 3 3" />
                  <path d="M7 10V8a5 5 0 0110 0v2" />
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                </svg>
                {fromToken === toToken ? 'Select different tokens' : 'Sign & Swap'}
              </button>
            </div>
          )}

          {status !== 'idle' && (
            <div className="space-y-6">
              <TransactionStatus
                status={status}
                txHash={txHash}
                errorMessage={errorMessage}
                explorerUrl={currentChain?.explorerUrl}
              />

              {(status === 'success' || status === 'error') && (
                <div className="flex gap-3">
                  <button
                    onClick={resetForm}
                    className="flex-1 rounded-xl bg-gray-800 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
                  >
                    {status === 'error' ? 'Try Again' : 'Swap Again'}
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
                  Do not close this page while the swap is processing.
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
            &larr; Back to Dashboard
          </button>
        )}
      </main>
    </div>
  );
}
