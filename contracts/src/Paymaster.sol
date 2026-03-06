// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OneClickWallet} from "./OneClickWallet.sol";

/// @title Paymaster
/// @notice Simple gas sponsorship contract. dApp devs deposit funds,
/// relayer triggers sponsored transactions through user wallets.
contract Paymaster {
    address public owner;
    address public relayer;

    /// @notice Emitted when funds are deposited
    /// @param depositor The address that deposited
    /// @param amount The amount deposited
    event Deposited(address indexed depositor, uint256 amount);

    /// @notice Emitted when the owner withdraws funds
    /// @param amount The amount withdrawn
    event Withdrawn(uint256 amount);

    /// @notice Emitted when a transaction is sponsored
    /// @param wallet The wallet that executed the transaction
    /// @param target The destination address of the sponsored call
    event TransactionSponsored(address indexed wallet, address indexed target);

    error OnlyOwner();
    error OnlyRelayer();
    error WithdrawFailed();
    error InsufficientBalance();

    constructor(address _owner, address _relayer) {
        owner = _owner;
        relayer = _relayer;
    }

    /// @notice Deposit funds for gas sponsorship
    function deposit() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw funds (owner only)
    /// @param amount The amount to withdraw
    function withdraw(uint256 amount) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (amount > address(this).balance) revert InsufficientBalance();

        emit Withdrawn(amount);

        (bool success, ) = owner.call{value: amount}("");
        if (!success) revert WithdrawFailed();
    }

    /// @notice Sponsor a transaction through a user's wallet
    /// @param wallet The OneClickWallet to call execute on
    /// @param target The destination address for the wallet call
    /// @param value The ETH/AVAX value to forward
    /// @param data The calldata for the target call
    /// @param signature The P256 signature (64 bytes: r || s)
    function sponsorTransaction(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();

        OneClickWallet(payable(wallet)).execute(target, value, data, signature);

        emit TransactionSponsored(wallet, target);
    }

    /// @notice Sponsor a WebAuthn-verified transaction through a user's wallet
    /// @param wallet The OneClickWallet to call executeWithWebAuthn on
    /// @param target The destination address for the wallet call
    /// @param value The ETH/AVAX value to forward
    /// @param data The calldata for the target call
    /// @param authenticatorData Raw authenticator data from WebAuthn assertion
    /// @param clientDataJSON Raw client data JSON string from WebAuthn assertion
    /// @param signature The P256 signature (64 bytes: r || s)
    function sponsorWebAuthnTransaction(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata authenticatorData,
        string calldata clientDataJSON,
        bytes calldata signature
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();

        OneClickWallet(payable(wallet)).executeWithWebAuthn(target, value, data, authenticatorData, clientDataJSON, signature);

        emit TransactionSponsored(wallet, target);
    }

    /// @notice Get the contract's current balance
    /// @return The balance in wei
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Allow the contract to receive native tokens (AVAX)
    receive() external payable {}
}
