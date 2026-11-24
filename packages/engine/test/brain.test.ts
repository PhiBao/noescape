import { describe, expect, it } from "vitest";
import { bit, popcount, reach } from "../src/bits.ts";
import { brainStep, nightMasks } from "../src/brain.ts";
import { idx } from "../src/map.ts";
import { WALK } from "../src/masks.ts";

describe("brain", () => {
  it("derives free and threat masks from detective positions", () => {
    const det = bit(idx(5, 2)) | bit(idx(6, 2)) | bit(idx(5, 3));
    const night = nightMasks(det);
    expect(night.free & det).toBe(0n);
    expect(night.free & ~WALK).toBe(0n);
    expect(night.threat2 & det).toBe(det);
    expect(popcount(night.threat3)).toBeGreaterThan(popcount(night.threat2));
    expect(reach(det, 3, WALK)).toBe(night.threat3);
  });

  it("keeps the fixed candidate order and gives invalid moves score zero", () => {
    const pos = bit(idx(0, 0));
    const step = brainStep(pos, 0, 0n, [0, 0, 0, 0, 0], false);
    expect(step.cands).toEqual([pos, 0n, pos << 1n, pos << 12n, 0n]);
    expect(step.valid).toEqual([true, false, true, true, false]);
    expect(step.scores[1]).toBe(0);
    expect(step.scores[4]).toBe(0);
  });

  it("keeps stay on an exact tie with north", () => {
    const pos = bit(idx(5, 2));
    const step = brainStep(pos, 0, 0n, [0, 0, 0, 0, 0], false);
    expect(step.scores[0]).toBe(step.scores[1]);
    expect(step.chosen).toBe(0);
    expect(step.newPos).toBe(pos);
  });

  it("adds toward only for the secret exit and only when enabled", () => {
    const pos = bit(idx(10, 7));
    const enabled = brainStep(pos, 2, 0n, [0, 0, 0, 0, 0], true);
    const disabled = brainStep(pos, 2, 0n, [0, 0, 0, 0, 0], false);
    expect(enabled.toward[2]).toBe(true);
    expect(disabled.toward[2]).toBe(false);
    expect((enabled.scores[2] ?? 0) - (disabled.scores[2] ?? 0)).toBe(8);
  });

  it("matches the documented score formula", () => {
    const pos = bit(idx(5, 2));
    const det = bit(idx(5, 1)) | bit(idx(6, 2)) | bit(idx(5, 3));
    const step = brainStep(pos, 0, det, [1, 2, 3, 4, 5], false);
    expect(step.scores[0]).toBe(1 + 1 + 0 + 0 + 4);
    expect(step.scores[1]).toBe(0);
  });
});
