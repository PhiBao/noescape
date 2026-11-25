import type { CaseOutcome } from "./caseMachine.ts";

export interface ShareCase {
  caseId: bigint;
  outcome: CaseOutcome;
  hour: string;
  searches: number;
  fresh: number;
  sightings: number;
  exitName?: string;
  url: string;
  verified: boolean;
}

function headline(input: ShareCase): string {
  if (input.outcome === "caught") return `caught at ${input.hour}`;
  if (input.outcome === "escaped") {
    return `it escaped via the ${input.exitName ?? "exit"} at ${input.hour}`;
  }
  if (input.outcome === "dawn") return `it got away at dawn at ${input.hour}`;
  return `abandoned at ${input.hour}`;
}

export function shareLine(input: ShareCase): string {
  const sightings = `${input.sightings} ${input.sightings === 1 ? "sighting" : "sightings"}`;
  const status = input.verified ? "verified onchain" : "verification pending";
  return (
    `noescape case #${input.caseId.toString()} — ${headline(input)} · ` +
    `${input.searches} searches · ${input.fresh} FRESH · ${sightings} · ` +
    `${status} ${input.url}/case/${input.caseId.toString()}/file`
  );
}
