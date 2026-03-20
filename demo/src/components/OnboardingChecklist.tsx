'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RELAYER_URL } from '@/lib/constants';
import { Spinner } from '@/components/Spinner';

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [show]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-300"
      >
        ?
      </button>
      {show && (
        <div className="absolute right-0 bottom-full mb-2 w-60 rounded-lg border border-gray-700 bg-gray-900 p-3 text-xs text-gray-300 shadow-xl z-10">
          {text}
        </div>
      )}
    </div>
  );
}

interface OnboardingChecklistProps {
  walletAddress: string;
  hasAssets: boolean;
  hasTransactions: boolean;
  onReceive: () => void;
  onTestModeActivated?: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
}

export function OnboardingChecklist({ walletAddress, hasAssets, hasTransactions, onReceive, onTestModeActivated }: OnboardingChecklistProps) {
  const router = useRouter();
  const [testModeFunded, setTestModeFunded] = useState(false);
  const [testModeLoading, setTestModeLoading] = useState(false);
  const [testModeError, setTestModeError] = useState<string | null>(null);

  const handleTestMode = async () => {
    setTestModeLoading(true);
    setTestModeError(null);

    try {
      const res = await fetch(`${RELAYER_URL}/faucet/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTestModeError(data.error || 'Failed to activate Test Mode');
        return;
      }

      // Success or alreadyFunded
      setTestModeFunded(true);
      onTestModeActivated?.();
    } catch {
      setTestModeError('Network error. Please try again.');
    } finally {
      setTestModeLoading(false);
    }
  };

  const fundStepComplete = hasAssets || testModeFunded;

  const steps: Step[] = [
    {
      id: 'create-wallet',
      title: 'Create your wallet',
      description: 'Signed up with fingerprint',
      completed: true,
    },
    {
      id: 'fund-wallet',
      title: 'Fund your wallet',
      description: 'Deposit AVAX to get started',
      completed: fundStepComplete,
      action: onReceive,
      actionLabel: 'Deposit',
    },
    {
      id: 'first-transaction',
      title: 'Make your first transaction',
      description: 'Send, swap, or explore dApps',
      completed: hasTransactions,
      action: () => router.push('/send'),
      actionLabel: 'Send',
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allCompleted = steps.every((s) => s.completed);

  if (allCompleted) return null;

  const firstIncompleteId = steps.find((s) => !s.completed)?.id;
  const isFundStepActive = firstIncompleteId === 'fund-wallet';

  return (
    <div className="mb-6 rounded-2xl border border-gray-800/50 bg-gray-900/50 p-5">
      <h2 className="text-lg font-bold text-white mb-3">Welcome to OneClick! 👋</h2>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-red-500 transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-400 whitespace-nowrap">
          {completedCount} of {steps.length} complete
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => {
          const isActive = step.id === firstIncompleteId;

          return (
            <div key={step.id}>
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="flex-shrink-0">
                  {step.completed ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/20">
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className={`h-7 w-7 rounded-full border-2 ${isActive ? 'border-gray-500' : 'border-gray-700'}`} />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${step.completed ? 'text-gray-300' : isActive ? 'text-white' : 'text-gray-500'}`}>
                    {step.title}
                  </p>
                  <p className={`text-xs ${step.completed ? 'text-gray-500' : isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                    {step.description}
                  </p>
                </div>

                {/* Action button (non-fund steps) */}
                {step.id !== 'fund-wallet' && !step.completed && isActive && step.action && (
                  <button
                    onClick={step.action}
                    className="flex-shrink-0 rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                  >
                    {step.actionLabel}
                  </button>
                )}
              </div>

              {/* Fund wallet step — Deposit + Test Mode buttons */}
              {step.id === 'fund-wallet' && isFundStepActive && !step.completed && (
                <div className="ml-10 mt-3 space-y-2.5">
                  {/* Deposit button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onReceive}
                      className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                    >
                      Deposit
                    </button>
                    <Tooltip text="Fund your wallet with AVAX, USDC, or USDT from another wallet or exchange. Once funded, you can send tokens and swap between assets." />
                  </div>

                  {/* Test Mode button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestMode}
                      disabled={testModeLoading}
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {testModeLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner />
                          Setting up test tokens...
                        </span>
                      ) : (
                        '... or Activate Test Mode — Get free test tokens'
                      )}
                    </button>
                    <Tooltip text="Get free practice tokens (1 AVAX + 5 USDC) on Fuji testnet. Perfect for first-timers — try sending, swapping, and Smart Route with zero risk." />
                  </div>

                  {testModeError && (
                    <p className="text-xs text-red-400">{testModeError}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
