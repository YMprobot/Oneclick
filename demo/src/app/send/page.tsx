'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { signChallenge } from '@/lib/webauthn';
import { RELAYER_URL } from '@/lib/constants';
import { avaxToWei, toSmallestUnit, fromSmallestUnit } from '@/lib/utils';
import { Header } from '@/components/Header';
import { TransactionStatus } from '@/components/TransactionStatus';

type FlowStatus = 'idle' | 'planning' | 'preparing' | 'signing' | 'swapping' | 'submitting' | 'success' | 'error';

interface ChainOption {
  name: string;
  chainId: number;
  nativeSymbol: string;
  explorerUrl: string;
}

interface TokenOption {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

interface SmartRouteStep {
  type: string;
  description: string;
  hash?: string;
}

interface TransactionPlan {
  needsSwap: boolean;
  steps: Array<{
    type: string;
    target: string;
    value: string;
    data: string;
    description: string;
  }>;
  swapDetails?: {
    fromToken: string;
    toToken: string;
    estimatedAmountIn: string;
    estimatedAmountOut: string;
  };
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

  // Token selection
  const [selectedToken, setSelectedToken] = useState<'native' | string>('native');
  const [chainTokens, setChainTokens] = useState<TokenOption[]>([]);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [isLoadingTokenBalance, setIsLoadingTokenBalance] = useState(false);

  const [status, setStatus] = useState<FlowStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [toError, setToError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [availableBalance, setAvailableBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Smart routing state
  const [plan, setPlan] = useState<TransactionPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [routeSteps, setRouteSteps] = useState<SmartRouteStep[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    if (!wallet) {
      router.push('/app');
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
      .catch(() => {});
  }, [wallet, hydrated, router]);

  // Fetch tokens for selected chain
  useEffect(() => {
    setSelectedToken('native');
    setChainTokens([]);
    setTokenBalance(null);
    setPlan(null);

    fetch(`${RELAYER_URL}/tokens?chainId=${chainId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TokenOption[]) => {
        if (Array.isArray(data)) {
          setChainTokens(data);
        }
      })
      .catch(() => {});
  }, [chainId]);

  // Fetch native balance
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
          const bal = Number(weiBalance) / 1e18;
          setAvailableBalance(bal.toFixed(4));
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

  // Fetch token balance when token changes
  useEffect(() => {
    if (selectedToken === 'native' || !wallet?.address) {
      setTokenBalance(null);
      return;
    }

    setIsLoadingTokenBalance(true);
    fetch(`${RELAYER_URL}/token-balances?walletAddress=${wallet.address}&chainId=${chainId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { symbol: string; balance: string; decimals: number }[]) => {
        const found = data.find((t) => t.symbol === selectedToken);
        if (found) {
          setTokenBalance(fromSmallestUnit(found.balance, found.decimals));
        } else {
          setTokenBalance('0.00');
        }
      })
      .catch(() => setTokenBalance(null))
      .finally(() => setIsLoadingTokenBalance(false));
  }, [selectedToken, wallet?.address, chainId]);

  // Fetch transaction plan when form changes (debounced)
  useEffect(() => {
    if (!wallet?.address || !isValidAddress(to) || !amount || selectedToken === 'native') {
      setPlan(null);
      return;
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setPlan(null);
      return;
    }

    const tokenConfig = chainTokens.find((t) => t.symbol === selectedToken);
    if (!tokenConfig) {
      setPlan(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingPlan(true);
      try {
        const sendValue = toSmallestUnit(amount, tokenConfig.decimals);
        const res = await fetch(`${RELAYER_URL}/transaction/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: wallet.address,
            target: to,
            value: sendValue,
            data: '0x',
            chainId,
            tokenAddress: tokenConfig.address,
            pubKeyX: wallet.pubKeyX,
            pubKeyY: wallet.pubKeyY,
          }),
        });
        if (res.ok) {
          const planData: TransactionPlan = await res.json();
          setPlan(planData);
        } else {
          setPlan(null);
        }
      } catch {
        setPlan(null);
      } finally {
        setIsLoadingPlan(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [wallet?.address, to, amount, selectedToken, chainId, chainTokens]);

  const currentChain = chains.find((c) => c.chainId === chainId);
  const currentTokenConfig = chainTokens.find((t) => t.symbol === selectedToken);
  const isNative = selectedToken === 'native';
  const displaySymbol = isNative ? (currentChain?.nativeSymbol || 'AVAX') : selectedToken;
  const displayDecimals = isNative ? 18 : (currentTokenConfig?.decimals || 6);
  const displayBalance = isNative ? availableBalance : tokenBalance;
  const isLoadingDisplayBalance = isNative ? isLoadingBalance : isLoadingTokenBalance;

  const GAS_BUFFER = 0.001;

  function handleMax() {
    if (!displayBalance) return;
    if (isNative) {
      const max = parseFloat(displayBalance) - GAS_BUFFER;
      if (max > 0) {
        setAmount(max.toFixed(4));
        setAmountError('');
      }
    } else {
      setAmount(displayBalance);
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
    setSelectedToken('native');
    setStatus('idle');
    setTxHash('');
    setErrorMessage('');
    setToError('');
    setAmountError('');
    setAvailableBalance(null);
    setTokenBalance(null);
    setPlan(null);
    setRouteSteps([]);
  }

  async function handleSend() {
    if (!wallet || !validate()) return;

    let sendValue: string;
    let tokenAddress: string | undefined;

    if (isNative) {
      sendValue = avaxToWei(amount);
      tokenAddress = undefined;
    } else {
      sendValue = toSmallestUnit(amount, displayDecimals);
      tokenAddress = currentTokenConfig?.address;
    }

    // Step A: Prepare — get challenge from relayer
    setStatus('preparing');
    setRouteSteps([]);

    let challengeHex: string;
    try {
      const res = await fetch(`${RELAYER_URL}/prepare-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          target: to,
          value: sendValue,
          data: '0x',
          chainId,
          tokenAddress,
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
        : err instanceof Error ? err.message : 'Failed to prepare transaction';
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

      // Step C: Submit (with smart routing)
      if (plan?.needsSwap) {
        setStatus('swapping');
      } else {
        setStatus('submitting');
      }

      const execRes = await fetch(`${RELAYER_URL}/execute-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          target: to,
          value: sendValue,
          data: '0x',
          chainId,
          tokenAddress,
          pubKeyX: wallet.pubKeyX,
          pubKeyY: wallet.pubKeyY,
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

      // Store smart route steps from response
      if (result.plan?.steps?.length > 0) {
        setRouteSteps(result.plan.steps);
      }

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

              {/* Token selector */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">Token</label>
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                >
                  <option value="native">
                    Native ({currentChain?.nativeSymbol || 'AVAX'})
                  </option>
                  {chainTokens.map((t) => (
                    <option key={t.address} value={t.symbol}>
                      {t.symbol} — {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-gray-400">Amount</label>
                  {isLoadingDisplayBalance ? (
                    <span className="text-xs text-gray-500">Loading balance...</span>
                  ) : displayBalance !== null ? (
                    <span className="text-xs text-gray-400">
                      Available: {displayBalance} {displaySymbol}
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                    placeholder="0.0"
                    step={isNative ? '0.0001' : '0.01'}
                    min="0"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 pr-28 text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {displayBalance !== null && parseFloat(displayBalance) > (isNative ? GAS_BUFFER : 0) && (
                      <button
                        type="button"
                        onClick={handleMax}
                        className="rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/30"
                      >
                        MAX
                      </button>
                    )}
                    <span className="text-sm text-gray-400">
                      {displaySymbol}
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
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Smart Route Preview */}
              {plan?.needsSwap && plan.swapDetails && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                      Smart Route
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-gray-300">
                    Insufficient {plan.swapDetails.toToken} balance. OneClick will automatically:
                  </p>
                  <div className="space-y-2">
                    {plan.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          step.type === 'swap'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-300">{step.description}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    You sign once — OneClick handles the rest
                  </p>
                </div>
              )}

              {isLoadingPlan && !isNative && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Checking route...
                </div>
              )}

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
                {plan?.needsSwap ? 'Sign & Smart Send' : 'Sign & Send'}
              </button>
            </div>
          )}

          {status !== 'idle' && (
            <div className="space-y-6">
              {/* Multi-step progress for smart routing */}
              {plan?.needsSwap && plan.steps.length > 0 ? (
                <SmartRouteProgress
                  steps={plan.steps.map((s) => s.description)}
                  currentStatus={status}
                  completedSteps={routeSteps}
                  explorerUrl={chains.find((c) => c.chainId === chainId)?.explorerUrl}
                />
              ) : (
                <TransactionStatus
                  status={status === 'swapping' ? 'submitting' : status === 'planning' ? 'preparing' : status}
                  txHash={txHash}
                  errorMessage={errorMessage}
                  explorerUrl={chains.find((c) => c.chainId === chainId)?.explorerUrl}
                />
              )}

              {/* Show all tx hashes on success */}
              {status === 'success' && routeSteps.length > 0 && !plan?.needsSwap && (
                <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Transaction Details</p>
                  {routeSteps.map((step, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-300">{step.description}</span>
                      {step.hash && (
                        <a
                          href={`${chains.find((c) => c.chainId === chainId)?.explorerUrl || ''}/tx/${step.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-red-400 hover:text-red-300"
                        >
                          {step.hash.slice(0, 8)}...{step.hash.slice(-6)}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
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
            &larr; Back to Dashboard
          </button>
        )}
      </main>
    </div>
  );
}

/** Multi-step progress component for smart routing */
function SmartRouteProgress({
  steps,
  currentStatus,
  completedSteps,
  explorerUrl,
}: {
  steps: string[];
  currentStatus: FlowStatus;
  completedSteps: SmartRouteStep[];
  explorerUrl?: string;
}) {
  const isSwapping = currentStatus === 'swapping';
  const isSubmitting = currentStatus === 'submitting';
  const isSuccess = currentStatus === 'success';
  const isError = currentStatus === 'error';
  const isSigning = currentStatus === 'signing';
  const isPreparing = currentStatus === 'preparing';

  return (
    <div className="space-y-4">
      {isPreparing && (
        <StatusMessage>Preparing smart transaction...</StatusMessage>
      )}
      {isSigning && (
        <StatusMessage>Confirm with fingerprint...</StatusMessage>
      )}

      {(isSwapping || isSubmitting || isSuccess || isError) && (
        <div className="space-y-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
              Smart Route
            </span>
            {isSuccess && (
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                Complete
              </span>
            )}
          </div>

          {steps.map((description, i) => {
            const completed = completedSteps[i]?.hash;
            const isActive = !completed && (
              (i === 0 && isSwapping) ||
              (i === 1 && isSubmitting) ||
              (i === completedSteps.length && (isSwapping || isSubmitting))
            );

            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  completed
                    ? 'border-green-500/20 bg-green-500/5'
                    : isActive
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-gray-800 bg-gray-900'
                }`}
              >
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  completed
                    ? 'bg-green-500/20 text-green-400'
                    : isActive
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-800 text-gray-500'
                }`}>
                  {completed ? '✓' : isActive ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (i + 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${completed ? 'text-green-400' : isActive ? 'text-white' : 'text-gray-500'}`}>
                    {description}
                  </p>
                  {completed && explorerUrl && (
                    <a
                      href={`${explorerUrl}/tx/${completedSteps[i].hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-red-400 hover:text-red-300"
                    >
                      {completedSteps[i].hash!.slice(0, 10)}...{completedSteps[i].hash!.slice(-8)}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isSuccess && !completedSteps.length && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center">
          <div className="mb-3 text-4xl">✓</div>
          <p className="text-lg font-semibold text-green-400">Transaction confirmed!</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <div className="mb-3 text-4xl">✕</div>
          <p className="text-sm text-red-400">Smart route failed. Please try again.</p>
        </div>
      )}
    </div>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
      <svg className="h-5 w-5 animate-spin text-red-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {children}
    </div>
  );
}
