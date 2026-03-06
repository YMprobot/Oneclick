// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OneClickFactory} from "../src/OneClickFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";

/// @title DeployDeterministic
/// @notice Deploys Factory and Paymaster via Nick's CREATE2 proxy so that
/// the same contract addresses are produced on every chain.
contract DeployDeterministic is Script {
    /// @dev Nick's Deterministic Deployment Proxy — same address on all EVM chains
    address constant NICK_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @dev Fixed salts — change only when redeploying a new version
    bytes32 constant FACTORY_SALT = keccak256("oneclick-v2-factory");
    bytes32 constant PAYMASTER_SALT = keccak256("oneclick-v2-paymaster");

    function run() external {
        address relayerAddress = vm.envAddress("RELAYER_ADDRESS");

        // Build init codes
        bytes memory factoryInitCode = type(OneClickFactory).creationCode;
        bytes memory paymasterInitCode = abi.encodePacked(
            type(Paymaster).creationCode,
            abi.encode(relayerAddress, relayerAddress) // owner = relayer
        );

        // Compute expected addresses (deterministic — same on every chain)
        address expectedFactory = computeCreate2(FACTORY_SALT, factoryInitCode);
        address expectedPaymaster = computeCreate2(PAYMASTER_SALT, paymasterInitCode);

        console.log("Expected Factory:", expectedFactory);
        console.log("Expected Paymaster:", expectedPaymaster);

        // Check if already deployed on this chain
        bool factoryExists = expectedFactory.code.length > 0;
        bool paymasterExists = expectedPaymaster.code.length > 0;

        if (factoryExists && paymasterExists) {
            console.log("Both contracts already deployed on this chain. Skipping.");
            return;
        }

        vm.startBroadcast();

        if (!factoryExists) {
            (bool ok, ) = NICK_FACTORY.call(
                abi.encodePacked(FACTORY_SALT, factoryInitCode)
            );
            require(ok, "Factory CREATE2 deploy failed");
            console.log("Factory deployed at:", expectedFactory);
        } else {
            console.log("Factory already deployed, skipping");
        }

        if (!paymasterExists) {
            (bool ok, ) = NICK_FACTORY.call(
                abi.encodePacked(PAYMASTER_SALT, paymasterInitCode)
            );
            require(ok, "Paymaster CREATE2 deploy failed");
            console.log("Paymaster deployed at:", expectedPaymaster);
        } else {
            console.log("Paymaster already deployed, skipping");
        }

        vm.stopBroadcast();
    }

    /// @dev Compute CREATE2 address: keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))
    function computeCreate2(
        bytes32 salt,
        bytes memory initCode
    ) internal pure returns (address) {
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                NICK_FACTORY,
                                salt,
                                keccak256(initCode)
                            )
                        )
                    )
                )
            );
    }
}
