interface TransactionStatusProps {
  status: 'idle' | 'preparing' | 'signing' | 'submitting' | 'success' | 'error';
  txHash?: string;
  errorMessage?: string;
}

const STEPS = [
  { key: 'preparing', label: 'Prepare' },
  { key: 'signing', label: 'Sign' },
  { key: 'submitting', label: 'Submit' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

function stepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? (status === 'success' ? STEPS.length : -1) : idx;
}

export function TransactionStatus({ status, txHash, errorMessage }: TransactionStatusProps) {
  if (status === 'idle') return null;

  const current = stepIndex(status);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1">
        {STEPS.map((step, i) => {
          const completed = current > i || status === 'success';
          const active = status === step.key;
          const errored = status === 'error' && current === i;

          return (
            <div key={step.key} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 ${
                    errored
                      ? 'bg-red-500/20 text-red-400'
                      : completed
                        ? 'bg-green-500/20 text-green-400'
                        : active
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {errored ? '✕' : completed ? '✓' : i + 1}
                </div>
                <span
                  className={`text-xs ${
                    active ? 'text-white' : completed ? 'text-green-400' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mb-5 h-0.5 w-8 transition-all duration-200 ${
                    current > i ? 'bg-green-500/40' : 'bg-gray-800'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {status === 'preparing' && (
        <StatusCard variant="loading">Preparing transaction...</StatusCard>
      )}
      {status === 'signing' && (
        <StatusCard variant="loading">Confirm with fingerprint...</StatusCard>
      )}
      {status === 'submitting' && (
        <StatusCard variant="loading">Submitting transaction...</StatusCard>
      )}
      {status === 'success' && txHash && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center">
          <div className="mb-3 text-4xl">✓</div>
          <p className="mb-2 text-lg font-semibold text-green-400">Transaction confirmed!</p>
          <p className="mb-3 font-mono text-sm text-gray-400">
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
          <a
            href={`https://testnet.snowtrace.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-red-400 underline hover:text-red-300"
          >
            View on Snowtrace
          </a>
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <div className="mb-3 text-4xl">✕</div>
          <p className="text-sm text-red-400">{errorMessage || 'Something went wrong'}</p>
        </div>
      )}
    </div>
  );
}

function StatusCard({ variant, children }: { variant: 'loading'; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
      {variant === 'loading' && (
        <svg className="h-5 w-5 animate-spin text-red-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </div>
  );
}
