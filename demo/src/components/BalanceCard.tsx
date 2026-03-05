interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
}

interface BalanceCardProps {
  chainName: string;
  chainId: number;
  balance: string;
  nativeSymbol?: string;
  isLoading: boolean;
  usdPrice?: number;
  tokens?: TokenBalance[];
}

export function BalanceCard({ chainName, balance, nativeSymbol = 'AVAX', isLoading, usdPrice, tokens }: BalanceCardProps) {
  const usdValue = usdPrice ? parseFloat(balance) * usdPrice : null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 transition-all duration-200 hover:border-gray-700">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">⛰️</span>
        <span className="text-sm font-medium text-gray-300">{chainName}</span>
      </div>
      {isLoading ? (
        <div className="h-8 w-28 animate-pulse rounded bg-gray-800" />
      ) : (
        <>
          <p className="text-2xl font-bold">
            {balance} <span className="text-sm text-gray-400">{nativeSymbol}</span>
          </p>
          {usdValue !== null && usdValue > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              ≈ ${usdValue.toFixed(2)}
            </p>
          )}
          {tokens && tokens.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-gray-800 pt-3">
              {tokens.map((t) => {
                const bal = Number(t.balance) / Math.pow(10, t.decimals);
                if (bal === 0) return null;
                return (
                  <p key={t.symbol} className="text-sm text-gray-400">
                    {bal.toFixed(2)} <span className="text-gray-500">{t.symbol}</span>
                  </p>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
