# @anthropic-oneclick/sdk

TypeScript SDK for **OneClick** -- passkey-based smart wallets on Avalanche.

Users authenticate with FaceID/TouchID. No seed phrases, no gas fees, no network switching.

## Install

```bash
npm install @anthropic-oneclick/sdk
```

## Quick Start

```typescript
import { connect } from '@anthropic-oneclick/sdk';

// 1. Connect -- creates a passkey and deploys a smart wallet
const wallet = await connect({ relayerUrl: 'https://your-relayer.example.com' });

console.log('Wallet address:', wallet.address);

// 2. Send a transaction (user confirms with FaceID/TouchID)
const tx = await wallet.execute({
  target: '0xRecipientAddress',
  value: '1000000000000000', // 0.001 AVAX in wei
  data: '0x',
  chainId: 43113,           // Fuji testnet
});

console.log('TX hash:', tx.hash);

// 3. Check balance
const balances = await wallet.getBalance();
console.log(balances);
```

## API

### `connect(config): Promise<OneClickWallet>`

Creates a passkey via WebAuthn and deploys a smart wallet through the relayer.

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.relayerUrl` | `string` | OneClick relayer endpoint |

### `OneClickWallet`

| Method | Returns | Description |
|--------|---------|-------------|
| `execute(tx)` | `Promise<TransactionResponse>` | Sign and execute a transaction |
| `getBalance(chainId?)` | `Promise<{chainId, balance}[]>` | Get wallet balance |
| `.address` | `string` | Smart wallet address |
| `.pubKeyX` | `string` | P256 public key X coordinate |
| `.pubKeyY` | `string` | P256 public key Y coordinate |

### `createPasskey(username): Promise<PasskeyCredential>`

Low-level: create a WebAuthn passkey and extract the P256 public key (x, y) from COSE.

### `signChallenge(credentialId, challenge): Promise<SignatureData>`

Low-level: sign a challenge with an existing passkey. Returns `(r, s)` + authenticator metadata.

## How It Works

```
User (FaceID/TouchID)
  -> SDK (WebAuthn API, this package)
    -> Relayer (meta-transaction submission)
      -> Smart Contracts (P256 verification via RIP-7212 precompile)
```

1. **Registration**: `createPasskey()` calls `navigator.credentials.create()`, extracts P256 public key from COSE/CBOR
2. **Signing**: `signChallenge()` calls `navigator.credentials.get()`, converts DER signature to raw `(r, s)`
3. **Execution**: SDK sends the signed intent to the relayer, which submits it on-chain

## Types

```typescript
interface OneClickConfig { relayerUrl: string }
interface PasskeyCredential { credentialId: string; pubKeyX: string; pubKeyY: string; rawId: Uint8Array }
interface TransactionRequest { target: string; value: string; data: string; chainId: number }
interface TransactionResponse { hash: string; chainId: number; status: 'pending' | 'confirmed' | 'failed' }
interface SignatureData { r: string; s: string; authenticatorData: string; clientDataJSON: string }
```

## Requirements

- Browser with WebAuthn support (all modern browsers)
- Platform authenticator (FaceID, TouchID, Windows Hello)
- Running OneClick relayer instance

## License

MIT
