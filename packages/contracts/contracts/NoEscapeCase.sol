// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE, euint8, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
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

    /// @notice The detective already has an open case.
    /// @param id Existing case id.
    error CaseActive(uint256 id);

    /// @notice A new solo case was opened.
    /// @param id Case id.
    /// @param detective Detective address.
    event CaseOpened(uint256 indexed id, address indexed detective);

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
