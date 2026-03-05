interface BalanceCardProps {
  chainName: string;
  chainId: number;
  balance: string;
  nativeSymbol?: string;
  isLoading: boolean;
}

export function BalanceCard({ chainName, balance, nativeSymbol = 'AVAX', isLoading }: BalanceCardProps) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 transition-all duration-200 hover:border-gray-700">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">⛰️</span>
        <span className="text-sm font-medium text-gray-300">{chainName}</span>
      </div>
      {isLoading ? (
        <div className="h-8 w-28 animate-pulse rounded bg-gray-800" />
      ) : (
        <p className="text-2xl font-bold">
          {balance} <span className="text-sm text-gray-400">{nativeSymbol}</span>
        </p>
      )}
    </div>
  );
}
