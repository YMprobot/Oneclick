'use client';

import { useRouter } from 'next/navigation';

interface QuickActionsProps {
  onReceive: () => void;
  disabled?: boolean;
}

export function QuickActions({ onReceive, disabled }: QuickActionsProps) {
  const router = useRouter();

  return (
    <div className="flex gap-3">
      <button
        onClick={() => router.push('/send')}
        disabled={disabled}
        className="flex-1 rounded-xl bg-red-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Send
      </button>
      <button
        onClick={onReceive}
        disabled={disabled}
        className="flex-1 rounded-xl bg-gray-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Receive
      </button>
      <button
        onClick={() => router.push('/swap')}
        disabled={disabled}
        className="flex-1 rounded-xl bg-gray-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Swap
      </button>
    </div>
  );
}
