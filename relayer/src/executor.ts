import { ethers } from 'ethers';
import { getChain } from './chains.js';

const FACTORY_ABI = [
  'function deployWallet(bytes32 pubKeyX, bytes32 pubKeyY, address relayer, address verifier) external returns (address)',
  'function getWalletAddress(bytes32 pubKeyX, bytes32 pubKeyY) external view returns (address)',
  'function isDeployed(bytes32 pubKeyX, bytes32 pubKeyY) external view returns (bool)',
];

const WALLET_ABI = [
  'function execute(address target, uint256 value, bytes calldata data, bytes calldata signature) external',
  'function executeWithWebAuthn(address target, uint256 value, bytes calldata data, bytes calldata authenticatorData, string calldata clientDataJSON, bytes calldata signature) external',
  'function executeAsRelayer(address target, uint256 value, bytes calldata data) external',
  'function nonce() external view returns (uint256)',
];

const P256_VERIFIER = '0x0000000000000000000000000000000000000100';

export class Executor {
  private signers: Map<number, ethers.Wallet> = new Map();
  private privateKey: string;

  constructor(privateKey: string) {
    this.privateKey = privateKey;
  }

  private getSigner(chainId: number): ethers.Wallet {
    if (!this.signers.has(chainId)) {
      const chain = getChain(chainId);
      if (!chain) throw new Error(`Chain ${chainId} not registered`);
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      const signer = new ethers.Wallet(this.privateKey, provider);
      this.signers.set(chainId, signer);
    }
    return this.signers.get(chainId)!;
  }

  async deployWallet(chainId: number, pubKeyX: string, pubKeyY: string): Promise<string> {
    const chain = getChain(chainId);
    if (!chain) throw new Error(`Chain ${chainId} not registered`);

    const signer = this.getSigner(chainId);
    const factory = new ethers.Contract(chain.factoryAddress, FACTORY_ABI, signer);

    const deployed = await factory.isDeployed(pubKeyX, pubKeyY);
    if (deployed) {
      return factory.getWalletAddress(pubKeyX, pubKeyY);
    }

    const tx = await factory.deployWallet(
      pubKeyX,
      pubKeyY,
      await signer.getAddress(),
      P256_VERIFIER
    );
    await tx.wait();

    const walletAddress: string = await factory.getWalletAddress(pubKeyX, pubKeyY);
    return walletAddress;
  }

  async ensureWalletDeployed(chainId: number, pubKeyX: string, pubKeyY: string): Promise<string> {
    const chain = getChain(chainId);
    if (!chain) throw new Error(`Chain ${chainId} not registered`);

    const signer = this.getSigner(chainId);
    const factory = new ethers.Contract(chain.factoryAddress, FACTORY_ABI, signer);

    const deployed = await factory.isDeployed(pubKeyX, pubKeyY);
    if (deployed) {
      return factory.getWalletAddress(pubKeyX, pubKeyY);
    }

    const tx = await factory.deployWallet(
      pubKeyX,
      pubKeyY,
      await signer.getAddress(),
      P256_VERIFIER
    );
    await tx.wait();

    const walletAddress: string = await factory.getWalletAddress(pubKeyX, pubKeyY);
    console.log(`Auto-deployed wallet ${walletAddress} on chain ${chainId}`);
    return walletAddress;
  }

  async getWalletAddress(chainId: number, pubKeyX: string, pubKeyY: string): Promise<string> {
    const chain = getChain(chainId);
    if (!chain) throw new Error(`Chain ${chainId} not registered`);

    const signer = this.getSigner(chainId);
    const factory = new ethers.Contract(chain.factoryAddress, FACTORY_ABI, signer);
    return factory.getWalletAddress(pubKeyX, pubKeyY);
  }

  async getNonce(chainId: number, walletAddress: string): Promise<bigint> {
    const signer = this.getSigner(chainId);
    const wallet = new ethers.Contract(walletAddress, WALLET_ABI, signer);
    return wallet.nonce();
  }

  async executeTransaction(
    chainId: number,
    walletAddress: string,
    target: string,
    value: string,
    data: string,
    signature: string,
    gasLimit?: bigint
  ): Promise<string> {
    const valueBigInt = BigInt(value);
    console.log('execute params:', {
      chainId,
      walletAddress,
      target,
      value: valueBigInt.toString(),
      dataLength: data.length,
      signatureLength: signature.length,
      gasLimit: gasLimit?.toString(),
    });

    const signer = this.getSigner(chainId);
    const wallet = new ethers.Contract(walletAddress, WALLET_ABI, signer);

    try {
      const overrides = gasLimit ? { gasLimit } : {};
      const tx = await wallet.execute(target, valueBigInt, data, signature, overrides);
      const receipt = await tx.wait();

      console.log('execute receipt:', {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        logs: receipt.logs.length,
      });

      return receipt.hash;
    } catch (err) {
      throw this.enhanceError(err, 'execute', target, value);
    }
  }

  async executeWithWebAuthn(
    chainId: number,
    walletAddress: string,
    target: string,
    value: string,
    data: string,
    authenticatorData: string,
    clientDataJSON: string,
    packedSignature: string,
    gasLimit?: bigint
  ): Promise<string> {
    const valueBigInt = BigInt(value);
    console.log('executeWithWebAuthn params:', {
      chainId,
      walletAddress,
      target,
      value: valueBigInt.toString(),
      dataLength: data.length,
      authenticatorDataLength: authenticatorData.length,
      clientDataJSONLength: clientDataJSON.length,
      signatureLength: packedSignature.length,
      gasLimit: gasLimit?.toString(),
    });

    const signer = this.getSigner(chainId);
    const wallet = new ethers.Contract(walletAddress, WALLET_ABI, signer);

    try {
      const overrides = gasLimit ? { gasLimit } : {};
      const tx = await wallet.executeWithWebAuthn(
        target,
        valueBigInt,
        data,
        authenticatorData,
        clientDataJSON,
        packedSignature,
        overrides
      );
      const receipt = await tx.wait();

      console.log('executeWithWebAuthn receipt:', {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        logs: receipt.logs.length,
      });

      return receipt.hash;
    } catch (err) {
      throw this.enhanceError(err, 'executeWithWebAuthn', target, value);
    }
  }

  /** Execute a transaction using relayer authority only (no user signature).
   *  Used for multi-step smart routing where the user already authorised Step 1. */
  async executeAsRelayer(
    chainId: number,
    walletAddress: string,
    target: string,
    value: string,
    data: string,
    gasLimit?: bigint
  ): Promise<string> {
    const valueBigInt = BigInt(value);
    console.log('executeAsRelayer params:', {
      chainId,
      walletAddress,
      target,
      value: valueBigInt.toString(),
      dataLength: data.length,
      gasLimit: gasLimit?.toString(),
    });

    const signer = this.getSigner(chainId);
    const wallet = new ethers.Contract(walletAddress, WALLET_ABI, signer);

    try {
      const overrides = gasLimit ? { gasLimit } : {};
      const tx = await wallet.executeAsRelayer(target, valueBigInt, data, overrides);
      const receipt = await tx.wait();

      console.log('executeAsRelayer receipt:', {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        logs: receipt.logs.length,
      });

      return receipt.hash;
    } catch (err) {
      throw this.enhanceError(err, 'executeAsRelayer', target, value);
    }
  }

  /** Decode known wallet error selectors to human-readable messages */
  private enhanceError(err: unknown, method: string, target: string, value: string): Error {
    const raw = err instanceof Error ? err.message : String(err);

    // Known custom error selectors from OneClickWallet.sol
    const knownErrors: Record<string, string> = {
      '0xacfdb444': 'ExecutionFailed — the inner call to the target contract reverted',
      '0x8baa579f': 'InvalidSignature — P256 passkey verification failed',
      '0x4578ddb8': 'OnlyRelayer — caller is not the authorized relayer',
      '0x0dc149f0': 'AlreadyInitialized — wallet already set up',
    };

    for (const [selector, description] of Object.entries(knownErrors)) {
      if (raw.includes(selector)) {
        const detail = `${method} → ${description} (target: ${target}, value: ${value})`;
        console.error(detail);
        return new Error(detail);
      }
    }

    console.error(`${method} failed:`, raw);
    return err instanceof Error ? err : new Error(raw);
  }

  getProvider(chainId: number): ethers.JsonRpcProvider {
    const signer = this.getSigner(chainId);
    return signer.provider as ethers.JsonRpcProvider;
  }

  async getBalance(chainId: number, address: string): Promise<string> {
    const signer = this.getSigner(chainId);
    const balance = await signer.provider!.getBalance(address);
    return balance.toString();
  }
}
