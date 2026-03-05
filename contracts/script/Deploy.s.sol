// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OneClickFactory} from "../src/OneClickFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";
import {ICMSync} from "../src/ICMSync.sol";

contract Deploy is Script {
    // TeleporterMessenger (universal address on all Avalanche chains)
    address constant TELEPORTER_MESSENGER = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;

    function run() external {
        address relayerAddress = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast();

        OneClickFactory factory = new OneClickFactory();
        console.log("OneClickFactory deployed at:", address(factory));

        Paymaster paymaster = new Paymaster(msg.sender, relayerAddress);
        console.log("Paymaster deployed at:", address(paymaster));

        ICMSync icmSync = new ICMSync(TELEPORTER_MESSENGER);
        console.log("ICMSync deployed at:", address(icmSync));

        vm.stopBroadcast();
    }
}
