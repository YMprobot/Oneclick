interface SmartRouteStep {
  type: 'swap' | 'transfer' | 'execute';
  description: string;
  hash: string;
}

interface TransactionRecord {
  id: string;
  walletAddress: string;
  target: string;
  value: string;
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  explorerUrl: string;
  hash: string;
  status: 'confirmed' | 'failed';
  timestamp: number;
  txType?: 'send' | 'swap' | 'smart-swap-send';
  smartRoute?: SmartRouteStep[];
}

interface TransactionListProps {
  transactions: TransactionRecord[];
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(weiValue: string): string {
  const num = Number(weiValue) / 1e18;
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  return num.toFixed(4);
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CHAIN_DOT_COLORS: Record<string, string> = {
  AVAX: 'bg-red-500',
  BEAM: 'bg-green-500',
};

function chainDotColor(nativeSymbol: string): string {
  return CHAIN_DOT_COLORS[nativeSymbol] || 'bg-gray-500';
}

function explorerTxUrl(explorerUrl: string, hash: string): string {
  if (!explorerUrl) return '';
  return `${explorerUrl}/tx/${hash}`;
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No transactions yet</p>;
  }

  return (
    <div className="divide-y divide-gray-800">
      {transactions.map((tx) => {
        const isSmartRoute = tx.txType === 'smart-swap-send';

        return (
          <div key={tx.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${chainDotColor(tx.nativeSymbol)}`}
                    />
                    {tx.chainName}
                  </span>
                  {isSmartRoute && (
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                      Smart Route
                    </span>
                  )}
                </div>
                <p className="truncate text-sm">
                  <span className="font-medium text-white">
                    {isSmartRoute ? 'Smart Swap + Send' : `Sent ${formatAmount(tx.value)} ${tx.nativeSymbol}`}
                  </span>{' '}
                  <span className="font-mono text-gray-400">
                    to {truncateAddress(tx.target)}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="whitespace-nowrap text-xs text-gray-500">
                  {timeAgo(tx.timestamp)}
                </span>
                {tx.explorerUrl && (
                  <a
                    href={explorerTxUrl(tx.explorerUrl, tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap text-xs text-red-400 transition-colors hover:text-red-300"
                  >
                    {truncateAddress(tx.hash)}
                  </a>
                )}
              </div>
            </div>

            {/* Smart route sub-steps */}
            {isSmartRoute && tx.smartRoute && tx.smartRoute.length > 0 && (
              <div className="mt-2 space-y-1 border-l-2 border-blue-500/20 pl-3">
                {tx.smartRoute.map((step, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className={`text-xs ${
                      step.type === 'swap' ? 'text-blue-400' : 'text-green-400'
                    }`}>
                      {step.description}
                    </span>
                    {step.hash && tx.explorerUrl && (
                      <a
                        href={explorerTxUrl(tx.explorerUrl, step.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-gray-500 hover:text-gray-300"
                      >
                        {step.hash.slice(0, 6)}...{step.hash.slice(-4)}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
