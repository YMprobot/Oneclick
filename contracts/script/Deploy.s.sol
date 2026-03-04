// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OneClickFactory} from "../src/OneClickFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";

contract Deploy is Script {
    function run() external {
        address relayerAddress = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast();

        OneClickFactory factory = new OneClickFactory();
        console.log("OneClickFactory deployed at:", address(factory));

        Paymaster paymaster = new Paymaster(msg.sender, relayerAddress);
        console.log("Paymaster deployed at:", address(paymaster));

        vm.stopBroadcast();
    }
}
