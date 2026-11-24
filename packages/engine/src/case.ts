import { bit, cellOf, reach } from "./bits.ts";
import { brainStep } from "./brain.ts";
import { CAMERAS, EXITS, isWalkableCell, PRECINCT, STARTS } from "./map.ts";
import { EXIT_MASK, WALK } from "./masks.ts";
import { DET_STEPS, encodeReport, SPRINT_STEPS, searchCode, TURNS } from "./rules.ts";

export type DetectiveCells = [number, number, number];
export type Noise = [number, number, number, number, number];
export type Codes = [number | null, number | null, number | null];
export type CaseStatus = "active" | "caught" | "escaped" | "dawn";

export interface CaseTurn {
  to: DetectiveCells;
  searchFlags: number;
  noise: Noise;
  codes: Codes;
  report: number;
}

export interface CaseState {
  exitIdx: number;
  path: number[];
  cells: DetectiveCells;
  turn: number;
  trail: bigint;
  status: CaseStatus;
  turns: CaseTurn[];
}

export interface CaseRecord {
  path: number[];
  exitIdx: number;
  turns: CaseTurn[];
}

export type OrderCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "unreachable" | "shared" | "notWalkable";
      detective: number;
    };

export function newCase(startIdx: number, exitIdx: number): CaseState {
  const start = STARTS[startIdx];
  if (start === undefined) throw new RangeError("startIdx must be between 0 and 7");
  if (!Number.isInteger(exitIdx) || exitIdx < 0 || exitIdx >= EXITS.length) {
    throw new RangeError("exitIdx must be between 0 and 3");
  }
  return {
    exitIdx,
    path: [start],
    cells: [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell],
    turn: 0,
    trail: bit(start),
    status: "active",
    turns: [],
  };
}

export function validOrders(
  cells: readonly [number, number, number],
  to: readonly [number, number, number],
  searchFlags: number,
): OrderCheck {
  for (let detective = 0; detective < 3; detective += 1) {
    const from = cells[detective];
    const target = to[detective];
    if (from === undefined || target === undefined || !isWalkableCell(target)) {
      return { ok: false, reason: "notWalkable", detective };
    }
    const steps = (searchFlags & (1 << detective)) !== 0 ? DET_STEPS : SPRINT_STEPS;
    if ((reach(bit(from), steps, WALK) & bit(target)) === 0n) {
      return { ok: false, reason: "unreachable", detective };
    }
  }

  const destinations = new Set(to);
  if (destinations.size !== 3) {
    const detective = to.findIndex((cell, index) => to.indexOf(cell) !== index);
    return { ok: false, reason: "shared", detective: Math.max(0, detective) };
  }
  return { ok: true };
}

function normalizeNoise(noise: readonly number[]): Noise {
  if (
    noise.length !== 5 ||
    noise.some((value) => !Number.isInteger(value) || value < 0 || value > 7)
  ) {
    throw new RangeError("noise must contain five integers from 0 to 7");
  }
  return [noise[0] ?? 0, noise[1] ?? 0, noise[2] ?? 0, noise[3] ?? 0, noise[4] ?? 0];
}

export function applyTurn(
  state: CaseState,
  to: readonly [number, number, number],
  searchFlags: number,
  noise: readonly number[],
): { state: CaseState; codes: Codes; report: number } {
  if (state.status !== "active") throw new Error("case is already over");
  if (state.turn >= TURNS) throw new Error("case has no turns left");
  const orders = validOrders(state.cells, to, searchFlags);
  if (!orders.ok) throw new Error(`invalid orders: ${orders.reason} detective ${orders.detective}`);

  const turn = state.turn + 1;
  const current = state.path[state.path.length - 1];
  if (current === undefined) throw new Error("case has no current position");
  const destinations: DetectiveCells = [to[0], to[1], to[2]];
  const normalizedNoise = normalizeNoise(noise);

  if (destinations.includes(current)) {
    const codes: Codes = [null, null, null];
    const report = encodeReport(1, 0);
    const record: CaseTurn = {
      to: destinations,
      searchFlags,
      noise: [0, 0, 0, 0, 0],
      codes,
      report,
    };
    return {
      state: {
        ...state,
        path: [...state.path, current],
        cells: destinations,
        turn,
        status: "caught",
        turns: [...state.turns, record],
      },
      codes,
      report,
    };
  }

  const positions = state.path.map(bit);
  const codes: Codes = [0, 0, 0];
  for (let detective = 0; detective < 3; detective += 1) {
    const cell = destinations[detective];
    if (cell === undefined) continue;
    codes[detective] =
      (searchFlags & (1 << detective)) !== 0 ? searchCode(positions, turn, cell) : null;
  }

  const detectiveMask = destinations.reduce((mask, cell) => mask | bit(cell), 0n);
  const move = brainStep(bit(current), state.exitIdx, detectiveMask, normalizedNoise, true);
  const next = cellOf(move.newPos);
  if (next < 0) throw new Error("brain produced an invalid position");
  const escaped = (move.newPos & (EXIT_MASK[state.exitIdx] ?? 0n)) !== 0n;
  const camera = CAMERAS.find((entry) => entry.cell === next)?.id ?? 0;
  const status: CaseStatus = escaped ? "escaped" : turn === TURNS ? "dawn" : "active";
  const report = encodeReport(escaped ? 2 : 0, camera);
  const record: CaseTurn = {
    to: destinations,
    searchFlags,
    noise: normalizedNoise,
    codes,
    report,
  };

  return {
    state: {
      ...state,
      path: [...state.path, next],
      cells: destinations,
      turn,
      trail: state.trail | move.newPos,
      status,
      turns: [...state.turns, record],
    },
    codes,
    report,
  };
}

export function toRecord(state: CaseState): CaseRecord {
  return {
    path: [...state.path],
    exitIdx: state.exitIdx,
    turns: state.turns.map((turn) => ({
      to: [...turn.to],
      searchFlags: turn.searchFlags,
      noise: [...turn.noise],
      codes: [...turn.codes],
      report: turn.report,
    })),
  };
}
