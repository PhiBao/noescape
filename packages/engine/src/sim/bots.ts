import { bit, cellOf, neighbors, reach } from "../bits.ts";
import { brainStep } from "../brain.ts";
import { CAMERAS, EXITS, isWalkableCell, STARTS } from "../map.ts";
import { WALK } from "../masks.ts";
import { searchCode } from "../rules.ts";

export type BotKind = "naive" | "expert";
export type Rng = () => number;

export interface Particle {
  pos: number;
  path: number[];
  exitIdx: number;
  weight: number;
}

const CELL_COUNT = 120;
const PARTICLE_COUNT = 600;
const REFILL_AT = 200;

function bfs(source: number): number[] {
  const distances = Array<number>(CELL_COUNT).fill(-1);
  distances[source] = 0;
  const queue = [source];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (cell === undefined) continue;
    const distance = distances[cell];
    if (distance === undefined) continue;
    const adjacent = neighbors(bit(cell)) & WALK;
    for (let next = 0; next < CELL_COUNT; next += 1) {
      if ((adjacent & bit(next)) === 0n || (distances[next] ?? -1) !== -1) continue;
      distances[next] = distance + 1;
      queue.push(next);
    }
  }
  return distances;
}

export const DISTANCES = Array.from({ length: CELL_COUNT }, (_, cell) => bfs(cell));
export const WALKABLE = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
  isWalkableCell,
);

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function randomNoise(rng: Rng): [number, number, number, number, number] {
  return [
    Math.floor(rng() * 8),
    Math.floor(rng() * 8),
    Math.floor(rng() * 8),
    Math.floor(rng() * 8),
    Math.floor(rng() * 8),
  ];
}

function cloneParticle(particle: Particle): Particle {
  return { ...particle, path: [...particle.path] };
}

function seedParticles(rng: Rng, useStarts = true): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const pos = useStarts
      ? (STARTS[Math.floor(rng() * STARTS.length)] ?? 0)
      : (WALKABLE[Math.floor(rng() * WALKABLE.length)] ?? 0);
    return {
      pos,
      path: [pos],
      exitIdx: Math.floor(rng() * EXITS.length),
      weight: 1,
    };
  });
}

function refill(particles: Particle[], rng: Rng): Particle[] {
  if (particles.length >= REFILL_AT) return particles;
  if (particles.length === 0) return seedParticles(rng, false);
  const totalWeight = particles.reduce((sum, particle) => sum + particle.weight, 0);
  const refilled = [...particles];
  while (refilled.length < PARTICLE_COUNT) {
    let target = rng() * totalWeight;
    let selected = particles[0];
    if (selected === undefined) return seedParticles(rng, false);
    for (const particle of particles) {
      target -= particle.weight;
      if (target <= 0) {
        selected = particle;
        break;
      }
    }
    refilled.push(cloneParticle(selected));
  }
  return refilled;
}

export function initialParticles(rng: Rng): Particle[] {
  return seedParticles(rng);
}

function aggregate(particles: Particle[]): number[] {
  const weights = Array<number>(CELL_COUNT).fill(0);
  for (const particle of particles)
    weights[particle.pos] = (weights[particle.pos] ?? 0) + particle.weight;
  return weights;
}

export function chooseOrders(
  _bot: BotKind,
  particles: Particle[],
  cells: readonly [number, number, number],
): { to: [number, number, number]; searchFlags: number } {
  const weights = aggregate(particles);
  const chosen = new Set<number>();
  const to: [number, number, number] = [...cells];

  for (let detective = 0; detective < 3; detective += 1) {
    const from = cells[detective];
    if (from === undefined) continue;
    const reachable = reach(bit(from), 2, WALK);
    let bestCell = from;
    let bestScore = -Infinity;
    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      if ((reachable & bit(cell)) === 0n || chosen.has(cell)) continue;
      const distances = DISTANCES[cell] ?? [];
      let score = 0;
      for (let position = 0; position < CELL_COUNT; position += 1) {
        const weight = weights[position] ?? 0;
        if (weight === 0) continue;
        const distance = distances[position] ?? -1;
        score += weight / (1 + Math.max(0, distance));
        if (cell === position) score += 5 * weight;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCell = cell;
      }
    }
    to[detective] = bestCell;
    chosen.add(bestCell);
  }

  return { to, searchFlags: 0b111 };
}

function cameraAt(cell: number): number {
  return CAMERAS.find((camera) => camera.cell === cell)?.id ?? 0;
}

function advanceParticle(
  particle: Particle,
  bot: BotKind,
  detectiveMask: bigint,
  rng: Rng,
): Particle | null {
  let next: number;
  if (bot === "expert") {
    const move = brainStep(
      bit(particle.pos),
      particle.exitIdx,
      detectiveMask,
      randomNoise(rng),
      true,
    );
    next = cellOf(move.newPos);
    if (next < 0) return null;
  } else {
    const adjacent = neighbors(bit(particle.pos)) & WALK;
    const options = [particle.pos];
    for (let cell = 0; cell < CELL_COUNT; cell += 1) {
      if ((adjacent & bit(cell)) !== 0n) options.push(cell);
    }
    next = options[Math.floor(rng() * options.length)] ?? particle.pos;
  }
  if (next === EXITS[particle.exitIdx]?.cell) return null;
  return { ...particle, pos: next, path: [...particle.path, next] };
}

export function updateParticles(
  particles: Particle[],
  bot: BotKind,
  to: readonly [number, number, number],
  turn: number,
  codes: readonly (number | null)[],
  reportCamera: number,
  rng: Rng,
): Particle[] {
  const detectiveMask = to.reduce((mask, cell) => mask | bit(cell), 0n);
  const searched = particles.filter((particle) => {
    if (to.includes(particle.pos)) return false;
    for (let detective = 0; detective < 3; detective += 1) {
      const destination = to[detective];
      const code = codes[detective];
      if (destination === undefined || code === null || code === undefined) continue;
      if (searchCode(particle.path.map(bit), turn, destination) !== code) return false;
    }
    return true;
  });

  const advanced: Particle[] = [];
  for (const particle of searched) {
    const next = advanceParticle(particle, bot, detectiveMask, rng);
    if (next !== null && cameraAt(next.pos) === reportCamera) advanced.push(next);
  }
  return refill(advanced, rng);
}
