import { describe, expect, it } from "vitest";
import { bit } from "../src/bits.ts";
import { applyTurn, type CaseState, newCase, validOrders } from "../src/case.ts";
import { idx, PRECINCT } from "../src/map.ts";
import { decodeReport } from "../src/rules.ts";

const silentNoise = [0, 0, 0, 0, 0];

describe("case", () => {
  it("starts at a settled start with detectives at the precinct", () => {
    const state = newCase(3, 1);
    expect(state.path).toEqual([idx(2, 6)]);
    expect(state.cells).toEqual(PRECINCT.map((entry) => entry.cell));
    expect(state.turn).toBe(0);
    expect(state.status).toBe("active");
  });

  it("validates reach, walkability and shared destinations", () => {
    const cells: [number, number, number] = [idx(5, 2), idx(6, 2), idx(5, 3)];
    expect(validOrders(cells, [idx(5, 2), idx(6, 2), idx(5, 3)], 0b111)).toEqual({ ok: true });
    expect(validOrders(cells, [idx(8, 2), idx(6, 2), idx(5, 3)], 0b111)).toMatchObject({
      ok: false,
      reason: "unreachable",
      detective: 0,
    });
    expect(validOrders(cells, [idx(8, 2), idx(6, 2), idx(5, 3)], 0b110)).toEqual({ ok: true });
    expect(validOrders(cells, [idx(5, 5), idx(6, 2), idx(5, 3)], 0b111)).toMatchObject({
      ok: false,
      reason: "notWalkable",
      detective: 0,
    });
    expect(validOrders(cells, [idx(5, 2), idx(5, 2), idx(5, 3)], 0b111)).toMatchObject({
      ok: false,
      reason: "shared",
    });
  });

  it("captures before searching or moving", () => {
    const base = newCase(0, 0);
    const state: CaseState = { ...base, path: [PRECINCT[0].cell], trail: bit(PRECINCT[0].cell) };
    const result = applyTurn(
      state,
      [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell],
      0b111,
      silentNoise,
    );
    expect(result.state.status).toBe("caught");
    expect(result.codes).toEqual([null, null, null]);
    expect(decodeReport(result.report)).toEqual({ status: 1, camera: 0 });
    expect(result.state.path).toEqual([PRECINCT[0].cell, PRECINCT[0].cell]);
  });

  it("reports a camera when the night move lands on one", () => {
    const base = newCase(0, 2);
    const state: CaseState = {
      ...base,
      path: [idx(2, 4)],
      trail: bit(idx(2, 4)),
      turn: 2,
    };
    const result = applyTurn(
      state,
      [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell],
      0b111,
      [0, 0, 0, 7, 0],
    );
    expect(result.state.path.at(-1)).toBe(idx(2, 5));
    expect(decodeReport(result.report)).toEqual({ status: 0, camera: 3 });
  });

  it("escapes on turn 12 when the chosen move reaches the secret exit", () => {
    const base = newCase(0, 0);
    const state: CaseState = {
      ...base,
      path: [idx(10, 0)],
      trail: bit(idx(10, 0)),
      turn: 11,
    };
    const result = applyTurn(
      state,
      [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell],
      0b000,
      [0, 0, 7, 0, 0],
    );
    expect(result.state.path.at(-1)).toBe(idx(11, 0));
    expect(result.state.status).toBe("escaped");
    expect(decodeReport(result.report)).toEqual({ status: 2, camera: 0 });
    expect(result.codes).toEqual([null, null, null]);
  });

  it("ends at dawn after turn 12 without an escape", () => {
    const base = newCase(0, 3);
    const state: CaseState = {
      ...base,
      path: [idx(5, 2)],
      trail: bit(idx(5, 2)),
      turn: 11,
    };
    const result = applyTurn(state, [idx(7, 2), idx(8, 2), idx(5, 3)], 0b111, silentNoise);
    expect(result.state.status).toBe("dawn");
    expect(decodeReport(result.report).status).toBe(0);
  });
});
