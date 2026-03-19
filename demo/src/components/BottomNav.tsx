'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { useCallback } from 'react';

interface Tab {
  label: string;
  path: string;
  icon: React.ComponentType<{ active: boolean }>;
  action?: () => void;
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { disconnect } = useWallet();

  const handleDisconnect = useCallback(() => {
    disconnect();
    router.push('/app');
  }, [disconnect, router]);

  const tabs: Tab[] = [
    { label: 'Home', path: '/dashboard', icon: HomeIcon },
    { label: 'Discover', path: '/discover', icon: DiscoverIcon },
    { label: 'Swap', path: '/swap', icon: SwapIcon },
    { label: 'Activity', path: '/activity', icon: ActivityIcon },
    { label: 'Log out', path: '', icon: LogoutIcon, action: handleDisconnect },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800/50 bg-gray-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map((tab) => {
          const active = !tab.action && pathname === tab.path;
          return (
            <button
              key={tab.label}
              onClick={tab.action ?? (() => router.push(tab.path))}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                active ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon active={active} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}

function SwapIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

function ActivityIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LogoutIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
