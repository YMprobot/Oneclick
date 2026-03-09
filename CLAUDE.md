# OneClick — CLAUDE.md
## Project Overview
OneClick is a universal smart wallet with passkey/biometric authentication (FaceID/TouchID) for Avalanche L1 blockchains. Built for Avalanche Build Games 2026 hackathon.
Users authenticate with fingerprint, never see seed phrases, gas fees, or network switching.
## Architecture
```
User (FaceID/TouchID)
  → OneClick SDK (TypeScript, npm package)
    → Relayer (Node.js, ethers.js v6)
      → Smart Contracts (Solidity, on each L1)
        → Connected via Avalanche ICM
```
### Smart Contracts (Foundry)
- `OneClickWallet.sol` — per-user wallet, passkey-verified execution via P256 precompile (0x0100)
- `OneClickFactory.sol` — CREATE2 deterministic wallet deployment
- `Paymaster.sol` — gas sponsorship, dApp devs deposit funds
- `ICMSync.sol` — cross-L1 key sync via Avalanche Interchain Messaging
### Relayer (Node.js)
- Receives user intents from SDK
- Routes to correct L1
- Submits meta-transactions
- Auto-deploys wallet on new L1s
### SDK (TypeScript)
- WebAuthn API for passkey create/sign
- Public API: connect(), execute(), getBalance()
- Talks to relayer, not directly to chain
### Demo App (Next.js)
- Landing page (marketing) at `/`
- Login with fingerprint at `/app`
- Dashboard with multi-chain balances + USD prices at `/dashboard`
- Send with Smart Route at `/send`
- TraderJoe swap UI at `/swap`
- Transaction history at `/activity`
- 11 reusable components, WalletContext with sessionStorage
## Tech Stack & Versions
- Solidity: 0.8.24
- Foundry (forge, cast, anvil)
- Node.js: 20+
- TypeScript: 5.x, strict mode
- ethers.js: v6 (NOT v5)
- Next.js: 15 (App Router)
- TailwindCSS: 4
- Target networks: Avalanche Fuji (43113), Avalanche C-Chain mainnet (43114), BEAM (4337)
## Code Conventions
### Solidity
- SPDX license: MIT
- Pragma: solidity ^0.8.24
- Use explicit types: uint256 (not uint), address (not addr)
- Named imports: `import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";`
- NatSpec comments on all public/external functions
- Events for all state changes
- Custom errors preferred over require strings where possible
- Test prefix: `test` (e.g., `testExecuteWithValidSignature`)
- One test file per contract
### TypeScript
- Strict mode always
- No `any` type — use proper interfaces
- Async/await, no raw promises
- Named exports
- camelCase for functions/variables, PascalCase for types/interfaces
### General
- All code, comments, commit messages, docs: English
- User-facing UI text: English
- Developer communication: Russian (but Claude Code works in English)
## Commands
```bash
# Contracts
cd contracts && forge build          # compile
cd contracts && forge test -vvv      # run tests
cd contracts && forge fmt            # format solidity
# SDK
cd sdk && npm install
cd sdk && npm run build
# Relayer
cd relayer && npm install
cd relayer && npm run dev
# Demo
cd demo && npm install
cd demo && npm run dev
```
## Repository Structure
```
oneclick/
├── contracts/               # Foundry project
│   ├── src/                 # Contract source files
│   ├── test/                # Forge tests
│   ├── script/              # Deploy scripts
│   └── foundry.toml
├── relayer/                 # Node.js transaction relayer
│   └── src/
├── sdk/                     # TypeScript SDK (npm package)
│   └── src/
├── demo/                    # Next.js demo app
│   └── app/
├── CLAUDE.md
├── .env.example
├── .gitignore
└── README.md
```
## Key Technical Details
### P256 (secp256r1) Passkey Verification
- Avalanche Granite upgrade added P256Verifier precompile at `address(0x0100)`
- This is RIP-7212 compatible
- Input: `abi.encode(bytes32 messageHash, bytes32 r, bytes32 s, bytes32 pubKeyX, bytes32 pubKeyY)`
- Output: `uint256(1)` if valid, `uint256(0)` or revert if invalid
- Use `staticcall` to invoke
### WebAuthn / Passkey Flow
1. Registration: `navigator.credentials.create()` → extract P256 public key (x, y) from COSE
2. Signing: `navigator.credentials.get()` → extract (r, s) from DER signature
3. Convert DER → raw 64 bytes (32 r + 32 s) for Solidity
4. Challenge = keccak256 hash of transaction data
### CREATE2 Deterministic Addresses
- Salt = keccak256(abi.encodePacked(pubKeyX, pubKeyY))
- Same pubkey → same wallet address on every L1
- Wallet can receive funds before deployment
### Gas Sponsorship (Paymaster)
- dApp devs deposit AVAX into Paymaster
- Relayer calls Paymaster.sponsorTransaction()
- Paymaster calls Wallet.execute()
- On Fuji testnet gas is free anyway — this demonstrates the architecture
## Important Constraints
- DO NOT use ERC-4337 bundler — we use a simplified relayer model
- DO NOT build AMM/DEX logic — we route to existing DEXs
- DO NOT use ethers.js v5 — only v6
- DO NOT use Hardhat — only Foundry
- DO NOT use constructor for wallet init — use initialize() pattern for CREATE2
- Mock P256Verifier in tests (precompile not available in forge test)
## Testing Strategy
### Contracts
- MockP256Verifier: always returns `abi.encode(uint256(1))`
- Pass verifier address to wallet initialize() — real precompile in prod, mock in tests
- Test through Factory (deploy + execute flow)
- Test access control (onlyRelayer)
- Test nonce increment
- Test Paymaster deposit/withdraw/sponsor
### SDK
- Unit test WebAuthn key extraction with known test vectors
- Integration: mock relayer responses
## Current Status
Phase 1 COMPLETE. All contracts deployed on 3 chains (Fuji, C-Chain, BEAM). Relayer live on Railway (13 endpoints). SDK published on npm. Demo deployed on Vercel. 39/39 tests passing. Smart Route, TraderJoe swap, ICM key sync, Paymaster — all working.

### Deployed Infrastructure
- **Relayer:** https://oneclick-production-54fc.up.railway.app
- **Demo:** https://oneclick-orcin-nine.vercel.app
- **SDK:** https://www.npmjs.com/package/oneclick-wallet-sdk
- **Factory:** `0x7ECeA257d8Fe653CA6C24CE744D589784DE5B188`
- **Paymaster:** `0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E`
