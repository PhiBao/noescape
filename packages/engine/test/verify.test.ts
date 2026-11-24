import { describe, expect, it } from "vitest";
import { bit, reach } from "../src/bits.ts";
import { applyTurn, type CaseRecord, newCase, toRecord } from "../src/case.ts";
import { idx } from "../src/map.ts";
import { WALK } from "../src/masks.ts";
import { verifyCase } from "../src/verify.ts";

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function clone(record: CaseRecord): CaseRecord {
  return structuredClone(record);
}

function playRandomCase(seed: number): CaseRecord {
  const rng = random(seed);
  let state = newCase(Math.floor(rng() * 8), Math.floor(rng() * 4));
  while (state.status === "active") {
    const destinations = new Set<number>();
    const to: [number, number, number] = [...state.cells];
    let flags = 0;
    for (let detective = 0; detective < 3; detective += 1) {
      const from = state.cells[detective];
      if (from === undefined) throw new Error("missing detective");
      const search = rng() > 0.25;
      if (search) flags |= 1 << detective;
      const reachable = reach(bit(from), search ? 2 : 3, WALK);
      const options = Array.from({ length: 120 }, (_, cell) => cell).filter(
        (cell) => (reachable & bit(cell)) !== 0n && !destinations.has(cell),
      );
      const choice = options[Math.floor(rng() * options.length)];
      if (choice === undefined) throw new Error("no reachable destination");
      destinations.add(choice);
      to[detective] = choice;
    }
    const noise = Array.from({ length: 5 }, () => Math.floor(rng() * 8));
    state = applyTurn(state, to, flags, noise).state;
  }
  return toRecord(state);
}

describe("verifier", () => {
  it("verifies a full random case", () => {
    const record = playRandomCase(41);
    const result = verifyCase(record);
    expect(result.ok).toBe(true);
    expect(result.failCode).toBe(0);
    expect(result.counts.moves).toBeGreaterThan(0);
    expect(result.counts.reports).toBe(record.turns.length);
  });

  it("rejects a tampered start", () => {
    const record = playRandomCase(7);
    record.path[0] = idx(5, 2);
    expect(verifyCase(record)).toMatchObject({ ok: false, failCode: 1, failTurn: 0 });
  });

  it("rejects an illegal path step", () => {
    const record = playRandomCase(9);
    const turnIndex = record.turns.findIndex((turn, index) => {
      const current = record.path[index];
      return current !== undefined && !turn.to.includes(current);
    });
    if (turnIndex < 0) throw new Error("no night move to tamper");
    const turn = record.turns[turnIndex];
    if (turn === undefined) throw new Error("missing turn");
    record.path[turnIndex + 1] = turn.to[0];
    expect(verifyCase(record)).toMatchObject({ ok: false, failCode: 3, failTurn: turnIndex + 1 });
  });

  it("rejects tampered noise that changes the argmax", () => {
    const record = playRandomCase(13);
    for (let turnIndex = 0; turnIndex < record.turns.length; turnIndex += 1) {
      const turn = record.turns[turnIndex];
      if (turn === undefined) continue;
      for (let candidate = 0; candidate < 5; candidate += 1) {
        for (let value = 0; value < 8; value += 1) {
          if (value === turn.noise[candidate]) continue;
          const tampered = clone(record);
          const tamperedTurn = tampered.turns[turnIndex];
          if (tamperedTurn === undefined) continue;
          tamperedTurn.noise[candidate] = value;
          const result = verifyCase(tampered);
          if (result.failCode === 4) {
            expect(result).toMatchObject({ ok: false, failCode: 4, failTurn: turnIndex + 1 });
            return;
          }
        }
      }
    }
    throw new Error("no single-noise tamper changed a move");
  });

  it("rejects a tampered search code", () => {
    const record = playRandomCase(17);
    const index = record.turns.findIndex((turn) => turn.codes.some((code) => code !== null));
    const turn = record.turns[index];
    if (turn === undefined) throw new Error("missing searched turn");
    const detective = turn.codes.findIndex((code) => code !== null);
    turn.codes[detective] = turn.codes[detective] === 2 ? 0 : 2;
    expect(verifyCase(record)).toMatchObject({ ok: false, failCode: 5, failTurn: index + 1 });
  });

  it("rejects a tampered report", () => {
    const record = clone(playRandomCase(19));
    const turn = record.turns[0];
    if (turn === undefined) throw new Error("missing turn");
    turn.report ^= 0b100;
    expect(verifyCase(record)).toMatchObject({ ok: false, failCode: 6, failTurn: 1 });
  });

  it("rejects an out-of-range exit", () => {
    const record = clone(playRandomCase(23));
    record.exitIdx = 4;
    expect(verifyCase(record)).toMatchObject({ ok: false, failCode: 7, failTurn: 0 });
  });

  it("rejects a tampered order", () => {
    const record = clone(playRandomCase(29));
    const turn = record.turns[0];
    if (turn === undefined) throw new Error("missing turn");
    turn.to[0] = idx(11, 9);
    expect(verifyCase(record)).toMatchObject({ ok: false, failCode: 8, failTurn: 1 });
  });
});
