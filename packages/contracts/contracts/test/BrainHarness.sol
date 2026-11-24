// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CityMapData} from "../generated/CityMapData.sol";
import {FugitiveBrain} from "../lib/FugitiveBrain.sol";
import {Grid} from "../lib/Grid.sol";

/// @title BrainHarness
/// @author noescape contributors
/// @notice Test-only harness for encrypted brain equivalence and Sepolia spikes.
contract BrainHarness is ZamaEthereumConfig {
    euint128 private _pos;
    euint128 private _p1;
    euint128 private _p2;
    euint128 private _trail;
    euint8 private _exitIdx;
    euint128 private _resultPos;
    euint8[5] private _lastScores;
    euint8[5] private _lastNoise;
    euint8[3] private _codes;
    euint8 private _report;

    /// @notice Encrypts plaintext test inputs and stores the brain output.
    /// @param pos Plaintext one-hot position.
    /// @param exitIdx Plaintext exit index.
    /// @param det Plaintext detective mask.
    /// @param noise Five plaintext noise values.
    /// @param useToward Whether to apply the secret-exit gradient.
    function stepPlain(uint128 pos, uint8 exitIdx, uint128 det, uint8[5] calldata noise, bool useToward) external {
        FugitiveBrain.Night memory n = FugitiveBrain.night(det);
        n.useToward = useToward;
        euint8[5] memory encryptedNoise;
        for (uint8 index = 0; index < 5; ++index) {
            encryptedNoise[index] = FHE.asEuint8(noise[index]);
        }
        (_resultPos, _lastScores) = FugitiveBrain.stepWithNoise(
            FHE.asEuint128(pos),
            FugitiveBrain.exitEq(FHE.asEuint8(exitIdx)),
            n,
            encryptedNoise
        );
        FHE.allowThis(_resultPos);
        FHE.allow(_resultPos, msg.sender);
        for (uint8 index = 0; index < 5; ++index) {
            FHE.allowThis(_lastScores[index]);
            FHE.allow(_lastScores[index], msg.sender);
        }
    }

    /// @notice Creates an encrypted start and exit from real FHE randomness.
    function init() external {
        euint8 startIdx = FHE.randEuint8(8);
        _exitIdx = FHE.randEuint8(4);
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
        _pos = start;
        _p1 = start;
        _p2 = start;
        _trail = start;
        FHE.allowThis(_pos);
        FHE.allowThis(_p1);
        FHE.allowThis(_p2);
        FHE.allowThis(_trail);
        FHE.allowThis(_exitIdx);
    }

    function _detMask(uint8[3] memory cells) internal pure returns (uint128) {
        return Grid.bit(cells[0]) | Grid.bit(cells[1]) | Grid.bit(cells[2]);
    }

    function _searchCode(uint128 shape) internal returns (euint8) {
        ebool fresh = FHE.or(
            FHE.ne(FHE.and(_p2, shape), 0),
            FHE.or(FHE.ne(FHE.and(_p1, shape), 0), FHE.ne(FHE.and(_pos, shape), 0))
        );
        ebool cold = FHE.ne(FHE.and(_trail, shape), 0);
        return FHE.select(fresh, FHE.asEuint8(2), FHE.select(cold, FHE.asEuint8(1), FHE.asEuint8(0)));
    }

    /// @notice Runs capture, searches, encrypted movement, escape, camera and report.
    /// @param det Three plaintext detective destinations.
    /// @param searchFlags Bit d enables detective d's search.
    function fullTurn(uint8[3] calldata det, uint8 searchFlags) external {
        _fullTurn(det, searchFlags);
    }

    function _fullTurn(uint8[3] memory det, uint8 searchFlags) internal {
        ebool caught = FHE.asEbool(false);
        for (uint8 index = 0; index < 3; ++index) {
            caught = FHE.or(caught, FHE.ne(FHE.and(_pos, Grid.bit(det[index])), 0));
        }
        for (uint8 index = 0; index < 3; ++index) {
            euint8 code = FHE.asEuint8(0);
            if ((searchFlags & (1 << index)) != 0) {
                code = _searchCode(Grid.plus(det[index]));
            }
            _codes[index] = FHE.select(caught, FHE.asEuint8(0), code);
            FHE.allowThis(_codes[index]);
            FHE.allow(_codes[index], msg.sender);
        }

        FugitiveBrain.Night memory n = FugitiveBrain.night(_detMask(det));
        (euint128 moved, euint8[5] memory noise) = FugitiveBrain.step(_pos, FugitiveBrain.exitEq(_exitIdx), n);
        euint128 next = FHE.select(caught, _pos, moved);
        ebool escaped = FugitiveBrain.exitHit(next, FugitiveBrain.exitEq(_exitIdx));
        _report = FugitiveBrain.report(caught, escaped, FugitiveBrain.cameraCode(next));
        _lastNoise = noise;
        _p2 = _p1;
        _p1 = _pos;
        _pos = next;
        _trail = FHE.or(_trail, next);
        FHE.allowThis(_p2);
        FHE.allowThis(_p1);
        FHE.allowThis(_pos);
        FHE.allowThis(_trail);
        FHE.makePubliclyDecryptable(_report);
    }

    /// @notice Runs one full turn and then one additional encrypted night move.
    /// @param det Three plaintext detective destinations.
    /// @param searchFlags Bit d enables detective d's search.
    function fullTurnPlusStep(uint8[3] calldata det, uint8 searchFlags) external {
        _fullTurn(det, searchFlags);
        FugitiveBrain.Night memory n = FugitiveBrain.night(_detMask(det));
        (euint128 moved, euint8[5] memory noise) = FugitiveBrain.step(_pos, FugitiveBrain.exitEq(_exitIdx), n);
        _pos = moved;
        _lastNoise = noise;
        FHE.allowThis(_pos);
    }

    /// @notice Returns the encrypted position.
    function getPos() external view returns (euint128) {
        return _pos;
    }

    /// @notice Returns the encrypted exit index.
    function getExit() external view returns (euint8) {
        return _exitIdx;
    }

    /// @notice Returns the encrypted result of the last plaintext equivalence call.
    function getResultPos() external view returns (euint128) {
        return _resultPos;
    }

    /// @notice Returns one encrypted candidate score.
    /// @param index Candidate index from zero to four.
    function getScore(uint8 index) external view returns (euint8) {
        return _lastScores[index];
    }

    /// @notice Returns one encrypted noise handle.
    /// @param index Noise index from zero to four.
    function getNoise(uint8 index) external view returns (euint8) {
        return _lastNoise[index];
    }

    /// @notice Returns one encrypted search code.
    /// @param index Detective index from zero to two.
    function getCode(uint8 index) external view returns (euint8) {
        return _codes[index];
    }

    /// @notice Returns the public encrypted report handle.
    function getReport() external view returns (euint8) {
        return _report;
    }
}
