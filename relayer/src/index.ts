import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { registerChain } from './chains.js';
import { Executor } from './executor.js';
import { createRouter } from './router.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Deterministic contract addresses — same on all chains (deployed via CREATE2 + Nick's Factory)
const factoryAddress = process.env.FACTORY_ADDRESS || '0x7ECeA257d8Fe653CA6C24CE744D589784DE5B188';
const paymasterAddress = process.env.PAYMASTER_ADDRESS || '0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E';

// Fuji C-Chain (testnet)
registerChain({
  chainId: 43113,
  name: 'Fuji C-Chain',
  rpcUrl: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  factoryAddress,
  paymasterAddress,
  nativeSymbol: 'AVAX',
  explorerUrl: 'https://testnet.snowtrace.io',
  swap: {
    routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    wavaxAddress: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c',
    tokens: [
      { symbol: 'USDC', address: '0xB6076C93701D6a07266c31066B298AeC6dd65c2d', decimals: 6 },
      { symbol: 'USDT', address: '0xAb231A5744C8E6c45481754928cCfFFFD4aa0732', decimals: 6 },
    ],
    defaultBinStep: 20,
  },
});

// Avalanche C-Chain (mainnet)
registerChain({
  chainId: 43114,
  name: 'Avalanche C-Chain',
  rpcUrl: process.env.MAINNET_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  factoryAddress,
  paymasterAddress,
  nativeSymbol: 'AVAX',
  explorerUrl: 'https://snowtrace.io',
  swap: {
    routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    wavaxAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    tokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6 },
    ],
    defaultBinStep: 20,
  },
});

// BEAM L1 (gaming chain)
registerChain({
  chainId: 4337,
  name: 'BEAM',
  rpcUrl: process.env.BEAM_RPC_URL || 'https://build.onbeam.com/rpc',
  factoryAddress,
  paymasterAddress,
  nativeSymbol: 'BEAM',
  explorerUrl: 'https://subnets.avax.network/beam',
});

const executor = new Executor(process.env.PRIVATE_KEY || '');
const router = createRouter(executor);
app.use('/', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OneClick Relayer running on port ${PORT}`);
});
