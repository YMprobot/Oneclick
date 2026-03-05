// Maps wallet address (lowercase) -> { pubKeyX, pubKeyY }
const wallets: Map<string, { pubKeyX: string; pubKeyY: string }> = new Map();

export function storeWallet(address: string, pubKeyX: string, pubKeyY: string): void {
  wallets.set(address.toLowerCase(), { pubKeyX, pubKeyY });
}

export function getWalletKeys(address: string): { pubKeyX: string; pubKeyY: string } | undefined {
  return wallets.get(address.toLowerCase());
}
