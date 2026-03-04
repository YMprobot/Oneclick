import type { Metadata } from 'next';
import { WalletProvider } from '@/context/WalletContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'OneClick — Smart Wallet',
  description: 'Universal smart wallet with passkey authentication for Avalanche L1s',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
