import { describe, expect, it } from "vitest";
import {
  ALL,
  bit,
  COL0,
  COL11,
  cellOf,
  isOneHot,
  neighbors,
  plus,
  popcount,
  reach,
} from "../src/bits.ts";
import { CELLS, idx, W } from "../src/map.ts";
import { WALK } from "../src/masks.ts";

describe("bits", () => {
  it("matches orthogonal neighbours without wrapping", () => {
    for (let cell = 0; cell < CELLS; cell += 1) {
      const x = cell % W;
      const y = Math.floor(cell / W);
      const adjacent = neighbors(bit(cell));
      let expected = 0n;
      if (y > 0) expected |= bit(idx(x, y - 1));
      if (y < 9) expected |= bit(idx(x, y + 1));
      if (x > 0) expected |= bit(idx(x - 1, y));
      if (x < 11) expected |= bit(idx(x + 1, y));
      expect(adjacent).toBe(expected);
    }
    expect(neighbors(ALL) >> BigInt(CELLS)).toBe(0n);
  });

  it("builds column masks and plus shapes", () => {
    expect(popcount(COL0)).toBe(10);
    expect(popcount(COL11)).toBe(10);
    expect(popcount(plus(idx(5, 5)))).toBe(5);
    expect(plus(idx(0, 0))).toBe(bit(0) | bit(1) | bit(12));
    expect(plus(idx(11, 9))).toBe(bit(119) | bit(118) | bit(107));
  });

  it("finds one-hot cells and rejects invalid masks", () => {
    for (let cell = 0; cell < CELLS; cell += 1) {
      expect(isOneHot(bit(cell))).toBe(true);
      expect(cellOf(bit(cell))).toBe(cell);
    }
    expect(isOneHot(0n)).toBe(false);
    expect(isOneHot(bit(1) | bit(2))).toBe(false);
    expect(cellOf(bit(1) | bit(2))).toBe(-1);
  });

  it("expands reach only over walkable cells", () => {
    const start = bit(idx(5, 2));
    expect(reach(start, 0, WALK)).toBe(start);
    expect(reach(start, 2, WALK) & ~WALK).toBe(0n);
    expect(reach(start, 3, WALK) & ~WALK).toBe(0n);
    expect(popcount(reach(start, 2, WALK))).toBeGreaterThan(popcount(reach(start, 1, WALK)));
  });
});
