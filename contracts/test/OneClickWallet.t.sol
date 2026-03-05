// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OneClickWallet} from "../src/OneClickWallet.sol";
import {OneClickFactory} from "../src/OneClickFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";
import {MockP256Verifier} from "./mocks/MockP256Verifier.sol";

contract OneClickWalletTest is Test {
    OneClickFactory factory;
    Paymaster paymaster;
    MockP256Verifier mockVerifier;

    address relayerAddr = address(0xBEEF);
    address ownerAddr = address(0xCAFE);
    address targetAddr = address(0xDEAD);

    bytes32 testPubKeyX = bytes32(uint256(0xAA));
    bytes32 testPubKeyY = bytes32(uint256(0xBB));
    bytes fakeSig = abi.encodePacked(bytes32(uint256(1)), bytes32(uint256(2)));

    function setUp() public {
        mockVerifier = new MockP256Verifier();
        factory = new OneClickFactory();
        paymaster = new Paymaster(ownerAddr, relayerAddr);
    }

    function testDeployWalletViaFactory() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));

        assertTrue(wallet != address(0));
        assertEq(OneClickWallet(payable(wallet)).ownerPubKeyX(), testPubKeyX);
        assertEq(OneClickWallet(payable(wallet)).ownerPubKeyY(), testPubKeyY);
    }

    function testGetWalletAddressPrediction() public {
        address predicted = factory.getWalletAddress(testPubKeyX, testPubKeyY);
        address actual = factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));

        assertEq(predicted, actual);
    }

    function testIsDeployed() public {
        assertFalse(factory.isDeployed(testPubKeyX, testPubKeyY));

        factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));

        assertTrue(factory.isDeployed(testPubKeyX, testPubKeyY));
    }

    function testExecuteWithValidSignature() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));
        vm.deal(wallet, 1 ether);

        vm.prank(relayerAddr);
        OneClickWallet(payable(wallet)).execute(targetAddr, 0.5 ether, "", fakeSig);

        assertEq(targetAddr.balance, 0.5 ether);
    }

    function testExecuteNonceIncrement() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));
        vm.deal(wallet, 2 ether);

        vm.prank(relayerAddr);
        OneClickWallet(payable(wallet)).execute(targetAddr, 0.1 ether, "", fakeSig);
        assertEq(OneClickWallet(payable(wallet)).nonce(), 1);

        vm.prank(relayerAddr);
        OneClickWallet(payable(wallet)).execute(targetAddr, 0.1 ether, "", fakeSig);
        assertEq(OneClickWallet(payable(wallet)).nonce(), 2);
    }

    function testExecuteOnlyRelayer() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));

        vm.prank(address(0x1234));
        vm.expectRevert(OneClickWallet.OnlyRelayer.selector);
        OneClickWallet(payable(wallet)).execute(targetAddr, 0, "", fakeSig);
    }

    function testPaymasterDeposit() public {
        paymaster.deposit{value: 1 ether}();

        assertEq(paymaster.getBalance(), 1 ether);
    }

    function testPaymasterSponsor() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, address(paymaster), address(mockVerifier));
        vm.deal(wallet, 1 ether);

        paymaster.deposit{value: 1 ether}();

        vm.prank(relayerAddr);
        paymaster.sponsorTransaction(wallet, targetAddr, 0.5 ether, "", fakeSig);

        assertEq(targetAddr.balance, 0.5 ether);
    }

    function testPaymasterWithdrawOnlyOwner() public {
        paymaster.deposit{value: 1 ether}();

        vm.prank(address(0x1234));
        vm.expectRevert(Paymaster.OnlyOwner.selector);
        paymaster.withdraw(1 ether);

        vm.prank(ownerAddr);
        paymaster.withdraw(1 ether);

        assertEq(paymaster.getBalance(), 0);
    }

    function testExecuteWithWebAuthn() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));
        vm.deal(wallet, 1 ether);

        bytes memory authenticatorData = hex"deadbeef";
        string memory clientDataJSON = '{"type":"webauthn.get","challenge":"AAAA","origin":"https://example.com"}';

        vm.prank(relayerAddr);
        OneClickWallet(payable(wallet)).executeWithWebAuthn(
            targetAddr,
            0.5 ether,
            "",
            authenticatorData,
            clientDataJSON,
            fakeSig
        );

        assertEq(targetAddr.balance, 0.5 ether);
        assertEq(OneClickWallet(payable(wallet)).nonce(), 1);
    }

    function testExecuteWithWebAuthnOnlyRelayer() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));

        vm.prank(address(0x1234));
        vm.expectRevert(OneClickWallet.OnlyRelayer.selector);
        OneClickWallet(payable(wallet)).executeWithWebAuthn(
            targetAddr,
            0,
            "",
            hex"deadbeef",
            '{"type":"webauthn.get"}',
            fakeSig
        );
    }

    function testPaymasterSponsorWebAuthn() public {
        address wallet = factory.deployWallet(testPubKeyX, testPubKeyY, address(paymaster), address(mockVerifier));
        vm.deal(wallet, 1 ether);

        paymaster.deposit{value: 1 ether}();

        vm.prank(relayerAddr);
        paymaster.sponsorWebAuthnTransaction(
            wallet,
            targetAddr,
            0.5 ether,
            "",
            hex"deadbeef",
            '{"type":"webauthn.get","challenge":"AAAA","origin":"https://example.com"}',
            fakeSig
        );

        assertEq(targetAddr.balance, 0.5 ether);
    }

    function testDoubleDeployReverts() public {
        factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));

        vm.expectRevert(OneClickFactory.AlreadyDeployed.selector);
        factory.deployWallet(testPubKeyX, testPubKeyY, relayerAddr, address(mockVerifier));
    }
}
