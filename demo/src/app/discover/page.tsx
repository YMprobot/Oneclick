'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { BottomNav } from '@/components/BottomNav';

type IntegrationStatus = 'live' | 'coming-soon' | 'none';

interface DApp {
  id: string;
  name: string;
  description: string;
  category: 'DeFi' | 'Gaming' | 'RWA' | 'Infrastructure' | 'NFT';
  url: string;
  logo: string;
  tags: string[];
  featured?: boolean;
  integrationStatus: IntegrationStatus;
}

const DAPPS: DApp[] = [
  {
    id: 'trader-joe',
    name: 'Trader Joe',
    description: 'Leading DEX on Avalanche with Liquidity Book',
    category: 'DeFi',
    url: 'https://traderjoexyz.com',
    logo: '🔄',
    tags: ['DEX', 'Swap'],
    featured: true,
    integrationStatus: 'none',
  },
  {
    id: 'benqi',
    name: 'BENQI',
    description: 'Lending & liquid staking protocol',
    category: 'DeFi',
    url: 'https://benqi.fi',
    logo: '🏦',
    tags: ['Lending', 'Staking'],
    featured: true,
    integrationStatus: 'none',
  },
  {
    id: 'dexalot',
    name: 'Dexalot',
    description: 'Central limit order book DEX on its own L1',
    category: 'DeFi',
    url: 'https://dexalot.com',
    logo: '📊',
    tags: ['DEX', 'Orderbook'],
    integrationStatus: 'none',
  },
  {
    id: 'gogopool',
    name: 'GoGoPool',
    description: 'Permissionless staking for Avalanche validators',
    category: 'DeFi',
    url: 'https://gogopool.com',
    logo: '🏊',
    tags: ['Staking', 'Validators'],
    integrationStatus: 'none',
  },
  {
    id: 'stargate',
    name: 'Stargate',
    description: 'Cross-chain bridge powered by LayerZero',
    category: 'DeFi',
    url: 'https://stargate.finance',
    logo: '🌉',
    tags: ['Bridge', 'Cross-chain'],
    integrationStatus: 'none',
  },
  {
    id: 'beam',
    name: 'BEAM',
    description: 'Gaming-focused L1 by Merit Circle',
    category: 'Gaming',
    url: 'https://beam.gg',
    logo: '🎮',
    tags: ['L1', 'Gaming'],
    featured: true,
    integrationStatus: 'coming-soon',
  },
  {
    id: 'shrapnel',
    name: 'Shrapnel',
    description: 'AAA FPS game on its own Avalanche L1',
    category: 'Gaming',
    url: 'https://shrapnel.com',
    logo: '💥',
    tags: ['FPS', 'AAA'],
    integrationStatus: 'none',
  },
  {
    id: 'off-the-grid',
    name: 'Off The Grid',
    description: 'Battle royale on GUNZ L1',
    category: 'Gaming',
    url: 'https://offthegrid.fun',
    logo: '🔫',
    tags: ['Battle Royale', 'GUNZ'],
    integrationStatus: 'none',
  },
  {
    id: 'securitize',
    name: 'Securitize',
    description: 'Tokenized real-world assets & BlackRock BUIDL',
    category: 'RWA',
    url: 'https://securitize.io',
    logo: '🏛️',
    tags: ['Tokenization', 'Bonds'],
    featured: true,
    integrationStatus: 'none',
  },
  {
    id: 'intain',
    name: 'IntainMARKETS',
    description: 'Structured finance marketplace on Avalanche',
    category: 'RWA',
    url: 'https://intain.io',
    logo: '📋',
    tags: ['Structured Finance'],
    integrationStatus: 'none',
  },
  {
    id: 'the-arena',
    name: 'Arena',
    description: 'Social platform on Avalanche',
    category: 'Infrastructure',
    url: 'https://arena.social',
    logo: '🏟️',
    tags: ['Social'],
    integrationStatus: 'none',
  },
];

type CategoryFilter = 'All' | DApp['category'];

const CATEGORIES: CategoryFilter[] = ['All', 'DeFi', 'Gaming', 'RWA', 'Infrastructure'];

export default function DiscoverPage() {
  const { wallet, hydrated, testModeActive } = useWallet();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('All');
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!wallet) {
      router.push('/app');
      return;
    }
    setOnboardingSkipped(localStorage.getItem('oneclick_onboarding_skipped') === 'true');
  }, [wallet, hydrated, router]);

  const handleResumeOnboarding = useCallback(() => {
    localStorage.removeItem('oneclick_onboarding_skipped');
    router.push('/dashboard');
  }, [router]);

  if (!hydrated || !wallet) return null;

  const statusOrder: Record<IntegrationStatus, number> = { live: 0, 'coming-soon': 1, none: 2 };

  const filteredDApps = (activeFilter === 'All'
    ? DAPPS
    : DAPPS.filter((d) => d.category === activeFilter)
  ).toSorted((a, b) => statusOrder[a.integrationStatus] - statusOrder[b.integrationStatus]);

  const featuredIds = ['trader-joe', 'beam', 'securitize'];
  const featuredDApps = featuredIds.map((id) => DAPPS.find((d) => d.id === id)!!);

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <main className="mx-auto max-w-lg px-4 pt-8">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Discover</h1>
          <p className="text-sm text-gray-400">Explore the Avalanche ecosystem</p>
        </div>

        {/* Category filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === cat
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
            >
              {cat === 'Infrastructure' ? 'Infra' : cat}
            </button>
          ))}
        </div>

        {/* Featured section — only when "All" */}
        {activeFilter === 'All' && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Featured</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {featuredDApps.map((dapp) => (
                <a
                  key={dapp.id}
                  href={dapp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-3 transition-colors hover:border-gray-700"
                >
                  <div className="mb-2 text-xl">{dapp.logo}</div>
                  <p className="text-xs font-semibold truncate">{dapp.name}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400 line-clamp-2 leading-tight">{dapp.description}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* All dApps list */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {activeFilter === 'All' ? 'All dApps' : activeFilter}
          </h2>
          <div className="rounded-2xl border border-gray-800/50 bg-gray-900/50 divide-y divide-gray-800/50">
            {filteredDApps.map((dapp) => (
              <div key={dapp.id} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-800 text-lg">
                  {dapp.logo}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{dapp.name}</p>
                  <p className="text-xs text-gray-400 truncate">{dapp.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {dapp.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {dapp.integrationStatus === 'live' && (
                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-[10px] font-medium text-green-400">
                        Works with OneClick
                      </span>
                    )}
                    {dapp.integrationStatus === 'coming-soon' && (
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-400">
                        Integration coming soon
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={dapp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-red-400 hover:text-red-300"
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Resume onboarding */}
        {onboardingSkipped && testModeActive && (
          <div className="mt-6 mb-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">📚</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Continue learning</p>
                <p className="text-xs text-gray-400 mt-0.5">Pick up where you left off with test tokens</p>
              </div>
              <button
                onClick={handleResumeOnboarding}
                className="shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
              >
                Resume
              </button>
            </div>
          </div>
        )}

        {/* CTA banner */}
        <div className="mt-8 mb-6 rounded-2xl border border-gray-800/50 bg-gradient-to-r from-red-500/5 to-orange-500/5 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔌</span>
            <div>
              <p className="text-sm font-semibold text-white">Building on Avalanche?</p>
              <p className="text-xs text-gray-400 mt-1">
                Let your users log in with fingerprint. 5 lines of code to integrate.
              </p>
              <a
                href="https://github.com/YMprobot/Oneclick"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                View Integration Guide &rarr;
              </a>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
