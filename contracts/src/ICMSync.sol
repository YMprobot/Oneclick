// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITeleporterMessenger, TeleporterMessageInput, TeleporterFeeInfo} from "./interfaces/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "./interfaces/ITeleporterReceiver.sol";
import {OneClickWallet} from "./OneClickWallet.sol";

/// @title ICMSync
/// @notice Cross-L1 key synchronization for OneClick wallets using Avalanche Interchain Messaging.
/// When a user adds/removes a passkey on one L1, this contract propagates the change
/// to their wallet contracts on other L1s via Teleporter.
contract ICMSync is ITeleporterReceiver {
    // --- Types ---

    enum SyncAction {
        ADD_KEY,
        REMOVE_KEY,
        REPLACE_KEY
    }

    struct KeySyncMessage {
        address walletAddress;
        SyncAction action;
        bytes32 pubKeyX;
        bytes32 pubKeyY;
        uint256 syncNonce;
    }

    // --- State ---

    ITeleporterMessenger public immutable teleporterMessenger;
    address public owner;

    /// @notice Registered remote ICMSync contracts (blockchainID => address)
    mapping(bytes32 => address) public remoteContracts;

    /// @notice Wallets authorized to trigger sync
    mapping(address => bool) public registeredWallets;

    /// @notice Sync nonces per wallet to prevent replay
    mapping(address => uint256) public syncNonces;

    /// @notice Chains where each wallet is deployed
    mapping(address => bytes32[]) public walletChains;

    // --- Events ---

    event KeySyncSent(
        address indexed wallet,
        bytes32 indexed destinationBlockchainID,
        SyncAction action,
        bytes32 pubKeyX,
        bytes32 pubKeyY,
        uint256 syncNonce
    );

    event KeySyncReceived(
        address indexed wallet,
        bytes32 indexed sourceBlockchainID,
        SyncAction action,
        bytes32 pubKeyX,
        bytes32 pubKeyY
    );

    event RemoteContractRegistered(bytes32 indexed blockchainID, address remoteAddress);

    event WalletRegistered(address indexed wallet);

    // --- Errors ---

    error OnlyOwner();
    error OnlyRegisteredWallet();
    error OnlyTeleporter();
    error UnknownRemoteSender();
    error RemoteNotRegistered();

    // --- Modifiers ---

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyRegisteredWallet() {
        if (!registeredWallets[msg.sender]) revert OnlyRegisteredWallet();
        _;
    }

    // --- Constructor ---

    constructor(address _teleporterMessenger) {
        teleporterMessenger = ITeleporterMessenger(_teleporterMessenger);
        owner = msg.sender;
    }

    // --- Admin functions ---

    /// @notice Register a remote ICMSync contract on another L1
    /// @param blockchainID The Avalanche blockchain ID of the remote chain
    /// @param remoteAddress The ICMSync contract address on the remote chain
    function registerRemoteContract(bytes32 blockchainID, address remoteAddress) external onlyOwner {
        remoteContracts[blockchainID] = remoteAddress;
        emit RemoteContractRegistered(blockchainID, remoteAddress);
    }

    /// @notice Register a wallet that can trigger key sync
    /// @param wallet The wallet address to authorize
    function registerWallet(address wallet) external onlyOwner {
        registeredWallets[wallet] = true;
        emit WalletRegistered(wallet);
    }

    /// @notice Add a chain to a wallet's sync list
    /// @param wallet The wallet address
    /// @param blockchainID The chain to add
    function addWalletChain(address wallet, bytes32 blockchainID) external onlyOwner {
        walletChains[wallet].push(blockchainID);
    }

    // --- Core sync functions ---

    /// @notice Sync a key change to a specific destination chain
    /// @param destinationBlockchainID Target chain's blockchain ID
    /// @param walletAddress The wallet to update on destination
    /// @param action ADD_KEY, REMOVE_KEY, or REPLACE_KEY
    /// @param pubKeyX New/removed key X coordinate
    /// @param pubKeyY New/removed key Y coordinate
    /// @return messageID The Teleporter message ID
    function syncKeyToChain(
        bytes32 destinationBlockchainID,
        address walletAddress,
        SyncAction action,
        bytes32 pubKeyX,
        bytes32 pubKeyY
    ) external onlyRegisteredWallet returns (bytes32 messageID) {
        return _syncKeyToChain(destinationBlockchainID, walletAddress, action, pubKeyX, pubKeyY);
    }

    /// @notice Sync a key change to ALL registered chains for a wallet
    /// @param walletAddress The wallet to update
    /// @param action ADD_KEY, REMOVE_KEY, or REPLACE_KEY
    /// @param pubKeyX New/removed key X coordinate
    /// @param pubKeyY New/removed key Y coordinate
    function syncKeyToAllChains(
        address walletAddress,
        SyncAction action,
        bytes32 pubKeyX,
        bytes32 pubKeyY
    ) external onlyRegisteredWallet {
        bytes32[] memory chains = walletChains[walletAddress];
        for (uint256 i = 0; i < chains.length; i++) {
            if (remoteContracts[chains[i]] != address(0)) {
                _syncKeyToChain(chains[i], walletAddress, action, pubKeyX, pubKeyY);
            }
        }
    }

    /// @dev Internal implementation for sending a key sync message
    function _syncKeyToChain(
        bytes32 destinationBlockchainID,
        address walletAddress,
        SyncAction action,
        bytes32 pubKeyX,
        bytes32 pubKeyY
    ) internal returns (bytes32 messageID) {
        address remoteContract = remoteContracts[destinationBlockchainID];
        if (remoteContract == address(0)) revert RemoteNotRegistered();

        uint256 currentNonce = syncNonces[walletAddress]++;

        KeySyncMessage memory syncMsg = KeySyncMessage({
            walletAddress: walletAddress,
            action: action,
            pubKeyX: pubKeyX,
            pubKeyY: pubKeyY,
            syncNonce: currentNonce
        });

        TeleporterMessageInput memory input = TeleporterMessageInput({
            destinationBlockchainID: destinationBlockchainID,
            destinationAddress: remoteContract,
            feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
            requiredGasLimit: 200_000,
            allowedRelayerAddresses: new address[](0),
            message: abi.encode(syncMsg)
        });

        messageID = teleporterMessenger.sendCrossChainMessage(input);

        emit KeySyncSent(walletAddress, destinationBlockchainID, action, pubKeyX, pubKeyY, currentNonce);
    }

    // --- Teleporter receiver ---

    /// @notice Called by TeleporterMessenger when a cross-chain message arrives
    /// @param sourceBlockchainID The chain the message came from
    /// @param originSenderAddress The ICMSync contract that sent the message
    /// @param message The encoded KeySyncMessage
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override {
        if (msg.sender != address(teleporterMessenger)) revert OnlyTeleporter();
        if (remoteContracts[sourceBlockchainID] != originSenderAddress) revert UnknownRemoteSender();

        KeySyncMessage memory syncMsg = abi.decode(message, (KeySyncMessage));

        emit KeySyncReceived(
            syncMsg.walletAddress, sourceBlockchainID, syncMsg.action, syncMsg.pubKeyX, syncMsg.pubKeyY
        );

        // Apply the key update to the wallet contract on this chain
        OneClickWallet(payable(syncMsg.walletAddress)).updateOwnerKey(syncMsg.pubKeyX, syncMsg.pubKeyY);
    }

    // --- View functions ---

    /// @notice Get all chains a wallet is registered on
    /// @param wallet The wallet address
    /// @return chains Array of blockchain IDs
    function getWalletChains(address wallet) external view returns (bytes32[] memory) {
        return walletChains[wallet];
    }

    /// @notice Get the remote ICMSync address for a chain
    /// @param blockchainID The chain's blockchain ID
    /// @return The remote contract address
    function getRemoteContract(bytes32 blockchainID) external view returns (address) {
        return remoteContracts[blockchainID];
    }
}
