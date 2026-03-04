'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface WalletState {
  address: string;
  pubKeyX: string;
  pubKeyY: string;
  credentialId: string;
  isConnected: boolean;
}

interface WalletContextType {
  wallet: WalletState | null;
  setWallet: (wallet: WalletState) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<WalletState | null>(null);

  const setWallet = (w: WalletState) => setWalletState({ ...w, isConnected: true });
  const disconnect = () => setWalletState(null);

  return (
    <WalletContext.Provider value={{ wallet, setWallet, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
