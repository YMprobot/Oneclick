'use client';

import { useState } from 'react';

interface CopyAddressProps {
  address: string;
}

export function CopyAddress({ address }: CopyAddressProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const display = address
    ? `${address.slice(0, 10)}...${address.slice(-8)}`
    : 'Pending deployment';

  return (
    <button
      onClick={handleCopy}
      disabled={!address}
      className="group relative inline-flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-2 font-mono text-sm text-gray-300 transition-colors hover:bg-gray-800 disabled:cursor-default disabled:opacity-60"
    >
      {display}
      <svg className="h-4 w-4 text-gray-500 transition-colors group-hover:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-gray-700 px-2 py-1 text-xs text-white whitespace-nowrap">
          Copied!
        </span>
      )}
    </button>
  );
}
