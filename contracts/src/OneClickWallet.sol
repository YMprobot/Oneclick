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
    address public icmSync;
    bool private initialized;

    /// @notice Emitted when the wallet executes a transaction
    /// @param target The destination address
    /// @param value The ETH/AVAX value sent
    /// @param walletNonce The nonce used for this execution
    event Executed(address indexed target, uint256 value, uint256 walletNonce);

    /// @notice Emitted when the owner key is updated via ICM sync
    /// @param pubKeyX The new X coordinate
    /// @param pubKeyY The new Y coordinate
    event KeyUpdated(bytes32 pubKeyX, bytes32 pubKeyY);

    error AlreadyInitialized();
    error OnlyRelayer();
    error OnlyICMSync();
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

    /// @notice Execute a transaction with full WebAuthn signature verification.
    /// The authenticator signs SHA-256(authenticatorData || SHA-256(clientDataJSON)).
    /// @param target The destination address
    /// @param value The ETH/AVAX value to send
    /// @param data The calldata for the target call
    /// @param authenticatorData Raw authenticator data from WebAuthn assertion
    /// @param clientDataJSON Raw client data JSON string from WebAuthn assertion
    /// @param signature 64 bytes: r (bytes 0-31) || s (bytes 32-63)
    function executeWithWebAuthn(
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata authenticatorData,
        string calldata clientDataJSON,
        bytes calldata signature
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();

        // Reconstruct the message that WebAuthn signed:
        // message = SHA-256(authenticatorData || SHA-256(clientDataJSON))
        bytes32 message = sha256(
            abi.encodePacked(authenticatorData, sha256(bytes(clientDataJSON)))
        );

        _verifyP256(message, signature);

        nonce++;

        (bool execSuccess, ) = target.call{value: value}(data);
        if (!execSuccess) revert ExecutionFailed();

        emit Executed(target, value, nonce - 1);
    }

    /// @notice Execute a transaction using relayer authority only (no user signature).
    /// Used for multi-step smart routing where the user already authorised Step 1
    /// with their passkey.  The relayer is a trusted party (msg.sender check).
    /// @param target The destination address
    /// @param value The ETH/AVAX value to send
    /// @param data The calldata for the target call
    function executeAsRelayer(
        address target,
        uint256 value,
        bytes calldata data
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();

        nonce++;

        (bool execSuccess, ) = target.call{value: value}(data);
        if (!execSuccess) revert ExecutionFailed();

        emit Executed(target, value, nonce - 1);
    }

    /// @dev Verify a P256 signature against the owner's public key
    function _verifyP256(bytes32 message, bytes calldata signature) internal view {
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);

        (bool success, bytes memory result) = verifier.staticcall(
            abi.encode(message, r, s, ownerPubKeyX, ownerPubKeyY)
        );

        if (!success || result.length < 32 || abi.decode(result, (uint256)) != 1) {
            revert InvalidSignature();
        }
    }

    /// @notice Set the ICMSync contract address (relayer only)
    /// @param _icmSync The ICMSync contract address
    function setICMSync(address _icmSync) external {
        if (msg.sender != relayer) revert OnlyRelayer();
        icmSync = _icmSync;
    }

    /// @notice Update the owner key via cross-chain sync (ICMSync only)
    /// @param _pubKeyX The new X coordinate
    /// @param _pubKeyY The new Y coordinate
    function updateOwnerKey(bytes32 _pubKeyX, bytes32 _pubKeyY) external {
        if (msg.sender != icmSync) revert OnlyICMSync();
        ownerPubKeyX = _pubKeyX;
        ownerPubKeyY = _pubKeyY;
        emit KeyUpdated(_pubKeyX, _pubKeyY);
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
