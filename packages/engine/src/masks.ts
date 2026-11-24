import { bit, neighbors } from "./bits.ts";
import { CAMERAS, CELLS, EXITS, idx, isWalkableCell, STARTS, W } from "./map.ts";

export const WALK = Array.from({ length: CELLS }, (_, cell) =>
  isWalkableCell(cell) ? bit(cell) : 0n,
).reduce((mask, cellBit) => mask | cellBit, 0n);

export const CAMS = CAMERAS.reduce((mask, camera) => mask | bit(camera.cell), 0n);

export const CAMBIT = [
  0n,
  bit(CAMERAS[0].cell),
  bit(CAMERAS[1].cell),
  bit(CAMERAS[2].cell),
  bit(CAMERAS[3].cell),
  bit(CAMERAS[4].cell),
  bit(CAMERAS[5].cell),
] as const;

export const EXIT_MASK = [
  bit(EXITS[0].cell),
  bit(EXITS[1].cell),
  bit(EXITS[2].cell),
  bit(EXITS[3].cell),
] as const;

export const START_MASK = [
  bit(STARTS[0]),
  bit(STARTS[1]),
  bit(STARTS[2]),
  bit(STARTS[3]),
  bit(STARTS[4]),
  bit(STARTS[5]),
  bit(STARTS[6]),
  bit(STARTS[7]),
] as const;

function bfs(source: number): number[] {
  const distances = Array<number>(CELLS).fill(-1);
  distances[source] = 0;
  const queue = [source];

  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (cell === undefined) continue;
    const distance = distances[cell];
    if (distance === undefined) continue;
    const adjacent = neighbors(bit(cell)) & WALK;
    for (let next = 0; next < CELLS; next += 1) {
      if ((adjacent & bit(next)) === 0n || (distances[next] ?? -1) !== -1) continue;
      distances[next] = distance + 1;
      queue.push(next);
    }
  }

  return distances;
}

export const dist = EXITS.map((exit) => bfs(exit.cell));

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
] as const;

export const TOWARD = dist.map((distances) => {
  const byDirection: bigint[] = [0n];

  for (const { dx, dy } of DIRECTIONS) {
    let mask = 0n;
    for (let cell = 0; cell < CELLS; cell += 1) {
      if (!isWalkableCell(cell)) continue;
      const x = cell % W;
      const y = Math.floor(cell / W);
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextX >= W || nextY < 0 || nextY >= 10) continue;
      const next = idx(nextX, nextY);
      const fromDistance = distances[cell];
      const toDistance = distances[next];
      if (
        isWalkableCell(next) &&
        fromDistance !== undefined &&
        toDistance !== undefined &&
        toDistance < fromDistance
      ) {
        mask |= bit(cell);
      }
    }
    byDirection.push(mask);
  }

  return byDirection;
});
