export interface SwapTokenConfig {
  symbol: string;
  address: string;
  decimals: number;
}

export interface SwapConfig {
  routerAddress: string;
  wavaxAddress: string;
  tokens: SwapTokenConfig[];
  defaultBinStep: number;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  factoryAddress: string;
  paymasterAddress: string;
  nativeSymbol: string;
  explorerUrl: string;
  swap?: SwapConfig;
}

const chains: Map<number, ChainConfig> = new Map();

export function registerChain(config: ChainConfig): void {
  chains.set(config.chainId, config);
}

export function getChain(chainId: number): ChainConfig | undefined {
  return chains.get(chainId);
}

export function getAllChains(): ChainConfig[] {
  return Array.from(chains.values());
}

export function getDefaultChainId(): number {
  // Default to Fuji testnet (contracts are deployed there)
  if (chains.has(43113)) return 43113;
  const first = chains.values().next();
  if (first.done) throw new Error('No chains registered');
  return first.value.chainId;
}
