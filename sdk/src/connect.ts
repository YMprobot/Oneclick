import type { OneClickConfig, WalletInfo } from './types.js';
import { createPasskey } from './webauthn.js';

/**
 * Connect to OneClick: create a passkey and deploy a smart wallet via the relayer.
 * If the relayer is unavailable, returns wallet info without an address.
 */
export async function connect(config: OneClickConfig): Promise<WalletInfo> {
  const credential = await createPasskey('OneClick User');

  try {
    const response = await fetch(`${config.relayerUrl}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubKeyX: credential.pubKeyX,
        pubKeyY: credential.pubKeyY,
        credentialId: credential.credentialId,
      }),
    });

    const { walletAddress } = await response.json();

    return {
      address: walletAddress,
      pubKeyX: credential.pubKeyX,
      pubKeyY: credential.pubKeyY,
      credentialId: credential.credentialId,
    };
  } catch {
    // Relayer not available — return credential info without wallet address
    return {
      address: '',
      pubKeyX: credential.pubKeyX,
      pubKeyY: credential.pubKeyY,
      credentialId: credential.credentialId,
    };
  }
}
