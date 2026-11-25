import { bit, cellOf, neighbors, reach } from "./bits.ts";
import { brainStep } from "./brain.ts";
import { type CaseRecord, validOrders } from "./case.ts";
import { CAMERAS, EXITS, isWalkableCell, PRECINCT, STARTS } from "./map.ts";
import { WALK } from "./masks.ts";
import {
  DET_STEPS,
  encodeReport,
  MOST_WANTED_MAX_STEPS,
  SPRINT_STEPS,
  searchCode,
  TURNS,
} from "./rules.ts";

export interface VerificationCounts {
  moves: number;
  answers: number;
  reports: number;
}

export interface VerificationResult {
  ok: boolean;
  failCode: number;
  failTurn: number;
  counts: VerificationCounts;
}

export function verifyCase(record: CaseRecord): VerificationResult {
  const counts: VerificationCounts = { moves: 0, answers: 0, reports: 0 };
  const fail = (failCode: number, failTurn: number): VerificationResult => ({
    ok: false,
    failCode,
    failTurn,
    counts,
  });

  const start = record.path[0];
  if (start === undefined || !STARTS.includes(start as (typeof STARTS)[number])) {
    return fail(1, 0);
  }
  if (!Number.isInteger(record.exitIdx) || record.exitIdx < 0 || record.exitIdx >= EXITS.length) {
    return fail(7, 0);
  }
  if (record.path.length !== record.turns.length + 1) return fail(2, record.turns.length);
  for (let index = 0; index < record.path.length; index += 1) {
    const cell = record.path[index];
    if (cell === undefined || !isWalkableCell(cell)) return fail(2, index);
  }
  if (record.turns.length > TURNS) return fail(6, TURNS + 1);

  let cells: [number, number, number] = [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell];

  for (let index = 0; index < record.turns.length; index += 1) {
    const turn = record.turns[index];
    if (turn === undefined) return fail(2, index + 1);
    const turnNo = index + 1;
    const current = record.path[index];
    const next = record.path[index + 1];
    if (current === undefined || next === undefined) return fail(2, turnNo);

    const orders = validOrders(cells, turn.to, turn.searchFlags);
    if (!orders.ok) return fail(8, turnNo);

    if (turn.to.includes(current)) {
      if (index !== record.turns.length - 1 || next !== current) return fail(6, turnNo);
      if (turn.report !== encodeReport(1, 0)) return fail(6, turnNo);
      if (turn.codes.some((code) => code !== null)) return fail(5, turnNo);
      counts.reports += 1;
      return { ok: true, failCode: 0, failTurn: 0, counts };
    }

    const positions = record.path.slice(0, index + 1).map(bit);
    for (let detective = 0; detective < 3; detective += 1) {
      const destination = turn.to[detective];
      if (destination === undefined) return fail(8, turnNo);
      if ((turn.searchFlags & (1 << detective)) === 0) {
        if (turn.codes[detective] !== null) return fail(5, turnNo);
        continue;
      }
      const expected = searchCode(positions, turnNo, destination);
      if (turn.codes[detective] !== expected) return fail(5, turnNo);
      counts.answers += 1;
    }

    if (
      (next !== current && (neighbors(bit(current)) & bit(next)) === 0n) ||
      turn.to.includes(next)
    ) {
      return fail(3, turnNo);
    }

    if (
      turn.noise.length !== 5 ||
      turn.noise.some((value) => !Number.isInteger(value) || value < 0 || value > 7)
    ) {
      return fail(4, turnNo);
    }
    const detectiveMask = turn.to.reduce((mask, cell) => mask | bit(cell), 0n);
    const move = brainStep(bit(current), record.exitIdx, detectiveMask, turn.noise, true);
    if (move.newPos !== bit(next) || cellOf(move.newPos) !== next) return fail(4, turnNo);
    counts.moves += 1;

    const escaped = next === EXITS[record.exitIdx]?.cell;
    if (escaped && index !== record.turns.length - 1) return fail(6, turnNo);
    if (turnNo === TURNS && index !== record.turns.length - 1) return fail(6, turnNo);
    const camera = CAMERAS.find((entry) => entry.cell === next)?.id ?? 0;
    const expectedReport = encodeReport(escaped ? 2 : 0, camera);
    if (turn.report !== expectedReport) return fail(6, turnNo);
    counts.reports += 1;
    cells = [...turn.to];
  }

  return { ok: true, failCode: 0, failTurn: 0, counts };
}

export type DailyStatus = "caught" | "gotAway";

export interface DailyStep {
  detMask: bigint;
  noise: [number, number, number, number, number];
}

export interface DailyAction {
  hunter: number;
  step: number;
  fromCell: number;
  toCell: number;
  searched: boolean;
  code: number;
}

export interface DailyRecord {
  path: number[];
  steps: DailyStep[];
  actions: DailyAction[];
  hunterCount: number;
  finalStatus: DailyStatus;
}

export function verifyDaily(record: DailyRecord): VerificationResult {
  const counts: VerificationCounts = { moves: 0, answers: 0, reports: 0 };
  const fail = (failCode: number, failTurn: number): VerificationResult => ({
    ok: false,
    failCode,
    failTurn,
    counts,
  });

  const start = record.path[0];
  if (start === undefined || !STARTS.includes(start as (typeof STARTS)[number])) {
    return fail(1, 0);
  }
  if (record.path.length !== record.steps.length + 1) return fail(2, record.steps.length);
  if (record.steps.length > MOST_WANTED_MAX_STEPS) {
    return fail(6, MOST_WANTED_MAX_STEPS + 1);
  }
  if (!Number.isInteger(record.hunterCount) || record.hunterCount < 1 || record.hunterCount > 64) {
    return fail(8, 0);
  }
  for (let index = 0; index < record.path.length; index += 1) {
    const cell = record.path[index];
    if (cell === undefined || !isWalkableCell(cell)) return fail(2, index);
  }

  const hunterCells = Array.from(
    { length: record.hunterCount },
    (_, index) => PRECINCT[index % PRECINCT.length]?.cell ?? 0,
  );
  const positions = record.path.map(bit);
  let previousStep = 0;
  let captured = false;

  for (const action of record.actions) {
    const failTurn = Math.max(1, action.step);
    if (
      !Number.isInteger(action.hunter) ||
      action.hunter < 0 ||
      action.hunter >= record.hunterCount ||
      !Number.isInteger(action.step) ||
      action.step < previousStep ||
      action.step < 0 ||
      action.step >= record.path.length
    ) {
      return fail(8, failTurn);
    }
    const from = hunterCells[action.hunter];
    if (from === undefined || action.fromCell !== from || !isWalkableCell(action.toCell)) {
      return fail(8, failTurn);
    }
    const steps = action.searched ? DET_STEPS : SPRINT_STEPS;
    if ((reach(bit(from), steps, WALK) & bit(action.toCell)) === 0n) return fail(8, failTurn);

    const isCapture = record.path[action.step] === action.toCell;
    const expected = isCapture
      ? 0
      : action.searched
        ? searchCode(positions, action.step, action.toCell)
        : 0;
    if (action.code !== expected) return fail(5, failTurn);
    if (action.searched && !isCapture) counts.answers += 1;
    captured ||= isCapture;
    hunterCells[action.hunter] = action.toCell;
    previousStep = action.step;
  }

  for (let index = 0; index < record.steps.length; index += 1) {
    const step = record.steps[index];
    const current = record.path[index];
    const next = record.path[index + 1];
    if (step === undefined || current === undefined || next === undefined)
      return fail(2, index + 1);
    if ((step.detMask & ~WALK) !== 0n) return fail(3, index + 1);
    if (
      (next !== current && (neighbors(bit(current)) & bit(next)) === 0n) ||
      (next !== current && (step.detMask & bit(next)) !== 0n)
    ) {
      return fail(3, index + 1);
    }
    if (
      step.noise.length !== 5 ||
      step.noise.some((value) => !Number.isInteger(value) || value < 0 || value > 7)
    ) {
      return fail(4, index + 1);
    }
    const move = brainStep(bit(current), 0, step.detMask, step.noise, false);
    if (move.newPos !== bit(next) || cellOf(move.newPos) !== next) return fail(4, index + 1);
    counts.moves += 1;
    counts.reports += 1;
  }

  if (record.finalStatus === "caught" && !captured) return fail(6, record.steps.length);
  if (record.finalStatus !== "caught" && record.finalStatus !== "gotAway") {
    return fail(6, record.steps.length);
  }
  return { ok: true, failCode: 0, failTurn: 0, counts };
}
