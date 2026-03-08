interface Segment {
  label: string;
  percent: number;
  color: string;
}

interface DistributionBarProps {
  segments: Segment[];
}

const DOT_COLORS: Record<string, string> = {
  AVAX: 'bg-red-500',
  BEAM: 'bg-green-500',
  USDC: 'bg-blue-500',
  USDT: 'bg-emerald-500',
};

const BAR_COLORS: Record<string, string> = {
  AVAX: 'bg-red-500',
  BEAM: 'bg-green-500',
  USDC: 'bg-blue-500',
  USDT: 'bg-emerald-500',
};

export function DistributionBar({ segments }: DistributionBarProps) {
  const filtered = segments.filter((s) => s.percent > 0);
  if (filtered.length === 0) return null;

  return (
    <div>
      {/* Bar */}
      <div className="flex h-2 overflow-hidden rounded-full">
        {filtered.map((seg, i) => (
          <div
            key={seg.label}
            className={`${BAR_COLORS[seg.label] || 'bg-gray-600'} ${i > 0 ? 'ml-0.5' : ''}`}
            style={{ width: `${seg.percent}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {filtered.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${DOT_COLORS[seg.label] || 'bg-gray-600'}`} />
            <span className="text-xs text-gray-400">
              {seg.label} {Math.round(seg.percent)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
