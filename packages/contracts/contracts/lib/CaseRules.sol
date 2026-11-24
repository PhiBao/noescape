// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {CityMapData} from "../generated/CityMapData.sol";
import {Grid} from "./Grid.sol";

/// @title CaseRules
/// @author noescape contributors
/// @notice Plaintext order validation shared by solo and daily cases.
library CaseRules {
    uint8 internal constant OK = 0;
    uint8 internal constant UNREACHABLE = 1;
    uint8 internal constant SHARED = 2;
    uint8 internal constant NOT_WALKABLE = 3;

    /// @notice Validates reach, walkability and distinct destinations.
    /// @param cells Current detective cells.
    /// @param to Requested detective destinations.
    /// @param flags Bit d enables detective d's search.
    /// @return ok Whether all orders are legal.
    /// @return reason Failure reason when invalid.
    /// @return detective Detective index that failed.
    function validOrders(
        uint8[3] memory cells,
        uint8[3] memory to,
        uint8 flags
    ) public pure returns (bool ok, uint8 reason, uint8 detective) {
        for (uint8 index = 0; index < 3; ++index) {
            uint8 target = to[index];
            if (target > 119 || (CityMapData.WALK & Grid.bit(target)) == 0) {
                return (false, NOT_WALKABLE, index);
            }
            uint8 steps = (flags & (1 << index)) != 0 ? CityMapData.DET_STEPS : CityMapData.SPRINT_STEPS;
            if ((Grid.reach(Grid.bit(cells[index]), steps, CityMapData.WALK) & Grid.bit(target)) == 0) {
                return (false, UNREACHABLE, index);
            }
        }
        for (uint8 first = 0; first < 3; ++first) {
            for (uint8 second = first + 1; second < 3; ++second) {
                if (to[first] == to[second]) return (false, SHARED, second);
            }
        }
        return (true, OK, 0);
    }
}
