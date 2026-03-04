// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockP256Verifier {
    fallback(bytes calldata) external returns (bytes memory) {
        return abi.encode(uint256(1));
    }
}
