# PROJECT_STATUS.md — OneClick

Complete project reference for any new Claude Code session.

---

## 1. Overview

**OneClick** is a universal smart wallet with passkey/biometric authentication (FaceID/TouchID) for Avalanche L1 blockchains. Users authenticate with fingerprint, never see seed phrases, gas fees, or network switching.

- **Hackathon:** Avalanche Build Games 2026
- **Builder:** Solo dev, 6 days
- **License:** MIT
- **Repo:** https://github.com/YMprobot/Oneclick

---

## 2. Current Status

| Task | Status |
|------|--------|
| Smart contracts (Wallet, Factory, Paymaster, ICMSync) | Done |
| P256 passkey verification via Granite precompile | Done |
| CREATE2 deterministic deployment on 3 chains | Done |
| TraderJoe swap integration (AVAX/USDC/USDT) | Done |
| Smart Route — auto-swap + transfer in one tap | Done |
| ICM cross-chain key sync (contracts + 19 tests) | Done |
| Gas sponsorship via Paymaster | Done |
| Relayer with 13 API endpoints | Done |
| SDK (`oneclick-wallet-sdk`) | Done |
| Demo app (Next.js 15) | Done |
| Contract verification on Sourcify/Snowtrace | Done |
| Security audit (`SECURITY_AUDIT.md`) | Done |
| Integration guide (`INTEGRATION_GUIDE.md`) | Done |
| 39/39 Forge tests passing | Done |
| Slippage protection (5% max) | Done |
| Docker non-root user | Done |
| SDK published on npm | Not done |
| Walkthrough video | Not done |
| Account recovery (social recovery) | Not done |
| Decentralized relayer network | Not done |

---

## 3. Architecture

```
User (FaceID / TouchID)
  │
  ▼
SDK (TypeScript, npm: oneclick-wallet-sdk)
  │  createPasskey() → WebAuthn API → P256 key pair
  │  signChallenge() → WebAuthn API → (r, s) signature
  │
  ▼
Relayer (Node.js, Express, ethers.js v6)
  │  /deploy           → OneClickFactory.deployWallet()
  │  /prepare-transaction → keccak256 challenge
  │  /execute-transaction → OneClickWallet.executeWithWebAuthn()
  │  Smart Router       → auto-swap AVAX→Token if needed
  │
  ▼
Smart Contracts (Solidity 0.8.24, each L1)
  ├── OneClickWallet.sol   — P256 verification via precompile 0x0100
  ├── OneClickFactory.sol  — CREATE2 deterministic deploy
  ├── Paymaster.sol        — gas sponsorship
  └── ICMSync.sol          — cross-L1 key sync via Teleporter
  │
  ▼
Avalanche L1s: Fuji (43113), C-Chain (43114), BEAM (4337)
```

**Three execution paths in OneClickWallet:**
- `execute()` — P256 signature bound to (target, value, data, nonce)
- `executeWithWebAuthn()` — full WebAuthn sig (not bound to tx params)
- `executeAsRelayer()` — no user signature, relayer authority only

**Smart routing:** Step 1 uses `executeWithWebAuthn()` for swap, Step 2 uses `executeAsRelayer()` for transfer (nonce increment invalidates the original sig).

---

## 4. Deployed Contracts

All contracts deployed via **deterministic CREATE2** through Nick's Factory (`0x4e59b44847b379578588920cA78FbF26c0B4956C`). Same addresses on every chain.

| Contract | Address |
|----------|---------|
| OneClickFactory | `0x7ECeA257d8Fe653CA6C24CE744D589784DE5B188` |
| Paymaster | `0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E` |
| Deployer EOA | `0x17523Fce08784bE4135ab70693746BE0Ddd10302` |

| Chain | Chain ID | RPC URL | Verified |
|-------|----------|---------|----------|
| Fuji C-Chain | 43113 | `https://api.avax-test.network/ext/bc/C/rpc` | Sourcify (exact_match) |
| Avalanche C-Chain | 43114 | `https://api.avax.network/ext/bc/C/rpc` | Sourcify |
| BEAM | 4337 | `https://build.onbeam.com/rpc` | Sourcify |

**ICMSync** is not deployed yet (marked as "future").

**Note:** Deployed bytecode is pre-security-audit. Source has reentrancy guards and zero-address checks that the deployed contracts lack.

Salts: `FACTORY_SALT = keccak256("oneclick-v2-factory")`, `PAYMASTER_SALT = keccak256("oneclick-v2-paymaster")`.

---

## 5. Deploy Infrastructure

| Component | Host | URL |
|-----------|------|-----|
| Demo app | Vercel | https://oneclick-orcin-nine.vercel.app |
| Relayer | Railway | https://oneclick-production-54fc.up.railway.app |
| Repo | GitHub | https://github.com/YMprobot/Oneclick |
| Contracts | Fuji + C-Chain + BEAM | See table above |

---

## 6. Repository Structure

```
oneclick/
├── contracts/                    # Foundry project (Solidity 0.8.24)
│   ├── src/
│   │   ├── OneClickWallet.sol          # Per-user wallet, P256 verification
│   │   ├── OneClickFactory.sol         # CREATE2 deterministic deploy
│   │   ├── Paymaster.sol               # Gas sponsorship
│   │   ├── ICMSync.sol                 # Cross-L1 key sync (Teleporter)
│   │   └── interfaces/                 # ITeleporterMessenger, ITeleporterReceiver
│   ├── test/                           # 39 Forge tests
│   │   ├── OneClickWallet.t.sol        # 20 tests (wallet + factory + paymaster)
│   │   ├── ICMSync.t.sol               # 19 tests (sync + teleporter)
│   │   └── mocks/                      # MockP256Verifier, MockTeleporterMessenger
│   ├── script/
│   │   ├── Deploy.s.sol                # Standard deploy (Factory, Paymaster, ICMSync)
│   │   └── DeployDeterministic.s.sol   # CREATE2 deploy via Nick's Factory
│   ├── deployments/                    # JSON records: fuji.json, mainnet.json, beam.json
│   ├── foundry.toml
│   └── SECURITY_AUDIT.md              # Contract-specific audit
├── relayer/                      # Node.js transaction relayer
│   ├── src/
│   │   ├── index.ts                    # Express app, chain registration
│   │   ├── router.ts                   # 13 API endpoints
│   │   ├── executor.ts                 # Blockchain interactions (ethers v6)
│   │   ├── chains.ts                   # Chain config registry
│   │   ├── swap.ts                     # TraderJoe LBRouter V2.1 calldata
│   │   ├── smartRouter.ts              # Auto-swap transaction planner
│   │   ├── tokens.ts                   # Token registry (USDC/USDT per chain)
│   │   ├── balanceChecker.ts           # Native + ERC20 balance queries
│   │   ├── transactions.ts             # Tx history (JSON persistence)
│   │   └── walletStore.ts              # Wallet keys (JSON persistence)
│   ├── data/                           # Persistent JSON (gitignored)
│   ├── Dockerfile                      # node:20-alpine, USER node
│   └── .env                            # Private key (gitignored)
├── sdk/                          # TypeScript SDK (npm: oneclick-wallet-sdk)
│   └── src/
│       ├── index.ts                    # Public exports
│       ├── connect.ts                  # connect() → OneClickWallet
│       ├── wallet.ts                   # OneClickWallet class
│       ├── webauthn.ts                 # WebAuthn + CBOR/COSE/DER parsing
│       └── types.ts                    # TypeScript interfaces
├── demo/                         # Next.js 15 demo app
│   └── src/
│       ├── app/page.tsx                # Login (create / sign-in)
│       ├── app/dashboard/page.tsx      # Multi-chain balances + USD prices
│       ├── app/send/page.tsx           # Send with Smart Route
│       ├── app/swap/page.tsx           # TraderJoe swap UI
│       ├── components/                 # Header, BalanceCard, CopyAddress, etc.
│       ├── context/WalletContext.tsx    # Wallet state (sessionStorage)
│       └── lib/webauthn.ts             # Standalone WebAuthn (no SDK import)
├── CLAUDE.md                     # AI development guidelines
├── SECURITY_AUDIT.md             # Full project security audit
├── INTEGRATION_GUIDE.md          # dApp developer integration guide
├── PROJECT_STATUS.md             # This file
├── README.md
├── .env.example
└── .gitignore
```

---

## 7. Relayer API Endpoints

Base URL: `https://oneclick-production-54fc.up.railway.app`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/deploy` | Deploy wallet on default chain (pubKeyX, pubKeyY) |
| POST | `/prepare-transaction` | Build challenge hash for passkey signing |
| POST | `/execute-transaction` | Submit signed tx (with smart routing) |
| POST | `/transaction/plan` | Preview transaction plan (detect auto-swap) |
| POST | `/swap/quote` | Get estimated swap output |
| POST | `/swap/execute` | Execute swap through wallet |
| GET | `/balance` | Wallet balance — one or all chains |
| GET | `/token-balances` | ERC-20 balances for a wallet on a chain |
| GET | `/transactions` | Transaction history (default limit: 20) |
| GET | `/chains` | List all registered chains |
| GET | `/tokens` | Token list per chain |
| GET | `/prices` | Token prices (CoinGecko + 5-min cache) |
| GET | `/health` | Health check |

---

## 8. SDK

**Package:** `oneclick-wallet-sdk` v0.1.0 (npm: **not yet published**)

| Export | Type | Description |
|--------|------|-------------|
| `connect(config)` | function | Create passkey + deploy wallet → `OneClickWallet` |
| `OneClickWallet` | class | `.address`, `.execute(tx)`, `.getBalance(chainId?)` |
| `createPasskey(username)` | function | WebAuthn `navigator.credentials.create()` → P256 pub key |
| `signChallenge(credentialId, challenge)` | function | WebAuthn `navigator.credentials.get()` → (r, s) |
| `OneClickConfig` | type | `{ relayerUrl: string }` |
| `TransactionRequest` | type | `{ target, value, data, chainId }` |
| `TransactionResponse` | type | `{ hash, chainId, status }` |
| `WalletInfo` | type | `{ address, pubKeyX, pubKeyY, credentialId }` |
| `PasskeyCredential` | type | `{ credentialId, pubKeyX, pubKeyY, rawId }` |
| `SignatureData` | type | `{ r, s, authenticatorData, clientDataJSON }` |

Build: `cd sdk && npm run build` (runs `tsc`, output to `dist/`).

---

## 9. Tests

**39 tests, 39 passed, 0 failed.** Run: `cd contracts && forge test -vvv`

| Suite | Count | Coverage |
|-------|-------|----------|
| OneClickWalletTest | 20 | Deploy, CREATE2, execute (P256 + WebAuthn + relayer), nonce, access control, Paymaster (deposit/withdraw/sponsor), smart route, reentrancy, zero-address |
| ICMSyncTest | 19 | Admin (register remote/wallet), sync (single/broadcast), receive (decode/key update), nonce/replay, E2E round-trip |

Mocks: `MockP256Verifier` (always returns 1), `MockTeleporterMessenger` (captures messages).

---

## 10. Known Limitations and TODO

**Security (from SECURITY_AUDIT.md):**
- `executeAsRelayer` has no user authorization — relayer key = full wallet control
- WebAuthn signature not bound to tx params — reusable by relayer
- No API authentication on relayer (no keys, no rate limiting)
- Wide-open CORS (`*`)
- Private key stored as plaintext in `.env` on disk
- Deployed contracts are pre-audit bytecode (missing reentrancy guard, zero-address checks)
- Mainnet chain registered but zero slippage was only recently fixed
- Hardcoded AVAX price ($25) for swap estimation — needs oracle

**Functional:**
- Token-to-token swap not supported (must use AVAX as intermediary)
- SDK has circular self-dependency in `package.json`
- ICMSync not deployed (contracts exist, tests pass, no on-chain deployment)
- No account recovery mechanism
- Wallet persistence is file-based JSON (not a database)
- Transaction history unbounded (no pagination, grows forever)
- Synchronous file I/O blocks event loop under load

---

## 11. Environment Variables

### Relayer (`relayer/.env`)

| Variable | Required | Default |
|----------|----------|---------|
| `PRIVATE_KEY` | **Yes** | — |
| `PORT` | No | `3000` |
| `FUJI_RPC_URL` | No | `https://api.avax-test.network/ext/bc/C/rpc` |
| `MAINNET_RPC_URL` | No | `https://api.avax.network/ext/bc/C/rpc` |
| `BEAM_RPC_URL` | No | `https://build.onbeam.com/rpc` |
| `FACTORY_ADDRESS` | No | `0x7ECeA257d8Fe653CA6C24CE744D589784DE5B188` |
| `PAYMASTER_ADDRESS` | No | `0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E` |

### Demo (`demo/.env.local`)

| Variable | Required | Default |
|----------|----------|---------|
| `NEXT_PUBLIC_RELAYER_URL` | No | `http://localhost:3000` |

Production: `https://oneclick-production-54fc.up.railway.app`

---

## 12. Local Development

```bash
# 1. Clone
git clone https://github.com/YMprobot/Oneclick.git
cd Oneclick

# 2. Contracts — build & test
cd contracts
forge build
forge test -vvv            # 39 tests, all pass

# 3. Relayer
cd ../relayer
cp ../.env.example .env    # fill in PRIVATE_KEY
npm install
npm run dev                # http://localhost:3000

# 4. Demo app
cd ../demo
npm install
npm run dev                # http://localhost:3001

# 5. SDK (if modifying)
cd ../sdk
npm install
npm run build              # tsc → dist/
```

---

## 13. Key Technical Decisions

| Decision | Why |
|----------|-----|
| **CREATE2 via Nick's Factory** | Same wallet address on every L1 from the same passkey. Users can receive funds before wallet is deployed on that chain. |
| **secp256r1 (P-256) passkeys** | Granite upgrade added `P256Verifier` precompile at `0x0100` (RIP-7212). Passkeys use P-256 natively — no key conversion needed. Device secure enclave stores private key. |
| **Not full ERC-4337** | ERC-4337 requires a bundler network, EntryPoint contract, and significant complexity. OneClick uses a simplified relayer model — same UX, 10x less code, faster to build for hackathon. |
| **WebAuthn + legacy P256 dual paths** | `execute()` binds sig to tx params (secure but single-tx only). `executeWithWebAuthn()` enables multi-step smart routing at the cost of weaker binding. |
| **`executeAsRelayer()` without user sig** | Enables Step 2 of smart routing after nonce increment. Accepted risk: relayer is trusted. |
| **File-based JSON persistence** | No database setup needed. Sufficient for hackathon demo. Wallets and tx history survive relayer restart. |
| **TraderJoe LBRouter V2.1** | Most liquid DEX on Avalanche. Supports native→token and token→native swaps. |

---

## 14. Priorities for Remaining Hackathon Days

| Priority | Task | Effort |
|----------|------|--------|
| 1 | Record walkthrough video | 1-2h |
| 2 | Publish SDK to npm (`npm publish`) | 15 min |
| 3 | Final README polish + video link | 15 min |
| 4 | Test demo end-to-end on Fuji (send + swap + smart route) | 30 min |
| 5 | Remove mainnet chain registration (safety) | 5 min |
| 6 | Push all commits, verify GitHub is up to date | 5 min |
