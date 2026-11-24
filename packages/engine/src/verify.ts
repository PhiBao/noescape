import { bit, cellOf, neighbors } from "./bits.ts";
import { brainStep } from "./brain.ts";
import { type CaseRecord, validOrders } from "./case.ts";
import { CAMERAS, EXITS, isWalkableCell, PRECINCT, STARTS } from "./map.ts";
import { encodeReport, searchCode, TURNS } from "./rules.ts";

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
