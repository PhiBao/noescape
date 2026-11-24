import { describe, expect, it } from "vitest";
import { bit, neighbors } from "../src/bits.ts";
import {
  CAMERAS,
  CELLS,
  EXITS,
  idx,
  isWalkableCell,
  PRECINCT,
  ROWS,
  STARTS,
  W,
} from "../src/map.ts";
import { dist, WALK } from "../src/masks.ts";

function distancesFrom(source: number): number[] {
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

describe("map", () => {
  it("has the exact 12 by 10 grid and 83 walkable cells", () => {
    expect(ROWS).toHaveLength(10);
    expect(ROWS.every((row) => row.length === W)).toBe(true);
    expect(Array.from({ length: CELLS }, (_, cell) => cell).filter(isWalkableCell)).toHaveLength(
      83,
    );
  });

  it("connects every walkable cell", () => {
    const first = Array.from({ length: CELLS }, (_, cell) => cell).find(isWalkableCell);
    if (first === undefined) throw new Error("map has no walkable cells");
    const distances = distancesFrom(first);
    expect(
      Array.from({ length: CELLS }, (_, cell) => cell).filter(
        (cell) => isWalkableCell(cell) && distances[cell] === -1,
      ),
    ).toEqual([]);
  });

  it("places every exit, camera and start on a walkable cell", () => {
    for (const cell of [...EXITS, ...CAMERAS].map((place) => place.cell)) {
      expect(isWalkableCell(cell)).toBe(true);
    }
    for (const cell of STARTS) expect(isWalkableCell(cell)).toBe(true);
  });

  it("keeps starts at least five steps from each precinct and four from each exit", () => {
    for (const precinct of PRECINCT) {
      const distances = distancesFrom(precinct.cell);
      for (const start of STARTS) expect(distances[start]).toBeGreaterThanOrEqual(5);
    }
    for (const exitDistances of dist) {
      for (const start of STARTS) expect(exitDistances[start]).toBeGreaterThanOrEqual(4);
    }
  });

  it("round-trips cell coordinates", () => {
    for (let cell = 0; cell < CELLS; cell += 1) {
      const { x, y } = { x: cell % W, y: Math.floor(cell / W) };
      expect(idx(x, y)).toBe(cell);
    }
  });
});
