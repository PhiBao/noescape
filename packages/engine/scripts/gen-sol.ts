import {
  ALL,
  CAMBIT,
  CAMERAS,
  COL0,
  COL11,
  DET_STEPS,
  EXIT_MASK,
  EXITS,
  H,
  NOISE_BOUND,
  PRECINCT,
  SPRINT_STEPS,
  START_MASK,
  STARTS,
  TOWARD,
  TURNS,
  W,
  W_FAR,
  W_SAFE,
  W_TOWARD,
  W_UNSEEN,
  WALK,
} from "../src/index.ts";

declare const process: { argv: string[]; exitCode?: number };
declare const console: { log(message: string): void; error(message: string): void };

// @ts-expect-error tsx supplies Node built-ins at runtime; the engine package stays browser-safe.
const { existsSync, readFileSync, writeFileSync } = await import("node:fs");

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const hash = argument("hash", "unknown");
const check = process.argv.includes("--check");
const output = new URL("../../contracts/contracts/generated/CityMapData.sol", import.meta.url);
const hex = (value: bigint) => `0x${value.toString(16).padStart(32, "0")}`;

const lines = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.27;",
  `// GENERATED — do not edit`,
  `// Engine source hash: ${hash}`,
  "/// @title CityMapData",
  "/// @author noescape contributors",
  "/// @notice Generated board constants; do not edit by hand.",
  "library CityMapData {",
  `    uint128 internal constant ALL = ${hex(ALL)};`,
  `    uint128 internal constant WALK = ${hex(WALK)};`,
  `    uint128 internal constant COL0 = ${hex(COL0)};`,
  `    uint128 internal constant COL11 = ${hex(COL11)};`,
  `    uint128 internal constant CAMS = ${hex(CAMBIT.slice(1).reduce((mask, value) => mask | value, 0n))};`,
];

for (let index = 1; index < CAMBIT.length; index += 1) {
  lines.push(`    uint128 internal constant CAMBIT_${index} = ${hex(CAMBIT[index] ?? 0n)};`);
}
for (let index = 0; index < EXIT_MASK.length; index += 1) {
  lines.push(`    uint128 internal constant EXIT_${index} = ${hex(EXIT_MASK[index] ?? 0n)};`);
}
for (let index = 0; index < START_MASK.length; index += 1) {
  lines.push(`    uint128 internal constant START_${index} = ${hex(START_MASK[index] ?? 0n)};`);
}
for (let exit = 0; exit < TOWARD.length; exit += 1) {
  for (let direction = 1; direction <= 4; direction += 1) {
    lines.push(
      `    uint128 internal constant TOWARD_${exit}_${direction} = ${hex(TOWARD[exit]?.[direction] ?? 0n)};`,
    );
  }
}

lines.push(
  `    uint8 internal constant W = ${W};`,
  `    uint8 internal constant H = ${H};`,
  `    uint8 internal constant TURNS = ${TURNS};`,
  `    uint8 internal constant DET_STEPS = ${DET_STEPS};`,
  `    uint8 internal constant SPRINT_STEPS = ${SPRINT_STEPS};`,
  `    uint8 internal constant W_SAFE = ${W_SAFE};`,
  `    uint8 internal constant W_FAR = ${W_FAR};`,
  `    uint8 internal constant W_TOWARD = ${W_TOWARD};`,
  `    uint8 internal constant W_UNSEEN = ${W_UNSEEN};`,
  `    uint8 internal constant NOISE_BOUND = ${NOISE_BOUND};`,
);

for (let index = 0; index < PRECINCT.length; index += 1) {
  lines.push(`    uint8 internal constant PRECINCT_${index} = ${PRECINCT[index]?.cell ?? 0};`);
}

lines.push("}", "");

// Keep these imports live so codegen fails if the canonical map data is removed.
void CAMERAS;
void EXITS;
void STARTS;

const content = lines.join("\n");
if (check) {
  if (!existsSync(output) || readFileSync(output, "utf8") !== content) {
    console.error("CityMapData.sol is stale; run pnpm -F engine gen:sol");
    process.exitCode = 1;
  } else {
    console.log("CityMapData.sol is up to date");
  }
} else {
  writeFileSync(output, content);
  console.log(`Wrote ${output.pathname}`);
}
