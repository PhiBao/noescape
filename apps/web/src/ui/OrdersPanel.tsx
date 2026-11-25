import { DETECTIVES, type OrderCheck, validOrders, xy } from "@noescape/engine";
import { Link } from "wouter";
import type { CaseMachineState } from "../game/caseMachine.ts";
import { Button } from "./Button.tsx";

interface OrdersPanelProps {
  state: CaseMachineState;
  selectedDetective: number;
  onSelectDetective(index: number): void;
  onSearchToggle(index: number): void;
  onSend(): void;
  onRetry(): void;
}

const phaseCopy: Record<CaseMachineState["phase"], string> = {
  noKey: "Preparing detective key…",
  funding: "Requesting fuel…",
  idle: "Ready.",
  opening: "Opening case…",
  planning: "Give your orders.",
  sending: "Signing orders…",
  mining: "Waiting for the block…",
  decoding: "Decoding the report…",
  ended: "Case closed.",
  resolving: "Closing the case…",
  revealing: "Revealing the path…",
  verified: "Case verified.",
  error: "Something went wrong.",
};

const outcomeCopy = {
  caught: "Caught. The fugitive is in custody.",
  escaped: "Escaped. The fugitive reached the exit.",
  dawn: "Dawn. The fugitive got away.",
  abandoned: "Abandoned.",
} as const;

function cellLabel(cell: number): string {
  const { x, y } = xy(cell);
  return `${String.fromCharCode(65 + x)}${y + 1}`;
}

function reasonFor(check: OrderCheck): string | null {
  if (check.ok) return null;
  const name = DETECTIVES[check.detective] ?? "Detective";
  if (check.reason === "shared") return "Two detectives on one corner";
  if (check.reason === "notWalkable") return "That corner is sealed";
  return `${name} can't reach that corner`;
}

export function OrdersPanel({
  state,
  selectedDetective,
  onSelectDetective,
  onSearchToggle,
  onSend,
  onRetry,
}: OrdersPanelProps) {
  const check = validOrders(state.cells, state.orders.to, state.orders.searchFlags);
  const reason = reasonFor(check);
  const ended = state.phase === "ended" || state.phase === "verified";

  return (
    <section aria-label="Orders">
      <h2 style={{ marginBottom: "var(--space-3)" }}>Detectives</h2>
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        {DETECTIVES.map((name, index) => {
          const from = state.cells[index] ?? 0;
          const to = state.orders.to[index] ?? from;
          const searching = (state.orders.searchFlags & (1 << index)) !== 0;
          const disabled = state.phase !== "planning";
          return (
            <div
              key={name}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr auto auto",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <button
                type="button"
                aria-label={`Select ${name}`}
                aria-pressed={selectedDetective === index}
                onClick={() => onSelectDetective(index)}
                style={{
                  width: "24px",
                  height: "24px",
                  border:
                    selectedDetective === index
                      ? "2px solid var(--brass)"
                      : "1px solid var(--brass)",
                  borderRadius: "50%",
                  color: "var(--desk)",
                  background: "var(--brass)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {name[0]}
              </button>
              <span>{to === from ? "stays" : `→ ${cellLabel(to)}`}</span>
              <button
                type="button"
                aria-pressed={searching}
                disabled={disabled}
                onClick={() => onSearchToggle(index)}
                style={{
                  padding: "var(--space-1) var(--space-2)",
                  border: "1px solid var(--brass)",
                  borderRadius: "var(--radius)",
                  color: searching ? "var(--desk)" : "var(--chalk-2)",
                  background: searching ? "var(--brass)" : "transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                Search
              </button>
              <button
                type="button"
                aria-pressed={!searching}
                disabled={disabled}
                onClick={() => onSearchToggle(index)}
                style={{
                  padding: "var(--space-1) var(--space-2)",
                  border: "1px solid var(--desk-line)",
                  borderRadius: "var(--radius)",
                  color: !searching ? "var(--chalk)" : "var(--chalk-2)",
                  background: !searching ? "var(--desk-2)" : "transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                Sprint
              </button>
            </div>
          );
        })}
      </div>
      <p style={{ margin: "var(--space-3) 0 var(--space-2)" }}>{phaseCopy[state.phase]}</p>
      {reason !== null ? (
        <p role="alert" style={{ color: "var(--chalk-2)" }}>
          {reason}
        </p>
      ) : null}
      {state.error !== null ? (
        <>
          <p role="alert">{state.error.kind}</p>
          <Button type="button" onClick={() => void onRetry()}>
            Try again
          </Button>
        </>
      ) : null}
      {state.phase === "planning" ? (
        <Button type="button" disabled={reason !== null} onClick={() => void onSend()}>
          Send orders
        </Button>
      ) : null}
      {ended ? (
        <>
          <p>{state.outcome === null ? "" : outcomeCopy[state.outcome]}</p>
          {state.caseId !== null ? (
            <Link href={`/case/${state.caseId}/file`}>Open the case file</Link>
          ) : null}
        </>
      ) : null}
      <p style={{ marginTop: "var(--space-4)" }}>
        <Link href="/secret">How it stays secret</Link>
      </p>
    </section>
  );
}
