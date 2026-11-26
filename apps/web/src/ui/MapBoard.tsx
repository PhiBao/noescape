import type { DetectiveCells } from "@noescape/engine";
import {
  bit,
  CAMERAS,
  DETECTIVES,
  EXITS,
  H,
  idx,
  isWalkableCell,
  PRECINCT,
  plus,
  ROWS,
  reach,
  W,
  WALK,
  xy,
} from "@noescape/engine";
import { useEffect, useState } from "react";
import type { CaseOrders } from "../game/caseMachine.ts";
import { Pin } from "./Pin.tsx";

interface MapBoardProps {
  cells: DetectiveCells;
  orders: CaseOrders;
  selectedDetective: number;
  search: boolean;
  onSelectDetective(index: number): void;
  onOrdersChange(orders: CaseOrders): void;
  onSearchToggle(index: number): void;
}

type Block = { x: number; y: number; width: number; height: number };

const CELL_SIZE = 40;
const MAP_WIDTH = W * CELL_SIZE;
const MAP_HEIGHT = H * CELL_SIZE;
const columnLabels = Array.from({ length: W }, (_, index) => String.fromCharCode(65 + index));
const rowLabels = Array.from({ length: H }, (_, index) => index + 1);
const allCells = Array.from({ length: W * H }, (_, index) => index);
const verticalStreets = Array.from({ length: W + 1 }, (_, index) => index * CELL_SIZE);
const horizontalStreets = Array.from({ length: H + 1 }, (_, index) => index * CELL_SIZE);
const waveOffsets = [0, 5, 10, 15, 20, 25, 30];
const plankOffsets = [6, 13, 20, 27, 34];

function buildingBlocks(): Block[] {
  const blocks: Block[] = [];
  let active = new Map<string, Block>();
  for (let y = 0; y < H; y += 1) {
    const next = new Map<string, Block>();
    const row = ROWS[y] ?? "";
    let x = 0;
    while (x < W) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }
      const start = x;
      while (x < W && row[x] === "#") x += 1;
      const width = x - start;
      const key = `${start}:${width}`;
      const previous = active.get(key);
      if (previous !== undefined) {
        previous.height += 1;
        next.set(key, previous);
      } else {
        const block = { x: start, y, width, height: 1 };
        blocks.push(block);
        next.set(key, block);
      }
    }
    active = next;
  }
  return blocks;
}

const blocks = buildingBlocks();

function CameraGlyph({ cell, label }: { cell: number; label: string }) {
  const { x, y } = xy(cell);
  const cx = x * CELL_SIZE + CELL_SIZE - 10;
  const cy = y * CELL_SIZE + 10;
  return (
    <g transform={`translate(${cx} ${cy})`} className="map-camera">
      <title>{label}</title>
      <circle className="map-camera__focus" r="12" />
      <circle className="map-camera__hit" r="14" />
      <path d="M-6-3H2L5-1V4H-6Z" />
      <circle cx="-3" cy="1" r="2" />
      <path d="M2-3L4-6H7" />
    </g>
  );
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  return `${Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    return `${index === 0 ? "M" : "L"}${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius}`;
  }).join(" ")} Z`;
}

export function MapBoard({
  cells,
  orders,
  selectedDetective,
  search,
  onSelectDetective,
  onOrdersChange,
  onSearchToggle,
}: MapBoardProps) {
  const [keyboardTarget, setKeyboardTarget] = useState<number | null>(null);
  const [focusedDetective, setFocusedDetective] = useState<number | null>(null);
  const [activeCamera, setActiveCamera] = useState<number | null>(null);
  const from = cells[selectedDetective] ?? 0;
  const reachable = reach(bit(from), search ? 2 : 3, WALK);
  const searchReach = reach(bit(from), 2, WALK);
  const chosen = orders.to[selectedDetective] ?? from;

  useEffect(() => {
    setKeyboardTarget((current) => {
      if (
        current !== null &&
        isWalkableCell(current) &&
        (reachable & bit(current)) !== 0n &&
        !orders.to.some(
          (destination, index) => index !== selectedDetective && destination === current,
        )
      ) {
        return current;
      }
      return orders.to[selectedDetective] ?? from;
    });
  }, [from, orders.to, reachable, selectedDetective]);

  function occupiedByOther(cell: number): boolean {
    return orders.to.some(
      (destination, index) => index !== selectedDetective && destination === cell,
    );
  }

  function chooseCell(cell: number) {
    const detective = orders.to.indexOf(cell);
    if (detective !== -1) {
      onSelectDetective(detective);
      return;
    }
    if ((reachable & bit(cell)) === 0n || !isWalkableCell(cell)) return;
    const to = [...orders.to] as DetectiveCells;
    to[selectedDetective] = cell;
    onOrdersChange({ ...orders, to });
  }

  function navigateTarget(dx: number, dy: number) {
    if (keyboardTarget === null) return;
    const start = xy(keyboardTarget);
    for (let distance = 1; distance <= 3; distance += 1) {
      const x = start.x + dx * distance;
      const y = start.y + dy * distance;
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const cell = idx(x, y);
      if (isWalkableCell(cell) && (reachable & bit(cell)) !== 0n && !occupiedByOther(cell)) {
        setKeyboardTarget(cell);
        return;
      }
    }
  }

  function confirmTarget() {
    if (keyboardTarget === null) return;
    if (
      !isWalkableCell(keyboardTarget) ||
      (reachable & bit(keyboardTarget)) === 0n ||
      occupiedByOther(keyboardTarget)
    ) {
      return;
    }
    chooseCell(keyboardTarget);
  }

  const camera = CAMERAS.find((entry) => entry.cell === activeCamera);
  const cameraPosition = camera === undefined ? null : xy(camera.cell);
  const targetPosition = keyboardTarget === null ? null : xy(keyboardTarget);
  const preview = search ? plus(chosen) : 0n;

  return (
    <div className="map-sheet paper">
      <div className="map-canvas">
        <svg
          className="map-svg"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          aria-label="City map. Tab to a detective pin, use arrow keys to choose a reachable cell, Enter to confirm, and S to toggle search."
        >
          <title>City map</title>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="var(--paper)" />

          <g className="map-streets">
            {verticalStreets.map((position) => (
              <line
                key={`vertical-${position}`}
                x1={position}
                y1="0"
                x2={position}
                y2={MAP_HEIGHT}
              />
            ))}
            {horizontalStreets.map((position) => (
              <line
                key={`horizontal-${position}`}
                x1="0"
                y1={position}
                x2={MAP_WIDTH}
                y2={position}
              />
            ))}
          </g>

          <g className="map-buildings">
            {blocks.map((block) => (
              <rect
                key={`${block.x}:${block.y}:${block.width}:${block.height}`}
                x={block.x * CELL_SIZE}
                y={block.y * CELL_SIZE}
                width={block.width * CELL_SIZE}
                height={block.height * CELL_SIZE}
              />
            ))}
          </g>

          <g className="map-river">
            <rect y={5 * CELL_SIZE} width={MAP_WIDTH} height={CELL_SIZE} />
            {waveOffsets.map((offset) => (
              <path
                key={`wave-${offset}`}
                d={`M0 ${5 * CELL_SIZE + 5 + offset} Q30 ${5 * CELL_SIZE + offset} 60 ${5 * CELL_SIZE + 5 + offset} T120 ${5 * CELL_SIZE + 5 + offset} T180 ${5 * CELL_SIZE + 5 + offset} T240 ${5 * CELL_SIZE + 5 + offset} T300 ${5 * CELL_SIZE + 5 + offset} T360 ${5 * CELL_SIZE + 5 + offset} T420 ${5 * CELL_SIZE + 5 + offset} T480 ${5 * CELL_SIZE + 5 + offset}`}
              />
            ))}
          </g>

          <g className="map-bridges">
            {[2, 8].map((x) => (
              <g key={`bridge-${x}`}>
                <rect x={x * CELL_SIZE} y={5 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} />
                {plankOffsets.map((offset) => (
                  <line
                    key={`plank-${x}-${offset}`}
                    x1={x * CELL_SIZE + 4}
                    y1={5 * CELL_SIZE + offset}
                    x2={(x + 1) * CELL_SIZE - 4}
                    y2={5 * CELL_SIZE + offset}
                  />
                ))}
              </g>
            ))}
          </g>

          <g className="map-reach">
            {allCells.map((cell) => {
              if ((reachable & bit(cell)) === 0n) return null;
              const { x, y } = xy(cell);
              const near = (searchReach & bit(cell)) !== 0n;
              return (
                <rect
                  key={`reach-${cell}`}
                  x={x * CELL_SIZE}
                  y={y * CELL_SIZE}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  opacity={near ? 0.18 : 0.09}
                />
              );
            })}
          </g>

          {search ? (
            <g className="map-plus-preview">
              {allCells.map((cell) => {
                if ((preview & bit(cell)) === 0n) return null;
                const { x, y } = xy(cell);
                return (
                  <rect
                    key={`plus-${cell}`}
                    x={x * CELL_SIZE + 3}
                    y={y * CELL_SIZE + 3}
                    width={CELL_SIZE - 6}
                    height={CELL_SIZE - 6}
                    rx="2"
                  />
                );
              })}
            </g>
          ) : null}

          {focusedDetective === selectedDetective && targetPosition !== null ? (
            <g className="map-keyboard-target">
              <rect
                x={targetPosition.x * CELL_SIZE + 2}
                y={targetPosition.y * CELL_SIZE + 2}
                width={CELL_SIZE - 4}
                height={CELL_SIZE - 4}
                rx="2"
              />
            </g>
          ) : null}

          <g className="map-margin-labels">
            {columnLabels.map((label, index) => (
              <text
                key={`column-${label}`}
                className="map-label map-label--column"
                x={index * CELL_SIZE + CELL_SIZE / 2}
                y="-10"
              >
                {label}
              </text>
            ))}
            {rowLabels.map((row) => (
              <text
                key={`row-${row}`}
                className="map-label map-label--row"
                x="-10"
                y={(row - 1) * CELL_SIZE + CELL_SIZE / 2}
              >
                {row}
              </text>
            ))}
          </g>

          <g className="map-exits">
            {EXITS.map((exit) => {
              const { x, y } = xy(exit.cell);
              const cx = x * CELL_SIZE + CELL_SIZE / 2;
              const cy = y * CELL_SIZE + CELL_SIZE / 2;
              const label =
                exit.id === 1
                  ? { x: -4, y: cy, anchor: "middle" as const, rotate: 90 }
                  : {
                      x: MAP_WIDTH + 4,
                      y: exit.id === 0 ? cy : exit.id === 2 ? cy : MAP_HEIGHT - 20,
                      anchor: "middle" as const,
                      rotate: -90,
                    };
              return (
                <g key={`exit-${exit.id}`}>
                  <rect
                    className="map-exit__gate"
                    x={cx - 10}
                    y={cy - 10}
                    width="20"
                    height="20"
                    rx="2"
                  />
                  <path d={`M${cx - 5} ${cy - 10}V${cy + 10}M${cx + 5} ${cy - 10}V${cy + 10}`} />
                  <text
                    className="map-exit__label"
                    x={label.x}
                    y={label.y}
                    textAnchor={label.anchor}
                    dominantBaseline="central"
                    transform={`rotate(${label.rotate} ${label.x} ${label.y})`}
                  >
                    {exit.name.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </g>

          <path
            className="map-precinct"
            d={starPath(
              xy(PRECINCT[0].cell).x * CELL_SIZE + 8,
              xy(PRECINCT[0].cell).y * CELL_SIZE + 8,
              6,
              2.5,
            )}
          />

          <g className="map-cells">
            {allCells.map((cell) => {
              if (!isWalkableCell(cell)) return null;
              const { x, y } = xy(cell);
              const cellReachable = (reachable & bit(cell)) !== 0n;
              const occupied = orders.to.includes(cell);
              const near = (searchReach & bit(cell)) !== 0n;
              const cellLabel = `${columnLabels[x]}${y + 1}`;
              const tooltip = cellReachable
                ? near
                  ? `Cell ${cellLabel} — reachable in up to 2 steps; you can search here`
                  : `Cell ${cellLabel} — reachable only by sprinting 3 steps; no search here`
                : `Cell ${cellLabel} — not reachable from ${DETECTIVES[selectedDetective]}; buildings and water cannot be entered`;
              return (
                // biome-ignore lint/a11y/useSemanticElements: Interactive SVG cells cannot contain HTML buttons.
                <rect
                  key={`cell-${cell}`}
                  className={`map-cell${cellReachable ? " map-cell--reachable" : ""}`}
                  data-cell={cell}
                  x={x * CELL_SIZE}
                  y={y * CELL_SIZE}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  role="button"
                  aria-label={tooltip}
                  aria-disabled={!cellReachable && !occupied}
                  tabIndex={-1}
                  onClick={() => chooseCell(cell)}
                >
                  <title>{tooltip}</title>
                </rect>
              );
            })}
          </g>

          <g className="map-cameras">
            {CAMERAS.map((entry) => (
              // biome-ignore lint/a11y/useSemanticElements: Interactive SVG glyphs cannot contain HTML buttons.
              <g
                key={`camera-${entry.id}`}
                className="map-camera-control"
                role="button"
                tabIndex={0}
                aria-label={`Camera ${entry.id}, ${entry.label}`}
                onMouseEnter={() => setActiveCamera(entry.cell)}
                onMouseLeave={() => setActiveCamera(null)}
                onFocus={() => setActiveCamera(entry.cell)}
                onBlur={() => setActiveCamera(null)}
                onClick={() => setActiveCamera(entry.cell)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveCamera(entry.cell);
                  }
                }}
              >
                <CameraGlyph cell={entry.cell} label={`Camera ${entry.id} — ${entry.label}`} />
              </g>
            ))}
          </g>

          <g className="map-pins">
            {DETECTIVES.map((name, index) => (
              <Pin
                key={name}
                cell={orders.to[index] ?? cells[index] ?? 0}
                initial={name[0] ?? "?"}
                name={name}
                selected={selectedDetective === index}
                targetCell={focusedDetective === index ? keyboardTarget : null}
                onSelect={() => {
                  setFocusedDetective(index);
                  onSelectDetective(index);
                }}
                onBlur={() => setFocusedDetective(null)}
                onNavigate={navigateTarget}
                onConfirm={confirmTarget}
                onToggleSearch={() => onSearchToggle(index)}
              />
            ))}
          </g>
        </svg>
        {camera !== undefined && cameraPosition !== null ? (
          <div
            className="map-tooltip"
            role="tooltip"
            style={{
              left: `${((cameraPosition.x + 0.5) / W) * 100}%`,
              top: `${((cameraPosition.y + 0.5) / H) * 100}%`,
            }}
          >
            Camera {camera.id} — {camera.label}
          </div>
        ) : null}
      </div>
      <details
        className="map-key"
        open
        style={{
          marginTop: "var(--space-3)",
          color: "var(--chalk-2)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono)",
          lineHeight: "var(--leading-mono)",
        }}
      >
        <summary style={{ cursor: "pointer", color: "var(--chalk)" }}>
          Map key — what can I do?
        </summary>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2) var(--space-4)",
            marginTop: "var(--space-2)",
          }}
        >
          <span>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "14px",
                height: "8px",
                marginRight: "6px",
                background: "var(--brass)",
                opacity: 0.5,
              }}
            />
            brass tint — you can move here and search
          </span>
          <span>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "14px",
                height: "8px",
                marginRight: "6px",
                background: "var(--brass)",
                opacity: 0.2,
              }}
            />
            faint tint — sprint only, no search
          </span>
          <span>dashed outline — search preview</span>
          <span>tan blocks / blue water — cannot enter</span>
          <span>red gates — exits the fugitive can use</span>
          <span>camera ring — public sighting</span>
          <span>NOTHING / COLD / FRESH — no trail / cold trail / fresh trail, always true</span>
        </div>
      </details>
      <p className="sr-only" aria-live="polite">
        {focusedDetective !== null && keyboardTarget !== null
          ? `${DETECTIVES[focusedDetective]} target cell ${keyboardTarget}. Enter to confirm.`
          : ""}
      </p>
    </div>
  );
}
