'use client';

import { useRouter } from 'next/navigation';

interface QuickActionsProps {
  onReceive: () => void;
}

export function QuickActions({ onReceive }: QuickActionsProps) {
  const router = useRouter();

  return (
    <div className="flex gap-3">
      <button
        onClick={() => router.push('/send')}
        className="flex-1 rounded-xl bg-red-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-600"
      >
        Send
      </button>
      <button
        onClick={onReceive}
        className="flex-1 rounded-xl bg-gray-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
      >
        Receive
      </button>
      <button
        onClick={() => router.push('/swap')}
        className="flex-1 rounded-xl bg-gray-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
      >
        Swap
      </button>
    </div>
  );
}
