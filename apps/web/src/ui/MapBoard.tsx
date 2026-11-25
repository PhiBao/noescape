import type { DetectiveCells } from "@noescape/engine";
import { bit, DETECTIVES, H, isWalkableCell, ROWS, reach, W, WALK } from "@noescape/engine";
import type { CaseOrders } from "../game/caseMachine.ts";

interface MapBoardProps {
  cells: DetectiveCells;
  orders: CaseOrders;
  selectedDetective: number;
  search: boolean;
  onSelectDetective(index: number): void;
  onOrdersChange(orders: CaseOrders): void;
}

export function MapBoard({
  cells,
  orders,
  selectedDetective,
  search,
  onSelectDetective,
  onOrdersChange,
}: MapBoardProps) {
  const from = cells[selectedDetective] ?? 0;
  const reachable = reach(bit(from), search ? 2 : 3, WALK);

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

  return (
    <fieldset
      aria-label="City map"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${W}, 30px)`,
        gridAutoRows: "30px",
        gap: "2px",
        width: "max-content",
        margin: 0,
        padding: 0,
        border: 0,
      }}
    >
      {Array.from({ length: H * W }, (_, cell) => {
        const x = cell % W;
        const y = Math.floor(cell / W);
        const walkable = isWalkableCell(cell);
        const canReach = walkable && (reachable & bit(cell)) !== 0n;
        const detective = orders.to.indexOf(cell);
        const selected = detective === selectedDetective;
        const terrain = ROWS[y]?.[x];
        return (
          <button
            key={`${x}:${y}`}
            type="button"
            data-cell={cell}
            aria-label={`Cell ${cell}, ${x},${y}${detective === -1 ? "" : `, ${DETECTIVES[detective]}`}${canReach ? ", reachable" : ""}`}
            disabled={!walkable}
            onClick={() => chooseCell(cell)}
            style={{
              padding: 0,
              border: selected ? "2px solid var(--brass)" : "1px solid var(--desk-line)",
              background: canReach ? "var(--paper-2)" : "var(--paper)",
              color: "var(--ink)",
              cursor: detective !== -1 || canReach ? "pointer" : "default",
              fontSize: "12px",
            }}
          >
            {detective === -1 ? (walkable ? "" : terrain) : DETECTIVES[detective]?.[0]}
          </button>
        );
      })}
    </fieldset>
  );
}
