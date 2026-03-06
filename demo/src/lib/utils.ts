export function avaxToWei(avax: string): string {
  const parts = avax.split('.');
  const whole = parts[0] || '0';
  const decimal = (parts[1] || '').padEnd(18, '0').slice(0, 18);
  const wei = whole + decimal;
  return wei.replace(/^0+/, '') || '0';
}

export function weiToAvax(wei: string): string {
  const padded = wei.padStart(19, '0');
  const whole = padded.slice(0, -18) || '0';
  const decimal = padded.slice(-18, -14);
  return `${whole}.${decimal}`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function toSmallestUnit(amount: string, decimals: number): string {
  const parts = amount.split('.');
  const whole = parts[0] || '0';
  const decimal = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  const raw = whole + decimal;
  return raw.replace(/^0+/, '') || '0';
}

export function fromSmallestUnit(raw: string, decimals: number): string {
  const padded = raw.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const decimal = padded.slice(-decimals);
  // Trim trailing zeros but keep at least 2 decimal places for stablecoins
  const trimmed = decimal.replace(/0+$/, '').padEnd(Math.min(2, decimals), '0');
  return `${whole}.${trimmed}`;
}
