// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OneClickWallet} from "./OneClickWallet.sol";

/// @title OneClickFactory
/// @notice Deploys OneClickWallet instances using CREATE2 for deterministic addresses.
/// Same passkey public key produces the same wallet address on every L1.
contract OneClickFactory {
    mapping(bytes32 => address) public wallets;

    /// @notice Emitted when a new wallet is deployed
    /// @param wallet The deployed wallet address
    /// @param pubKeyX The X coordinate of the owner's P256 public key
    /// @param pubKeyY The Y coordinate of the owner's P256 public key
    event WalletDeployed(address indexed wallet, bytes32 pubKeyX, bytes32 pubKeyY);

    error AlreadyDeployed();

    /// @notice Deploy a new OneClickWallet using CREATE2
    /// @param pubKeyX The X coordinate of the owner's P256 public key
    /// @param pubKeyY The Y coordinate of the owner's P256 public key
    /// @param relayer The authorized relayer address
    /// @param verifier The P256 verifier address (0x0100 in prod, mock in tests)
    /// @return wallet The address of the deployed wallet
    function deployWallet(
        bytes32 pubKeyX,
        bytes32 pubKeyY,
        address relayer,
        address verifier
    ) external returns (address wallet) {
        bytes32 salt = keccak256(abi.encodePacked(pubKeyX, pubKeyY));
        if (wallets[salt] != address(0)) revert AlreadyDeployed();

        wallet = address(new OneClickWallet{salt: salt}());
        OneClickWallet(payable(wallet)).initialize(pubKeyX, pubKeyY, relayer, verifier);

        wallets[salt] = wallet;
        emit WalletDeployed(wallet, pubKeyX, pubKeyY);
    }

    /// @notice Compute the CREATE2 address for a given public key without deploying
    /// @param pubKeyX The X coordinate of the owner's P256 public key
    /// @param pubKeyY The Y coordinate of the owner's P256 public key
    /// @return The deterministic wallet address
    function getWalletAddress(bytes32 pubKeyX, bytes32 pubKeyY) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(pubKeyX, pubKeyY));
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            salt,
                            keccak256(type(OneClickWallet).creationCode)
                        )
                    )
                )
            )
        );
    }

    /// @notice Check if a wallet has been deployed for a given public key
    /// @param pubKeyX The X coordinate of the owner's P256 public key
    /// @param pubKeyY The Y coordinate of the owner's P256 public key
    /// @return True if the wallet has been deployed
    function isDeployed(bytes32 pubKeyX, bytes32 pubKeyY) external view returns (bool) {
        bytes32 salt = keccak256(abi.encodePacked(pubKeyX, pubKeyY));
        return wallets[salt] != address(0);
    }
}
