'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RELAYER_URL } from '@/lib/constants';

const STORAGE_KEY = 'oneclick:wallet';
const TEST_MODE_KEY = 'oneclick:testmode';

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
  testModeActive: boolean;
  onboardingSkipped: boolean;
  setTestModeActive: (v: boolean) => void;
  setOnboardingSkipped: (v: boolean) => void;
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

function loadTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(TEST_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<WalletState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [testModeActive, setTestModeActiveState] = useState(false);
  const [onboardingSkipped, setOnboardingSkippedState] = useState(false);

  // Hydrate from sessionStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = loadWallet();
    if (stored) setWalletState(stored);
    setTestModeActiveState(loadTestMode());
    setHydrated(true);
  }, []);

  // Check faucet status when wallet address becomes available
  useEffect(() => {
    if (!wallet?.address) return;
    // Skip if already known from sessionStorage
    if (testModeActive) return;

    fetch(`${RELAYER_URL}/faucet/status?walletAddress=${wallet.address}`)
      .then((r) => r.json())
      .then((data: { funded: boolean; onboardingSkipped?: boolean }) => {
        if (data.funded) {
          setTestModeActiveState(true);
          try { sessionStorage.setItem(TEST_MODE_KEY, 'true'); } catch { /* noop */ }
        }
        if (data.onboardingSkipped) {
          setOnboardingSkippedState(true);
        }
      })
      .catch(() => {});
  }, [wallet?.address, testModeActive]);

  const setTestModeActive = (v: boolean) => {
    setTestModeActiveState(v);
    try { sessionStorage.setItem(TEST_MODE_KEY, v ? 'true' : 'false'); } catch { /* noop */ }
  };

  const setOnboardingSkipped = (v: boolean) => {
    setOnboardingSkippedState(v);
    if (wallet?.address) {
      const endpoint = v ? '/onboarding/skip' : '/onboarding/resume';
      fetch(`${RELAYER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet.address }),
      }).catch(() => {});
    }
  };

  const setWallet = (w: WalletState) => {
    const state = { ...w, isConnected: true };
    setWalletState(state);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
  };

  const disconnect = () => {
    setWalletState(null);
    setTestModeActiveState(false);
    setOnboardingSkippedState(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TEST_MODE_KEY);
    } catch { /* noop */ }
  };

  return (
    <WalletContext.Provider value={{ wallet, hydrated, testModeActive, onboardingSkipped, setTestModeActive, setOnboardingSkipped, setWallet, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
