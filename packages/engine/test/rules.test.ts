import { describe, expect, it } from "vitest";
import { bit } from "../src/bits.ts";
import { idx } from "../src/map.ts";
import { TOWARD } from "../src/masks.ts";
import {
  decodeReport,
  encodeReport,
  MOST_WANTED_FEE_TOKENS,
  MOST_WANTED_MAX_HUNTERS,
  MOST_WANTED_MAX_STEPS,
  MOST_WANTED_WATCH,
  NOISE_BOUND,
  SPRINT_STEPS,
  searchCode,
  TURNS,
  W_FAR,
  W_SAFE,
  W_TOWARD,
  W_UNSEEN,
} from "../src/rules.ts";

describe("rules", () => {
  it("keeps the settled constants", () => {
    expect([TURNS, SPRINT_STEPS, W_SAFE, W_FAR, W_TOWARD, W_UNSEEN, NOISE_BOUND]).toEqual([
      12, 3, 16, 8, 8, 4, 8,
    ]);
    expect([MOST_WANTED_WATCH, MOST_WANTED_MAX_STEPS, MOST_WANTED_MAX_HUNTERS]).toEqual([
      1800, 48, 64,
    ]);
    expect(MOST_WANTED_FEE_TOKENS).toBe(5);
  });

  it("round-trips every report value", () => {
    for (let status = 0; status < 4; status += 1) {
      for (let camera = 0; camera < 7; camera += 1) {
        expect(decodeReport(encodeReport(status, camera))).toEqual({ status, camera });
      }
    }
  });

  it("classifies fresh, cold and empty searches against prior positions", () => {
    const cell = idx(5, 2);
    const elsewhere = bit(idx(11, 9));
    expect(searchCode([bit(cell)], 1, cell)).toBe(2);
    expect(searchCode([bit(cell), elsewhere], 2, cell)).toBe(2);
    expect(searchCode([bit(cell), elsewhere, elsewhere], 3, cell)).toBe(2);
    expect(searchCode([bit(cell), elsewhere, elsewhere, elsewhere], 4, cell)).toBe(1);
    expect(searchCode([elsewhere, elsewhere, elsewhere, elsewhere], 4, cell)).toBe(0);
  });

  it("marks east toward Harbour only where the step is valid", () => {
    const eastTowardHarbour = TOWARD[2]?.[2] ?? 0n;
    expect((eastTowardHarbour & bit(idx(10, 7))) !== 0n).toBe(true);
    expect((eastTowardHarbour & bit(idx(11, 7))) !== 0n).toBe(false);
  });
});
