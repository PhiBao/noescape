// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FeeProbe
/// @author noescape contributors
/// @notice Test-only probe for the official ERC-7984 wrapper on Sepolia.
contract FeeProbe is ZamaEthereumConfig {
    /// @notice Official confidential token wrapper.
    IERC7984 public immutable TOKEN;
    /// @notice Probe fee in the wrapper's smallest unit.
    uint64 public immutable FEE;
    /// @notice Amount actually pulled by the latest probe.
    euint64 public sent;
    /// @notice Whether the latest pull matched the fee.
    ebool public paid;

    constructor(address token_, uint64 fee_) {
        TOKEN = IERC7984(token_);
        FEE = fee_;
    }

    /// @notice Pulls the fee, records whether it was paid, then sends it back.
    function probe() external {
        euint64 amount = FHE.asEuint64(FEE);
        FHE.allowTransient(amount, address(TOKEN));
        sent = TOKEN.confidentialTransferFrom(msg.sender, address(this), amount);
        paid = FHE.eq(sent, FEE);
        FHE.allowThis(sent);
        FHE.allow(sent, msg.sender);
        FHE.allowThis(paid);
        FHE.allow(paid, msg.sender);
        TOKEN.confidentialTransfer(msg.sender, sent);
    }

    /// @notice Runs the probe from its own unfunded balance without reverting.
    function probeUnderfunded() external {
        this.probe();
        FHE.allow(sent, msg.sender);
        FHE.allow(paid, msg.sender);
    }

    /// @notice Grants read access to this probe's confidential token balance.
    /// @param to Address granted access to the probe balance handle.
    function allowBalance(address to) external {
        FHE.allow(TOKEN.confidentialBalanceOf(address(this)), to);
    }
}
