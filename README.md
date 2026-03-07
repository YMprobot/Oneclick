# OneClick — One Fingerprint. Every Chain.

Universal smart wallet with passkey authentication for Avalanche L1 blockchains. No seed phrases. No network switching. No gas fees.

**[Live Demo](https://oneclick-orcin-nine.vercel.app)** | **[Walkthrough Video — Coming soon]** | **[Relayer API](https://oneclick-production-54fc.up.railway.app/health)**

> Built solo in 6 days for **Avalanche Build Games 2026**.

---

## The Problem

Avalanche has 100+ L1 blockchains. Each requires its own gas token, RPC config, and wallet setup. Users must manage seed phrases, manually switch networks, buy gas tokens on each L1, and approve every transaction through confusing popups.

This kills adoption. Web3 UX is broken.

## The Solution

OneClick gives users a single wallet that works across all Avalanche L1s with biometric auth:

1. **Login with fingerprint** — no seed phrases, ever
2. **One wallet, every chain** — same address on all L1s via CREATE2
3. **Auto-routing** — transactions go to the right chain automatically
4. **Smart Swap** — don't have USDC? OneClick auto-swaps from AVAX in one tap
5. **Gas sponsorship** — dApps pay gas for their users via Paymaster

**5 lines of code to integrate:**

```typescript
import { connect } from "oneclick-wallet-sdk";

const wallet = await connect({ relayerUrl: "https://oneclick-production-54fc.up.railway.app" });

await wallet.execute({
  target: "0x...", value: "0", data: "0x...", chainId: 43114
});
```

## Architecture

```
User (FaceID / TouchID)
│
OneClick SDK (TypeScript, npm)
│
Relayer (Node.js, ethers.js v6)
├── Intent routing (which L1?)
├── Smart Swap (auto-swap if needed)
├── Gas estimation
└── Paymaster (who pays gas?)
│
Smart Contracts (deployed on each L1)
├── OneClickWallet.sol   — P256 passkey verification via Granite precompile
├── OneClickFactory.sol  — CREATE2 deterministic deployment
├── Paymaster.sol        — gas sponsorship for dApps
└── ICMSync.sol          — cross-L1 key sync via Avalanche Teleporter
│
Connected via Avalanche ICM (Interchain Messaging)
```

## Features

### Passkey Authentication
- FaceID / TouchID via WebAuthn API
- P-256 (secp256r1) keys stored in device secure enclave
- On-chain verification via Granite precompile at `0x0100` (RIP-7212)
- Private keys never leave the device

### Multi-Chain Support

| Chain | Chain ID | Status | Features |
|-------|----------|--------|----------|
| Fuji C-Chain (testnet) | 43113 | ✅ Live | Send, Swap, Smart Route |
| Avalanche C-Chain | 43114 | ✅ Live | Send, Swap, Smart Route |
| BEAM | 4337 | ✅ Live | Send |

### Smart Route (Killer Feature)

User wants to send USDC but only has AVAX? OneClick handles it in one fingerprint tap:

1. Auto-detects insufficient USDC balance
2. Swaps AVAX → USDC via TraderJoe LBRouter V2.1
3. Sends USDC to recipient
4. **User signs once. One fingerprint tap. Two on-chain transactions.**

### Gas Sponsorship

dApp developers deposit AVAX into Paymaster contracts. The relayer calls `sponsorTransaction()` and users never see gas fees.

### Cross-L1 Key Sync (ICM)

Change your passkey on one L1 → automatically synced to all others via Avalanche Interchain Messaging (Teleporter). The `ICMSync` contract sends `KeySyncMessage` payloads across chains, and the receiving contract calls `wallet.updateOwnerKey()` to apply the update.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.24, Foundry |
| Passkey Verification | secp256r1 precompile (RIP-7212, Granite upgrade) |
| Deterministic Deploy | CREATE2 via Nick's Factory (`0x4e59b44...`) |
| Cross-L1 Messaging | Avalanche ICM / Teleporter |
| Relayer | Node.js 20, TypeScript 5, ethers.js v6, Express |
| SDK | TypeScript, WebAuthn API, custom CBOR/COSE parser |
| Demo App | Next.js 15 (App Router), TailwindCSS 4 |
| DEX Integration | TraderJoe LBRouter V2.1 |
| Hosting | Railway (relayer), Vercel (demo) |

## Deployed Contracts

All contracts deployed via **deterministic CREATE2** — same address on every chain:

| Contract | Address |
|----------|---------|
| OneClickFactory | [`0x7ECeA257d8Fe653CA6C24CE744D589784DE5B188`](https://testnet.snowtrace.io/address/0x7ECeA257d8Fe653CA6C24CE744D589784DE5B188) |
| Paymaster | [`0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E`](https://testnet.snowtrace.io/address/0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E) |

Verified on: **Fuji C-Chain** (43113) · **Avalanche C-Chain** (43114) · **BEAM** (4337)

## Test Results

```
39 tests, 39 passed, 0 failed

OneClickWalletTest: 20 tests
  ├── Deploy, CREATE2 prediction, double-deploy revert
  ├── Execute with P256 signature, WebAuthn, relayer-only
  ├── Nonce increment, access control
  ├── Paymaster deposit/withdraw/sponsor (P256 + WebAuthn)
  └── Smart route multi-step (WebAuthn + executeAsRelayer)

ICMSyncTest: 19 tests
  ├── Admin: register remote contracts, wallets
  ├── Sync: send to single chain, broadcast to all chains
  ├── Receive: message decode, wallet key update, access control
  ├── Nonce: increment, replay prevention
  └── E2E: full round-trip sync → wallet keys updated
```

## Relayer API

Base URL: `https://oneclick-production-54fc.up.railway.app`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/deploy` | Deploy wallet on a chain |
| POST | `/prepare-transaction` | Build challenge hash for passkey signing |
| POST | `/execute-transaction` | Submit signed tx (with smart routing) |
| POST | `/transaction/plan` | Preview transaction plan |
| POST | `/swap/quote` | Get swap estimate |
| POST | `/swap/execute` | Execute swap through wallet |
| GET | `/balance` | Wallet balance (one or all chains) |
| GET | `/token-balances` | ERC-20 token balances |
| GET | `/prices` | Token prices (CoinGecko + cache) |
| GET | `/chains` | List registered chains |
| GET | `/tokens` | Token list per chain |
| GET | `/transactions` | Transaction history |
| GET | `/health` | Health check |

## Competitive Positioning

| Feature | MetaMask | Biconomy / ZeroDev | Abstract | **OneClick** |
|---------|----------|-------------------|----------|-------------|
| Auth | Seed phrase | Seed phrase + AA | Passkeys | **Passkeys** |
| Multi-L1 | Manual switch | Single chain | One L2 | **All Avalanche L1s** |
| Auto-swap | No | No | No | **Yes** |
| Gas sponsorship | No | Yes | Yes | **Yes** |
| ICM key sync | N/A | N/A | N/A | **Yes** |
| Deterministic address | No | Partial | No | **Same address on every chain** |

## Getting Started

### Prerequisites

- Node.js 20+
- Foundry (`forge`, `cast`, `anvil`)

### Local Development

```bash
# Clone
git clone https://github.com/YMprobot/Oneclick.git
cd Oneclick

# Smart Contracts — build & test
cd contracts
forge build
forge test -vvv

# Relayer
cd ../relayer
cp .env.example .env   # fill in PRIVATE_KEY
npm install
npm run dev             # http://localhost:3000

# Demo App
cd ../demo
npm install
npm run dev             # http://localhost:3001
```

### Environment Variables (Relayer)

| Variable | Required | Default |
|----------|----------|---------|
| `PRIVATE_KEY` | **Yes** | — |
| `PORT` | No | 3000 |
| `FUJI_RPC_URL` | No | `https://api.avax-test.network/ext/bc/C/rpc` |
| `MAINNET_RPC_URL` | No | `https://api.avax.network/ext/bc/C/rpc` |
| `BEAM_RPC_URL` | No | `https://build.onbeam.com/rpc` |
| `FACTORY_ADDRESS` | No | `0x7ECeA257...B188` |
| `PAYMASTER_ADDRESS` | No | `0xFe1Dd7F4...494E` |

## Repository Structure

```
oneclick/
├── contracts/                # Foundry project
│   ├── src/
│   │   ├── OneClickWallet.sol      # Per-user wallet, P256 verification
│   │   ├── OneClickFactory.sol     # CREATE2 deterministic deploy
│   │   ├── Paymaster.sol           # Gas sponsorship
│   │   ├── ICMSync.sol             # Cross-L1 key sync (Teleporter)
│   │   └── interfaces/             # ITeleporterMessenger, ITeleporterReceiver
│   ├── test/                       # 39 Forge tests + mocks
│   ├── script/                     # Deploy + DeployDeterministic scripts
│   └── deployments/                # Deployed addresses per chain
├── relayer/                  # Node.js transaction relayer
│   ├── src/
│   │   ├── index.ts                # Express app, chain registration
│   │   ├── router.ts               # 13 API endpoints
│   │   ├── executor.ts             # Blockchain interactions (ethers v6)
│   │   ├── chains.ts               # Chain config registry
│   │   ├── swap.ts                 # TraderJoe LBRouter integration
│   │   ├── smartRouter.ts          # Auto-swap transaction planner
│   │   ├── tokens.ts               # Token registry
│   │   ├── balanceChecker.ts       # Balance aggregation
│   │   ├── transactions.ts         # Tx history (persistent JSON)
│   │   └── walletStore.ts          # Wallet keys (persistent JSON)
│   ├── data/                       # Persistent storage (gitignored)
│   └── Dockerfile                  # Railway deployment
├── sdk/                      # TypeScript SDK
│   └── src/
│       ├── index.ts                # Public API exports
│       ├── connect.ts              # connect() entry point
│       ├── wallet.ts               # OneClickWallet class
│       ├── webauthn.ts             # WebAuthn + CBOR/COSE/DER parsing
│       └── types.ts                # TypeScript interfaces
├── demo/                     # Next.js 15 demo app
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Login (create / sign-in)
│       │   ├── dashboard/page.tsx  # Multi-chain balances + USD
│       │   ├── send/page.tsx       # Send with Smart Route
│       │   └── swap/page.tsx       # TraderJoe swap UI
│       ├── components/             # 7 reusable components
│       └── context/                # WalletContext (sessionStorage)
├── CLAUDE.md                 # AI development guidelines
├── .env.example
└── README.md
```

## Monetization

dApp developers pay to sponsor gas for their users through Paymaster contracts. Same model validated by Abstract — gas sponsorship as a user acquisition cost.

## Roadmap

- [x] Passkey wallet with P256 on-chain verification
- [x] Deterministic multi-chain deployment (3 L1s)
- [x] TraderJoe swap integration (AVAX/USDC/USDT)
- [x] Smart Route — auto-swap + transfer in one tap
- [x] ICM cross-chain key sync (end-to-end with tests)
- [x] Gas sponsorship via Paymaster
- [x] SDK with 5-line integration API
- [x] Live demo + relayer deployed
- [x] 39/39 tests passing
- [x] SDK published on npm ([oneclick-wallet-sdk](https://www.npmjs.com/package/oneclick-wallet-sdk))
- [ ] Account recovery (social recovery)
- [ ] Decentralized relayer network
- [ ] Mobile app (React Native)

## License

MIT
