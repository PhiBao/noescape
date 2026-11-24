import { bit, neighbors } from "../bits.ts";
import {
  applyTurn,
  type CaseState,
  type CaseTurn,
  type Codes,
  type Noise,
  newCase,
} from "../case.ts";
import { CAMERAS, EXITS } from "../map.ts";
import { WALK } from "../masks.ts";
import { encodeReport, searchCode, TURNS } from "../rules.ts";
import {
  type BotKind,
  chooseOrders,
  createRng,
  initialParticles,
  type Rng,
  randomNoise,
  updateParticles,
} from "./bots.ts";

export type FugitiveKind = "ai" | "random";

export interface SimulationOptions {
  cases: number;
  seed: number;
  bot: BotKind;
  fugitive: FugitiveKind;
}

export interface SimulationStats {
  cases: number;
  caught: number;
  escaped: number;
  dawn: number;
  averageCaptureTurn: number;
}

function randomWalkMove(pos: number, rng: Rng): number {
  const adjacent = neighbors(bit(pos)) & WALK;
  const options = [pos];
  for (let cell = 0; cell < 120; cell += 1) {
    if ((adjacent & bit(cell)) !== 0n) options.push(cell);
  }
  return options[Math.floor(rng() * options.length)] ?? pos;
}

function applyRandomTurn(
  state: CaseState,
  to: [number, number, number],
  searchFlags: number,
  rng: Rng,
): { state: CaseState; codes: Codes; report: number } {
  const turn = state.turn + 1;
  const current = state.path[state.path.length - 1];
  if (current === undefined) throw new Error("case has no current position");
  if (to.includes(current)) {
    const codes: Codes = [null, null, null];
    const report = encodeReport(1, 0);
    const record: CaseTurn = {
      to,
      searchFlags,
      noise: [0, 0, 0, 0, 0],
      codes,
      report,
    };
    return {
      state: {
        ...state,
        path: [...state.path, current],
        cells: to,
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
    const destination = to[detective];
    if (destination === undefined) continue;
    codes[detective] =
      (searchFlags & (1 << detective)) !== 0 ? searchCode(positions, turn, destination) : null;
  }
  const next = randomWalkMove(current, rng);
  const escaped = next === EXITS[state.exitIdx]?.cell;
  const camera = CAMERAS.find((entry) => entry.cell === next)?.id ?? 0;
  const status = escaped ? "escaped" : turn === TURNS ? "dawn" : "active";
  const report = encodeReport(escaped ? 2 : 0, camera);
  const record: CaseTurn = { to, searchFlags, noise: [0, 0, 0, 0, 0], codes, report };
  return {
    state: {
      ...state,
      path: [...state.path, next],
      cells: to,
      turn,
      trail: state.trail | bit(next),
      status,
      turns: [...state.turns, record],
    },
    codes,
    report,
  };
}

function playCase(options: SimulationOptions, rng: Rng): CaseState {
  let state = newCase(Math.floor(rng() * 8), Math.floor(rng() * 4));
  let particles = initialParticles(rng);
  while (state.status === "active") {
    const orders = chooseOrders(options.bot, particles, state.cells);
    const noise: Noise = randomNoise(rng);
    const result =
      options.fugitive === "ai"
        ? applyTurn(state, orders.to, orders.searchFlags, noise)
        : applyRandomTurn(state, orders.to, orders.searchFlags, rng);
    state = result.state;
    if (state.status !== "active") break;
    const camera = result.report >> 2;
    particles = updateParticles(
      particles,
      options.bot,
      orders.to,
      state.turn,
      result.codes,
      camera,
      rng,
    );
  }
  return state;
}

export function simulate(options: SimulationOptions): SimulationStats {
  const rng = createRng(options.seed);
  let caught = 0;
  let escaped = 0;
  let dawn = 0;
  let captureTurns = 0;
  for (let index = 0; index < options.cases; index += 1) {
    const state = playCase(options, rng);
    if (state.status === "caught") {
      caught += 1;
      captureTurns += state.turn;
    } else if (state.status === "escaped") escaped += 1;
    else dawn += 1;
  }
  return {
    cases: options.cases,
    caught,
    escaped,
    dawn,
    averageCaptureTurn: caught === 0 ? 0 : captureTurns / caught,
  };
}

export function formatStats(options: SimulationOptions, stats: SimulationStats): string {
  const percent = (count: number) => ((count / stats.cases) * 100).toFixed(1);
  return [
    `cases=${stats.cases} seed=${options.seed} bot=${options.bot} fugitive=${options.fugitive}`,
    `caught ${percent(stats.caught)}% · escaped ${percent(stats.escaped)}% · dawn ${percent(stats.dawn)}% · avg capture turn ${stats.averageCaptureTurn.toFixed(2)}`,
  ].join("\n");
}
