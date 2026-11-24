import { plus } from "./bits.ts";

export const TURNS = 12;
export const DET_STEPS = 2;
export const SPRINT_STEPS = 3;
export const W_SAFE = 16;
export const W_FAR = 8;
export const W_TOWARD = 8;
export const W_UNSEEN = 4;
export const NOISE_BOUND = 8;

export const MOST_WANTED_WATCH = 30 * 60;
export const MOST_WANTED_MAX_STEPS = 48;
export const MOST_WANTED_MAX_HUNTERS = 64;
export const MOST_WANTED_FEE_TOKENS = 5;

export function encodeReport(status: number, camera: number): number {
  return status | (camera << 2);
}

export function decodeReport(report: number): { status: number; camera: number } {
  return { status: report & 0b11, camera: report >> 2 };
}

export function searchCode(positions: readonly bigint[], turn: number, cell: number): 0 | 1 | 2 {
  const shape = plus(cell);
  const current = turn - 1;
  const recentStart = Math.max(0, turn - 3);

  for (let position = recentStart; position <= current; position += 1) {
    if (((positions[position] ?? 0n) & shape) !== 0n) return 2;
  }
  for (let position = 0; position < recentStart; position += 1) {
    if (((positions[position] ?? 0n) & shape) !== 0n) return 1;
  }
  return 0;
}
