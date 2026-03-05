import { ethers } from 'ethers';

// LBRouter V2.1 ABI (only swap functions we need)
export const LB_ROUTER_ABI = [
  'function swapExactNATIVEForTokens(uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) payable returns (uint256 amountOut)',
  'function swapExactTokensForNATIVE(uint256 amountIn, uint256 amountOutMinNATIVE, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address payable to, uint256 deadline) returns (uint256 amountOut)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)',
];

// ERC20 ABI for approve and balance checks
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const routerInterface = new ethers.Interface(LB_ROUTER_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

/** Build calldata for AVAX -> Token swap via LBRouter V2.1 */
export function buildSwapNativeForTokensCalldata(
  amountOutMin: bigint,
  binStep: number,
  wavaxAddress: string,
  tokenOutAddress: string,
  recipientAddress: string,
  deadline: number
): string {
  const path = {
    pairBinSteps: [binStep],
    versions: [2], // V2_1 = 2 in the enum (V1=0, V2=1, V2_1=2)
    tokenPath: [wavaxAddress, tokenOutAddress],
  };
  return routerInterface.encodeFunctionData('swapExactNATIVEForTokens', [
    amountOutMin,
    path,
    recipientAddress,
    deadline,
  ]);
}

/** Build calldata for Token -> AVAX swap via LBRouter V2.1 */
export function buildSwapTokensForNativeCalldata(
  amountIn: bigint,
  amountOutMin: bigint,
  binStep: number,
  tokenInAddress: string,
  wavaxAddress: string,
  recipientAddress: string,
  deadline: number
): string {
  const path = {
    pairBinSteps: [binStep],
    versions: [2], // V2_1
    tokenPath: [tokenInAddress, wavaxAddress],
  };
  return routerInterface.encodeFunctionData('swapExactTokensForNATIVE', [
    amountIn,
    amountOutMin,
    path,
    recipientAddress,
    deadline,
  ]);
}

/** Build calldata for Token -> Token swap via LBRouter V2.1 */
export function buildSwapTokensForTokensCalldata(
  amountIn: bigint,
  amountOutMin: bigint,
  binSteps: number[],
  tokenPath: string[],
  recipientAddress: string,
  deadline: number
): string {
  const path = {
    pairBinSteps: binSteps,
    versions: binSteps.map(() => 2), // V2_1 for all hops
    tokenPath,
  };
  return routerInterface.encodeFunctionData('swapExactTokensForTokens', [
    amountIn,
    amountOutMin,
    path,
    recipientAddress,
    deadline,
  ]);
}

/** Build ERC20 approve calldata */
export function buildApproveCalldata(spender: string, amount: bigint): string {
  return erc20Interface.encodeFunctionData('approve', [spender, amount]);
}
