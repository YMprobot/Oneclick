import type { Metadata } from 'next';
import { WalletProvider } from '@/context/WalletContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'OneClick — One Fingerprint. Every Asset.',
  description: 'Avalanche-native wallet onboarding SDK. Passkey login, sponsored gas, cross-chain routing. No seed phrases, no network switching. Built for Beam gaming and Avalanche L1 apps.',
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
