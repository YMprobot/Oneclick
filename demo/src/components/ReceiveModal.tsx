'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ReceiveModalProps {
  address: string;
  onClose: () => void;
}

export function ReceiveModal({ address, onClose }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-center text-xl font-bold text-white">Receive</h2>

        <div className="mb-4 flex justify-center">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={address} size={200} />
          </div>
        </div>

        <p className="mb-5 break-all text-center font-mono text-sm text-gray-400">
          {address}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleCopy}
            className="w-full rounded-xl bg-red-500 py-3 font-semibold text-white transition-colors hover:bg-red-600"
          >
            {copied ? 'Copied!' : 'Copy Address'}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-800 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
