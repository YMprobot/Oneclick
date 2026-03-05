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

// Fuji C-Chain (testnet)
registerChain({
  chainId: 43113,
  name: 'Fuji C-Chain',
  rpcUrl: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  factoryAddress: process.env.FUJI_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
  paymasterAddress: process.env.FUJI_PAYMASTER_ADDRESS || '0x0000000000000000000000000000000000000000',
});

// Avalanche C-Chain (mainnet)
registerChain({
  chainId: 43114,
  name: 'Avalanche C-Chain',
  rpcUrl: process.env.MAINNET_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  factoryAddress: process.env.MAINNET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
  paymasterAddress: process.env.MAINNET_PAYMASTER_ADDRESS || '0x0000000000000000000000000000000000000000',
});

const executor = new Executor(process.env.PRIVATE_KEY || '');
const router = createRouter(executor);
app.use('/', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OneClick Relayer running on port ${PORT}`);
});
