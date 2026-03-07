# OneClick Integration Guide

For dApp developers replacing MetaMask/WalletConnect with fingerprint auth.

## What You Get

- **Fingerprint login** for your users (no MetaMask popup, no seed phrases)
- **Gas sponsorship** — your users never pay gas fees
- **Multi-chain** — works on C-Chain, BEAM, and any Avalanche L1

## Install

```bash
npm install oneclick-wallet-sdk
```

## Quick Start

```typescript
import { connect } from "oneclick-wallet-sdk";

const wallet = await connect({ relayerUrl: "https://oneclick-production-54fc.up.railway.app" });
console.log("Wallet address:", wallet.address); // same on every L1

await wallet.execute({ target: "0xRecipient", value: "1000000000000000000", data: "0x", chainId: 43113 });

const balances = await wallet.getBalance(); // all chains
```

## Step-by-step Integration

### Step 1: Replace wallet connect

**Before (MetaMask):**
```typescript
const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
const address = accounts[0];
```

**After (OneClick):**
```typescript
import { connect } from "oneclick-wallet-sdk";

const wallet = await connect({ relayerUrl: "https://oneclick-production-54fc.up.railway.app" });
const address = wallet.address;
```

User sees FaceID/TouchID prompt instead of MetaMask popup. No extension required.

### Step 2: Execute transactions

**Before (ethers.js):**
```typescript
const tx = await signer.sendTransaction({ to: recipient, value: ethers.parseEther("0.1") });
```

**After (OneClick):**
```typescript
const tx = await wallet.execute({
  target: recipient,
  value: ethers.parseEther("0.1").toString(),
  data: "0x",
  chainId: 43113,
});
console.log("tx hash:", tx.hash); // confirmed on-chain
```

User confirms with fingerprint. Gas is paid by Paymaster.

### Step 3: Get balance

```typescript
// All chains at once
const all = await wallet.getBalance();
// [{ chainId: 43113, balance: "500000000000000000" }, { chainId: 4337, balance: "0" }]

// Specific chain
const fuji = await wallet.getBalance(43113);
```

## API Reference

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `connect(config)` | `{ relayerUrl: string }` | `OneClickWallet` | Create passkey + deploy wallet |
| `wallet.execute(tx)` | `{ target, value, data, chainId }` | `{ hash, chainId, status }` | Sign with fingerprint + execute on-chain |
| `wallet.getBalance(chainId?)` | Optional chain ID | `{ chainId, balance }[]` | Native balance in wei |
| `wallet.address` | — | `string` | Deterministic address (same on all L1s) |

## Relayer Endpoints

For teams integrating without the SDK — the raw HTTP API:

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/deploy` | `{ pubKeyX, pubKeyY }` | Deploy smart wallet |
| POST | `/prepare-transaction` | `{ walletAddress, target, value, data, chainId }` | Get challenge hash for signing |
| POST | `/execute-transaction` | `{ walletAddress, target, value, data, chainId, signature }` | Submit signed transaction |
| GET | `/balance?walletAddress=0x...` | — | Get balance across all chains |
| GET | `/chains` | — | List supported chains |
| GET | `/health` | — | Health check |

Base URL: `https://oneclick-production-54fc.up.railway.app`

## For Hackathon Teams

> **We'll pre-fund the Paymaster for your demo — zero setup.**
> Integration takes ~30 minutes. DM us on Discord for live support.

Just `npm install oneclick-wallet-sdk` and use the hosted relayer. No contracts to deploy, no gas tokens to buy. Chains: Fuji (43113), Avalanche C-Chain (43114), BEAM (4337).

## Example: React Component

Drop-in `<OneClickButton />` for any React/Next.js app:

```tsx
"use client";
import { useState } from "react";
import { connect, type OneClickWallet } from "oneclick-wallet-sdk";

const RELAYER = "https://oneclick-production-54fc.up.railway.app";

export function OneClickButton({ onConnect }: { onConnect: (wallet: OneClickWallet) => void }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const wallet = await connect({ relayerUrl: RELAYER });
      onConnect(wallet);
    } catch (err) {
      console.error("OneClick connect failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}
      style={{ padding: "12px 24px", fontSize: 16, borderRadius: 12, cursor: "pointer" }}>
      {loading ? "Authenticating..." : "Login with Fingerprint"}
    </button>
  );
}
```

Usage: `<OneClickButton onConnect={(w) => setWallet(w)} />`

---

[GitHub](https://github.com/YMprobot/Oneclick) | DM on Discord for support
