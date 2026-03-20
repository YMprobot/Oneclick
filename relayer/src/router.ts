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
import { fundWallet } from './faucet.js';
import { isFunded, getFunding, isOnboardingSkipped, setOnboardingSkipped } from './faucetStore.js';

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

/** Fetch live AVAX/USD price from DeFiLlama with fallback */
async function getAvaxPrice(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://coins.llama.fi/prices/current/coingecko:avalanche-2', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data: { coins: Record<string, { price: number }> } = await res.json();
      const p = data.coins['coingecko:avalanche-2']?.price;
      if (typeof p === 'number' && p > 0) return p;
    }
  } catch {
    // fallback
  }
  return 8.84;
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

      // Use generous gas limit for wallet contract calls (P256 verification + nested DEX calls)
      const SMART_ROUTE_GAS = 2_000_000n;
      const SINGLE_TX_GAS = 1_000_000n;

      if (plan.needsSwap && plan.swapDetails && chain?.swap) {
        // Smart routing requires WebAuthn: executeWithWebAuthn does NOT bind the
        // signature to (target, value, data, nonce), so the same sig can be reused
        // across multiple steps.  The legacy execute() path binds the signature to
        // a specific (target, value, data, nonce), making multi-step impossible.
        if (!authenticatorData || !clientDataJSON) {
          res.status(400).json({
            error: 'Smart routing requires WebAuthn signature (authenticatorData + clientDataJSON). Legacy P256 signatures are bound to a single transaction and cannot be reused across steps.',
          });
          return;
        }

        console.log(`  smart route: auto-swap ${plan.swapDetails.fromToken} -> ${plan.swapDetails.toToken}`);

        // Step 1: Execute the swap (AVAX -> Token)
        const swapStep = plan.steps.find((s) => s.type === 'swap');
        if (!swapStep) {
          res.status(500).json({ error: 'Smart route: swap step missing in plan' });
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

        const swapValue = swapStep.value;

        // Pre-check: does the wallet have enough native AVAX for the swap?
        const nativeBalance = await provider.getBalance(walletAddress);
        const swapValueBig = BigInt(swapValue);
        if (nativeBalance < swapValueBig) {
          const needed = ethers.formatEther(swapValueBig);
          const available = ethers.formatEther(nativeBalance);
          console.error(`  insufficient AVAX: need ${needed} but wallet has ${available}`);
          res.status(400).json({
            error: `Insufficient ${chain.nativeSymbol} for auto-swap. Need ${needed} ${chain.nativeSymbol} but wallet has ${available} ${chain.nativeSymbol}. Fund the wallet first.`,
          });
          return;
        }

        console.log(`  wallet AVAX balance: ${ethers.formatEther(nativeBalance)}, swap needs: ${ethers.formatEther(swapValueBig)}`);

        const deadline = Math.floor(Date.now() / 1000) + 1200;
        // Calculate minimum output with 5% max slippage
        const estimatedOut = ethers.parseUnits(
          plan.swapDetails!.estimatedAmountOut,
          tokenConfig.decimals
        );
        const amountOutMin = estimatedOut * 95n / 100n;

        const swapCalldata = buildSwapNativeForTokensCalldata(
          amountOutMin,
          defaultBinStep,
          wavaxAddress,
          tokenConfig.address,
          walletAddress,
          deadline
        );

        let swapHash: string;
        try {
          swapHash = await executor.executeWithWebAuthn(
            chainId, walletAddress, routerAddress, swapValue, swapCalldata,
            authenticatorData, clientDataJSON, packedSignature,
            SMART_ROUTE_GAS
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Swap step failed';
          console.error(`  smart route swap step failed: ${msg}`);
          res.status(500).json({ error: `Smart route swap failed: ${msg}` });
          return;
        }
        console.log(`  swap step confirmed: ${swapHash}`);
        smartRouteSteps.push({
          type: 'swap',
          description: swapStep.description,
          hash: swapHash,
        });

        // Post-swap balance check: verify the swap yielded enough tokens for the transfer.
        // Without this, executeAsRelayer succeeds but the inner ERC20 transfer reverts
        // with ExecutionFailed, giving a cryptic error.
        //
        // Tolerance: if the wallet has >= 98% of the required amount, proceed with
        // transferring whatever is available (rebuild calldata with postSwapBalance).
        // Only error out if < 98%.
        if (tokenAddress) {
          const tokenContract = new ethers.Contract(actualTarget, ERC20_ABI, provider);
          const postSwapBalance: bigint = await tokenContract.balanceOf(walletAddress);
          const iface = new ethers.Interface(ERC20_ABI);
          const decoded = iface.decodeFunctionData('transfer', actualData);
          const requiredAmount: bigint = decoded[1];
          const minAcceptable = requiredAmount * 98n / 100n;

          console.log(`  post-swap token balance: ${postSwapBalance.toString()}, required: ${requiredAmount.toString()}, minAcceptable (98%): ${minAcceptable.toString()}`);

          if (postSwapBalance < minAcceptable) {
            // Less than 98% — hard error, slippage too high
            const tokenConfig = chain?.swap?.tokens.find(
              (t) => t.address.toLowerCase() === actualTarget.toLowerCase()
            );
            const decimals = tokenConfig?.decimals || 18;
            const symbol = tokenConfig?.symbol || 'TOKEN';
            const have = ethers.formatUnits(postSwapBalance, decimals);
            const need = ethers.formatUnits(requiredAmount, decimals);
            console.error(`  insufficient token balance after swap: have ${have} ${symbol}, need ${need} ${symbol}`);
            res.status(500).json({
              error: `Smart route: swap succeeded but received insufficient tokens. Have ${have} ${symbol}, need ${need} ${symbol}. The swap tx hash: ${swapHash}. Try sending a smaller amount or fund the wallet with more ${chain?.nativeSymbol || 'AVAX'}.`,
              partialResult: {
                swapHash,
                swapDescription: swapStep.description,
                postSwapBalance: have,
                requiredAmount: need,
                tokenSymbol: symbol,
              },
            });
            return;
          }

          // If we have enough but slightly less than requested, transfer available balance
          if (postSwapBalance < requiredAmount) {
            const transferAmount = postSwapBalance;
            const recipient = decoded[0] as string;
            actualData = iface.encodeFunctionData('transfer', [recipient, transferAmount]);
            console.log(`  adjusted transfer amount: ${transferAmount.toString()} (was ${requiredAmount.toString()})`);
          }
        }

        // Step 2: Execute the original transfer using relayer authority.
        // After Step 1 the wallet nonce has incremented, making the original WebAuthn
        // signature unusable for a second executeWithWebAuthn call.  executeAsRelayer
        // requires only msg.sender == relayer — no user signature needed.
        const transferStep = plan.steps.find((s) => s.type === 'execute');
        if (!transferStep) {
          res.status(500).json({ error: 'Smart route: transfer step missing in plan' });
          return;
        }

        console.log(`  step2 (executeAsRelayer): target=${actualTarget}, value=${actualValue}, data=${actualData.slice(0, 10)}... (${actualData.length} chars)`);

        let transferHash: string;
        try {
          transferHash = await executor.executeAsRelayer(
            chainId, walletAddress, actualTarget, actualValue, actualData,
            SMART_ROUTE_GAS
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transfer step failed';
          console.error(`  smart route transfer step failed: ${msg}`);
          // Still return partial success — the swap already confirmed
          res.status(500).json({
            error: `Smart route transfer failed (swap succeeded): ${msg}`,
            partialResult: {
              swapHash: smartRouteSteps[0]?.hash,
              swapDescription: smartRouteSteps[0]?.description,
            },
          });
          return;
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
            authenticatorData, clientDataJSON, packedSignature,
            SINGLE_TX_GAS
          );
        } else {
          finalHash = await executor.executeTransaction(
            chainId, walletAddress, actualTarget, actualValue, actualData, packedSignature,
            SINGLE_TX_GAS
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

  // GET /transactions — transaction history for a wallet (on-chain + session)
  router.get('/transactions', async (req, res) => {
    const walletAddress = req.query.walletAddress as string;
    const limitParam = req.query.limit as string | undefined;

    if (!walletAddress) {
      res.status(400).json({ error: 'Missing walletAddress query parameter' });
      return;
    }

    try {
      const limit = limitParam ? parseInt(limitParam, 10) : 20;
      const records = await getTransactions(walletAddress, limit);
      res.json(records);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      res.json([]);
    }
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
        let chainWalletAddress = requestedAddress;
        try {
          if (keys) chainWalletAddress = await executor.getWalletAddress(chainId, keys.pubKeyX, keys.pubKeyY);
        } catch {
          // Factory not deployed on this chain — use raw address
        }
        let balance = '0';
        try {
          balance = await executor.getBalance(chainId, chainWalletAddress);
        } catch {
          // RPC unreachable for this chain
        }
        res.json([{ chainId, balance, walletAddress: chainWalletAddress }]);
        return;
      }

      // Return balances for all registered chains — errors per-chain don't crash the response
      const chains = getAllChains();
      const balances = await Promise.all(
        chains.map(async (chain) => {
          let chainWalletAddress = requestedAddress;
          try {
            if (keys) chainWalletAddress = await executor.getWalletAddress(chain.chainId, keys.pubKeyX, keys.pubKeyY);
          } catch {
            // Factory not deployed on this chain — use raw address
          }
          let balance = '0';
          try {
            balance = await executor.getBalance(chain.chainId, chainWalletAddress);
          } catch {
            // RPC unreachable for this chain
          }
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

      const avaxPriceUsd = await getAvaxPrice();
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

        // Calculate minimum output with 5% max slippage
        const avaxPriceUsd = await getAvaxPrice();
        const avaxIn = Number(BigInt(amount)) / 1e18;
        const estimatedOutput = BigInt(Math.floor(avaxIn * avaxPriceUsd * 10 ** tokenConfig.decimals));
        const amountOutMin = estimatedOutput * 95n / 100n;

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
            authenticatorData, clientDataJSON, packedSignature,
            2_000_000n
          );
        } else {
          hash = await executor.executeTransaction(
            chainId, walletAddress, routerAddress, amount, swapCalldata, packedSignature,
            2_000_000n
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
            authenticatorData, clientDataJSON, packedSignature,
            1_000_000n
          );
        } else {
          await executor.executeTransaction(
            chainId, walletAddress, tokenConfig.address, '0', approveCalldata, packedSignature,
            1_000_000n
          );
        }

        console.log(`  approve tx submitted for ${fromToken}`);

        // Step 2: Swap tokens for AVAX — 5% max slippage
        const avaxPriceUsd = await getAvaxPrice();
        const tokenAmountUsd = Number(amountBigInt) / 10 ** tokenConfig.decimals;
        const estimatedAvaxOut = BigInt(Math.floor((tokenAmountUsd / avaxPriceUsd) * 1e18));
        const amountOutMin = estimatedAvaxOut * 95n / 100n;

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
            authenticatorData, clientDataJSON, packedSignature,
            2_000_000n
          );
        } else {
          hash = await executor.executeTransaction(
            chainId, walletAddress, routerAddress, '0', swapCalldata, packedSignature,
            2_000_000n
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
        txType: 'swap',
      });

      console.log(`  swap confirmed: ${hash}`);
      res.json({ txHash: hash, status: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /swap/execute failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  // GET /prices — token prices in USD (DeFiLlama with 5-min cache)
  let priceCache: { prices: Record<string, number>; source: string; timestamp: number } | null = null;
  const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // DeFiLlama price identifiers per chain
  const DEFILLAMA_IDS: Record<number, string> = {
    43113: 'coingecko:avalanche-2',
    43114: 'coingecko:avalanche-2',
    4337: 'coingecko:beam-2',
  };

  const FALLBACK_PRICES: Record<number, number> = {
    43113: 8.84,
    43114: 8.84,
    4337: 0.002,
  };

  router.get('/prices', async (_req, res) => {
    try {
      const now = Date.now();

      // Return cached if still fresh
      if (priceCache && (now - priceCache.timestamp) < PRICE_CACHE_TTL) {
        res.json({
          prices: priceCache.prices,
          source: priceCache.source,
          cached: true,
        });
        return;
      }

      // Fetch from DeFiLlama
      const uniqueIds = [...new Set(Object.values(DEFILLAMA_IDS))].join(',');
      let priceMap: Record<string, number> = {};
      let source = 'fallback';

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const llamaRes = await fetch(
          `https://coins.llama.fi/prices/current/${uniqueIds}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (llamaRes.ok) {
          const llamaData: { coins: Record<string, { price: number }> } = await llamaRes.json();
          for (const [chainIdStr, llamaId] of Object.entries(DEFILLAMA_IDS)) {
            const price = llamaData.coins[llamaId]?.price;
            if (typeof price === 'number') {
              priceMap[chainIdStr] = price;
            }
          }
          if (Object.keys(priceMap).length > 0) {
            source = 'defillama';
          }
        }
      } catch {
        // DeFiLlama unavailable — use fallback
      }

      // Fill missing with fallback
      for (const [chainId, fallbackPrice] of Object.entries(FALLBACK_PRICES)) {
        if (!(chainId in priceMap)) {
          priceMap[chainId] = fallbackPrice;
          if (source === 'defillama') source = 'defillama+fallback';
        }
      }

      // If nothing from DeFiLlama, pure fallback
      if (source === 'fallback') {
        priceMap = Object.fromEntries(
          Object.entries(FALLBACK_PRICES).map(([k, v]) => [k, v])
        );
      }

      priceCache = { prices: priceMap, source, timestamp: now };

      res.json({
        prices: priceMap,
        source,
        cached: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`GET /prices failed: ${message}`);
      res.json({
        prices: Object.fromEntries(
          Object.entries(FALLBACK_PRICES).map(([k, v]) => [k, v])
        ),
        source: 'fallback',
        cached: false,
      });
    }
  });

  // POST /faucet/fund — fund wallet with test tokens (Test Mode)
  router.post('/faucet/fund', async (req, res) => {
    try {
      const { walletAddress } = req.body;

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        res.status(400).json({ error: 'Invalid or missing walletAddress' });
        return;
      }

      console.log(`POST /faucet/fund — wallet: ${walletAddress}`);
      const result = await fundWallet(walletAddress);

      if (!result.success) {
        res.status(500).json({ success: false, error: result.error });
        return;
      }

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`POST /faucet/fund failed: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /faucet/status — check if wallet was funded via Test Mode
  router.get('/faucet/status', (req, res) => {
    const walletAddress = req.query.walletAddress as string;

    if (!walletAddress) {
      res.status(400).json({ error: 'Missing walletAddress query parameter' });
      return;
    }

    const funded = isFunded(walletAddress);
    const record = funded ? getFunding(walletAddress) : null;
    res.json({
      funded,
      fundedAt: record?.fundedAt || null,
      onboardingSkipped: record?.onboardingSkipped === true,
    });
  });

  // POST /onboarding/skip — mark onboarding as skipped
  router.post('/onboarding/skip', (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid or missing walletAddress' });
      return;
    }
    setOnboardingSkipped(walletAddress, true);
    res.json({ success: true });
  });

  // POST /onboarding/resume — un-skip onboarding
  router.post('/onboarding/resume', (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid or missing walletAddress' });
      return;
    }
    setOnboardingSkipped(walletAddress, false);
    res.json({ success: true });
  });

  // GET /health — health check
  router.get('/health', (_req, res) => {
    const chains = getAllChains();
    res.json({ status: 'ok', chains: chains.length });
  });

  return router;
}
