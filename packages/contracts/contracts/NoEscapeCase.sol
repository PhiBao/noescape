// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CaseRules} from "./lib/CaseRules.sol";
import {FugitiveBrain} from "./lib/FugitiveBrain.sol";
import {Grid} from "./lib/Grid.sol";
import {CityMapData} from "./generated/CityMapData.sol";

/// @title NoEscapeCase
/// @author noescape contributors
/// @notice Solo manhunt cases with an ownerless encrypted fugitive.
contract NoEscapeCase is ZamaEthereumConfig {
    enum Status {
        None,
        Active,
        Caught,
        Escaped,
        Dawn,
        Abandoned
    }

    struct Turn {
        uint8[3] cells;
        uint8 searchFlags;
        euint8[3] codes;
        euint8[5] noise;
        euint128 posAfter;
        euint8 report;
        bool resolved;
        uint8 reportClear;
    }

    // solhint-disable-next-line gas-struct-packing
    struct Case {
        address detective;
        Status status;
        uint8 turn;
        uint64 openedAt;
        uint64 closedAt;
        euint128 startPos;
        euint128 pos;
        euint128 p1;
        euint128 p2;
        euint128 trail;
        euint8 exitIdx;
        bool verified;
        bool verifyOk;
        uint8 failCode;
        uint8 failTurn;
        uint8 exitClear;
        uint128[] path;
        bytes noiseClear;
        bytes codesClear;
    }

    struct Stats {
        uint32 opened;
        uint32 caught;
        uint32 escaped;
        uint32 dawn;
        uint32 abandoned;
        uint8 bestTurn;
    }

    mapping(uint256 id => Case caseData) private cases;
    mapping(uint256 id => mapping(uint8 turn => Turn turnData)) private turns;
    /// @notice Active case id for each detective.
    mapping(address detective => uint256 id) public activeCaseOf;
    /// @notice Lifetime statistics for each detective.
    mapping(address detective => Stats stats) public statsOf;
    uint256[32] private recent;
    uint8 private recentHead;
    uint256 private nextId = 1;

    /// @notice The caller is not the case detective.
    error NotDetective();
    /// @notice The case is not active.
    error NotActive();
    /// @notice The previous report proof is missing.
    error ReportPending();
    /// @notice The requested orders are invalid.
    /// @param reason Validation failure reason.
    /// @param detective Detective index that failed.
    error BadOrders(uint8 reason, uint8 detective);
    /// @notice The case has already ended.
    error CaseOver();
    /// @notice The case has no turns left.
    error NoTurns();
    /// @notice The detective already has an open case.
    /// @param id Existing case id.
    error CaseActive(uint256 id);

    /// @notice A new solo case was opened.
    /// @param id Case id.
    /// @param detective Detective address.
    event CaseOpened(uint256 indexed id, address indexed detective);
    /// @notice A turn was played on chain.
    /// @param id Case id.
    /// @param turn One-based turn number.
    /// @param to Detective destinations.
    /// @param searchFlags Search bitmask.
    /// @param report Public encrypted report handle.
    event TurnPlayed(uint256 indexed id, uint8 turn, uint8[3] to, uint8 searchFlags, euint8 report);
    /// @notice A case ended.
    /// @param id Case id.
    /// @param status Final status.
    /// @param turn Final turn number.
    event CaseEnded(uint256 indexed id, Status status, uint8 turn);

    /// @notice Opens a case with encrypted start and exit randomness.
    /// @return id New case id.
    function openCase() external returns (uint256 id) {
        uint256 existing = activeCaseOf[msg.sender];
        if (existing != 0) revert CaseActive(existing);

        id = nextId;
        ++nextId;
        Case storage c = cases[id];
        c.detective = msg.sender;
        c.status = Status.Active;
        c.openedAt = uint64(block.timestamp);

        euint8 startIdx = FHE.randEuint8(8);
        c.exitIdx = FHE.randEuint8(4);
        uint128[8] memory starts = [
            CityMapData.START_0,
            CityMapData.START_1,
            CityMapData.START_2,
            CityMapData.START_3,
            CityMapData.START_4,
            CityMapData.START_5,
            CityMapData.START_6,
            CityMapData.START_7
        ];
        euint128 start = FHE.asEuint128(starts[7]);
        for (int8 index = 6; index != -1; --index) {
            start = FHE.select(FHE.eq(startIdx, uint8(index)), FHE.asEuint128(starts[uint8(index)]), start);
        }
        c.startPos = start;
        c.pos = start;
        c.p1 = start;
        c.p2 = start;
        c.trail = start;

        FHE.allowThis(c.startPos);
        FHE.allowThis(c.pos);
        FHE.allowThis(c.p1);
        FHE.allowThis(c.p2);
        FHE.allowThis(c.trail);
        FHE.allowThis(c.exitIdx);

        // solhint-disable-next-line gas-increment-by-one
        statsOf[msg.sender].opened += 1;
        activeCaseOf[msg.sender] = id;
        emit CaseOpened(id, msg.sender);
    }

    function _detMask(uint8[3] memory cells) internal pure returns (uint128) {
        return Grid.bit(cells[0]) | Grid.bit(cells[1]) | Grid.bit(cells[2]);
    }

    function _searchCode(Case storage c, uint128 shape) internal returns (euint8) {
        ebool fresh = FHE.or(
            FHE.ne(FHE.and(c.p2, shape), 0),
            FHE.or(FHE.ne(FHE.and(c.p1, shape), 0), FHE.ne(FHE.and(c.pos, shape), 0))
        );
        ebool cold = FHE.ne(FHE.and(c.trail, shape), 0);
        return FHE.select(fresh, FHE.asEuint8(2), FHE.select(cold, FHE.asEuint8(1), FHE.asEuint8(0)));
    }

    function _runTurn(Case storage c, uint256 id, Turn storage tr, uint8[3] memory to, uint8 flags) internal {
        uint8 turn = c.turn + 1;
        tr.cells = to;
        tr.searchFlags = flags;

        ebool caught = FHE.asEbool(false);
        for (uint8 index = 0; index < 3; ++index) {
            caught = FHE.or(caught, FHE.ne(FHE.and(c.pos, Grid.bit(to[index])), 0));
        }
        for (uint8 index = 0; index < 3; ++index) {
            if ((flags & (1 << index)) == 0) continue;
            euint8 code = _searchCode(c, Grid.plus(to[index]));
            tr.codes[index] = FHE.select(caught, FHE.asEuint8(0), code);
            FHE.allowThis(tr.codes[index]);
            FHE.allow(tr.codes[index], c.detective);
        }

        FugitiveBrain.Night memory n = FugitiveBrain.night(_detMask(to));
        (euint128 moved, euint8[5] memory noise) = FugitiveBrain.step(c.pos, FugitiveBrain.exitEq(c.exitIdx), n);
        euint128 next = FHE.select(caught, c.pos, moved);
        ebool escaped = FugitiveBrain.exitHit(next, FugitiveBrain.exitEq(c.exitIdx));
        euint8 cam = FHE.select(caught, FHE.asEuint8(0), FugitiveBrain.cameraCode(next));
        tr.report = FugitiveBrain.report(caught, escaped, cam);
        tr.posAfter = next;
        tr.noise = noise;
        FHE.allowThis(tr.posAfter);
        FHE.allowThis(tr.report);
        for (uint8 index = 0; index < 5; ++index) {
            FHE.allowThis(tr.noise[index]);
        }
        FHE.makePubliclyDecryptable(tr.report);

        c.p2 = c.p1;
        c.p1 = c.pos;
        c.pos = next;
        c.trail = FHE.or(c.trail, next);
        FHE.allowThis(c.p2);
        FHE.allowThis(c.p1);
        FHE.allowThis(c.pos);
        FHE.allowThis(c.trail);
        c.turn = turn;
        emit TurnPlayed(id, turn, to, flags, tr.report);
    }

    function _cellsForTurn(uint256 id, Case storage c) internal view returns (uint8[3] memory cells) {
        if (c.turn == 0) {
            cells = [CityMapData.PRECINCT_0, CityMapData.PRECINCT_1, CityMapData.PRECINCT_2];
        } else {
            cells = turns[id][c.turn].cells;
        }
    }

    function _resolvePrevious(uint256 id, Case storage c, bytes memory clear, bytes memory proof) internal {
        if (c.turn == 0) return;
        Turn storage previous = turns[id][c.turn];
        if (previous.resolved) return;
        if (clear.length == 0 || proof.length == 0) revert ReportPending();
        _resolveReport(id, clear, proof);
        if (c.status != Status.Active) revert CaseOver();
    }

    /// @notice Plays one complete turn, resolving the previous report first.
    /// @param id Case id.
    /// @param to Detective destinations.
    /// @param searchFlags Search bitmask.
    /// @param prevClear ABI-encoded previous report value.
    /// @param prevProof Previous report KMS proof.
    function playTurn(
        uint256 id,
        uint8[3] calldata to,
        uint8 searchFlags,
        bytes calldata prevClear,
        bytes calldata prevProof
    ) external {
        Case storage c = cases[id];
        if (msg.sender != c.detective) revert NotDetective();
        if (c.status != Status.Active) revert NotActive();
        _resolvePrevious(id, c, prevClear, prevProof);
        if (c.turn > CityMapData.TURNS - 1) revert NoTurns();

        {
            uint8[3] memory cells = _cellsForTurn(id, c);
            (bool ok, uint8 reason, uint8 detective) = CaseRules.validOrders(cells, to, searchFlags);
            if (!ok) revert BadOrders(reason, detective);
        }
        _runTurn(c, id, turns[id][c.turn + 1], to, searchFlags);
    }

    function _resolveReport(uint256 id, bytes memory clear, bytes memory proof) internal {
        Case storage c = cases[id];
        if (c.turn == 0) revert NoTurns();
        Turn storage tr = turns[id][c.turn];
        if (tr.resolved) return;
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint8.unwrap(tr.report);
        FHE.checkSignatures(handles, clear, proof);
        uint8 value = abi.decode(clear, (uint8));
        tr.reportClear = value;
        tr.resolved = true;
        uint8 status = value & 3;
        if (status == 1) {
            _end(id, Status.Caught);
        } else if (status == 2) {
            _end(id, Status.Escaped);
        } else if (c.turn == CityMapData.TURNS) {
            _end(id, Status.Dawn);
        }
    }

    /// @notice Resolves the latest public report with its KMS proof.
    /// @param id Case id.
    /// @param clear ABI-encoded report value.
    /// @param proof KMS decryption proof.
    function resolveReport(uint256 id, bytes calldata clear, bytes calldata proof) external {
        Case storage c = cases[id];
        if (c.status != Status.Active) revert NotActive();
        _resolveReport(id, clear, proof);
    }

    function _makeRevealPublic(Case storage c, uint256 id) internal {
        FHE.makePubliclyDecryptable(c.startPos);
        FHE.makePubliclyDecryptable(c.exitIdx);
        for (uint8 turn = 1; turn < c.turn + 1; ++turn) {
            Turn storage tr = turns[id][turn];
            FHE.makePubliclyDecryptable(tr.posAfter);
            for (uint8 index = 0; index < 5; ++index) {
                FHE.makePubliclyDecryptable(tr.noise[index]);
            }
            for (uint8 index = 0; index < 3; ++index) {
                if ((tr.searchFlags & (1 << index)) != 0) {
                    FHE.makePubliclyDecryptable(tr.codes[index]);
                }
            }
        }
    }

    function _end(uint256 id, Status status) internal {
        Case storage c = cases[id];
        c.status = status;
        c.closedAt = uint64(block.timestamp);
        Stats storage stats = statsOf[c.detective];
        if (status == Status.Caught) {
            // solhint-disable-next-line gas-increment-by-one
            stats.caught += 1;
            if (stats.bestTurn == 0 || c.turn < stats.bestTurn) stats.bestTurn = c.turn;
        } else if (status == Status.Escaped) {
            // solhint-disable-next-line gas-increment-by-one
            stats.escaped += 1;
        } else if (status == Status.Dawn) {
            // solhint-disable-next-line gas-increment-by-one
            stats.dawn += 1;
        } else if (status == Status.Abandoned) {
            // solhint-disable-next-line gas-increment-by-one
            stats.abandoned += 1;
        }
        delete activeCaseOf[c.detective];
        recent[recentHead] = id;
        recentHead = uint8((uint256(recentHead) + 1) % 32);
        _makeRevealPublic(c, id);
        emit CaseEnded(id, status, c.turn);
    }

    /// @notice Abandons an active case.
    /// @param id Case id.
    function abandonCase(uint256 id) external {
        Case storage c = cases[id];
        if (msg.sender != c.detective) revert NotDetective();
        if (c.status != Status.Active) revert NotActive();
        _end(id, Status.Abandoned);
    }

    /// @notice Returns a case record.
    /// @param id Case id.
    /// @return c Stored case record.
    function getCase(uint256 id) external view returns (Case memory c) {
        return cases[id];
    }

    /// @notice Returns one turn record.
    /// @param id Case id.
    /// @param turn One-based turn number.
    /// @return t Stored turn record.
    function getTurn(uint256 id, uint8 turn) external view returns (Turn memory t) {
        return turns[id][turn];
    }

    /// @notice Returns the encrypted fugitive position handle.
    /// @param id Case id.
    /// @return handle Encrypted position handle.
    function posHandle(uint256 id) external view returns (euint128 handle) {
        return cases[id].pos;
    }

    /// @notice Returns the raw 32-slot recent-case ring.
    /// @return ids Recent case id ring.
    function recentClosed() external view returns (uint256[32] memory ids) {
        return recent;
    }
}
