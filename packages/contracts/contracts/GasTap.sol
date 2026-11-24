// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title GasTap
/// @author noescape contributors
/// @notice A capped ETH drip for guest detectives, controlled by a limited operator.
contract GasTap is Ownable2Step, Pausable {
    /// @notice Maximum drip per badge.
    uint256 public constant MAX_DRIP = 0.02 ether;
    /// @notice Maximum spend per UTC day.
    uint256 public constant MAX_DAILY_CAP = 1 ether;
    /// @notice Minimum time between drips to one badge.
    uint256 public constant COOLDOWN = 1 days;

    /// @notice Account allowed to issue drips.
    address public operator;
    /// @notice Amount sent per funded badge.
    uint256 public dripWei;
    /// @notice Maximum amount spent per UTC day.
    uint256 public dailyCapWei;
    /// @notice UTC day index used for the current spending window.
    uint256 public currentDay;
    uint256 private _spentToday;
    /// @notice Last drip timestamp for each badge.
    mapping(address badge => uint256 lastDripAt) public lastDrip;

    error NotOperator();
    error TooSoon();
    error AlreadyFunded();
    error DailyCapReached();
    error DripTooLarge();
    error CapTooLarge();
    error SendFailed();

    /// @notice A badge received fuel.
    /// @param to Recipient badge.
    /// @param amount Drip amount.
    event Dripped(address indexed to, uint256 indexed amount);
    /// @notice The operator changed.
    /// @param operator New operator.
    event OperatorSet(address indexed operator);
    /// @notice The drip amount changed.
    /// @param amount New drip amount.
    event DripSet(uint256 indexed amount);
    /// @notice The daily cap changed.
    /// @param amount New daily cap.
    event DailyCapSet(uint256 indexed amount);
    /// @notice The owner withdrew ETH.
    /// @param to Recipient.
    /// @param amount Withdrawal amount.
    event Withdrawn(address indexed to, uint256 indexed amount);

    /// @notice Creates the tap with separate owner and operator roles.
    /// @param initialOwner The owner allowed to configure and withdraw.
    /// @param initialOperator The only account allowed to drip.
    /// @param initialDripWei Amount sent per funded badge.
    /// @param initialDailyCapWei Maximum amount spent per UTC day.
    constructor(
        address initialOwner,
        address initialOperator,
        uint256 initialDripWei,
        uint256 initialDailyCapWei
    ) Ownable(initialOwner) {
        if (initialDripWei > MAX_DRIP) revert DripTooLarge();
        if (initialDailyCapWei > MAX_DAILY_CAP) revert CapTooLarge();
        operator = initialOperator;
        dripWei = initialDripWei;
        dailyCapWei = initialDailyCapWei;
        currentDay = block.timestamp / 1 days;
        emit OperatorSet(initialOperator);
        emit DripSet(initialDripWei);
        emit DailyCapSet(initialDailyCapWei);
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function _today() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// @notice Returns the amount spent in the current UTC day.
    function spentToday() public view returns (uint256) {
        return currentDay == _today() ? _spentToday : 0;
    }

    /// @notice Sends one drip to a badge that is low on fuel.
    /// @param to Recipient badge address.
    function drip(address to) external onlyOperator whenNotPaused {
        uint256 today = _today();
        if (currentDay != today) {
            currentDay = today;
            _spentToday = 0;
        }
        if (block.timestamp < lastDrip[to] + COOLDOWN) revert TooSoon();
        // solhint-disable-next-line gas-strict-inequalities
        if (to.balance >= dripWei / 2) revert AlreadyFunded();
        if (_spentToday + dripWei > dailyCapWei) revert DailyCapReached();

        lastDrip[to] = block.timestamp;
        _spentToday += dripWei;
        (bool sent, ) = to.call{value: dripWei}("");
        if (!sent) revert SendFailed();
        emit Dripped(to, dripWei);
    }

    /// @notice Replaces the limited operator account.
    /// @param nextOperator New operator address.
    function setOperator(address nextOperator) external onlyOwner {
        operator = nextOperator;
        emit OperatorSet(nextOperator);
    }

    /// @notice Changes the per-badge drip amount.
    /// @param amount New amount, at most 0.02 ETH.
    function setDrip(uint256 amount) external onlyOwner {
        if (amount > MAX_DRIP) revert DripTooLarge();
        dripWei = amount;
        emit DripSet(amount);
    }

    /// @notice Changes the UTC daily spending cap.
    /// @param amount New cap, at most 1 ETH.
    function setDailyCap(uint256 amount) external onlyOwner {
        if (amount > MAX_DAILY_CAP) revert CapTooLarge();
        dailyCapWei = amount;
        emit DailyCapSet(amount);
    }

    /// @notice Pauses new drips.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes new drips.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Withdraws ETH to an owner-selected address.
    /// @param to Recipient address.
    /// @param amount Amount to withdraw.
    function withdraw(address to, uint256 amount) external onlyOwner {
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert SendFailed();
        emit Withdrawn(to, amount);
    }

    /// @notice Accepts ETH funding from the owner or guests.
    receive() external payable {}
}
