// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {CaseRules} from "../lib/CaseRules.sol";

/// @title CaseRulesHarness
/// @author noescape contributors
/// @notice Test-only delegatecall wrapper for the external CaseRules library.
contract CaseRulesHarness {
    /// @notice Replays a reveal through the linked rules library.
    /// @param r Decoded reveal record.
    /// @return ok Whether verification passed.
    /// @return failCode Failure code.
    /// @return failTurn Failure turn.
    /// @return moves Verified moves.
    /// @return answers Verified answers.
    /// @return reportsCount Verified reports.
    function verifyCase(
        CaseRules.Reveal calldata r
    )
        external
        pure
        returns (bool ok, uint8 failCode, uint8 failTurn, uint16 moves, uint16 answers, uint16 reportsCount)
    {
        return CaseRules.verifyCase(r);
    }

    /// @notice Returns the camera id encoded for a one-hot mask.
    /// @param mask One-hot position mask.
    /// @return id Camera id, or zero.
    function camera(uint128 mask) external pure returns (uint8 id) {
        return CaseRules._camera(mask);
    }

    /// @notice Validates detective orders through the linked library.
    /// @param cells Current cells.
    /// @param to Requested cells.
    /// @param flags Search flags.
    /// @return ok Whether orders are valid.
    /// @return reason Failure reason.
    /// @return detective Failed detective.
    function validOrders(
        uint8[3] calldata cells,
        uint8[3] calldata to,
        uint8 flags
    ) external pure returns (bool ok, uint8 reason, uint8 detective) {
        return CaseRules.validOrders(cells, to, flags);
    }

    /// @notice Replays a revealed daily case through the linked rules library.
    /// @param r Decoded daily reveal record.
    /// @return ok Whether verification passed.
    /// @return failCode Failure code.
    /// @return failTurn One-based failure step.
    /// @return moves Verified moves.
    /// @return answers Verified answers.
    /// @return reportsCount Verified camera steps.
    function verifyDaily(
        CaseRules.DailyReveal calldata r
    )
        external
        pure
        returns (bool ok, uint8 failCode, uint16 failTurn, uint16 moves, uint16 answers, uint16 reportsCount)
    {
        return CaseRules.verifyDaily(r);
    }
}
