import type { OneClickConfig, WalletInfo, TransactionRequest, TransactionResponse } from './types.js';
import { signChallenge } from './webauthn.js';

export class OneClickWallet {
  private config: OneClickConfig;
  private walletInfo: WalletInfo;

  constructor(config: OneClickConfig, walletInfo: WalletInfo) {
    this.config = config;
    this.walletInfo = walletInfo;
  }

  get address(): string {
    return this.walletInfo.address;
  }

  get pubKeyX(): string {
    return this.walletInfo.pubKeyX;
  }

  get pubKeyY(): string {
    return this.walletInfo.pubKeyY;
  }

  /**
   * Execute a transaction on a target L1.
   * 1. Send tx details to relayer to get a challenge (nonce-bound hash)
   * 2. Sign the challenge with passkey (FaceID/TouchID)
   * 3. Send signed tx back to relayer for on-chain execution
   */
  async execute(tx: TransactionRequest): Promise<TransactionResponse> {
    // Step 1: Request challenge from relayer
    const prepareRes = await fetch(`${this.config.relayerUrl}/prepare-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: this.walletInfo.address,
        target: tx.target,
        value: tx.value,
        data: tx.data,
        chainId: tx.chainId,
      }),
    });

    if (!prepareRes.ok) {
      throw new Error(`Failed to prepare transaction: ${prepareRes.statusText}`);
    }

    const { challenge } = await prepareRes.json();

    // Step 2: Sign challenge with passkey
    const challengeBytes = hexToBytes(challenge);
    const signature = await signChallenge(this.walletInfo.credentialId, challengeBytes);

    // Step 3: Submit signed transaction to relayer
    const executeRes = await fetch(`${this.config.relayerUrl}/execute-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: this.walletInfo.address,
        target: tx.target,
        value: tx.value,
        data: tx.data,
        chainId: tx.chainId,
        signature: {
          r: signature.r,
          s: signature.s,
          authenticatorData: signature.authenticatorData,
          clientDataJSON: signature.clientDataJSON,
        },
      }),
    });

    if (!executeRes.ok) {
      throw new Error(`Failed to execute transaction: ${executeRes.statusText}`);
    }

    return executeRes.json();
  }

  /**
   * Get wallet balance across one or all chains.
   */
  async getBalance(chainId?: number): Promise<{ chainId: number; balance: string }[]> {
    const params = new URLSearchParams({ walletAddress: this.walletInfo.address });
    if (chainId !== undefined) {
      params.set('chainId', chainId.toString());
    }

    const res = await fetch(`${this.config.relayerUrl}/balance?${params}`);
    if (!res.ok) {
      throw new Error(`Failed to get balance: ${res.statusText}`);
    }

    return res.json();
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
