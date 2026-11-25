// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CityMapData} from "./generated/CityMapData.sol";
import {CaseRules} from "./lib/CaseRules.sol";
import {FugitiveBrain} from "./lib/FugitiveBrain.sol";
import {Grid} from "./lib/Grid.sol";

/// @title MostWanted
/// @author noescape contributors
/// @notice Daily shared manhunt with confidential entry fees and payouts.
contract MostWanted is ZamaEthereumConfig {
    uint8 internal constant STATUS_NONE = 0;
    uint8 internal constant STATUS_ACTIVE = 1;
    uint8 internal constant STATUS_CAUGHT = 2;
    uint8 internal constant STATUS_GOT_AWAY = 3;
    uint8 internal constant MAX_HUNTERS = 64;
    uint8 internal constant MAX_STEPS = 48;
    uint256 internal constant WATCH_SECONDS = 30 minutes;
    uint8 internal constant ORDER_UNREACHABLE = 1;
    uint8 internal constant ORDER_NOT_WALKABLE = 3;
    uint8 internal constant REVEAL_PATH = 0;
    uint8 internal constant REVEAL_NOISE = 1;
    uint8 internal constant REVEAL_CODES = 2;
    uint16 internal constant PATH_BATCH_SIZE = 16;
    uint16 internal constant CODE_BATCH_SIZE = 256;

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

    struct RevealPart {
        uint8 kind;
        uint16 start;
        bytes32[] handles;
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
    mapping(uint32 day => uint128[] clears) private dailyPathClear;
    mapping(uint32 day => uint8[] clears) private dailyNoiseClear;
    mapping(uint32 day => uint8[] clears) private dailyCodesClear;
    mapping(uint32 day => uint256 submitted) private dailyRevealedParts;
    mapping(uint32 day => mapping(address hunter => uint16 number)) private hunterNoOf;

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
    /// @notice The caller has not joined this day.
    error NotJoined();
    /// @notice The caller already acted in this watch.
    error OncePerWatch();
    /// @notice The requested destination is invalid.
    /// @param reason Validation failure reason.
    error BadOrders(uint8 reason);
    /// @notice The action index does not exist.
    error BadAction();
    /// @notice The day has not started.
    error NotStarted();
    /// @notice The day has not ended.
    error NotEnded();
    /// @notice The requested reveal part is not in the plan.
    error BadRevealPart();
    /// @notice The reveal part was already submitted.
    error AlreadySubmitted();
    /// @notice The decoded reveal length does not match its handles.
    error BadRevealLength();
    /// @notice The day reveal was already verified.
    error AlreadyVerified();

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
    /// @notice A hunter acted in the daily case.
    /// @param day UTC day number.
    /// @param actionIdx Action index.
    /// @param hunter Hunter address.
    /// @param step Current night-move step.
    /// @param fromCell Origin cell.
    /// @param toCell Destination cell.
    /// @param searched Whether the hunter searched.
    event Hunted(
        uint32 indexed day,
        uint256 indexed actionIdx,
        address indexed hunter,
        uint8 step,
        uint8 fromCell,
        uint8 toCell,
        bool searched
    );
    // solhint-disable gas-indexed-events
    /// @notice A revealed day was replayed on chain.
    /// @param day UTC day number.
    /// @param ok Whether verification passed.
    /// @param failCode Failure code, zero when ok.
    event DayVerified(uint32 indexed day, bool indexed ok, uint8 failCode);
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
        _makeRevealPublic(previous);
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
        hunterNoOf[day.day][msg.sender] = hunterNo;
        hunterList[day.day].push(msg.sender);
        day.hunters = hunterNo + 1;
        emit HunterJoined(day.day, msg.sender, hunter.cell, hunterNo);
    }

    function _hunterMask(uint32 day) internal view returns (uint128 mask) {
        address[] storage list = hunterList[day];
        for (uint256 index = 0; index < list.length; ++index) {
            mask |= Grid.bit(hunterOf[day][list[index]].cell);
        }
    }

    function _nightMove(Day storage day) internal {
        uint128 det = _hunterMask(day.day);
        FugitiveBrain.Night memory night = FugitiveBrain.night(det);
        night.useToward = false;
        ebool[3] memory noExit = [FHE.asEbool(false), FHE.asEbool(false), FHE.asEbool(false)];
        (euint128 moved, euint8[5] memory noise) = FugitiveBrain.step(day.pos, noExit, night);
        uint8 step = day.steps + 1;

        day.p2 = day.p1;
        day.p1 = day.pos;
        day.pos = moved;
        day.trail = FHE.or(day.trail, moved);
        FHE.allowThis(day.p2);
        FHE.allowThis(day.p1);
        FHE.allowThis(day.pos);
        FHE.allowThis(day.trail);

        stepPos[day.day][step] = FHE.allowThis(moved);
        stepDetMask[day.day][step] = det;
        for (uint8 index = 0; index < 5; ++index) {
            stepNoise[day.day][step][index] = FHE.allowThis(noise[index]);
        }
        euint8 report = FugitiveBrain.cameraCode(moved);
        stepReport[day.day][step] = FHE.allowThis(report);
        FHE.makePubliclyDecryptable(report);
        day.steps = step;
    }

    function _orderReason(uint8 from, uint8 to, bool search) internal pure returns (uint8) {
        if (to > 119 || (CityMapData.WALK & Grid.bit(to)) == 0) return ORDER_NOT_WALKABLE;
        uint8 steps = search ? CityMapData.DET_STEPS : CityMapData.SPRINT_STEPS;
        if ((Grid.reach(Grid.bit(from), steps, CityMapData.WALK) & Grid.bit(to)) == 0) {
            return ORDER_UNREACHABLE;
        }
        return 0;
    }

    function _searchCode(Day storage day, uint128 shape) internal returns (euint8) {
        ebool fresh = FHE.or(
            FHE.ne(FHE.and(day.p2, shape), 0),
            FHE.or(FHE.ne(FHE.and(day.p1, shape), 0), FHE.ne(FHE.and(day.pos, shape), 0))
        );
        ebool cold = FHE.ne(FHE.and(day.trail, shape), 0);
        return FHE.select(fresh, FHE.asEuint8(2), FHE.select(cold, FHE.asEuint8(1), FHE.asEuint8(0)));
    }

    function _recordAction(
        Day storage day,
        Hunter storage hunter,
        uint8 to,
        bool search,
        ebool caught,
        euint8 code
    ) internal {
        uint256 actionIdx = actions[day.day].length;
        Action storage action = actions[day.day].push();
        action.hunter = msg.sender;
        action.step = day.steps;
        action.fromCell = hunter.cell;
        action.toCell = to;
        action.searched = search;
        action.code = code;
        action.caught = caught;
        hunter.cell = to;
        // solhint-disable-next-line gas-increment-by-one
        hunter.actions += 1;
        emit Hunted(day.day, actionIdx, msg.sender, day.steps, action.fromCell, to, search);
    }

    /// @notice Moves one detective and optionally searches for the fugitive's trail.
    /// @param to Destination cell.
    /// @param search Whether to search instead of sprint.
    function hunt(uint8 to, bool search) external {
        Day storage day = _ensureDay();
        if (day.status != STATUS_ACTIVE) revert DayOver();
        Hunter storage hunter = hunterOf[day.day][msg.sender];
        if (!hunter.joined) revert NotJoined();
        uint8 watch = uint8((block.timestamp % 1 days) / WATCH_SECONDS);
        uint8 watchNo = watch + 1;
        if (hunter.lastWatch > watchNo - 1) revert OncePerWatch();

        if (day.lastStepWatch < watchNo && day.steps < MAX_STEPS) {
            _nightMove(day);
            day.lastStepWatch = watchNo;
        }
        uint8 reason = _orderReason(hunter.cell, to, search);
        if (reason != 0) revert BadOrders(reason);

        ebool caught = FHE.ne(FHE.and(day.pos, Grid.bit(to)), 0);
        euint8 code = search ? _searchCode(day, Grid.plus(to)) : FHE.asEuint8(0);
        code = FHE.select(caught, FHE.asEuint8(0), code);
        FHE.allowThis(code);
        FHE.allow(code, msg.sender);
        FHE.allowThis(caught);
        FHE.makePubliclyDecryptable(caught);

        hunter.lastWatch = watchNo;
        _recordAction(day, hunter, to, search, caught, code);
    }

    function _makeRevealPublic(Day storage day) internal {
        FHE.makePubliclyDecryptable(day.startPos);
        for (uint8 step = 1; step < day.steps + 1; ++step) {
            FHE.makePubliclyDecryptable(stepPos[day.day][step]);
            for (uint8 index = 0; index < 5; ++index) {
                FHE.makePubliclyDecryptable(stepNoise[day.day][step][index]);
            }
        }
        for (uint256 index = 0; index < actions[day.day].length; ++index) {
            Action storage action = actions[day.day][index];
            FHE.makePubliclyDecryptable(action.caught);
            if (action.searched) FHE.makePubliclyDecryptable(action.code);
        }
    }

    /// @notice Resolves a public capture proof and pays the winning hunter.
    /// @param day UTC day number.
    /// @param actionIdx Capturing action index.
    /// @param clear ABI-encoded capture flag.
    /// @param proof KMS decryption proof.
    function claimCapture(uint32 day, uint256 actionIdx, bytes calldata clear, bytes calldata proof) external {
        Day storage opened = dayData[day];
        if (opened.status != STATUS_ACTIVE) revert DayOver();
        if (actionIdx < actions[day].length) {
            Action storage action = actions[day][actionIdx];
            bytes32[] memory handles = new bytes32[](1);
            handles[0] = ebool.unwrap(action.caught);
            FHE.checkSignatures(handles, clear, proof);
            if (!abi.decode(clear, (bool))) return;

            action.resolved = true;
            opened.status = STATUS_CAUGHT;
            opened.winner = action.hunter;
            ebool paid = hunterOf[day][action.hunter].paid;
            euint64 payout = FHE.select(paid, opened.pot, FHE.asEuint64(0));
            rollover = FHE.select(paid, FHE.asEuint64(0), opened.pot);
            FHE.allowThis(payout);
            FHE.allowThis(rollover);
            FHE.allowTransient(payout, address(TOKEN));
            TOKEN.confidentialTransfer(action.hunter, payout);
            _makeRevealPublic(opened);
            emit DayClosed(day, opened.status);
        } else {
            revert BadAction();
        }
    }

    /// @notice Closes an active day after its UTC window has ended.
    /// @param day UTC day number.
    function closeDay(uint32 day) external {
        Day storage opened = dayData[day];
        if (opened.status == STATUS_NONE) revert NotStarted();
        if (opened.status != STATUS_ACTIVE) revert DayOver();
        if (block.timestamp < (uint256(day) + 1) * 1 days) revert NotEnded();
        opened.status = STATUS_GOT_AWAY;
        rollover = FHE.allowThis(opened.pot);
        _makeRevealPublic(opened);
        emit DayClosed(day, opened.status);
    }

    function _pathHandle(Day storage opened, uint256 index) internal view returns (bytes32) {
        return
            index == 0
                ? bytes32(euint128.unwrap(opened.startPos))
                : bytes32(euint128.unwrap(stepPos[opened.day][uint8(index)]));
    }

    function _revealPlan(Day storage opened) internal view returns (RevealPart[] memory parts) {
        uint256 pathCount = uint256(opened.steps) + 1;
        uint256 pathParts = (pathCount + PATH_BATCH_SIZE - 1) / PATH_BATCH_SIZE;
        uint256 noiseCount = uint256(opened.steps) * 5;
        uint256 noiseParts = noiseCount == 0 ? 0 : 1;
        uint256 codeCount = actions[opened.day].length;
        uint256 codeParts = (codeCount + CODE_BATCH_SIZE - 1) / CODE_BATCH_SIZE;
        parts = new RevealPart[](pathParts + noiseParts + codeParts);
        uint256 cursor;

        for (uint256 part = 0; part < pathParts; ++part) {
            uint256 start = part * PATH_BATCH_SIZE;
            uint256 size = pathCount - start < PATH_BATCH_SIZE ? pathCount - start : PATH_BATCH_SIZE;
            bytes32[] memory handles = new bytes32[](size);
            for (uint256 index = 0; index < size; ++index) {
                handles[index] = _pathHandle(opened, start + index);
            }
            parts[cursor] = RevealPart(REVEAL_PATH, uint16(start), handles);
            ++cursor;
        }
        if (noiseCount > 0) {
            bytes32[] memory handles = new bytes32[](noiseCount);
            uint256 offset;
            for (uint8 step = 1; step < opened.steps + 1; ++step) {
                for (uint8 candidate = 0; candidate < 5; ++candidate) {
                    handles[offset] = bytes32(euint8.unwrap(stepNoise[opened.day][step][candidate]));
                    ++offset;
                }
            }
            parts[cursor] = RevealPart(REVEAL_NOISE, 0, handles);
            ++cursor;
        }
        for (uint256 part = 0; part < codeParts; ++part) {
            uint256 start = part * CODE_BATCH_SIZE;
            uint256 size = codeCount - start < CODE_BATCH_SIZE ? codeCount - start : CODE_BATCH_SIZE;
            bytes32[] memory handles = new bytes32[](size);
            for (uint256 index = 0; index < size; ++index) {
                handles[index] = bytes32(euint8.unwrap(actions[opened.day][start + index].code));
            }
            parts[cursor] = RevealPart(REVEAL_CODES, uint16(start), handles);
            ++cursor;
        }
    }

    /// @notice Returns the exact public-decryption batches for a closed day.
    /// @param day UTC day number.
    /// @return Ordered path, noise and code batches.
    function revealPlan(uint32 day) external view returns (RevealPart[] memory) {
        Day storage opened = dayData[day];
        if (opened.status != STATUS_CAUGHT && opened.status != STATUS_GOT_AWAY) revert NotEnded();
        return _revealPlan(opened);
    }

    function _word(bytes memory data, uint256 index) internal pure returns (uint256 value) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            value := mload(add(add(data, 32), mul(index, 32)))
        }
    }

    function _decodePathValues(bytes memory clear, uint256 count) internal pure returns (uint128[] memory values) {
        if (clear.length != count * 32) revert BadRevealLength();
        values = new uint128[](count);
        for (uint256 index = 0; index < count; ++index) {
            uint256 value = _word(clear, index);
            if (value > type(uint128).max) revert BadRevealLength();
            values[index] = uint128(value);
        }
    }

    function _decodeByteValues(bytes memory clear, uint256 count) internal pure returns (uint8[] memory values) {
        if (clear.length != count * 32) revert BadRevealLength();
        values = new uint8[](count);
        for (uint256 index = 0; index < count; ++index) {
            uint256 value = _word(clear, index);
            if (value > type(uint8).max) revert BadRevealLength();
            values[index] = uint8(value);
        }
    }

    function _storePath(uint32 day, uint16 start, uint128[] memory values) internal {
        uint128[] storage stored = dailyPathClear[day];
        uint256 end = uint256(start) + values.length;
        if (stored.length < end) {
            while (stored.length < end) stored.push();
        }
        for (uint256 index = 0; index < values.length; ++index) {
            stored[uint256(start) + index] = values[index];
        }
    }

    function _storeBytes(uint32 day, uint8 kind, uint16 start, uint8[] memory values) internal {
        uint8[] storage stored = kind == REVEAL_NOISE ? dailyNoiseClear[day] : dailyCodesClear[day];
        uint256 end = uint256(start) + values.length;
        if (stored.length < end) {
            while (stored.length < end) stored.push();
        }
        for (uint256 index = 0; index < values.length; ++index) {
            stored[uint256(start) + index] = values[index];
        }
    }

    function _dailyReveal(Day storage opened) internal view returns (CaseRules.DailyReveal memory record) {
        record.path = dailyPathClear[opened.day];
        record.detMasks = new uint128[](opened.steps);
        for (uint8 step = 1; step < opened.steps + 1; ++step) {
            record.detMasks[step - 1] = stepDetMask[opened.day][step];
        }
        record.noise = dailyNoiseClear[opened.day];
        uint256 actionCount = actions[opened.day].length;
        record.hunters = new uint16[](actionCount);
        record.actionSteps = new uint8[](actionCount);
        record.fromCells = new uint8[](actionCount);
        record.toCells = new uint8[](actionCount);
        record.searched = new bool[](actionCount);
        record.codes = new uint8[](actionCount);
        for (uint256 index = 0; index < actionCount; ++index) {
            Action storage action = actions[opened.day][index];
            record.hunters[index] = hunterNoOf[opened.day][action.hunter];
            record.actionSteps[index] = action.step;
            record.fromCells[index] = action.fromCell;
            record.toCells[index] = action.toCell;
            record.searched[index] = action.searched;
            record.codes[index] = dailyCodesClear[opened.day][index];
        }
        record.hunterCount = opened.hunters;
        record.finalStatus = opened.status;
    }

    // solhint-disable code-complexity
    /// @notice Submits one KMS-signed daily reveal batch.
    /// @param day UTC day number.
    /// @param kind Reveal kind: path, noise or codes.
    /// @param start First handle index within the kind.
    /// @param clear ABI-encoded clear values.
    /// @param proof KMS decryption proof.
    function submitDailyReveal(
        uint32 day,
        uint8 kind,
        uint16 start,
        bytes calldata clear,
        bytes calldata proof
    ) external {
        Day storage opened = dayData[day];
        if (opened.status != STATUS_CAUGHT && opened.status != STATUS_GOT_AWAY) revert NotEnded();
        if (opened.verified) revert AlreadyVerified();
        RevealPart[] memory plan = _revealPlan(opened);
        uint256 partIndex;
        bool found;
        for (partIndex = 0; partIndex < plan.length; ++partIndex) {
            if (plan[partIndex].kind == kind && plan[partIndex].start == start) {
                found = true;
                break;
            }
        }
        if (!found) revert BadRevealPart();
        uint256 partBit = uint256(1) << partIndex;
        if ((dailyRevealedParts[day] & partBit) != 0) revert AlreadySubmitted();
        FHE.checkSignatures(plan[partIndex].handles, clear, proof);

        if (kind == REVEAL_PATH) {
            uint128[] memory values = _decodePathValues(clear, plan[partIndex].handles.length);
            _storePath(day, start, values);
        } else {
            uint8[] memory values = _decodeByteValues(clear, plan[partIndex].handles.length);
            _storeBytes(day, kind, start, values);
        }
        dailyRevealedParts[day] |= partBit;

        uint256 expected = (uint256(1) << plan.length) - 1;
        if (dailyRevealedParts[day] == expected) {
            (bool ok, uint8 failCode, , , , ) = CaseRules.verifyDaily(_dailyReveal(opened));
            opened.verified = true;
            opened.verifyOk = ok;
            opened.failCode = failCode;
            emit DayVerified(day, ok, failCode);
        }
    }
    // solhint-enable code-complexity

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
