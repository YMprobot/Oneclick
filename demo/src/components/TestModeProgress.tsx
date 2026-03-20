'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TestModeStep {
  id: string;
  label: string;
  completed: boolean;
  description: string;
  action: string;
}

interface TestModeProgressData {
  testModeActive: boolean;
  steps: TestModeStep[];
  completedCount: number;
  totalCount: number;
}

interface TestModeProgressProps {
  progress: TestModeProgressData;
}

const ACTION_LABELS: Record<string, string> = {
  '/send': 'Send →',
  '/swap': 'Swap →',
};

export function TestModeProgress({ progress }: TestModeProgressProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('oneclick_testmode_dismissed') === 'true';
  });

  if (dismissed) return null;

  const allComplete = progress.completedCount === progress.totalCount;

  // Completion state
  if (allComplete) {
    return (
      <div className="mb-6 rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Test Mode Complete!</h3>
            <p className="text-sm text-gray-400 mt-1">
              You&apos;ve learned the basics — sending, swapping, and Smart Route.
              The same experience works with real assets on Avalanche.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('oneclick_testmode_dismissed', 'true');
            setDismissed(true);
          }}
          className="rounded-xl bg-gray-800 px-5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const progressPercent = (progress.completedCount / progress.totalCount) * 100;

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/20 bg-gray-900/50 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Test Mode</h3>
        <span className="text-sm text-gray-400">
          {progress.completedCount}/{progress.totalCount} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden mb-5">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {progress.steps.map((step) => (
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
                <div className="h-7 w-7 rounded-full border-2 border-gray-600" />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                {step.label}
              </p>
              <p className={`text-xs ${step.completed ? 'text-gray-600' : 'text-gray-400'}`}>
                {step.description}
              </p>
            </div>

            {/* Action button */}
            {!step.completed && (
              <button
                onClick={() => router.push(step.action)}
                className="flex-shrink-0 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
              >
                {ACTION_LABELS[step.action] || 'Go →'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Tokens are for practice only
      </p>
    </div>
  );
}
