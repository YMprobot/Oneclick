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
    signature: string
  ): Promise<string> {
    const signer = this.getSigner(chainId);
    const wallet = new ethers.Contract(walletAddress, WALLET_ABI, signer);

    const tx = await wallet.execute(target, value, data, signature);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async executeWithWebAuthn(
    chainId: number,
    walletAddress: string,
    target: string,
    value: string,
    data: string,
    authenticatorData: string,
    clientDataJSON: string,
    packedSignature: string
  ): Promise<string> {
    const signer = this.getSigner(chainId);
    const wallet = new ethers.Contract(walletAddress, WALLET_ABI, signer);

    const tx = await wallet.executeWithWebAuthn(
      target,
      value,
      data,
      authenticatorData,
      clientDataJSON,
      packedSignature
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getBalance(chainId: number, address: string): Promise<string> {
    const signer = this.getSigner(chainId);
    const balance = await signer.provider!.getBalance(address);
    return balance.toString();
  }
}
