'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'oneclick:wallet';

interface WalletState {
  address: string;
  pubKeyX: string;
  pubKeyY: string;
  credentialId: string;
  isConnected: boolean;
}

interface WalletContextType {
  wallet: WalletState | null;
  hydrated: boolean;
  setWallet: (wallet: WalletState) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function loadWallet(): WalletState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as WalletState;
  } catch {
    // ignore parse errors
  }
  return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<WalletState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = loadWallet();
    if (stored) setWalletState(stored);
    setHydrated(true);
  }, []);

  const setWallet = (w: WalletState) => {
    const state = { ...w, isConnected: true };
    setWalletState(state);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
  };
  const disconnect = () => {
    setWalletState(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  };

  return (
    <WalletContext.Provider value={{ wallet, hydrated, setWallet, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
