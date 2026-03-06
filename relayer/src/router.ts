import { Router } from 'express';
import { ethers } from 'ethers';
import { Executor } from './executor.js';
import { getAllChains, getChain, getDefaultChainId } from './chains.js';
import { addTransaction, getTransactions } from './transactions.js';
import type { SmartRouteStep } from './transactions.js';
import { storeWallet, getWalletKeys } from './walletStore.js';
import { getTokensForChain } from './tokens.js';
import {
  buildSwapNativeForTokensCalldata,
  buildSwapTokensForNativeCalldata,
  buildApproveCalldata,
  ERC20_ABI as SWAP_ERC20_ABI,
} from './swap.js';
import { planTransaction } from './smartRouter.js';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

/**
 * Resolve wallet public keys from the wallet store, falling back to
 * pubKeyX/pubKeyY provided in the request body.  When found via the
 * fallback, the keys are persisted so subsequent requests work too.
 */
function resolveWalletKeys(
  requestedAddress: string,
  bodyPubKeyX?: string,
  bodyPubKeyY?: string
): { pubKeyX: string; pubKeyY: string } | undefined {
  const existing = getWalletKeys(requestedAddress);
  if (existing) return existing;

  // Fallback: client sent the keys directly
  if (bodyPubKeyX && bodyPubKeyY) {
    const x = bodyPubKeyX.startsWith('0x') ? bodyPubKeyX : '0x' + bodyPubKeyX;
    const y = bodyPubKeyY.startsWith('0x') ? bodyPubKeyY : '0x' + bodyPubKeyY;
    storeWallet(requestedAddress, x, y);
    console.log(`  re-registered wallet keys for ${requestedAddress} from request body`);
    return { pubKeyX: x, pubKeyY: y };
  }

  return undefined;
}

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
      const { walletAddress: requestedAddress, target, value, data, chainId, tokenAddress, pubKeyX, pubKeyY } = req.body;

      console.log(`POST /prepare-transaction — wallet: ${requestedAddress}, target: ${target}, value: ${value}, chainId: ${chainId}, token: ${tokenAddress || 'native'}`);

      if (!requestedAddress || !target || value === undefined || !chainId) {
        res.status(400).json({ error: 'Missing required fields: walletAddress, target, value, chainId' });
        return;
      }

      // Resolve wallet keys from store or request body
      const keys = resolveWalletKeys(requestedAddress, pubKeyX, pubKeyY);
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

  // POST /execute-transaction — submit signed transaction (with smart routing)
  router.post('/execute-transaction', async (req, res) => {
    try {
      const { walletAddress: requestedAddress, target, value, data, chainId, signature, tokenAddress, pubKeyX, pubKeyY } = req.body;

      console.log('=== EXECUTE-TRANSACTION CALLED ===', JSON.stringify(req.body));
      console.log(`POST /execute-transaction — wallet: ${requestedAddress}, target: ${target}, value: ${value}, chainId: ${chainId}, token: ${tokenAddress || 'native'}`);

      if (!requestedAddress || !target || value === undefined || !chainId || !signature) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Resolve wallet keys from store or request body
      const keys = resolveWalletKeys(requestedAddress, pubKeyX, pubKeyY);
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

      const chain = getChain(chainId);

      // --- Smart routing: check if auto-swap is needed ---
      const provider = executor.getProvider(chainId);
      const plan = await planTransaction(
        provider,
        walletAddress,
        actualTarget,
        actualValue,
        actualData,
        chain!
      );

      const smartRouteSteps: SmartRouteStep[] = [];
      let finalHash: string;

      if (plan.needsSwap && plan.swapDetails && chain?.swap) {
        console.log(`  smart route: auto-swap ${plan.swapDetails.fromToken} -> ${plan.swapDetails.toToken}`);

        // Step 1: Execute the swap (AVAX -> Token)
        const swapStep = plan.steps.find((s) => s.type === 'swap');
        if (!swapStep) {
          res.status(500).json({ error: 'Smart route: swap step missing' });
          return;
        }

        const { routerAddress, wavaxAddress, defaultBinStep } = chain.swap;
        const tokenConfig = chain.swap.tokens.find(
          (t) => t.symbol === plan.swapDetails!.toToken
        );
        if (!tokenConfig) {
          res.status(400).json({ error: `Token ${plan.swapDetails.toToken} not supported for auto-swap` });
          return;
        }

        const deadline = Math.floor(Date.now() / 1000) + 1200;
        const swapCalldata = buildSwapNativeForTokensCalldata(
          0n, // testnet: accept any output
          defaultBinStep,
          wavaxAddress,
          tokenConfig.address,
          walletAddress,
          deadline
        );

        const swapValue = swapStep.value;

        let swapHash: string;
        if (authenticatorData && clientDataJSON) {
          swapHash = await executor.executeWithWebAuthn(
            chainId, walletAddress, routerAddress, swapValue, swapCalldata,
            authenticatorData, clientDataJSON, packedSignature
          );
        } else {
          swapHash = await executor.executeTransaction(
            chainId, walletAddress, routerAddress, swapValue, swapCalldata, packedSignature
          );
        }
        console.log(`  swap step confirmed: ${swapHash}`);
        smartRouteSteps.push({
          type: 'swap',
          description: swapStep.description,
          hash: swapHash,
        });

        // Step 2: Execute the original transfer
        const transferStep = plan.steps.find((s) => s.type === 'execute');
        if (!transferStep) {
          res.status(500).json({ error: 'Smart route: transfer step missing' });
          return;
        }

        let transferHash: string;
        if (authenticatorData && clientDataJSON) {
          transferHash = await executor.executeWithWebAuthn(
            chainId, walletAddress, transferStep.target, transferStep.value, transferStep.data,
            authenticatorData, clientDataJSON, packedSignature
          );
        } else {
          transferHash = await executor.executeTransaction(
            chainId, walletAddress, transferStep.target, transferStep.value, transferStep.data,
            packedSignature
          );
        }
        console.log(`  transfer step confirmed: ${transferHash}`);
        smartRouteSteps.push({
          type: 'transfer',
          description: transferStep.description,
          hash: transferHash,
        });

        finalHash = transferHash;
      } else {
        // No swap needed — execute directly as before
        if (authenticatorData && clientDataJSON) {
          finalHash = await executor.executeWithWebAuthn(
            chainId, walletAddress, actualTarget, actualValue, actualData,
            authenticatorData, clientDataJSON, packedSignature
          );
        } else {
          finalHash = await executor.executeTransaction(
            chainId, walletAddress, actualTarget, actualValue, actualData, packedSignature
          );
        }
      }

      const txType = plan.needsSwap ? 'smart-swap-send' as const : 'send' as const;

      addTransaction({
        id: crypto.randomUUID(),
        walletAddress,
        target,
        value,
        chainId,
        chainName: chain?.name || `Chain ${chainId}`,
        nativeSymbol: chain?.nativeSymbol || 'AVAX',
        explorerUrl: chain?.explorerUrl || '',
        hash: finalHash,
        status: 'confirmed',
        timestamp: Date.now(),
        txType,
        smartRoute: smartRouteSteps.length > 0 ? smartRouteSteps : undefined,
      });

      console.log(`  confirmed: ${finalHash} (${txType})`);
      res.json({
        hash: finalHash,
        chainId,
        status: 'confirmed',
        plan: {
          needsSwap: plan.needsSwap,
          steps: smartRouteSteps,
        },
      });
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

  // POST /transaction/plan — preview transaction plan (detect auto-swap needs)
  router.post('/transaction/plan', async (req, res) => {
    try {
      const { walletAddress: requestedAddress, target, value, data, chainId, tokenAddress, pubKeyX, pubKeyY } = req.body;

      console.log(`POST /transaction/plan — wallet: ${requestedAddress}, target: ${target}, chainId: ${chainId}, token: ${tokenAddress || 'native'}`);

      if (!requestedAddress || !target || value === undefined || !chainId) {
        res.status(400).json({ error: 'Missing required fields: walletAddress, target, value, chainId' });
        return;
      }

      const chain = getChain(chainId);
      if (!chain) {
        res.status(400).json({ error: `Chain ${chainId} not registered` });
        return;
      }

      // Resolve wallet keys from store or request body
      const keys = resolveWalletKeys(requestedAddress, pubKeyX, pubKeyY);
      if (!keys) {
        res.status(400).json({ error: 'Wallet keys not found. Please reconnect.' });
        return;
      }

      const walletAddress = await executor.getWalletAddress(chainId, keys.pubKeyX, keys.pubKeyY);

      // Build the actual target/value/data (same logic as prepare-transaction)
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

      const provider = executor.getProvider(chainId);
      const plan = await planTransaction(
        provider,
        walletAddress,
        actualTarget,
        actualValue,
        actualData,
        chain
      );

      console.log(`  plan: needsSwap=${plan.needsSwap}, steps=${plan.steps.length}`);
      res.json(plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /transaction/plan failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  // POST /swap/quote — get estimated swap output
  router.post('/swap/quote', async (req, res) => {
    try {
      const { chainId, fromToken, toToken, amount } = req.body;

      if (!chainId || !fromToken || !toToken || !amount) {
        res.status(400).json({ error: 'Missing required fields: chainId, fromToken, toToken, amount' });
        return;
      }

      const chain = getChain(chainId);
      if (!chain) {
        res.status(400).json({ error: `Chain ${chainId} not registered` });
        return;
      }
      if (!chain.swap) {
        res.status(400).json({ error: `Swap not available on ${chain.name}` });
        return;
      }

      const slippage = 0.01;
      const isFromNative = fromToken === 'AVAX' || fromToken === chain.nativeSymbol;
      const isToNative = toToken === 'AVAX' || toToken === chain.nativeSymbol;

      const fromTokenConfig = isFromNative
        ? null
        : chain.swap.tokens.find((t) => t.symbol === fromToken);
      const toTokenConfig = isToNative
        ? null
        : chain.swap.tokens.find((t) => t.symbol === toToken);

      if (!isFromNative && !fromTokenConfig) {
        res.status(400).json({ error: `Token ${fromToken} not supported on ${chain.name}` });
        return;
      }
      if (!isToNative && !toTokenConfig) {
        res.status(400).json({ error: `Token ${toToken} not supported on ${chain.name}` });
        return;
      }

      // Simple price estimation: use a conservative approximate price
      // For AVAX/USD pairs, fetch from on-chain or use approximate testnet pricing
      const amountBigInt = BigInt(amount);
      const fromDecimals = isFromNative ? 18 : fromTokenConfig!.decimals;
      const toDecimals = isToNative ? 18 : toTokenConfig!.decimals;

      // Approximate prices (testnet: AVAX ~25 USD)
      const avaxPriceUsd = 25;
      let estimatedOutputRaw: bigint;

      if (isFromNative && !isToNative) {
        // AVAX -> stablecoin: amount_avax * price
        const amountAvax = Number(amountBigInt) / 1e18;
        const outputUsd = amountAvax * avaxPriceUsd;
        estimatedOutputRaw = BigInt(Math.floor(outputUsd * 10 ** toDecimals));
      } else if (!isFromNative && isToNative) {
        // Stablecoin -> AVAX: amount_usd / price
        const amountUsd = Number(amountBigInt) / 10 ** fromDecimals;
        const outputAvax = amountUsd / avaxPriceUsd;
        estimatedOutputRaw = BigInt(Math.floor(outputAvax * 1e18));
      } else {
        // Token -> Token (stablecoin to stablecoin): ~1:1
        const amountIn = Number(amountBigInt) / 10 ** fromDecimals;
        estimatedOutputRaw = BigInt(Math.floor(amountIn * 10 ** toDecimals));
      }

      const minimumOutputRaw = estimatedOutputRaw * BigInt(Math.floor((1 - slippage) * 10000)) / 10000n;

      const estimatedOutputFormatted = Number(estimatedOutputRaw) / 10 ** toDecimals;
      const minimumOutputFormatted = Number(minimumOutputRaw) / 10 ** toDecimals;

      const route = `${fromToken} -> ${toToken}`;

      console.log(`POST /swap/quote — ${route}, amount: ${amount}, estimated: ${estimatedOutputRaw}`);

      res.json({
        estimatedOutput: estimatedOutputFormatted.toFixed(toDecimals === 6 ? 2 : 4),
        estimatedOutputRaw: estimatedOutputRaw.toString(),
        minimumOutput: minimumOutputFormatted.toFixed(toDecimals === 6 ? 2 : 4),
        minimumOutputRaw: minimumOutputRaw.toString(),
        slippage,
        priceImpact: '0.02',
        route,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /swap/quote failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  // POST /swap/execute — execute a swap through the wallet
  router.post('/swap/execute', async (req, res) => {
    try {
      const { chainId, walletAddress: requestedAddress, fromToken, toToken, amount, slippage, signature, pubKeyX, pubKeyY } = req.body;

      console.log(`POST /swap/execute — wallet: ${requestedAddress}, ${fromToken} -> ${toToken}, amount: ${amount}, chain: ${chainId}`);

      if (!chainId || !requestedAddress || !fromToken || !toToken || !amount || !signature) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const chain = getChain(chainId);
      if (!chain) {
        res.status(400).json({ error: `Chain ${chainId} not registered` });
        return;
      }
      if (!chain.swap) {
        res.status(400).json({ error: `Swap not available on ${chain.name}` });
        return;
      }

      const keys = resolveWalletKeys(requestedAddress, pubKeyX, pubKeyY);
      if (!keys) {
        res.status(400).json({ error: 'Wallet keys not found. Please reconnect.' });
        return;
      }

      const walletAddress = await executor.ensureWalletDeployed(chainId, keys.pubKeyX, keys.pubKeyY);
      console.log(`  resolved wallet for chain ${chainId}: ${walletAddress}`);

      const { r, s, authenticatorData, clientDataJSON } = signature;
      if (!r || !s) {
        res.status(400).json({ error: 'Signature must include r and s' });
        return;
      }

      const rClean = r.startsWith('0x') ? r.slice(2) : r;
      const sClean = s.startsWith('0x') ? s.slice(2) : s;
      const packedSignature = '0x' + rClean + sClean;

      const isFromNative = fromToken === 'AVAX' || fromToken === chain.nativeSymbol;
      const isToNative = toToken === 'AVAX' || toToken === chain.nativeSymbol;

      const { routerAddress, wavaxAddress, defaultBinStep } = chain.swap;
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
      const slippagePct = typeof slippage === 'number' ? slippage : 0.01;

      let hash: string;

      if (isFromNative && !isToNative) {
        // AVAX -> Token
        const tokenConfig = chain.swap.tokens.find((t) => t.symbol === toToken);
        if (!tokenConfig) {
          res.status(400).json({ error: `Token ${toToken} not found` });
          return;
        }

        // For testnet, use amountOutMin = 0 for simplicity
        const amountOutMin = 0n;
        const swapCalldata = buildSwapNativeForTokensCalldata(
          amountOutMin,
          defaultBinStep,
          wavaxAddress,
          tokenConfig.address,
          walletAddress,
          deadline
        );

        // Execute: wallet.execute(routerAddress, avaxAmount, swapCalldata)
        if (authenticatorData && clientDataJSON) {
          hash = await executor.executeWithWebAuthn(
            chainId, walletAddress, routerAddress, amount, swapCalldata,
            authenticatorData, clientDataJSON, packedSignature
          );
        } else {
          hash = await executor.executeTransaction(
            chainId, walletAddress, routerAddress, amount, swapCalldata, packedSignature
          );
        }
      } else if (!isFromNative && isToNative) {
        // Token -> AVAX: first approve, then swap
        const tokenConfig = chain.swap.tokens.find((t) => t.symbol === fromToken);
        if (!tokenConfig) {
          res.status(400).json({ error: `Token ${fromToken} not found` });
          return;
        }

        const amountBigInt = BigInt(amount);

        // Step 1: Approve router to spend tokens
        const approveCalldata = buildApproveCalldata(routerAddress, amountBigInt);

        // We need to prepare + sign + execute approve first, but since the relayer
        // submits both calls, and signature covers the swap, for testnet we do
        // approve with the same signature flow. In practice, the wallet contract
        // verifies the passkey signature for each execute call.
        // For the MVP, we execute approve directly since the relayer is the authorized caller.
        if (authenticatorData && clientDataJSON) {
          await executor.executeWithWebAuthn(
            chainId, walletAddress, tokenConfig.address, '0', approveCalldata,
            authenticatorData, clientDataJSON, packedSignature
          );
        } else {
          await executor.executeTransaction(
            chainId, walletAddress, tokenConfig.address, '0', approveCalldata, packedSignature
          );
        }

        console.log(`  approve tx submitted for ${fromToken}`);

        // Step 2: Swap tokens for AVAX
        const amountOutMin = 0n; // testnet: accept any output
        const swapCalldata = buildSwapTokensForNativeCalldata(
          amountBigInt,
          amountOutMin,
          defaultBinStep,
          tokenConfig.address,
          wavaxAddress,
          walletAddress,
          deadline
        );

        if (authenticatorData && clientDataJSON) {
          hash = await executor.executeWithWebAuthn(
            chainId, walletAddress, routerAddress, '0', swapCalldata,
            authenticatorData, clientDataJSON, packedSignature
          );
        } else {
          hash = await executor.executeTransaction(
            chainId, walletAddress, routerAddress, '0', swapCalldata, packedSignature
          );
        }
      } else {
        res.status(400).json({ error: 'Token-to-token swap not yet supported. Use AVAX as intermediary.' });
        return;
      }

      addTransaction({
        id: crypto.randomUUID(),
        walletAddress,
        target: routerAddress,
        value: isFromNative ? amount : '0',
        chainId,
        chainName: chain.name,
        nativeSymbol: chain.nativeSymbol,
        explorerUrl: chain.explorerUrl,
        hash,
        status: 'confirmed',
        timestamp: Date.now(),
      });

      console.log(`  swap confirmed: ${hash}`);
      res.json({ txHash: hash, status: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /swap/execute failed: ${message}`);
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
