// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {Grid} from "../lib/Grid.sol";

/// @title GridHarness
/// @author noescape contributors
/// @notice Exposes the internal Grid library for engine-equivalence tests.
contract GridHarness {
    /// @notice Returns the one-hot mask for a cell.
    /// @param cell Board cell index.
    function bit(uint8 cell) external pure returns (uint128) {
        return Grid.bit(cell);
    }

    /// @notice Returns orthogonal neighbour bits without wrapping.
    /// @param mask Input board mask.
    function neighbors(uint128 mask) external pure returns (uint128) {
        return Grid.neighbors(mask);
    }

    /// @notice Expands a mask through walkable cells.
    /// @param mask Starting mask.
    /// @param steps Number of expansion steps.
    /// @param walk Walkable-cell mask.
    function reach(uint128 mask, uint8 steps, uint128 walk) external pure returns (uint128) {
        return Grid.reach(mask, steps, walk);
    }

    /// @notice Returns a cell and its orthogonal neighbours.
    /// @param cell Board cell index.
    function plus(uint8 cell) external pure returns (uint128) {
        return Grid.plus(cell);
    }

    /// @notice Reports whether a mask contains exactly one board bit.
    /// @param mask Input board mask.
    function isOneHot(uint128 mask) external pure returns (bool) {
        return Grid.isOneHot(mask);
    }

    /// @notice Returns the cell index of a one-hot mask, or -1.
    /// @param mask Input board mask.
    function cellOf(uint128 mask) external pure returns (int16) {
        return Grid.cellOf(mask);
    }
}
