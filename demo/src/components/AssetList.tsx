interface Asset {
  symbol: string;
  amount: string;
  usdValue: number;
  color: string;
}

interface AssetListProps {
  assets: Asset[];
}

const ICON_COLORS: Record<string, string> = {
  AVAX: 'bg-red-500',
  BEAM: 'bg-green-500',
  USDC: 'bg-blue-500',
  USDT: 'bg-emerald-500',
};

export function AssetList({ assets }: AssetListProps) {
  if (assets.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No assets yet</p>;
  }

  return (
    <div className="space-y-1">
      {assets.map((asset) => (
        <div
          key={asset.symbol}
          className="flex items-center justify-between rounded-2xl px-4 py-3 transition-colors hover:bg-gray-800/50"
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${
                ICON_COLORS[asset.symbol] || 'bg-gray-600'
              }`}
            >
              {asset.symbol[0]}
            </div>
            <div>
              <p className="font-semibold text-white">{asset.symbol}</p>
              <p className="text-sm text-gray-500">
                {asset.amount} {asset.symbol}
              </p>
            </div>
          </div>
          <p className="font-semibold text-white">
            ${asset.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      ))}
    </div>
  );
}

export type { Asset };
