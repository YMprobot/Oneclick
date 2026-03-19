'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { BottomNav } from '@/components/BottomNav';

interface DApp {
  id: string;
  name: string;
  description: string;
  category: 'DeFi' | 'Gaming' | 'RWA' | 'Infrastructure' | 'NFT';
  url: string;
  logo: string;
  tags: string[];
  featured?: boolean;
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
  },
  {
    id: 'dexalot',
    name: 'Dexalot',
    description: 'Central limit order book DEX on its own L1',
    category: 'DeFi',
    url: 'https://dexalot.com',
    logo: '📊',
    tags: ['DEX', 'Orderbook'],
  },
  {
    id: 'gogopool',
    name: 'GoGoPool',
    description: 'Permissionless staking for Avalanche validators',
    category: 'DeFi',
    url: 'https://gogopool.com',
    logo: '🏊',
    tags: ['Staking', 'Validators'],
  },
  {
    id: 'stargate',
    name: 'Stargate',
    description: 'Cross-chain bridge powered by LayerZero',
    category: 'DeFi',
    url: 'https://stargate.finance',
    logo: '🌉',
    tags: ['Bridge', 'Cross-chain'],
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
  },
  {
    id: 'shrapnel',
    name: 'Shrapnel',
    description: 'AAA FPS game on its own Avalanche L1',
    category: 'Gaming',
    url: 'https://shrapnel.com',
    logo: '💥',
    tags: ['FPS', 'AAA'],
  },
  {
    id: 'off-the-grid',
    name: 'Off The Grid',
    description: 'Battle royale on GUNZ L1',
    category: 'Gaming',
    url: 'https://offthegrid.fun',
    logo: '🔫',
    tags: ['Battle Royale', 'GUNZ'],
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
  },
  {
    id: 'intain',
    name: 'IntainMARKETS',
    description: 'Structured finance marketplace on Avalanche',
    category: 'RWA',
    url: 'https://intain.io',
    logo: '📋',
    tags: ['Structured Finance'],
  },
  {
    id: 'the-arena',
    name: 'Arena',
    description: 'Social platform on Avalanche',
    category: 'Infrastructure',
    url: 'https://arena.social',
    logo: '🏟️',
    tags: ['Social'],
  },
  {
    id: 'core-wallet',
    name: 'Core',
    description: 'Native Avalanche wallet & portfolio tracker',
    category: 'Infrastructure',
    url: 'https://core.app',
    logo: '💎',
    tags: ['Wallet', 'Portfolio'],
  },
];

type CategoryFilter = 'All' | DApp['category'];

const CATEGORIES: CategoryFilter[] = ['All', 'DeFi', 'Gaming', 'RWA', 'Infrastructure'];

export default function DiscoverPage() {
  const { wallet, hydrated } = useWallet();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('All');

  useEffect(() => {
    if (!hydrated) return;
    if (!wallet) {
      router.push('/app');
    }
  }, [wallet, hydrated, router]);

  if (!hydrated || !wallet) return null;

  const filteredDApps = activeFilter === 'All'
    ? DAPPS
    : DAPPS.filter((d) => d.category === activeFilter);

  const featuredDApps = DAPPS.filter((d) => d.featured);

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
            <div className="flex gap-3 overflow-x-auto pb-2">
              {featuredDApps.map((dapp) => (
                <div
                  key={dapp.id}
                  className="w-44 shrink-0 rounded-xl border border-gray-800/50 bg-gray-900/50 p-4"
                >
                  <div className="mb-2 text-2xl">{dapp.logo}</div>
                  <p className="text-sm font-semibold">{dapp.name}</p>
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">{dapp.description}</p>
                  <a
                    href={dapp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-xs font-medium text-red-400 hover:text-red-300"
                  >
                    Open &rarr;
                  </a>
                </div>
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
                  <div className="mt-1 flex gap-1.5">
                    {dapp.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
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

        {/* Coming Soon banner */}
        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/30 p-5 text-center mt-6">
          <p className="text-sm font-medium mb-1">More integrations coming soon</p>
          <p className="text-xs text-gray-400 mb-1">
            OneClick is building native integrations with these dApps.
          </p>
          <p className="text-xs text-gray-400 mb-3">
            Your fingerprint = your access.
          </p>
          <p className="text-xs text-gray-500">
            Want your project listed?{' '}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300"
            >
              GitHub &rarr; Issues
            </a>
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
