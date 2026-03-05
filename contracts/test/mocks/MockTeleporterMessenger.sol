// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TeleporterMessageInput} from "../../src/interfaces/ITeleporterMessenger.sol";

/// @notice Mock TeleporterMessenger for testing ICMSync.
/// Records calls to sendCrossChainMessage and allows simulating message delivery.
contract MockTeleporterMessenger {
    struct SentMessage {
        bytes32 destinationBlockchainID;
        address destinationAddress;
        uint256 requiredGasLimit;
        bytes message;
    }

    SentMessage[] public sentMessages;
    uint256 private messageCounter;

    /// @notice Records the cross-chain message and returns a fake messageID
    function sendCrossChainMessage(
        TeleporterMessageInput calldata messageInput
    ) external returns (bytes32) {
        sentMessages.push(
            SentMessage({
                destinationBlockchainID: messageInput.destinationBlockchainID,
                destinationAddress: messageInput.destinationAddress,
                requiredGasLimit: messageInput.requiredGasLimit,
                message: messageInput.message
            })
        );
        messageCounter++;
        return bytes32(messageCounter);
    }

    /// @notice Returns number of messages sent
    function getMessageCount() external view returns (uint256) {
        return sentMessages.length;
    }

    /// @notice Helper: get the Nth sent message
    function getMessage(uint256 index) external view returns (SentMessage memory) {
        return sentMessages[index];
    }

    function getNextMessageID(bytes32) external view returns (bytes32) {
        return bytes32(messageCounter + 1);
    }
}
