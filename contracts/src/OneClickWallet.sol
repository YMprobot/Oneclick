// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OneClickWallet
/// @notice Per-user smart wallet with P256 (secp256r1) passkey verification.
/// Deployed via CREATE2 by OneClickFactory. Each user gets their own instance.
contract OneClickWallet {
    bytes32 public ownerPubKeyX;
    bytes32 public ownerPubKeyY;
    uint256 public nonce;
    address public relayer;
    address public verifier;
    bool private initialized;

    /// @notice Emitted when the wallet executes a transaction
    /// @param target The destination address
    /// @param value The ETH/AVAX value sent
    /// @param walletNonce The nonce used for this execution
    event Executed(address indexed target, uint256 value, uint256 walletNonce);

    error AlreadyInitialized();
    error OnlyRelayer();
    error InvalidSignature();
    error ExecutionFailed();

    /// @notice Initialize the wallet with owner's passkey and relayer
    /// @param _pubKeyX The X coordinate of the owner's P256 public key
    /// @param _pubKeyY The Y coordinate of the owner's P256 public key
    /// @param _relayer The authorized relayer address
    /// @param _verifier The P256 verifier address (0x0100 in prod, mock in tests)
    function initialize(
        bytes32 _pubKeyX,
        bytes32 _pubKeyY,
        address _relayer,
        address _verifier
    ) external {
        if (initialized) revert AlreadyInitialized();

        ownerPubKeyX = _pubKeyX;
        ownerPubKeyY = _pubKeyY;
        relayer = _relayer;
        verifier = _verifier;
        initialized = true;
    }

    /// @notice Execute a transaction after verifying the P256 passkey signature
    /// @param target The destination address
    /// @param value The ETH/AVAX value to send
    /// @param data The calldata for the target call
    /// @param signature 64 bytes: r (bytes 0-31) || s (bytes 32-63)
    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();

        bytes32 messageHash = keccak256(
            abi.encodePacked(address(this), target, value, data, nonce)
        );

        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);

        (bool success, bytes memory result) = verifier.staticcall(
            abi.encode(messageHash, r, s, ownerPubKeyX, ownerPubKeyY)
        );

        if (!success || result.length < 32 || abi.decode(result, (uint256)) != 1) {
            revert InvalidSignature();
        }

        nonce++;

        (bool execSuccess, ) = target.call{value: value}(data);
        if (!execSuccess) revert ExecutionFailed();

        emit Executed(target, value, nonce - 1);
    }

    /// @notice Returns the owner's P256 public key
    /// @return pubKeyX The X coordinate
    /// @return pubKeyY The Y coordinate
    function getOwnerPubKey() external view returns (bytes32, bytes32) {
        return (ownerPubKeyX, ownerPubKeyY);
    }

    /// @notice Allow the wallet to receive native tokens (AVAX)
    receive() external payable {}
}
