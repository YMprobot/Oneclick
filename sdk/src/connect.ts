import type { OneClickConfig } from './types.js';
import { createPasskey } from './webauthn.js';
import { OneClickWallet } from './wallet.js';

/**
 * Connect to OneClick: create a passkey and deploy a smart wallet via the relayer.
 * Returns a OneClickWallet instance ready for transaction execution.
 */
export async function connect(config: OneClickConfig): Promise<OneClickWallet> {
  const credential = await createPasskey('OneClick User');

  let walletAddress = '';
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

    const data = await response.json();
    walletAddress = data.walletAddress;
  } catch {
    console.warn('Relayer unavailable, wallet address unknown until relayer connects');
  }

  return new OneClickWallet(config, {
    address: walletAddress,
    pubKeyX: credential.pubKeyX,
    pubKeyY: credential.pubKeyY,
    credentialId: credential.credentialId,
  });
}
