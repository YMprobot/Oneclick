import { Router } from 'express';
import { ethers } from 'ethers';
import { Executor } from './executor.js';
import { getAllChains, getChain, getDefaultChainId } from './chains.js';
import { addTransaction, getTransactions } from './transactions.js';
import { storeWallet, getWalletKeys } from './walletStore.js';
import { getTokensForChain } from './tokens.js';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

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
      const { walletAddress: requestedAddress, target, value, data, chainId, tokenAddress } = req.body;

      console.log(`POST /prepare-transaction — wallet: ${requestedAddress}, target: ${target}, value: ${value}, chainId: ${chainId}, token: ${tokenAddress || 'native'}`);

      if (!requestedAddress || !target || value === undefined || !chainId) {
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

      let actualTarget: string;
      let actualValue: string;
      let actualData: string;

      if (tokenAddress) {
        // ERC-20 transfer: wallet calls token contract's transfer(to, amount)
        const iface = new ethers.Interface(ERC20_ABI);
        const transferData = iface.encodeFunctionData('transfer', [target, BigInt(value)]);
        actualTarget = tokenAddress;
        actualValue = '0';
        actualData = transferData;
      } else {
        // Native token transfer
        actualTarget = target;
        actualValue = value;
        actualData = data || '0x';
      }

      const nonce = await executor.getNonce(chainId, walletAddress);

      const challenge = ethers.solidityPackedKeccak256(
        ['address', 'address', 'uint256', 'bytes', 'uint256'],
        [walletAddress, actualTarget, actualValue, actualData, nonce]
      );

      console.log(`  challenge: ${challenge}, nonce: ${nonce}`);
      res.json({ challenge, nonce: nonce.toString(), walletAddress, actualTarget, actualValue, actualData });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /prepare-transaction failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  // POST /execute-transaction — submit signed transaction
  router.post('/execute-transaction', async (req, res) => {
    try {
      const { walletAddress: requestedAddress, target, value, data, chainId, signature, tokenAddress } = req.body;

      console.log(`POST /execute-transaction — wallet: ${requestedAddress}, target: ${target}, value: ${value}, chainId: ${chainId}, token: ${tokenAddress || 'native'}`);

      if (!requestedAddress || !target || value === undefined || !chainId || !signature) {
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

      let actualTarget: string;
      let actualValue: string;
      let actualData: string;

      if (tokenAddress) {
        const iface = new ethers.Interface(ERC20_ABI);
        const transferData = iface.encodeFunctionData('transfer', [target, BigInt(value)]);
        actualTarget = tokenAddress;
        actualValue = '0';
        actualData = transferData;
      } else {
        actualTarget = target;
        actualValue = value;
        actualData = data || '0x';
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

      console.log(`  path: ${authenticatorData ? 'WebAuthn' : 'Legacy P256'}, sig length: ${packedSignature.length}`);

      let hash: string;

      if (authenticatorData && clientDataJSON) {
        hash = await executor.executeWithWebAuthn(
          chainId,
          walletAddress,
          actualTarget,
          actualValue,
          actualData,
          authenticatorData,
          clientDataJSON,
          packedSignature
        );
      } else {
        hash = await executor.executeTransaction(
          chainId,
          walletAddress,
          actualTarget,
          actualValue,
          actualData,
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

  // GET /tokens — token list for a chain
  router.get('/tokens', (req, res) => {
    const chainIdParam = req.query.chainId as string | undefined;
    if (!chainIdParam) {
      res.status(400).json({ error: 'Missing chainId query parameter' });
      return;
    }
    const chainId = parseInt(chainIdParam, 10);
    const tokens = getTokensForChain(chainId);
    res.json(tokens);
  });

  // GET /token-balances — ERC-20 balances for a wallet on a chain
  router.get('/token-balances', async (req, res) => {
    try {
      const requestedAddress = req.query.walletAddress as string;
      const chainIdParam = req.query.chainId as string | undefined;

      if (!requestedAddress || !chainIdParam) {
        res.status(400).json({ error: 'Missing walletAddress or chainId query parameter' });
        return;
      }

      const chainId = parseInt(chainIdParam, 10);
      const keys = getWalletKeys(requestedAddress);

      // Resolve chain-specific address
      const walletAddress = keys
        ? await executor.getWalletAddress(chainId, keys.pubKeyX, keys.pubKeyY)
        : requestedAddress;

      const tokens = getTokensForChain(chainId);
      const provider = executor.getProvider(chainId);

      const results = await Promise.all(
        tokens.map(async (token) => {
          try {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balance: bigint = await contract.balanceOf(walletAddress);
            return {
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              decimals: token.decimals,
              balance: balance.toString(),
              chainId: token.chainId,
            };
          } catch {
            return {
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              decimals: token.decimals,
              balance: '0',
              chainId: token.chainId,
            };
          }
        })
      );

      res.json(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // GET /health — health check
  router.get('/health', (_req, res) => {
    const chains = getAllChains();
    res.json({ status: 'ok', chains: chains.length });
  });

  return router;
}
