// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {CityMapData} from "../generated/CityMapData.sol";
import {Grid} from "./Grid.sol";

/// @title FugitiveBrain
/// @author noescape contributors
/// @notice The encrypted five-candidate fugitive policy and its public clues.
library FugitiveBrain {
    struct Night {
        uint128 free;
        uint128 threat2;
        uint128 threat3;
        bool useToward;
    }

    /// @notice Derives plaintext danger masks from public detective positions.
    /// @param det Public detective-cell mask.
    /// @return n Free, two-step and three-step danger masks.
    function night(uint128 det) internal pure returns (Night memory n) {
        n.free = CityMapData.WALK & ~det;
        n.threat2 = Grid.reach(det, 2, CityMapData.WALK);
        n.threat3 = Grid.reach(det, 3, CityMapData.WALK);
        n.useToward = true;
    }

    /// @notice Compares the encrypted exit index with zero, one and two.
    /// @param exitIdx Encrypted exit index.
    /// @return e Three encrypted equality handles.
    function exitEq(euint8 exitIdx) internal returns (ebool[3] memory e) {
        e[0] = FHE.eq(exitIdx, 0);
        e[1] = FHE.eq(exitIdx, 1);
        e[2] = FHE.eq(exitIdx, 2);
    }

    function _exitMask(ebool[3] memory e) internal returns (euint128) {
        return
            FHE.select(
                e[0],
                FHE.asEuint128(CityMapData.EXIT_0),
                FHE.select(
                    e[1],
                    FHE.asEuint128(CityMapData.EXIT_1),
                    FHE.select(e[2], FHE.asEuint128(CityMapData.EXIT_2), FHE.asEuint128(CityMapData.EXIT_3))
                )
            );
    }

    function _towardMasks(ebool[3] memory e) internal returns (euint128[4] memory masks) {
        for (uint8 direction = 1; direction < 5; ++direction) {
            masks[direction - 1] = FHE.select(
                e[0],
                FHE.asEuint128(_toward(0, direction)),
                FHE.select(
                    e[1],
                    FHE.asEuint128(_toward(1, direction)),
                    FHE.select(e[2], FHE.asEuint128(_toward(2, direction)), FHE.asEuint128(_toward(3, direction)))
                )
            );
        }
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

    function _select8(ebool control, uint8 a, uint8 b) internal returns (euint8) {
        return FHE.select(control, FHE.asEuint8(a), FHE.asEuint8(b));
    }

    function _score(
        euint8 noise,
        ebool valid,
        ebool safe,
        ebool far,
        ebool toward,
        ebool unseen
    ) internal returns (euint8) {
        euint8 score = FHE.add(noise, 1);
        score = FHE.add(score, _select8(safe, CityMapData.W_SAFE, 0));
        score = FHE.add(score, _select8(far, CityMapData.W_FAR, 0));
        score = FHE.add(score, _select8(toward, CityMapData.W_TOWARD, 0));
        score = FHE.add(score, _select8(unseen, CityMapData.W_UNSEEN, 0));
        return FHE.select(valid, score, FHE.asEuint8(0));
    }

    /// @notice Scores the fixed stay/north/east/south/west candidates over ciphertext.
    /// @param pos Encrypted current one-hot position.
    /// @param e Encrypted exit equality handles.
    /// @param n Plaintext night danger masks.
    /// @param noise Five encrypted noise handles.
    /// @return newPos Encrypted chosen one-hot position.
    /// @return scores Five encrypted candidate scores.
    function stepWithNoise(
        euint128 pos,
        ebool[3] memory e,
        Night memory n,
        euint8[5] memory noise
    ) internal returns (euint128 newPos, euint8[5] memory scores) {
        euint128[5] memory cands;
        cands[0] = pos;
        cands[1] = FHE.shr(pos, 12);
        cands[2] = FHE.shl(FHE.and(pos, ~CityMapData.COL11), 1);
        cands[3] = FHE.and(FHE.shl(pos, 12), CityMapData.ALL);
        cands[4] = FHE.shr(FHE.and(pos, ~CityMapData.COL0), 1);

        euint128[4] memory towardMasks;
        if (n.useToward) {
            towardMasks = _towardMasks(e);
        } else {
            for (uint8 direction = 0; direction < 4; ++direction) {
                towardMasks[direction] = FHE.asEuint128(0);
            }
        }

        ebool[5] memory safe;
        ebool[5] memory far;
        ebool[5] memory toward;
        ebool[5] memory unseen;
        for (uint8 index = 0; index < 5; ++index) {
            safe[index] = FHE.eq(FHE.and(cands[index], n.threat2), 0);
            far[index] = FHE.eq(FHE.and(cands[index], n.threat3), 0);
            unseen[index] = FHE.eq(FHE.and(cands[index], CityMapData.CAMS), 0);
            if (index == 0 || n.useToward == false) {
                toward[index] = FHE.asEbool(false);
            } else {
                toward[index] = FHE.ne(FHE.and(pos, towardMasks[index - 1]), 0);
            }
        }

        scores[0] = _score(noise[0], FHE.asEbool(true), safe[0], far[0], toward[0], unseen[0]);
        for (uint8 index = 1; index < 5; ++index) {
            ebool valid = FHE.ne(FHE.and(cands[index], n.free), 0);
            scores[index] = _score(noise[index], valid, safe[index], far[index], toward[index], unseen[index]);
        }

        newPos = cands[0];
        euint8 best = scores[0];
        for (uint8 index = 1; index < 5; ++index) {
            ebool greater = FHE.gt(scores[index], best);
            best = FHE.select(greater, scores[index], best);
            newPos = FHE.select(greater, cands[index], newPos);
        }
    }

    /// @notice Draws five encrypted noise values and runs the policy.
    /// @param pos Encrypted current one-hot position.
    /// @param e Encrypted exit equality handles.
    /// @param n Plaintext night danger masks.
    /// @return newPos Encrypted chosen one-hot position.
    /// @return noise Five encrypted noise handles.
    function step(
        euint128 pos,
        ebool[3] memory e,
        Night memory n
    ) internal returns (euint128 newPos, euint8[5] memory noise) {
        for (uint8 index = 0; index < 5; ++index) {
            noise[index] = FHE.randEuint8(CityMapData.NOISE_BOUND);
        }
        (newPos, ) = stepWithNoise(pos, e, n, noise);
    }

    /// @notice Reports whether the new position is the secret exit.
    /// @param newPos Encrypted new one-hot position.
    /// @param e Encrypted exit equality handles.
    function exitHit(euint128 newPos, ebool[3] memory e) internal returns (ebool) {
        return FHE.ne(FHE.and(newPos, _exitMask(e)), 0);
    }

    /// @notice Encodes the public camera sighting as zero or four times its id.
    /// @param newPos Encrypted new one-hot position.
    /// @return cam Encoded camera handle.
    function cameraCode(euint128 newPos) internal returns (euint8 cam) {
        uint128[6] memory masks = [
            CityMapData.CAMBIT_1,
            CityMapData.CAMBIT_2,
            CityMapData.CAMBIT_3,
            CityMapData.CAMBIT_4,
            CityMapData.CAMBIT_5,
            CityMapData.CAMBIT_6
        ];
        cam = FHE.asEuint8(0);
        for (uint8 index = 0; index < 6; ++index) {
            cam = FHE.select(FHE.ne(FHE.and(newPos, masks[index]), 0), FHE.asEuint8((index + 1) * 4), cam);
        }
    }

    /// @notice Combines outcome and camera into the public turn report.
    /// @param caught Encrypted capture flag.
    /// @param escaped Encrypted escape flag.
    /// @param cam Encoded camera handle.
    function report(ebool caught, ebool escaped, euint8 cam) internal returns (euint8) {
        return FHE.add(FHE.select(caught, FHE.asEuint8(1), FHE.select(escaped, FHE.asEuint8(2), FHE.asEuint8(0))), cam);
    }
}
