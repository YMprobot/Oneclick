import { isWalletFunded } from './faucet.js';
import { getTransactions } from './transactions.js';

interface TestModeStep {
  id: string;
  label: string;
  completed: boolean;
  description: string;
  action: string;
}

export interface TestModeProgress {
  testModeActive: boolean;
  steps: TestModeStep[];
  completedCount: number;
  totalCount: number;
}

const FUJI_CHAIN_ID = 43113;

export async function getTestModeProgress(walletAddress: string): Promise<TestModeProgress> {
  const funded = isWalletFunded(walletAddress);

  if (!funded) {
    return {
      testModeActive: false,
      steps: [],
      completedCount: 0,
      totalCount: 5,
    };
  }

  // Load transaction history to detect completed steps
  const txs = await getTransactions(walletAddress, 100);

  // Detect completed steps from transaction history
  const hasSendAvax = txs.some(
    (tx) => tx.chainId === FUJI_CHAIN_ID && tx.txType === 'send' && tx.status === 'confirmed'
  );

  const hasSwap = txs.some(
    (tx) => tx.txType === 'swap' && tx.status === 'confirmed'
  );

  const hasSmartRoute = txs.some(
    (tx) => tx.txType === 'smart-swap-send' && tx.status === 'confirmed'
  );

  const steps: TestModeStep[] = [
    {
      id: 'wallet_created',
      label: 'Create your wallet',
      completed: true,
      description: 'Signed up with fingerprint',
      action: '/app',
    },
    {
      id: 'tokens_received',
      label: 'Get test tokens',
      completed: true, // Always true if testModeActive
      description: 'Received 1 AVAX + 5 USDC',
      action: '/dashboard',
    },
    {
      id: 'send_avax',
      label: 'Send AVAX to another address',
      completed: hasSendAvax,
      description: 'Send any amount of AVAX on Fuji',
      action: '/send',
    },
    {
      id: 'swap_tokens',
      label: 'Swap AVAX \u2192 USDC on TraderJoe',
      completed: hasSwap,
      description: 'Try a token swap on the DEX',
      action: '/swap',
    },
    {
      id: 'smart_route',
      label: 'Use Smart Route (auto-swap + send)',
      completed: hasSmartRoute,
      description: 'Send USDC — OneClick auto-swaps for you',
      action: '/send',
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  return {
    testModeActive: true,
    steps,
    completedCount,
    totalCount: steps.length,
  };
}
