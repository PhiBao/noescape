import { describe, expect, it } from "vitest";
import { bit, cellOf, neighbors, plus, reach } from "../src/bits.ts";
import { brainStep } from "../src/brain.ts";
import { applyTurn, type CaseRecord, newCase, toRecord } from "../src/case.ts";
import { idx, PRECINCT, STARTS } from "../src/map.ts";
import { WALK } from "../src/masks.ts";
import { searchCode } from "../src/rules.ts";
import { type DailyRecord, verifyCase, verifyDaily } from "../src/verify.ts";

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

function playDaily(seed: number): DailyRecord {
  const rng = random(seed);
  const start = STARTS[Math.floor(rng() * STARTS.length)];
  if (start === undefined) throw new Error("missing start");
  const path = [start];
  const cells = PRECINCT.map((entry) => entry.cell);
  const steps: DailyRecord["steps"] = [];
  const actions: DailyRecord["actions"] = [];

  for (let step = 1; step <= 10; step += 1) {
    const detMask = cells.reduce((mask, cell) => mask | bit(cell), 0n);
    const noise: [number, number, number, number, number] = [
      Math.floor(rng() * 8),
      Math.floor(rng() * 8),
      Math.floor(rng() * 8),
      Math.floor(rng() * 8),
      Math.floor(rng() * 8),
    ];
    const current = path[path.length - 1];
    if (current === undefined) throw new Error("missing current position");
    const next = cellOf(brainStep(bit(current), 0, detMask, noise, false).newPos);
    if (next < 0) throw new Error("invalid daily move");
    const hunter = (step - 1) % 3;
    const fromCell = cells[hunter];
    if (fromCell === undefined) throw new Error("missing hunter");
    const toCell = fromCell;
    const code = next === toCell ? 0 : searchCode(path.map(bit), step, toCell);
    actions.push({ hunter, step, fromCell, toCell, searched: true, code });
    cells[hunter] = toCell;
    path.push(next);
    steps.push({ detMask, noise });
  }

  return { path, steps, actions, hunterCount: 3, finalStatus: "gotAway" };
}

describe("daily verifier", () => {
  it("verifies a ten-step day with three hunters", () => {
    const record = playDaily(41);
    expect(verifyDaily(record)).toEqual({
      ok: true,
      failCode: 0,
      failTurn: 0,
      counts: { moves: 10, answers: 10, reports: 10 },
    });
  });

  it("rejects a tampered daily start", () => {
    const record = playDaily(7);
    record.path[0] = idx(5, 2);
    expect(verifyDaily(record)).toMatchObject({ ok: false, failCode: 1, failTurn: 0 });
  });

  it("rejects a tampered daily path", () => {
    const record = playDaily(9);
    const start = record.path[0];
    const original = record.path[1];
    if (start === undefined || original === undefined) throw new Error("missing path");
    const adjacent = neighbors(bit(start)) & WALK;
    const searchedShapes = PRECINCT.reduce((mask, entry) => mask | plus(entry.cell), 0n);
    const replacement = Array.from({ length: 120 }, (_, cell) => cell).find(
      (cell) =>
        (WALK & bit(cell)) !== 0n &&
        (adjacent & bit(cell)) === 0n &&
        (searchedShapes & bit(cell)) === 0n &&
        cell !== original,
    );
    if (replacement === undefined) throw new Error("no alternate path cell");
    record.path[1] = replacement;
    expect(verifyDaily(record)).toMatchObject({ ok: false, failCode: 3, failTurn: 1 });
  });

  it("rejects tampered daily noise that changes the argmax", () => {
    const record = playDaily(13);
    for (let stepIndex = 0; stepIndex < record.steps.length; stepIndex += 1) {
      const step = record.steps[stepIndex];
      if (step === undefined) continue;
      for (let candidate = 0; candidate < 5; candidate += 1) {
        for (let value = 0; value < 8; value += 1) {
          if (value === step.noise[candidate]) continue;
          const tampered = structuredClone(record);
          const tamperedStep = tampered.steps[stepIndex];
          if (tamperedStep === undefined) continue;
          tamperedStep.noise[candidate] = value;
          const result = verifyDaily(tampered);
          if (result.failCode === 4) {
            expect(result).toMatchObject({ ok: false, failCode: 4, failTurn: stepIndex + 1 });
            return;
          }
        }
      }
    }
    throw new Error("no single-noise tamper changed a daily move");
  });

  it("rejects a tampered daily code", () => {
    const record = playDaily(17);
    const action = record.actions[0];
    if (action === undefined) throw new Error("missing action");
    action.code = action.code === 2 ? 0 : 2;
    expect(verifyDaily(record)).toMatchObject({ ok: false, failCode: 5, failTurn: 1 });
  });

  it("rejects a tampered daily order", () => {
    const record = playDaily(29);
    const action = record.actions[0];
    if (action === undefined) throw new Error("missing action");
    action.fromCell = idx(11, 9);
    expect(verifyDaily(record)).toMatchObject({ ok: false, failCode: 8, failTurn: 1 });
  });
});
