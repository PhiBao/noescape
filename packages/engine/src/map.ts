export const W = 12;
export const H = 10;
export const CELLS = W * H;

export const ROWS = [
  "....#......R",
  ".##.#.##.##.",
  "..........#.",
  ".#.##.#.....",
  "T......#.##.",
  "~~=~~~~~=~~~",
  ".#.#...#....",
  "...#.#.#.#.H",
  ".#..#.......",
  "...A..#..#..",
] as const;

export function idx(x: number, y: number): number {
  return y * W + x;
}

export function xy(cell: number): { x: number; y: number } {
  return { x: cell % W, y: Math.floor(cell / W) };
}

export function isWalkableCell(cell: number): boolean {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return false;
  const { x, y } = xy(cell);
  return ROWS[y]?.[x] !== "#" && ROWS[y]?.[x] !== "~";
}

export const EXITS = [
  { id: 0, name: "Rail yard", cell: idx(11, 0) },
  { id: 1, name: "Tunnel", cell: idx(0, 4) },
  { id: 2, name: "Harbour", cell: idx(11, 7) },
  { id: 3, name: "Airstrip", cell: idx(3, 9) },
] as const;

export const STARTS = [
  idx(0, 0),
  idx(10, 3),
  idx(0, 7),
  idx(2, 6),
  idx(4, 6),
  idx(6, 7),
  idx(8, 6),
  idx(8, 9),
] as const;

export const CAMERAS = [
  { id: 1, cell: idx(2, 2), label: "North-west roof" },
  { id: 2, cell: idx(9, 2), label: "North-east roof" },
  { id: 3, cell: idx(2, 5), label: "West bridge" },
  { id: 4, cell: idx(8, 5), label: "East bridge" },
  { id: 5, cell: idx(6, 8), label: "South yard" },
  { id: 6, cell: idx(10, 8), label: "Harbour approach" },
] as const;

export const PRECINCT = [
  { name: "Ada", cell: idx(5, 2) },
  { name: "Bram", cell: idx(6, 2) },
  { name: "Cole", cell: idx(5, 3) },
] as const;

export const DETECTIVES = ["Ada", "Bram", "Cole"] as const;
