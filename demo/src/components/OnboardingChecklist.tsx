'use client';

import { useRouter } from 'next/navigation';

interface OnboardingChecklistProps {
  walletAddress: string;
  hasAssets: boolean;
  hasTransactions: boolean;
  onReceive: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
}

export function OnboardingChecklist({ hasAssets, hasTransactions, onReceive }: OnboardingChecklistProps) {
  const router = useRouter();

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
      completed: hasAssets,
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
            <div key={step.id} className="flex items-center gap-3">
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

              {/* Action button */}
              {!step.completed && isActive && step.action && (
                <button
                  onClick={step.action}
                  className="flex-shrink-0 rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  {step.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
