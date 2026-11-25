import { DETECTIVES } from "@noescape/engine";
import { Link } from "wouter";
import type { CaseMachineState } from "../game/caseMachine.ts";
import { Button } from "../ui/Button.tsx";

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
  sending: "Sending orders…",
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
};

export function OrdersPanel({
  state,
  selectedDetective,
  onSelectDetective,
  onSearchToggle,
  onSend,
  onRetry,
}: OrdersPanelProps) {
  const ended = state.phase === "ended" || state.phase === "verified";
  return (
    <section aria-label="Orders">
      <h2>Detectives</h2>
      {DETECTIVES.map((name, index) => (
        <div key={name}>
          <Button
            type="button"
            variant={selectedDetective === index ? "primary" : "secondary"}
            aria-pressed={selectedDetective === index}
            onClick={() => onSelectDetective(index)}
          >
            {name}
          </Button>{" "}
          <label>
            <input
              type="checkbox"
              checked={(state.orders.searchFlags & (1 << index)) !== 0}
              onChange={() => onSearchToggle(index)}
              disabled={state.phase !== "planning"}
            />{" "}
            Search
          </label>
        </div>
      ))}
      <p>{phaseCopy[state.phase]}</p>
      {state.orderError !== null ? <p role="alert">{state.orderError}</p> : null}
      {state.error !== null ? (
        <>
          <p role="alert">{state.error.kind}</p>
          <Button type="button" onClick={() => void onRetry()}>
            Try again
          </Button>
        </>
      ) : null}
      {state.phase === "planning" ? (
        <Button type="button" disabled={state.orderError !== null} onClick={() => void onSend()}>
          Send orders
        </Button>
      ) : null}
      {ended ? (
        <>
          <p>{state.outcome === null ? "" : outcomeCopy[state.outcome]}</p>
          {state.caseId !== null ? (
            <Link href={`/case/${state.caseId}/file`}>Case file</Link>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
