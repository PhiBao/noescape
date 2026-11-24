// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {CityMapData} from "../generated/CityMapData.sol";

/// @title Grid
/// @author noescape contributors
/// @notice Bit-mask helpers shared by the encrypted fugitive brain.
library Grid {
    function bit(uint8 cell) internal pure returns (uint128) {
        return uint128(1) << cell;
    }

    function neighbors(uint128 mask) internal pure returns (uint128) {
        return
            ((mask >> 12) |
                ((mask << 12) & CityMapData.ALL) |
                ((mask & ~CityMapData.COL11) << 1) |
                ((mask & ~CityMapData.COL0) >> 1)) & CityMapData.ALL;
    }

    function reach(uint128 mask, uint8 steps, uint128 walk) internal pure returns (uint128 result) {
        result = mask & walk;
        for (uint8 step = 0; step < steps; ++step) {
            result |= neighbors(result) & walk;
        }
        return result & walk;
    }

    function plus(uint8 cell) internal pure returns (uint128) {
        return bit(cell) | neighbors(bit(cell));
    }

    function isOneHot(uint128 mask) internal pure returns (bool) {
        return mask != 0 && mask < CityMapData.ALL + 1 && (mask & (mask - 1)) == 0;
    }

    function cellOf(uint128 mask) internal pure returns (int16) {
        if (isOneHot(mask) == false) return -1;
        for (uint8 cell = 0; cell < 120; ++cell) {
            if (mask == bit(cell)) return int16(uint16(cell));
        }
        return -1;
    }
}
