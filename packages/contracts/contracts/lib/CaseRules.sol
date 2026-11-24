// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {CityMapData} from "../generated/CityMapData.sol";
import {Grid} from "./Grid.sol";

/// @title CaseRules
/// @author noescape contributors
/// @notice Plaintext order validation and reveal verification for cases.
library CaseRules {
    uint8 internal constant OK = 0;
    uint8 internal constant UNREACHABLE = 1;
    uint8 internal constant SHARED = 2;
    uint8 internal constant NOT_WALKABLE = 3;

    // solhint-disable-next-line gas-struct-packing
    struct Reveal {
        uint128[] path;
        uint8 exitIdx;
        uint8 turnCount;
        uint8[3][] orders;
        uint8[] flags;
        uint8[] reports;
        uint8[] noise;
        uint8[] codes;
        uint8 finalStatus;
    }

    struct Counts {
        uint16 moves;
        uint16 answers;
        uint16 reports;
    }

    struct Night {
        uint128 free;
        uint128 threat2;
        uint128 threat3;
        uint128[4] toward;
    }

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

    function _isStart(uint128 mask) internal pure returns (bool) {
        return
            mask == CityMapData.START_0 ||
            mask == CityMapData.START_1 ||
            mask == CityMapData.START_2 ||
            mask == CityMapData.START_3 ||
            mask == CityMapData.START_4 ||
            mask == CityMapData.START_5 ||
            mask == CityMapData.START_6 ||
            mask == CityMapData.START_7;
    }

    function _toward(uint8 exitIdx, uint8 direction) internal pure returns (uint128) {
        uint128[16] memory masks = [
            CityMapData.TOWARD_0_1,
            CityMapData.TOWARD_0_2,
            CityMapData.TOWARD_0_3,
            CityMapData.TOWARD_0_4,
            CityMapData.TOWARD_1_1,
            CityMapData.TOWARD_1_2,
            CityMapData.TOWARD_1_3,
            CityMapData.TOWARD_1_4,
            CityMapData.TOWARD_2_1,
            CityMapData.TOWARD_2_2,
            CityMapData.TOWARD_2_3,
            CityMapData.TOWARD_2_4,
            CityMapData.TOWARD_3_1,
            CityMapData.TOWARD_3_2,
            CityMapData.TOWARD_3_3,
            CityMapData.TOWARD_3_4
        ];
        return masks[uint256(exitIdx) * 4 + uint256(direction) - 1];
    }

    function _night(uint128 det, uint8 exitIdx) internal pure returns (Night memory n) {
        n.free = CityMapData.WALK & ~det;
        n.threat2 = Grid.reach(det, 2, CityMapData.WALK);
        n.threat3 = Grid.reach(det, 3, CityMapData.WALK);
        n.toward = [_toward(exitIdx, 1), _toward(exitIdx, 2), _toward(exitIdx, 3), _toward(exitIdx, 4)];
    }

    function _score(
        uint128 candidate,
        uint128 pos,
        Night memory n,
        uint8 index,
        uint8 noise
    ) internal pure returns (uint8) {
        bool safe = (candidate & n.threat2) == 0;
        bool far = (candidate & n.threat3) == 0;
        bool unseen = (candidate & CityMapData.CAMS) == 0;
        bool toward = index > 0 && (pos & n.toward[index - 1]) != 0;
        return
            uint8(
                1 +
                    noise +
                    (safe ? CityMapData.W_SAFE : 0) +
                    (far ? CityMapData.W_FAR : 0) +
                    (toward ? CityMapData.W_TOWARD : 0) +
                    (unseen ? CityMapData.W_UNSEEN : 0)
            );
    }

    function _brainStep(
        uint128 pos,
        uint8 exitIdx,
        uint128 det,
        uint8[5] memory noise
    ) internal pure returns (uint128) {
        Night memory n = _night(det, exitIdx);
        uint128[5] memory cands = [
            pos,
            pos >> 12,
            (pos & ~CityMapData.COL11) << 1,
            (pos << 12) & CityMapData.ALL,
            (pos & ~CityMapData.COL0) >> 1
        ];
        uint8[5] memory scores;
        for (uint8 index = 0; index < 5; ++index) {
            bool valid = index == 0 || (cands[index] & n.free) != 0;
            if (valid) scores[index] = _score(cands[index], pos, n, index, noise[index]);
        }
        uint128 chosen = cands[0];
        uint8 best = scores[0];
        for (uint8 index = 1; index < 5; ++index) {
            if (scores[index] > best) {
                best = scores[index];
                chosen = cands[index];
            }
        }
        return chosen;
    }

    function _searchCode(uint128[] memory path, uint8 turnNo, uint8 cell) internal pure returns (uint8) {
        uint128 shape = Grid.plus(cell);
        uint8 recentStart = turnNo > 3 ? turnNo - 3 : 0;
        for (uint8 index = recentStart; index < turnNo; ++index) {
            if ((path[index] & shape) != 0) return 2;
        }
        for (uint8 index = 0; index < recentStart; ++index) {
            if ((path[index] & shape) != 0) return 1;
        }
        return 0;
    }

    function _camera(uint128 mask) internal pure returns (uint8) {
        if (mask == CityMapData.CAMBIT_1) return 1;
        if (mask == CityMapData.CAMBIT_2) return 2;
        if (mask == CityMapData.CAMBIT_3) return 3;
        if (mask == CityMapData.CAMBIT_4) return 4;
        if (mask == CityMapData.CAMBIT_5) return 5;
        if (mask == CityMapData.CAMBIT_6) return 6;
        return 0;
    }

    function _detMask(uint8[3] memory cells) internal pure returns (uint128) {
        return Grid.bit(cells[0]) | Grid.bit(cells[1]) | Grid.bit(cells[2]);
    }

    function _isCaptured(uint8[3] memory cells, int16 fugitiveCell) internal pure returns (bool) {
        return cells[0] == uint16(fugitiveCell) || cells[1] == uint16(fugitiveCell) || cells[2] == uint16(fugitiveCell);
    }

    function _turnCodes(
        Reveal memory r,
        uint8 index,
        uint8 turnNo,
        uint256 codeCursor,
        Counts memory counts,
        bool verify
    ) internal pure returns (uint8 failCode, uint256 nextCursor) {
        nextCursor = codeCursor;
        for (uint8 detective = 0; detective < 3; ++detective) {
            if ((r.flags[index] & (1 << detective)) == 0) continue;
            if (nextCursor == r.codes.length) return (5, nextCursor);
            if (verify) {
                uint8 expected = _searchCode(r.path, turnNo, r.orders[index][detective]);
                if (r.codes[nextCursor] != expected) return (5, nextCursor);
                ++counts.answers;
            }
            ++nextCursor;
        }
        return (0, nextCursor);
    }

    // solhint-disable-next-line code-complexity
    function _turnMove(
        Reveal memory r,
        uint8 index,
        uint128 current,
        uint128 next,
        Counts memory counts
    ) internal pure returns (uint8 failCode, uint8 terminalStatus) {
        uint8 turnNo = index + 1;
        int16 currentCell = Grid.cellOf(current);
        int16 nextCell = Grid.cellOf(next);
        if (
            (nextCell != currentCell && (Grid.neighbors(current) & next) == 0) || _isCaptured(r.orders[index], nextCell)
        ) return (3, 0);

        uint8[5] memory turnNoise;
        for (uint8 candidate = 0; candidate < 5; ++candidate) {
            uint256 noiseIndex = uint256(index) * 5 + candidate;
            if (noiseIndex == r.noise.length || r.noise[noiseIndex] > 7) return (4, 0);
            turnNoise[candidate] = r.noise[noiseIndex];
        }
        if (_brainStep(current, r.exitIdx, _detMask(r.orders[index]), turnNoise) != next) return (4, 0);
        ++counts.moves;

        bool escaped =
            next ==
                (
                    r.exitIdx == 0
                        ? CityMapData.EXIT_0
                        : r.exitIdx == 1
                            ? CityMapData.EXIT_1
                            : r.exitIdx == 2
                                ? CityMapData.EXIT_2
                                : CityMapData.EXIT_3
                );
        if (escaped && index != uint256(r.turnCount) - 1) return (6, 0);
        if (turnNo == CityMapData.TURNS && index != uint256(r.turnCount) - 1) return (6, 0);
        uint8 expectedReport = escaped ? 2 : 0;
        expectedReport += _camera(next) * 4;
        if (r.reports[index] != expectedReport) return (6, 0);
        ++counts.reports;
        if (escaped) return (0, 2);
        if (turnNo == CityMapData.TURNS) return (0, 3);
        return (0, 0);
    }

    // solhint-disable-next-line code-complexity
    function _verifyTurn(
        Reveal memory r,
        uint8 index,
        uint8[3] memory cells,
        uint256 codeCursor,
        Counts memory counts
    ) internal pure returns (uint8 terminalStatus, uint8 failCode, uint256 nextCursor) {
        (bool ordersOk, , ) = validOrders(cells, r.orders[index], r.flags[index]);
        if (!ordersOk) return (0, 8, codeCursor);
        uint128 current = r.path[index];
        uint128 next = r.path[index + 1];
        if (_isCaptured(r.orders[index], Grid.cellOf(current))) {
            (failCode, nextCursor) = _turnCodes(r, index, index + 1, codeCursor, counts, false);
            if (failCode != 0) return (0, failCode, nextCursor);
            if (index != uint256(r.turnCount) - 1 || next != current || r.reports[index] != 1) {
                return (0, 6, nextCursor);
            }
            ++counts.reports;
            return (1, 0, nextCursor);
        }
        (failCode, nextCursor) = _turnCodes(r, index, index + 1, codeCursor, counts, true);
        if (failCode != 0) return (0, failCode, nextCursor);
        (failCode, terminalStatus) = _turnMove(r, index, current, next, counts);
        return (terminalStatus, failCode, nextCursor);
    }

    // solhint-disable code-complexity
    /// @notice Replays a revealed solo case and checks every rule and answer.
    /// @param r Decoded reveal record.
    /// @return ok Whether the whole record verifies.
    /// @return failCode Failure code, zero when ok.
    /// @return failTurn One-based failure turn.
    /// @return moves Number of verified night moves.
    /// @return answers Number of verified search answers.
    /// @return reportsCount Number of verified reports.
    function verifyCase(
        Reveal memory r
    ) public pure returns (bool ok, uint8 failCode, uint8 failTurn, uint16 moves, uint16 answers, uint16 reportsCount) {
        if (r.path.length == 0 || !_isStart(r.path[0])) return (false, 1, 0, 0, 0, 0);
        if (r.exitIdx > 3) return (false, 7, 0, 0, 0, 0);
        if (r.path.length != uint256(r.turnCount) + 1) return (false, 2, r.turnCount, 0, 0, 0);
        if (r.orders.length != r.turnCount || r.flags.length != r.turnCount || r.reports.length != r.turnCount) {
            return (false, 8, r.turnCount, 0, 0, 0);
        }
        if (r.noise.length != uint256(r.turnCount) * 5) return (false, 4, r.turnCount, 0, 0, 0);
        for (uint256 index = 0; index < r.path.length; ++index) {
            if (!Grid.isOneHot(r.path[index]) || (r.path[index] & CityMapData.WALK) == 0) {
                return (false, 2, uint8(index), 0, 0, 0);
            }
        }

        Counts memory counts;
        uint8[3] memory cells = [CityMapData.PRECINCT_0, CityMapData.PRECINCT_1, CityMapData.PRECINCT_2];
        uint256 codeCursor = 0;
        uint8 terminalStatus = 0;
        for (uint8 index = 0; index < r.turnCount; ++index) {
            uint8 turnFail;
            (terminalStatus, turnFail, codeCursor) = _verifyTurn(r, index, cells, codeCursor, counts);
            if (turnFail != 0) return (false, turnFail, index + 1, counts.moves, counts.answers, counts.reports);
            if (terminalStatus != 0 && index != uint256(r.turnCount) - 1) {
                return (false, 6, index + 1, counts.moves, counts.answers, counts.reports);
            }
            cells = r.orders[index];
        }

        if (codeCursor != r.codes.length) return (false, 5, r.turnCount, counts.moves, counts.answers, counts.reports);
        bool finalMatches =
            (terminalStatus == 0 && r.finalStatus == 5) ||
                (terminalStatus == 1 && (r.finalStatus == 2 || r.finalStatus == 5)) ||
                (terminalStatus == 2 && (r.finalStatus == 3 || r.finalStatus == 5)) ||
                (terminalStatus == 3 && (r.finalStatus == 4 || r.finalStatus == 5));
        if (!finalMatches) return (false, 6, r.turnCount, counts.moves, counts.answers, counts.reports);
        return (true, 0, 0, counts.moves, counts.answers, counts.reports);
    }
    // solhint-enable code-complexity
}
