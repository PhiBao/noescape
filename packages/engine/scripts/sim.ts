import type { BotKind } from "../src/sim/bots.ts";
import {
  type FugitiveKind,
  formatStats,
  type SimulationOptions,
  simulate,
} from "../src/sim/run.ts";

declare const process: { argv: string[] };

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const cases = Number(argument("cases", "1000"));
const seed = Number(argument("seed", "1"));
const bot = argument("bot", "naive") as BotKind;
const fugitive = argument("fugitive", "ai") as FugitiveKind;

if (!Number.isInteger(cases) || cases <= 0) throw new Error("--cases must be a positive integer");
if (!Number.isInteger(seed)) throw new Error("--seed must be an integer");
if (bot !== "naive" && bot !== "expert") throw new Error("--bot must be naive or expert");
if (fugitive !== "ai" && fugitive !== "random") {
  throw new Error("--fugitive must be ai or random");
}

const options: SimulationOptions = { cases, seed, bot, fugitive };
console.log(formatStats(options, simulate(options)));
