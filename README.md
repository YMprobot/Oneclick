# OneClick

Universal smart wallet with passkey authentication for Avalanche L1s.

## What is OneClick?

OneClick lets users interact with multiple Avalanche L1 blockchains using just their fingerprint. No seed phrases, no gas fees, no network switching.

## Tech Stack

- Smart Contracts: Solidity 0.8.24 + Foundry
- Passkey verification: secp256r1 precompile (RIP-7212)
- Cross-L1 messaging: Avalanche ICM
- Relayer: Node.js + TypeScript + ethers.js v6
- SDK: TypeScript + WebAuthn API
- Demo: Next.js + TailwindCSS

## Build

```bash
cd contracts && forge build
```

## Test

```bash
cd contracts && forge test -vvv
```

## Project Structure

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

## License

MIT
