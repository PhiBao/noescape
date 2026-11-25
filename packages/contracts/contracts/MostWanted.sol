// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CityMapData} from "./generated/CityMapData.sol";

/// @title MostWanted
/// @author noescape contributors
/// @notice Daily shared manhunt with confidential entry fees and payouts.
contract MostWanted is ZamaEthereumConfig {
    uint8 internal constant STATUS_NONE = 0;
    uint8 internal constant STATUS_ACTIVE = 1;
    uint8 internal constant STATUS_CAUGHT = 2;
    uint8 internal constant STATUS_GOT_AWAY = 3;
    uint8 internal constant MAX_HUNTERS = 64;

    // solhint-disable-next-line gas-struct-packing
    struct Hunter {
        uint8 cell;
        uint8 lastWatch;
        bool joined;
        ebool paid;
        uint16 actions;
    }

    // solhint-disable-next-line gas-struct-packing
    struct Day {
        uint32 day;
        uint8 status;
        euint128 pos;
        euint128 p1;
        euint128 p2;
        euint128 trail;
        euint128 startPos;
        uint8 steps;
        uint8 lastStepWatch;
        address winner;
        uint16 hunters;
        euint64 pot;
        bool verified;
        bool verifyOk;
        uint8 failCode;
    }

    // solhint-disable-next-line gas-struct-packing
    struct Action {
        address hunter;
        uint8 step;
        uint8 fromCell;
        uint8 toCell;
        bool searched;
        euint8 code;
        ebool caught;
        bool resolved;
    }

    mapping(uint32 day => Day data) private dayData;
    mapping(uint32 day => address[] hunters) private hunterList;
    mapping(uint32 day => mapping(address hunter => Hunter hunterData)) private hunterOf;
    mapping(uint32 day => mapping(uint8 step => euint8[5] noise)) private stepNoise;
    mapping(uint32 day => mapping(uint8 step => euint128 pos)) private stepPos;
    mapping(uint32 day => mapping(uint8 step => euint8 report)) private stepReport;
    mapping(uint32 day => mapping(uint8 step => uint128 detMask)) private stepDetMask;
    mapping(uint32 day => Action[] actions) private actions;
    euint64 private rollover;

    /// @notice Official confidential token used for fees and payouts.
    IERC7984 public immutable TOKEN;
    /// @notice Entry fee in the token's smallest unit.
    uint64 public immutable FEE;

    /// @notice The day already has the maximum number of hunters.
    error DayFull();
    /// @notice The hunter already joined this day.
    error AlreadyJoined();
    /// @notice The day is no longer active.
    error DayOver();

    /// @notice A new UTC day was opened.
    /// @param day UTC day number.
    event DayOpened(uint32 indexed day);
    /// @notice An unfinished day was rolled over.
    /// @param day UTC day number.
    /// @param status Final day status.
    event DayClosed(uint32 indexed day, uint8 indexed status);
    // solhint-disable gas-indexed-events
    /// @notice A hunter joined a day.
    /// @param day UTC day number.
    /// @param hunter Hunter address.
    /// @param cell Assigned precinct cell.
    /// @param hunterNo Zero-based hunter number.
    event HunterJoined(uint32 indexed day, address indexed hunter, uint8 cell, uint16 hunterNo);
    // solhint-enable gas-indexed-events

    /// @notice Creates the daily game with the official token and fee.
    /// @param token_ Confidential token address.
    /// @param fee_ Entry fee in the token's smallest unit.
    constructor(address token_, uint64 fee_) {
        TOKEN = IERC7984(token_);
        FEE = fee_;
    }

    function _rollover(uint32 previousDay) internal {
        Day storage previous = dayData[previousDay];
        if (previous.status != STATUS_ACTIVE) return;
        previous.status = STATUS_GOT_AWAY;
        rollover = FHE.allowThis(previous.pot);
        emit DayClosed(previousDay, previous.status);
    }

    function _openDay(uint32 day) internal returns (Day storage opened) {
        opened = dayData[day];
        opened.day = day;
        opened.status = STATUS_ACTIVE;
        opened.pot = FHE.allowThis(rollover);

        euint8 startIdx = FHE.randEuint8(8);
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
        for (int8 index = 6; index > -1; --index) {
            start = FHE.select(FHE.eq(startIdx, uint8(index)), FHE.asEuint128(starts[uint8(index)]), start);
        }
        opened.startPos = start;
        opened.pos = start;
        opened.p1 = start;
        opened.p2 = start;
        opened.trail = start;
        FHE.allowThis(opened.startPos);
        FHE.allowThis(opened.pos);
        FHE.allowThis(opened.p1);
        FHE.allowThis(opened.p2);
        FHE.allowThis(opened.trail);
        emit DayOpened(day);
    }

    function _ensureDay() internal returns (Day storage opened) {
        uint32 day = uint32(block.timestamp / 1 days);
        opened = dayData[day];
        if (opened.day == day) return opened;
        if (day > 0) _rollover(day - 1);
        opened = _openDay(day);
    }

    /// @notice Joins the current UTC day and pays the confidential entry fee.
    function join() external {
        Day storage day = _ensureDay();
        if (day.status != STATUS_ACTIVE) revert DayOver();
        if (day.hunters > MAX_HUNTERS - 1) revert DayFull();
        Hunter storage hunter = hunterOf[day.day][msg.sender];
        if (hunter.joined) revert AlreadyJoined();

        euint64 amount = FHE.asEuint64(FEE);
        FHE.allowTransient(amount, address(TOKEN));
        euint64 sent = TOKEN.confidentialTransferFrom(msg.sender, address(this), amount);
        hunter.paid = FHE.allowThis(FHE.eq(sent, FEE));
        day.pot = FHE.allowThis(FHE.add(day.pot, sent));

        uint16 hunterNo = day.hunters;
        uint8[3] memory precinct = [CityMapData.PRECINCT_0, CityMapData.PRECINCT_1, CityMapData.PRECINCT_2];
        hunter.cell = precinct[hunterNo % 3];
        hunter.joined = true;
        hunterList[day.day].push(msg.sender);
        day.hunters = hunterNo + 1;
        emit HunterJoined(day.day, msg.sender, hunter.cell, hunterNo);
    }

    /// @notice Returns the public and encrypted state of a day.
    /// @param day UTC day number.
    /// @return Day state.
    function getDay(uint32 day) external view returns (Day memory) {
        return dayData[day];
    }

    /// @notice Returns a hunter's state for a day.
    /// @param day UTC day number.
    /// @param hunter Hunter address.
    /// @return Hunter state.
    function getHunter(uint32 day, address hunter) external view returns (Hunter memory) {
        return hunterOf[day][hunter];
    }

    /// @notice Returns a bounded page of actions for a day.
    /// @param day UTC day number.
    /// @param from First action index.
    /// @param count Maximum number of actions.
    /// @return page Action records.
    function actionsOf(uint32 day, uint256 from, uint256 count) external view returns (Action[] memory page) {
        Action[] storage stored = actions[day];
        if (from < stored.length) {
            uint256 available = stored.length - from;
            uint256 size = count < available ? count : available;
            page = new Action[](size);
            for (uint256 index = 0; index < size; ++index) {
                page[index] = stored[from + index];
            }
            return page;
        }
        return new Action[](0);
    }
}
