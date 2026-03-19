interface ComingSoonFeature {
  id: string;
  icon: string;
  title: string;
  description: string;
  gradient: string;
}

const COMING_SOON_FEATURES: ComingSoonFeature[] = [
  {
    id: 'buy-crypto',
    icon: '💳',
    title: 'Buy Crypto with Card',
    description: 'Apple Pay, Google Pay, and card payments. Fund your wallet in seconds.',
    gradient: 'from-blue-500/10 to-purple-500/10',
  },
  {
    id: 'staking',
    icon: '📈',
    title: 'Staking',
    description: 'Earn yield on your AVAX. One-tap staking through BENQI.',
    gradient: 'from-green-500/10 to-emerald-500/10',
  },
];

export function ComingSoonCards() {
  return (
    <div className="mt-6 mb-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Coming Soon</h2>
      <div className="space-y-3">
        {COMING_SOON_FEATURES.map((feature) => (
          <div
            key={feature.id}
            className={`relative rounded-2xl border border-gray-800/50 bg-gradient-to-r ${feature.gradient} p-4`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{feature.icon}</span>
              <span className="text-sm font-semibold text-white">{feature.title}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{feature.description}</p>
            <span className="absolute bottom-3 right-3 bg-gray-800/80 text-[10px] text-gray-400 font-medium uppercase tracking-wider rounded-full px-2.5 py-0.5">
              Coming Soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
