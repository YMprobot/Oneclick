// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct TeleporterMessageInput {
    bytes32 destinationBlockchainID;
    address destinationAddress;
    TeleporterFeeInfo feeInfo;
    uint256 requiredGasLimit;
    address[] allowedRelayerAddresses;
    bytes message;
}

struct TeleporterFeeInfo {
    address feeTokenAddress;
    uint256 amount;
}

interface ITeleporterMessenger {
    function sendCrossChainMessage(
        TeleporterMessageInput calldata messageInput
    ) external returns (bytes32);

    function getNextMessageID(
        bytes32 destinationBlockchainID
    ) external view returns (bytes32);
}
