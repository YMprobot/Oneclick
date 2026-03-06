// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ICMSync} from "../src/ICMSync.sol";
import {OneClickWallet} from "../src/OneClickWallet.sol";
import {OneClickFactory} from "../src/OneClickFactory.sol";
import {MockTeleporterMessenger} from "./mocks/MockTeleporterMessenger.sol";
import {MockP256Verifier} from "./mocks/MockP256Verifier.sol";

contract ICMSyncTest is Test {
    ICMSync icmSync;
    MockTeleporterMessenger mockTeleporter;
    MockP256Verifier mockVerifier;
    OneClickFactory factory;

    address owner = address(this);
    address walletAddr;
    address nonOwner = address(0xBEEF);

    bytes32 constant FUJI_BLOCKCHAIN_ID = 0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5;
    bytes32 constant REMOTE_BLOCKCHAIN_ID = bytes32(uint256(0x1234));
    address constant REMOTE_ICM_SYNC = address(0xABCD);

    bytes32 testPubKeyX = bytes32(uint256(0xAA));
    bytes32 testPubKeyY = bytes32(uint256(0xBB));
    bytes32 newPubKeyX = bytes32(uint256(0xCC));
    bytes32 newPubKeyY = bytes32(uint256(0xDD));

    function setUp() public {
        mockTeleporter = new MockTeleporterMessenger();
        mockVerifier = new MockP256Verifier();
        factory = new OneClickFactory();
        icmSync = new ICMSync(address(mockTeleporter));

        // Deploy a wallet via factory
        walletAddr = factory.deployWallet(testPubKeyX, testPubKeyY, address(this), address(mockVerifier));

        // Register the wallet in ICMSync
        icmSync.registerWallet(walletAddr);

        // Authorize ICMSync to update wallet keys
        OneClickWallet(payable(walletAddr)).setICMSync(address(icmSync));
    }

    // --- Admin tests ---

    function testRegisterRemoteContract() public {
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);
        assertEq(icmSync.getRemoteContract(REMOTE_BLOCKCHAIN_ID), REMOTE_ICM_SYNC);
    }

    function testRegisterRemoteContractNonOwnerReverts() public {
        vm.prank(nonOwner);
        vm.expectRevert(ICMSync.OnlyOwner.selector);
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);
    }

    function testRegisterWallet() public {
        address newWallet = address(0xFACE);
        icmSync.registerWallet(newWallet);
        assertTrue(icmSync.registeredWallets(newWallet));
    }

    function testRegisterWalletNonOwnerReverts() public {
        vm.prank(nonOwner);
        vm.expectRevert(ICMSync.OnlyOwner.selector);
        icmSync.registerWallet(address(0xFACE));
    }

    // --- Sync to chain tests ---

    function testSyncKeyToChain() public {
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);

        vm.prank(walletAddr);
        bytes32 messageID =
            icmSync.syncKeyToChain(REMOTE_BLOCKCHAIN_ID, walletAddr, ICMSync.SyncAction.REPLACE_KEY, newPubKeyX, newPubKeyY);

        assertTrue(messageID != bytes32(0));
        assertEq(mockTeleporter.getMessageCount(), 1);

        // Verify the sent message
        MockTeleporterMessenger.SentMessage memory msg_ = mockTeleporter.getMessage(0);
        assertEq(msg_.destinationBlockchainID, REMOTE_BLOCKCHAIN_ID);
        assertEq(msg_.destinationAddress, REMOTE_ICM_SYNC);
        assertEq(msg_.requiredGasLimit, 200_000);

        // Decode the message payload
        ICMSync.KeySyncMessage memory syncMsg = abi.decode(msg_.message, (ICMSync.KeySyncMessage));
        assertEq(syncMsg.walletAddress, walletAddr);
        assertEq(uint8(syncMsg.action), uint8(ICMSync.SyncAction.REPLACE_KEY));
        assertEq(syncMsg.pubKeyX, newPubKeyX);
        assertEq(syncMsg.pubKeyY, newPubKeyY);
        assertEq(syncMsg.syncNonce, 0);
    }

    function testSyncKeyToChainUnregisteredWalletReverts() public {
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);

        vm.prank(nonOwner);
        vm.expectRevert(ICMSync.OnlyRegisteredWallet.selector);
        icmSync.syncKeyToChain(REMOTE_BLOCKCHAIN_ID, nonOwner, ICMSync.SyncAction.ADD_KEY, newPubKeyX, newPubKeyY);
    }

    function testSyncKeyToChainNoRemoteReverts() public {
        vm.prank(walletAddr);
        vm.expectRevert(ICMSync.RemoteNotRegistered.selector);
        icmSync.syncKeyToChain(REMOTE_BLOCKCHAIN_ID, walletAddr, ICMSync.SyncAction.ADD_KEY, newPubKeyX, newPubKeyY);
    }

    // --- Sync to all chains ---

    function testSyncKeyToAllChains() public {
        bytes32 chain2 = bytes32(uint256(0x5678));
        address remote2 = address(0xDCBA);

        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);
        icmSync.registerRemoteContract(chain2, remote2);
        icmSync.addWalletChain(walletAddr, REMOTE_BLOCKCHAIN_ID);
        icmSync.addWalletChain(walletAddr, chain2);

        vm.prank(walletAddr);
        icmSync.syncKeyToAllChains(walletAddr, ICMSync.SyncAction.ADD_KEY, newPubKeyX, newPubKeyY);

        assertEq(mockTeleporter.getMessageCount(), 2);

        MockTeleporterMessenger.SentMessage memory msg1 = mockTeleporter.getMessage(0);
        assertEq(msg1.destinationBlockchainID, REMOTE_BLOCKCHAIN_ID);
        assertEq(msg1.destinationAddress, REMOTE_ICM_SYNC);

        MockTeleporterMessenger.SentMessage memory msg2 = mockTeleporter.getMessage(1);
        assertEq(msg2.destinationBlockchainID, chain2);
        assertEq(msg2.destinationAddress, remote2);
    }

    // --- Receive message tests ---

    function testReceiveMessage() public {
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);

        ICMSync.KeySyncMessage memory syncMsg = ICMSync.KeySyncMessage({
            walletAddress: walletAddr,
            action: ICMSync.SyncAction.REPLACE_KEY,
            pubKeyX: newPubKeyX,
            pubKeyY: newPubKeyY,
            syncNonce: 0
        });

        vm.prank(address(mockTeleporter));
        vm.expectEmit(true, true, false, true);
        emit ICMSync.KeySyncReceived(
            walletAddr, REMOTE_BLOCKCHAIN_ID, ICMSync.SyncAction.REPLACE_KEY, newPubKeyX, newPubKeyY
        );

        icmSync.receiveTeleporterMessage(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC, abi.encode(syncMsg));
    }

    function testReceiveMessageWrongSenderReverts() public {
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);

        ICMSync.KeySyncMessage memory syncMsg = ICMSync.KeySyncMessage({
            walletAddress: walletAddr,
            action: ICMSync.SyncAction.ADD_KEY,
            pubKeyX: newPubKeyX,
            pubKeyY: newPubKeyY,
            syncNonce: 0
        });

        // Call from non-teleporter address
        vm.prank(nonOwner);
        vm.expectRevert(ICMSync.OnlyTeleporter.selector);
        icmSync.receiveTeleporterMessage(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC, abi.encode(syncMsg));
    }

    function testReceiveMessageUnknownOriginReverts() public {
        // Remote NOT registered
        ICMSync.KeySyncMessage memory syncMsg = ICMSync.KeySyncMessage({
            walletAddress: walletAddr,
            action: ICMSync.SyncAction.ADD_KEY,
            pubKeyX: newPubKeyX,
            pubKeyY: newPubKeyY,
            syncNonce: 0
        });

        vm.prank(address(mockTeleporter));
        vm.expectRevert(ICMSync.UnknownRemoteSender.selector);
        icmSync.receiveTeleporterMessage(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC, abi.encode(syncMsg));
    }

    // --- Nonce tests ---

    function testSyncNonceIncrement() public {
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);

        assertEq(icmSync.syncNonces(walletAddr), 0);

        vm.prank(walletAddr);
        icmSync.syncKeyToChain(REMOTE_BLOCKCHAIN_ID, walletAddr, ICMSync.SyncAction.ADD_KEY, newPubKeyX, newPubKeyY);
        assertEq(icmSync.syncNonces(walletAddr), 1);

        vm.prank(walletAddr);
        icmSync.syncKeyToChain(REMOTE_BLOCKCHAIN_ID, walletAddr, ICMSync.SyncAction.REPLACE_KEY, newPubKeyX, newPubKeyY);
        assertEq(icmSync.syncNonces(walletAddr), 2);

        // Verify nonce was encoded in each message
        ICMSync.KeySyncMessage memory msg1 = abi.decode(mockTeleporter.getMessage(0).message, (ICMSync.KeySyncMessage));
        assertEq(msg1.syncNonce, 0);

        ICMSync.KeySyncMessage memory msg2 = abi.decode(mockTeleporter.getMessage(1).message, (ICMSync.KeySyncMessage));
        assertEq(msg2.syncNonce, 1);
    }

    // --- Wallet key update tests ---

    function testSetICMSync() public {
        OneClickWallet wallet = OneClickWallet(payable(walletAddr));
        wallet.setICMSync(address(icmSync));
        assertEq(wallet.icmSync(), address(icmSync));
    }

    function testSetICMSyncNonRelayerReverts() public {
        OneClickWallet wallet = OneClickWallet(payable(walletAddr));
        vm.prank(nonOwner);
        vm.expectRevert(OneClickWallet.OnlyRelayer.selector);
        wallet.setICMSync(address(icmSync));
    }

    function testUpdateOwnerKey() public {
        OneClickWallet wallet = OneClickWallet(payable(walletAddr));
        wallet.setICMSync(address(icmSync));

        vm.prank(address(icmSync));
        wallet.updateOwnerKey(newPubKeyX, newPubKeyY);

        (bytes32 x, bytes32 y) = wallet.getOwnerPubKey();
        assertEq(x, newPubKeyX);
        assertEq(y, newPubKeyY);
    }

    function testUpdateOwnerKeyNonICMSyncReverts() public {
        OneClickWallet wallet = OneClickWallet(payable(walletAddr));
        wallet.setICMSync(address(icmSync));

        vm.prank(nonOwner);
        vm.expectRevert(OneClickWallet.OnlyICMSync.selector);
        wallet.updateOwnerKey(newPubKeyX, newPubKeyY);
    }

    // --- End-to-end sync tests ---

    function testReceiveMessageUpdatesWalletKey() public {
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);

        // Verify original keys
        OneClickWallet wallet = OneClickWallet(payable(walletAddr));
        (bytes32 origX, bytes32 origY) = wallet.getOwnerPubKey();
        assertEq(origX, testPubKeyX);
        assertEq(origY, testPubKeyY);

        // Simulate receiving a REPLACE_KEY message from a remote chain
        ICMSync.KeySyncMessage memory syncMsg = ICMSync.KeySyncMessage({
            walletAddress: walletAddr,
            action: ICMSync.SyncAction.REPLACE_KEY,
            pubKeyX: newPubKeyX,
            pubKeyY: newPubKeyY,
            syncNonce: 0
        });

        vm.prank(address(mockTeleporter));
        icmSync.receiveTeleporterMessage(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC, abi.encode(syncMsg));

        // Verify keys were actually updated in the wallet
        (bytes32 updatedX, bytes32 updatedY) = wallet.getOwnerPubKey();
        assertEq(updatedX, newPubKeyX);
        assertEq(updatedY, newPubKeyY);
    }

    function testFullSyncRoundTrip() public {
        // Setup: register remote chain and wallet chains
        icmSync.registerRemoteContract(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC);
        icmSync.addWalletChain(walletAddr, REMOTE_BLOCKCHAIN_ID);

        // Step 1: Wallet sends a sync message to remote chain
        vm.prank(walletAddr);
        icmSync.syncKeyToChain(
            REMOTE_BLOCKCHAIN_ID, walletAddr, ICMSync.SyncAction.REPLACE_KEY, newPubKeyX, newPubKeyY
        );

        // Verify the outbound message was built correctly
        assertEq(mockTeleporter.getMessageCount(), 1);
        ICMSync.KeySyncMessage memory sentMsg =
            abi.decode(mockTeleporter.getMessage(0).message, (ICMSync.KeySyncMessage));
        assertEq(sentMsg.walletAddress, walletAddr);
        assertEq(sentMsg.pubKeyX, newPubKeyX);

        // Step 2: Simulate the remote chain sending the same message back
        // (in production, the remote ICMSync would process and forward)
        bytes memory messagePayload = mockTeleporter.getMessage(0).message;
        vm.prank(address(mockTeleporter));
        icmSync.receiveTeleporterMessage(REMOTE_BLOCKCHAIN_ID, REMOTE_ICM_SYNC, messagePayload);

        // Step 3: Verify the wallet keys are updated end-to-end
        OneClickWallet wallet = OneClickWallet(payable(walletAddr));
        (bytes32 finalX, bytes32 finalY) = wallet.getOwnerPubKey();
        assertEq(finalX, newPubKeyX);
        assertEq(finalY, newPubKeyY);
    }

    // --- View function tests ---

    function testGetWalletChains() public {
        icmSync.addWalletChain(walletAddr, REMOTE_BLOCKCHAIN_ID);
        icmSync.addWalletChain(walletAddr, FUJI_BLOCKCHAIN_ID);

        bytes32[] memory chains = icmSync.getWalletChains(walletAddr);
        assertEq(chains.length, 2);
        assertEq(chains[0], REMOTE_BLOCKCHAIN_ID);
        assertEq(chains[1], FUJI_BLOCKCHAIN_ID);
    }
}
