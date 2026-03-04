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

export function generateFakeTxHash(): string {
  const bytes = new Array(32)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  return '0x' + bytes.join('');
}
