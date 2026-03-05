export interface TokenConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
}

const tokens: TokenConfig[] = [
  // BEAM chain
  { symbol: 'USDC', name: 'USD Coin', address: '0x76BF5E7d2Bcb06b1444C0a2742780051D8D0E304', decimals: 6, chainId: 4337 },
  { symbol: 'USDT', name: 'Tether USD', address: '0x999f90f25a2922ae1b21A06066F7EDEbedad42a9', decimals: 6, chainId: 4337 },
  // Avalanche C-Chain mainnet
  { symbol: 'USDC', name: 'USD Coin', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, chainId: 43114 },
  { symbol: 'USDT', name: 'Tether USD', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, chainId: 43114 },
  // Fuji C-Chain — no official USDC/USDT, skip for now
];

export function getTokensForChain(chainId: number): TokenConfig[] {
  return tokens.filter(t => t.chainId === chainId);
}

export function getToken(chainId: number, symbol: string): TokenConfig | undefined {
  return tokens.find(t => t.chainId === chainId && t.symbol === symbol);
}

export function getAllTokens(): TokenConfig[] {
  return tokens;
}
