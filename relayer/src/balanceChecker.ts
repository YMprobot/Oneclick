import { ethers } from 'ethers';

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export interface TokenBalance {
  symbol: string;
  address: string; // "native" for AVAX
  balance: bigint;
  decimals: number;
}

/** Get native token balance */
export async function getNativeBalance(
  provider: ethers.JsonRpcProvider,
  walletAddress: string
): Promise<bigint> {
  return provider.getBalance(walletAddress);
}

/** Get ERC20 token balance */
export async function getTokenBalance(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
  walletAddress: string
): Promise<{ balance: bigint; decimals: number }> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [balance, decimals] = await Promise.all([
    token.balanceOf(walletAddress),
    token.decimals(),
  ]);
  return { balance, decimals: Number(decimals) };
}

/** Get all balances for a wallet on a chain */
export async function getAllBalances(
  provider: ethers.JsonRpcProvider,
  walletAddress: string,
  tokens: Array<{ symbol: string; address: string; decimals: number }>
): Promise<TokenBalance[]> {
  const nativeBalance = await getNativeBalance(provider, walletAddress);
  const result: TokenBalance[] = [
    { symbol: 'AVAX', address: 'native', balance: nativeBalance, decimals: 18 },
  ];

  for (const token of tokens) {
    try {
      const { balance } = await getTokenBalance(provider, token.address, walletAddress);
      result.push({
        symbol: token.symbol,
        address: token.address,
        balance,
        decimals: token.decimals,
      });
    } catch {
      result.push({
        symbol: token.symbol,
        address: token.address,
        balance: 0n,
        decimals: token.decimals,
      });
    }
  }

  return result;
}
