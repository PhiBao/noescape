import { bit, H, neighbors, W, WALK, xy } from "@noescape/engine";
import { useEffect, useRef, useState } from "react";

interface PinProps {
  cell: number;
  initial: string;
  name: string;
  selected: boolean;
  targetCell: number | null;
  onSelect(): void;
  onBlur(): void;
  onNavigate(dx: number, dy: number): void;
  onConfirm(): void;
  onToggleSearch(): void;
}

const CELL_SIZE = 40;

function shortestPath(from: number, to: number): number[] {
  if (from === to) return [from];
  const queue = [from];
  const previous = new Map<number, number>([[from, -1]]);
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (cell === undefined || cell === to) break;
    const adjacent = neighbors(bit(cell)) & WALK;
    for (let next = 0; next < W * H; next += 1) {
      if ((adjacent & bit(next)) === 0n || previous.has(next)) continue;
      previous.set(next, cell);
      queue.push(next);
    }
  }
  const path = [to];
  let cursor = to;
  while (cursor !== from) {
    const parent = previous.get(cursor);
    if (parent === undefined || parent === -1) return [from];
    path.unshift(parent);
    cursor = parent;
  }
  return path;
}

export function Pin({
  cell,
  initial,
  name,
  selected,
  targetCell,
  onSelect,
  onBlur,
  onNavigate,
  onConfirm,
  onToggleSearch,
}: PinProps) {
  const [displayCell, setDisplayCell] = useState(cell);
  const displayCellRef = useRef(cell);

  useEffect(() => {
    const from = displayCellRef.current;
    if (from === cell) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayCellRef.current = cell;
      setDisplayCell(cell);
      return;
    }
    const path = shortestPath(from, cell);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      const next = path[index];
      if (next === undefined) {
        window.clearInterval(timer);
        return;
      }
      displayCellRef.current = next;
      setDisplayCell(next);
      if (index === path.length - 1) window.clearInterval(timer);
    }, 220);
    return () => window.clearInterval(timer);
  }, [cell]);

  const { x, y } = xy(displayCell);
  const cx = x * CELL_SIZE + CELL_SIZE / 2;
  const cy = y * CELL_SIZE + CELL_SIZE / 2;

  return (
    // biome-ignore lint/a11y/useSemanticElements: Interactive SVG pins cannot contain HTML buttons.
    <g
      className={`map-pin${selected ? " map-pin--selected" : ""}`}
      style={{ transform: `translate(${cx}px, ${cy}px)` }}
      role="button"
      tabIndex={0}
      aria-label={`${name} pin, cell ${displayCell}${targetCell === null ? "" : `, target cell ${targetCell}`}${selected ? ", selected" : ""}`}
      aria-pressed={selected}
      onFocus={onSelect}
      onBlur={onBlur}
      onClick={onSelect}
      onKeyDown={(event) => {
        const directions: Record<string, [number, number]> = {
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
        };
        const direction = directions[event.key];
        if (direction !== undefined) {
          event.preventDefault();
          onNavigate(direction[0], direction[1]);
        } else if (event.key === "Enter") {
          event.preventDefault();
          onConfirm();
        } else if (event.key.toLowerCase() === "s") {
          event.preventDefault();
          onToggleSearch();
        }
      }}
    >
      {selected ? <circle className="map-pin__selection" r="19" /> : null}
      <circle className="map-pin__focus" r="22" />
      <circle className="map-pin__body" r="14" />
      <text className="map-pin__initial" textAnchor="middle" dominantBaseline="central">
        {initial}
      </text>
    </g>
  );
}
