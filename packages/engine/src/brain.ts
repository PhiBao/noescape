import { ALL, COL0, COL11, reach } from "./bits.ts";
import { CAMS, TOWARD, WALK } from "./masks.ts";
import { W_FAR, W_SAFE, W_TOWARD, W_UNSEEN } from "./rules.ts";

export interface NightMasks {
  free: bigint;
  threat2: bigint;
  threat3: bigint;
}

export interface BrainStep {
  cands: bigint[];
  valid: boolean[];
  safe: boolean[];
  far: boolean[];
  toward: boolean[];
  unseen: boolean[];
  scores: number[];
  chosen: number;
  newPos: bigint;
}

export function nightMasks(det: bigint): NightMasks {
  return {
    free: WALK & ~det,
    threat2: reach(det, 2, WALK),
    threat3: reach(det, 3, WALK),
  };
}

export function brainStep(
  pos: bigint,
  exitIdx: number,
  det: bigint,
  noise: readonly number[],
  useToward: boolean,
): BrainStep {
  const { free, threat2, threat3 } = nightMasks(det);
  const cands = [pos, pos >> 12n, (pos & ~COL11) << 1n, (pos << 12n) & ALL, (pos & ~COL0) >> 1n];
  const valid = cands.map((candidate, index) => index === 0 || (candidate & free) !== 0n);
  const safe = cands.map((candidate) => (candidate & threat2) === 0n);
  const far = cands.map((candidate) => (candidate & threat3) === 0n);
  const toward = cands.map((_, index) => {
    if (!useToward || index === 0) return false;
    return (pos & (TOWARD[exitIdx]?.[index] ?? 0n)) !== 0n;
  });
  const unseen = cands.map((candidate) => (candidate & CAMS) === 0n);
  const scores = cands.map((_, index) => {
    if (!valid[index]) return 0;
    return (
      1 +
      (noise[index] ?? 0) +
      (safe[index] ? W_SAFE : 0) +
      (far[index] ? W_FAR : 0) +
      (toward[index] ? W_TOWARD : 0) +
      (unseen[index] ? W_UNSEEN : 0)
    );
  });

  let chosen = 0;
  let best = scores[0] ?? 0;
  let newPos = cands[0] ?? 0n;
  for (let index = 1; index < cands.length; index += 1) {
    const score = scores[index] ?? 0;
    if (score > best) {
      chosen = index;
      best = score;
      newPos = cands[index] ?? 0n;
    }
  }

  return { cands, valid, safe, far, toward, unseen, scores, chosen, newPos };
}
