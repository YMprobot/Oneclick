import { Router } from 'express';
import { ethers } from 'ethers';
import { Executor } from './executor.js';
import { getAllChains, getChain, getDefaultChainId } from './chains.js';
import { addTransaction, getTransactions } from './transactions.js';
import { storeWallet, getWalletKeys } from './walletStore.js';

export function createRouter(executor: Executor): Router {
  const router = Router();

  // POST /deploy — deploy wallet on default chain
  router.post('/deploy', async (req, res) => {
    try {
      const { pubKeyX, pubKeyY } = req.body;

      if (!pubKeyX || !pubKeyY) {
        res.status(400).json({
          error: 'Missing pubKeyX or pubKeyY',
          received: { pubKeyX: !!pubKeyX, pubKeyY: !!pubKeyY },
        });
        return;
      }

      // Ensure 0x prefix and proper bytes32 format
      const x = pubKeyX.startsWith('0x') ? pubKeyX : '0x' + pubKeyX;
      const y = pubKeyY.startsWith('0x') ? pubKeyY : '0x' + pubKeyY;

      console.log(`POST /deploy — pubKeyX: ${x}, pubKeyY: ${y}`);

      const chainId = getDefaultChainId();
      const walletAddress = await executor.deployWallet(chainId, x, y);
      storeWallet(walletAddress, x, y);

      console.log(`Wallet deployed at ${walletAddress} on chain ${chainId}`);
      res.json({ walletAddress, chainId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /deploy failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  // POST /prepare-transaction — build challenge hash for signing
  router.post('/prepare-transaction', async (req, res) => {
    try {
      const { walletAddress, target, value, data, chainId } = req.body;

      if (!walletAddress || !target || value === undefined || !data || !chainId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Auto-deploy wallet on target chain if not yet deployed
      const prepareKeys = getWalletKeys(walletAddress);
      if (prepareKeys) {
        await executor.ensureWalletDeployed(chainId, prepareKeys.pubKeyX, prepareKeys.pubKeyY);
      }

      const nonce = await executor.getNonce(chainId, walletAddress);

      const challenge = ethers.solidityPackedKeccak256(
        ['address', 'address', 'uint256', 'bytes', 'uint256'],
        [walletAddress, target, value, data, nonce]
      );

      res.json({ challenge, nonce: nonce.toString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // POST /execute-transaction — submit signed transaction
  router.post('/execute-transaction', async (req, res) => {
    try {
      const { walletAddress, target, value, data, chainId, signature } = req.body;

      if (!walletAddress || !target || value === undefined || !data || !chainId || !signature) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Auto-deploy wallet on target chain if not yet deployed
      const executeKeys = getWalletKeys(walletAddress);
      if (executeKeys) {
        await executor.ensureWalletDeployed(chainId, executeKeys.pubKeyX, executeKeys.pubKeyY);
      }

      const { r, s, authenticatorData, clientDataJSON } = signature;
      if (!r || !s) {
        res.status(400).json({ error: 'Signature must include r and s' });
        return;
      }

      // Pack r + s into 64-byte signature (strip 0x prefix, concatenate)
      const rClean = r.startsWith('0x') ? r.slice(2) : r;
      const sClean = s.startsWith('0x') ? s.slice(2) : s;
      const packedSignature = '0x' + rClean + sClean;

      let hash: string;

      if (authenticatorData && clientDataJSON) {
        // WebAuthn path: pass authenticatorData + clientDataJSON to contract
        hash = await executor.executeWithWebAuthn(
          chainId,
          walletAddress,
          target,
          value,
          data,
          authenticatorData,
          clientDataJSON,
          packedSignature
        );
      } else {
        // Legacy path: direct P256 verification
        hash = await executor.executeTransaction(
          chainId,
          walletAddress,
          target,
          value,
          data,
          packedSignature
        );
      }

      const chain = getChain(chainId);
      addTransaction({
        id: crypto.randomUUID(),
        walletAddress,
        target,
        value,
        chainId,
        chainName: chain?.name || `Chain ${chainId}`,
        nativeSymbol: chain?.nativeSymbol || 'AVAX',
        explorerUrl: chain?.explorerUrl || '',
        hash,
        status: 'confirmed',
        timestamp: Date.now(),
      });

      res.json({ hash, chainId, status: 'confirmed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // GET /transactions — transaction history for a wallet
  router.get('/transactions', (req, res) => {
    const walletAddress = req.query.walletAddress as string;
    const limitParam = req.query.limit as string | undefined;

    if (!walletAddress) {
      res.status(400).json({ error: 'Missing walletAddress query parameter' });
      return;
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const records = getTransactions(walletAddress, limit);
    res.json(records);
  });

  // GET /balance — wallet balance for one or all chains
  router.get('/balance', async (req, res) => {
    try {
      const walletAddress = req.query.walletAddress as string;
      const chainIdParam = req.query.chainId as string | undefined;

      if (!walletAddress) {
        res.status(400).json({ error: 'Missing walletAddress query parameter' });
        return;
      }

      if (chainIdParam) {
        const chainId = parseInt(chainIdParam, 10);
        const balance = await executor.getBalance(chainId, walletAddress);
        res.json([{ chainId, balance }]);
        return;
      }

      // Return balances for all registered chains
      const chains = getAllChains();
      const balances = await Promise.all(
        chains.map(async (chain) => {
          const balance = await executor.getBalance(chain.chainId, walletAddress);
          return { chainId: chain.chainId, balance };
        })
      );

      res.json(balances);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // GET /chains — list all registered chains
  router.get('/chains', (_req, res) => {
    const chains = getAllChains();
    res.json(chains);
  });

  // GET /health — health check
  router.get('/health', (_req, res) => {
    const chains = getAllChains();
    res.json({ status: 'ok', chains: chains.length });
  });

  return router;
}
