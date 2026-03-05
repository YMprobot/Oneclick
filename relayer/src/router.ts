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
      const { walletAddress: requestedAddress, target, value, data, chainId } = req.body;

      console.log(`POST /prepare-transaction — wallet: ${requestedAddress}, target: ${target}, value: ${value}, chainId: ${chainId}`);

      if (!requestedAddress || !target || value === undefined || !data || !chainId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Resolve the correct wallet address for the target chain
      const keys = getWalletKeys(requestedAddress);
      if (!keys) {
        res.status(400).json({ error: 'Wallet keys not found. Please reconnect.' });
        return;
      }

      const walletAddress = await executor.ensureWalletDeployed(chainId, keys.pubKeyX, keys.pubKeyY);
      console.log(`  resolved wallet for chain ${chainId}: ${walletAddress} (requested: ${requestedAddress})`);

      const nonce = await executor.getNonce(chainId, walletAddress);

      const challenge = ethers.solidityPackedKeccak256(
        ['address', 'address', 'uint256', 'bytes', 'uint256'],
        [walletAddress, target, value, data, nonce]
      );

      console.log(`  challenge: ${challenge}, nonce: ${nonce}`);
      res.json({ challenge, nonce: nonce.toString(), walletAddress });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /prepare-transaction failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  // POST /execute-transaction — submit signed transaction
  router.post('/execute-transaction', async (req, res) => {
    try {
      const { walletAddress: requestedAddress, target, value, data, chainId, signature } = req.body;

      console.log(`POST /execute-transaction — wallet: ${requestedAddress}, target: ${target}, value: ${value}, chainId: ${chainId}`);

      if (!requestedAddress || !target || value === undefined || !data || !chainId || !signature) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Resolve the correct wallet address for the target chain
      const keys = getWalletKeys(requestedAddress);
      if (!keys) {
        res.status(400).json({ error: 'Wallet keys not found. Please reconnect.' });
        return;
      }

      const walletAddress = await executor.ensureWalletDeployed(chainId, keys.pubKeyX, keys.pubKeyY);
      console.log(`  resolved wallet for chain ${chainId}: ${walletAddress} (requested: ${requestedAddress})`);

      const { r, s, authenticatorData, clientDataJSON } = signature;
      if (!r || !s) {
        res.status(400).json({ error: 'Signature must include r and s' });
        return;
      }

      // Pack r + s into 64-byte signature (strip 0x prefix, concatenate)
      const rClean = r.startsWith('0x') ? r.slice(2) : r;
      const sClean = s.startsWith('0x') ? s.slice(2) : s;
      const packedSignature = '0x' + rClean + sClean;

      console.log(`  path: ${authenticatorData ? 'WebAuthn' : 'Legacy P256'}, sig length: ${packedSignature.length}`);

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

      console.log(`  confirmed: ${hash}`);
      res.json({ hash, chainId, status: 'confirmed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /execute-transaction failed: ${message}`);
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
      const requestedAddress = req.query.walletAddress as string;
      const chainIdParam = req.query.chainId as string | undefined;

      if (!requestedAddress) {
        res.status(400).json({ error: 'Missing walletAddress query parameter' });
        return;
      }

      const keys = getWalletKeys(requestedAddress);

      if (chainIdParam) {
        const chainId = parseInt(chainIdParam, 10);
        // Resolve chain-specific address if keys are available
        const chainWalletAddress = keys
          ? await executor.getWalletAddress(chainId, keys.pubKeyX, keys.pubKeyY)
          : requestedAddress;
        const balance = await executor.getBalance(chainId, chainWalletAddress);
        res.json([{ chainId, balance, walletAddress: chainWalletAddress }]);
        return;
      }

      // Return balances for all registered chains
      const chains = getAllChains();
      const balances = await Promise.all(
        chains.map(async (chain) => {
          // Resolve chain-specific address if keys are available
          const chainWalletAddress = keys
            ? await executor.getWalletAddress(chain.chainId, keys.pubKeyX, keys.pubKeyY)
            : requestedAddress;
          const balance = await executor.getBalance(chain.chainId, chainWalletAddress);
          return { chainId: chain.chainId, balance, walletAddress: chainWalletAddress };
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
