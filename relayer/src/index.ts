import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { registerChain } from './chains.js';
import { Executor } from './executor.js';
import { createRouter } from './router.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

registerChain({
  chainId: 43113,
  name: 'Fuji C-Chain',
  rpcUrl: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  factoryAddress: process.env.FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
  paymasterAddress: process.env.PAYMASTER_ADDRESS || '0x0000000000000000000000000000000000000000',
});

const executor = new Executor(process.env.PRIVATE_KEY || '');
const router = createRouter(executor);
app.use('/', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OneClick Relayer running on port ${PORT}`);
});
