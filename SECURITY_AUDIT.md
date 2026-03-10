# OneClick Security Audit

**Date:** 2026-03-07
**Auditor:** Claude Code (automated)
**Scope:** Full project — Smart Contracts, Relayer, SDK, Demo App, Deploy & Configs
**Commit:** Latest on `main`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Smart Contracts](#1-smart-contracts-solidity)
3. [Relayer](#2-relayer-nodejstypescript)
4. [SDK](#3-sdk-typescript)
5. [Demo App](#4-demo-app-nextjs)
6. [Deploy & Configs](#5-deploy--configs)
7. [Summary Table](#summary-table)
8. [Recommendations Priority](#recommendations-priority)

---

## Executive Summary

OneClick is a passkey-based smart wallet for Avalanche L1s. This audit covers all components: Solidity contracts (4 files), Node.js relayer (10 files), TypeScript SDK (5 files), Next.js demo app (9 files), and deployment configurations.

**Totals:** 5 Critical, 6 High, 8 Medium, 6 Low, 4 Informational findings.

The most urgent issues are: (1) the relayer private key on disk with no rotation mechanism, (2) zero API authentication on the relayer, (3) WebAuthn signature reuse in `executeWithWebAuthn`, (4) zero slippage protection on testnet swaps, and (5) `executeAsRelayer` allowing relayer to drain wallets without user consent.

---

## 1. Smart Contracts (Solidity)

### C-01: `executeAsRelayer` has no user authorization [CRITICAL]

- **File:** `contracts/src/OneClickWallet.sol:140-156`
- **Description:** `executeAsRelayer()` allows the relayer to execute arbitrary calls from the wallet with no passkey signature required. Only `msg.sender == relayer` is checked. If the relayer private key is compromised, all user wallets can be drained immediately.
- **Impact:** Full fund theft for all deployed wallets if relayer key leaks.
- **Fix:** Add a scope limitation (e.g., whitelist of allowed targets for relayer-only calls), or require the user to pre-authorize specific operations via a signed approval, or implement a timelock.
- **Status:** DOCUMENTED (by design for multi-step smart routing). **Risk accepted for hackathon MVP.**

### C-02: `executeWithWebAuthn` does not bind signature to transaction parameters [HIGH]

- **File:** `contracts/src/OneClickWallet.sol:105-132`
- **Description:** The WebAuthn path verifies that the passkey signed `SHA-256(authenticatorData || SHA-256(clientDataJSON))` but does NOT bind this to the `target`, `value`, `data`, or `nonce`. The relayer can submit the same signature to execute any arbitrary transaction.
- **Impact:** A compromised relayer can reuse a valid WebAuthn signature to execute different transactions than what the user approved.
- **Fix:** Include the transaction hash (keccak256 of target, value, data, nonce) inside the `clientDataJSON.challenge` field and verify it on-chain. This is how proper WebAuthn verification works — the challenge should contain the transaction commitment.
- **Status:** DOCUMENTED (known design trade-off for multi-step smart routing).

### C-03: Reentrancy guard uses manual pattern [MEDIUM — FIXED]

- **File:** `contracts/src/OneClickWallet.sol:15,70-71,94`
- **Description:** Custom `bool _locked` reentrancy guard implemented. Applied to `execute()`, `executeWithWebAuthn()`, and `executeAsRelayer()`.
- **Impact:** Prevents reentrancy through external `target.call{value:}(data)`.
- **Fix:** Already applied. Guard uses manual unlock at function end (not in a modifier), which is acceptable given the function structure.
- **Status:** FIXED in current source. Note: deployed contracts on Fuji are pre-fix versions.

### C-04: Zero-address validation in `initialize()` [MEDIUM — FIXED]

- **File:** `contracts/src/OneClickWallet.sol:48-49`
- **Description:** `initialize()` now reverts if `_relayer` or `_verifier` is `address(0)`.
- **Impact:** Prevents accidental deployment with null relayer/verifier.
- **Status:** FIXED in current source. Deployed contracts are pre-fix.

### C-05: Paymaster `withdraw()` CEI pattern [MEDIUM — FIXED]

- **File:** `contracts/src/Paymaster.sol:44-52`
- **Description:** `withdraw()` now follows Checks-Effects-Interactions: emit event before external call. Also added `InsufficientBalance` check.
- **Impact:** Prevents reentrancy and over-withdrawal.
- **Status:** FIXED in current source. Deployed contracts are pre-fix.

### C-06: `initialize()` callable by anyone [MEDIUM]

- **File:** `contracts/src/OneClickWallet.sol:41-56`
- **Description:** `initialize()` is `external` with no caller restriction — whoever calls it first sets the relayer and verifier. In practice, the Factory calls it immediately after CREATE2 deployment in the same transaction, so frontrunning is theoretically possible but practically very unlikely.
- **Impact:** An attacker could frontrun the Factory's deploy+initialize in the same block and set themselves as the relayer. Extremely unlikely due to atomic nature of the Factory call.
- **Fix:** Add `onlyFactory` modifier or use a constructor-like pattern.
- **Status:** DOCUMENTED (acceptable for hackathon; Factory calls atomically).

### C-07: No per-depositor balance tracking in Paymaster [LOW]

- **File:** `contracts/src/Paymaster.sol`
- **Description:** Single pool of funds shared by all depositors. Any authorized relayer spends from the common pool. No accounting of who deposited what.
- **Impact:** One depositor can consume another's gas sponsorship funds.
- **Fix:** Add a `mapping(address => uint256) public deposits` and track per-depositor balances.
- **Status:** DOCUMENTED (acceptable for demo).

### C-08: ICMSync trusts remote `walletAddress` without verification [LOW]

- **File:** `contracts/src/ICMSync.sol:214`
- **Description:** `receiveTeleporterMessage()` calls `OneClickWallet(syncMsg.walletAddress).updateOwnerKey()` without verifying that the wallet address is legitimate or deployed by the Factory on this chain.
- **Impact:** A malicious message from a compromised remote ICMSync could point to any contract address. Mitigated by Teleporter authentication and remote contract registration checks.
- **Fix:** Verify wallet address against the Factory's `wallets` mapping.
- **Status:** DOCUMENTED (ICMSync is not yet deployed, marked as "future").

### C-09: Deployed contracts differ from audited source [INFORMATIONAL]

- **File:** All contracts on Fuji testnet
- **Description:** The contracts deployed on Fuji (Factory: `0x7ECeA257d8Fe653CA6C24CE744D589784DE5B188`, Paymaster: `0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E`) are pre-audit versions without reentrancy guards, zero-address checks, or Paymaster CEI fixes.
- **Impact:** On-chain contracts lack security improvements from this audit.
- **Fix:** Redeploy contracts with audited source code. Note: CREATE2 addresses will change due to different bytecode.
- **Status:** DOCUMENTED.

---

## 2. Relayer (Node.js/TypeScript)

### R-01: Private key on disk in plaintext [CRITICAL]

- **File:** `relayer/.env`
- **Description:** The relayer private key `a03eb75c...` is stored in plaintext in `.env` on disk. While `.env` is gitignored, anyone with server access can read it.
- **Impact:** Compromised server = full control over all user wallets via `executeAsRelayer`.
- **Fix:** Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, Railway encrypted env vars). Never store private keys in files.
- **Status:** OPEN.

### R-02: No API authentication [CRITICAL]

- **File:** `relayer/src/index.ts:14`, `relayer/src/router.ts`
- **Description:** All 13 API endpoints are completely unauthenticated. Anyone can call `/deploy`, `/execute-transaction`, `/swap/execute`, etc. No API keys, no JWT, no HMAC, no rate limiting.
- **Impact:** Anyone can deploy wallets (wasting relayer gas), execute arbitrary transactions through any wallet (if they have a valid WebAuthn sig), or DoS the service with unlimited requests.
- **Fix:** Add API key authentication for sensitive endpoints. Add rate limiting (e.g., `express-rate-limit`). At minimum, add an API key header check for transaction endpoints.
- **Status:** OPEN.

### R-03: Wide-open CORS [HIGH]

- **File:** `relayer/src/index.ts:14` — `app.use(cors())`
- **Description:** CORS is set to allow ALL origins (`*`). Any website can make requests to the relayer API.
- **Impact:** Malicious sites can silently interact with the relayer if a user visits them, potentially deploying wallets or submitting transactions.
- **Fix:** Restrict CORS to specific origins: `cors({ origin: ['https://oneclick-orcin-nine.vercel.app', 'http://localhost:3001'] })`.
- **Status:** OPEN.

### R-04: WebAuthn signature reuse across multiple transactions [HIGH]

- **File:** `relayer/src/router.ts:210-290`
- **Description:** In smart routing mode, the same WebAuthn signature is used for Step 1 (swap) and the relayer then uses `executeAsRelayer` for Step 2 (transfer). The WebAuthn signature itself is not bound to any specific transaction parameters (see C-02), so the relayer could theoretically reuse it for unrelated operations.
- **Impact:** If the relayer is compromised after a user signs once, the captured signature could be reused for different transactions.
- **Fix:** Bind the WebAuthn challenge to the full transaction plan (including all steps) and verify on-chain.
- **Status:** DOCUMENTED (known design trade-off for multi-step routing).

### R-05: Zero slippage protection on swaps [HIGH]

- **File:** `relayer/src/router.ts:260`, `relayer/src/router.ts:787-788,844`
- **Description:** `amountOutMin` is hardcoded to `0n` for all swap operations (both smart routing and direct swaps). Comment says "testnet: accept any output."
- **Impact:** 100% of swap value could be lost to sandwich attacks or extreme slippage on mainnet. This is especially dangerous since Avalanche mainnet (chainId 43114) is registered as a chain.
- **Fix:** Calculate minimum output based on oracle price with reasonable slippage tolerance (e.g., 1-3%). Never use `amountOutMin = 0` in production.
- **Status:** OPEN. **Must fix before mainnet usage.**

### R-06: No `helmet` middleware [MEDIUM]

- **File:** `relayer/src/index.ts`
- **Description:** Express server does not use `helmet` for security headers (X-Frame-Options, Content-Security-Policy, X-Content-Type-Options, etc.).
- **Impact:** Susceptible to clickjacking, MIME-type sniffing, and other HTTP-level attacks.
- **Fix:** `npm install helmet` and add `app.use(helmet())`.
- **Status:** OPEN.

### R-07: Unbounded transaction history [MEDIUM]

- **File:** `relayer/src/transactions.ts`
- **Description:** Transaction history grows without limit. All transactions are loaded into memory on startup and saved synchronously to `relayer/data/transactions.json`.
- **Impact:** Memory exhaustion and slow startup over time. Synchronous file writes block the event loop.
- **Fix:** Add max transaction limit per wallet, implement pagination, use async file writes or a database.
- **Status:** OPEN.

### R-08: Hardcoded AVAX price ($25) for swap estimation [MEDIUM]

- **File:** `relayer/src/smartRouter.ts:105`, `relayer/src/router.ts:684`
- **Description:** Swap amount calculations use a hardcoded `avaxPriceUsd = 25`. If AVAX price changes significantly, auto-swap calculations will be incorrect.
- **Impact:** Users may swap too much or too little AVAX when auto-swap is triggered. Could lead to failed transactions or excess spending.
- **Fix:** Use the CoinGecko price from the `/prices` endpoint or an on-chain oracle.
- **Status:** OPEN.

### R-09: Verbose logging of sensitive data [LOW]

- **File:** `relayer/src/router.ts` (multiple lines), `relayer/src/executor.ts`
- **Description:** Console.log statements output wallet addresses, public keys, transaction data, signatures, and challenge hashes. Line 144 logs the entire request body: `JSON.stringify(req.body)`.
- **Impact:** Log files contain sensitive operational data. In a shared hosting environment, logs may be accessible to other users.
- **Fix:** Use structured logging with configurable log levels. Remove full request body logging. Redact signature data.
- **Status:** OPEN.

### R-10: Synchronous file I/O blocks event loop [LOW]

- **File:** `relayer/src/walletStore.ts`, `relayer/src/transactions.ts`
- **Description:** `JSON.stringify` + `fs.writeFileSync` is used to persist wallet keys and transaction history. This blocks the Node.js event loop during writes.
- **Impact:** Under high load, synchronous writes will cause request latency spikes.
- **Fix:** Use `fs.promises.writeFile` with a write queue/debounce pattern.
- **Status:** OPEN.

---

## 3. SDK (TypeScript)

### S-01: RS256 fallback in `pubKeyCredParams` [MEDIUM]

- **File:** `sdk/src/webauthn.ts:251`
- **Description:** `pubKeyCredParams` includes `{ alg: -257, type: 'public-key' }` (RS256) as a fallback. If the authenticator does not support ES256 (P-256), it will use RSA. The COSE key parser then attempts to extract P-256 coordinates (keys -2 and -3) from an RSA key, which will fail with a confusing error.
- **Impact:** If a user's device only supports RSA authenticators, they get a cryptic "Could not extract public key coordinates" error instead of a clear message.
- **Fix:** After credential creation, check the algorithm used. If not ES256, throw a clear error: "Your device does not support P-256 passkeys, which are required for OneClick."
- **Status:** OPEN.

### S-02: No input validation on relayer URL [LOW]

- **File:** `sdk/src/connect.ts:14`, `sdk/src/wallet.ts:33,56,90`
- **Description:** The `relayerUrl` from config is used directly in `fetch()` without validation. A malicious or misconfigured URL could cause unexpected behavior.
- **Impact:** Minor — developers control the config. Could theoretically be used for SSRF if the SDK runs server-side.
- **Fix:** Validate that `relayerUrl` is a valid HTTPS URL in production.
- **Status:** OPEN.

### S-03: SDK has circular dependency [INFORMATIONAL]

- **File:** `sdk/package.json:32`
- **Description:** `dependencies` includes `"oneclick-wallet-sdk": "^0.1.0"` — the package depends on itself.
- **Impact:** `npm install` may create unexpected behavior or fail in certain package manager versions.
- **Fix:** Remove the self-dependency from `package.json`.
- **Status:** OPEN.

---

## 4. Demo App (Next.js)

### D-01: Public keys stored in `localStorage` [MEDIUM]

- **File:** `demo/src/lib/webauthn.ts:282`
- **Description:** After passkey creation, the public key coordinates (pubKeyX, pubKeyY) are stored in `localStorage` keyed by credential ID. This data persists across sessions and is accessible to any JavaScript on the same origin.
- **Impact:** An XSS vulnerability would expose public keys. While public keys alone cannot sign transactions, they reveal wallet addresses and could be used to prepare attacks.
- **Fix:** Consider storing in `sessionStorage` (already done for wallet state) or encrypting with a session key.
- **Status:** OPEN.

### D-02: Wallet address passed as URL query parameter [LOW]

- **File:** `demo/src/app/dashboard/page.tsx:60-63`
- **Description:** Wallet address is sent as a query parameter in GET requests: `fetch(\`${RELAYER_URL}/balance?walletAddress=${wallet.address}\`)`. This exposes the address in server logs, browser history, and referrer headers.
- **Impact:** Privacy concern — wallet addresses leak through standard HTTP infrastructure.
- **Fix:** Use POST requests for wallet-specific queries, or accept this as inherent to blockchain (addresses are public anyway).
- **Status:** DOCUMENTED (acceptable for blockchain use case).

### D-03: No CSP headers configured [LOW]

- **File:** `demo/next.config.mjs`
- **Description:** Next.js config is empty — no Content-Security-Policy, no security headers configured.
- **Impact:** No protection against inline script injection or loading of unauthorized external resources.
- **Fix:** Add security headers via `next.config.mjs` headers configuration or middleware.
- **Status:** OPEN.

### D-04: `.env.local` committed to git [INFORMATIONAL]

- **File:** `demo/.env.local`
- **Description:** `.env.local` contains only `NEXT_PUBLIC_RELAYER_URL=https://oneclick.up.railway.app` which is public information (NEXT_PUBLIC prefix). However, committing `.env.local` is against Next.js conventions.
- **Impact:** No security impact (only public env vars). Convention violation.
- **Fix:** Add `demo/.env.local` to `.gitignore`.
- **Status:** OPEN.

---

## 5. Deploy & Configs

### DC-01: Docker runs as root [CRITICAL]

- **File:** `relayer/Dockerfile`
- **Description:** The Dockerfile does not specify a non-root user. The relayer process runs as root inside the container, with the private key accessible.
- **Impact:** If an attacker achieves code execution inside the container (e.g., via a dependency vulnerability), they have root access, can exfiltrate the private key, and potentially escape the container.
- **Fix:** Add a non-root user:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  ```
- **Status:** OPEN.

### DC-02: Mainnet chain registered but contracts not audited for production [HIGH]

- **File:** `relayer/src/index.ts:42-59`
- **Description:** Avalanche C-Chain mainnet (chainId 43114) is registered with real mainnet contract addresses and RPC URL. The relayer can execute transactions on mainnet where real funds are at stake, but zero slippage protection and other security issues remain unfixed.
- **Impact:** Users could lose real funds through sandwich attacks or relayer compromise on mainnet.
- **Fix:** Remove mainnet chain registration until all CRITICAL and HIGH issues are resolved. Or add a `ENABLE_MAINNET=true` flag that defaults to false.
- **Status:** OPEN. **Must address before any mainnet usage.**

### DC-03: No request body size limit [MEDIUM]

- **File:** `relayer/src/index.ts:15` — `app.use(express.json())`
- **Description:** `express.json()` is used without a body size limit. Default is 100KB, but this should be explicitly set to prevent abuse.
- **Impact:** An attacker could send very large JSON payloads to consume server memory.
- **Fix:** `app.use(express.json({ limit: '10kb' }))`.
- **Status:** OPEN.

### DC-04: Single relayer key for all chains [INFORMATIONAL]

- **File:** `relayer/src/executor.ts:22-25`
- **Description:** The same private key is used as the relayer/signer for all chains (Fuji, Mainnet, BEAM). Compromise of one environment exposes all.
- **Impact:** Defense-in-depth concern. Single point of failure across all networks.
- **Fix:** Use separate keys per environment (testnet vs mainnet), ideally with different wallets for different trust levels.
- **Status:** DOCUMENTED.

---

## Summary Table

| ID | Severity | Component | Title | Status |
|----|----------|-----------|-------|--------|
| C-01 | CRITICAL | Contracts | `executeAsRelayer` has no user authorization | Documented |
| R-01 | CRITICAL | Relayer | Private key on disk in plaintext | Open |
| R-02 | CRITICAL | Relayer | No API authentication | Open |
| DC-01 | CRITICAL | Deploy | Docker runs as root | Open |
| R-05 | CRITICAL* | Relayer | Zero slippage protection on swaps | Open |
| C-02 | HIGH | Contracts | WebAuthn sig not bound to tx params | Documented |
| R-03 | HIGH | Relayer | Wide-open CORS | Open |
| R-04 | HIGH | Relayer | WebAuthn signature reuse | Documented |
| DC-02 | HIGH | Deploy | Mainnet registered without safeguards | Open |
| C-03 | MEDIUM | Contracts | Reentrancy guard (manual pattern) | Fixed |
| C-04 | MEDIUM | Contracts | Zero-address validation | Fixed |
| C-05 | MEDIUM | Contracts | Paymaster CEI pattern | Fixed |
| C-06 | MEDIUM | Contracts | `initialize()` callable by anyone | Documented |
| R-06 | MEDIUM | Relayer | No `helmet` middleware | Open |
| R-07 | MEDIUM | Relayer | Unbounded transaction history | Open |
| R-08 | MEDIUM | Relayer | Hardcoded AVAX price | Open |
| S-01 | MEDIUM | SDK | RS256 fallback confusion | Open |
| D-01 | MEDIUM | Demo | Public keys in localStorage | Open |
| DC-03 | MEDIUM | Deploy | No request body size limit | Open |
| C-07 | LOW | Contracts | No per-depositor tracking | Documented |
| C-08 | LOW | Contracts | ICMSync trusts remote address | Documented |
| R-09 | LOW | Relayer | Verbose logging | Open |
| R-10 | LOW | Relayer | Synchronous file I/O | Open |
| S-02 | LOW | SDK | No input validation on relayer URL | Open |
| D-02 | LOW | Demo | Wallet address in URL params | Documented |
| D-03 | LOW | Demo | No CSP headers | Open |
| C-09 | INFO | Contracts | Deployed != audited source | Documented |
| S-03 | INFO | SDK | Circular self-dependency | Open |
| D-04 | INFO | Demo | .env.local committed | Open |
| DC-04 | INFO | Deploy | Single key for all chains | Documented |

*R-05 elevated to CRITICAL because mainnet is registered and has zero slippage.

---

## Recommendations Priority

### Before Mainnet (MUST FIX)

1. **Remove mainnet chain registration** or add explicit opt-in flag (DC-02)
2. **Fix zero slippage**: never use `amountOutMin = 0` on mainnet (R-05)
3. **Move private key to secrets manager** (R-01)
4. **Add API authentication** to relayer endpoints (R-02)
5. **Restrict CORS** to allowed origins (R-03)
6. **Add non-root user** to Dockerfile (DC-01)

### Before Production (SHOULD FIX)

7. Bind WebAuthn challenge to transaction parameters (C-02)
8. Add `helmet` middleware (R-06)
9. Add request body size limit (DC-03)
10. Fix SDK circular dependency (S-03)
11. Add CSP headers to demo (D-03)
12. Check passkey algorithm after creation (S-01)

### Nice to Have (Improvements)

13. Per-depositor Paymaster tracking (C-07)
14. Async file I/O in relayer (R-10)
15. Structured logging with levels (R-09)
16. Transaction history pagination (R-07)
17. Use oracle for AVAX price (R-08)
18. Redeploy contracts with audit fixes (C-09)

---

*This audit was performed by automated analysis. Manual review and formal verification are recommended before mainnet deployment with real funds.*
