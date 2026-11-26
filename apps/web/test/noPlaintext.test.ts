import { PRECINCT } from "@noescape/engine";
import { describe, expect, it } from "vitest";
import {
  type CaseEvent,
  type CaseMachineState,
  caseReducer,
  initialCaseState,
} from "../src/game/caseMachine.ts";

const cells = [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell] as [number, number, number];
const PLAINTEXT = { code: 987654321, report: 987654322 };
const FORBIDDEN_KEYS = ["code", "codes", "report", "clear", "plaintext", "decodedValue"];

function assertNoPlaintext(state: CaseMachineState): void {
  for (const key of Object.keys(state)) {
    expect(FORBIDDEN_KEYS).not.toContain(key);
  }
  const json = JSON.stringify(state, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  expect(json).not.toContain(String(PLAINTEXT.code));
  expect(json).not.toContain(String(PLAINTEXT.report));
}

function withExtraFields(event: CaseEvent): CaseEvent {
  return { ...event, ...PLAINTEXT } as CaseEvent;
}

describe("no plaintext in the case machine", () => {
  it("carries no code or report value through a full turn", () => {
    let state = caseReducer(initialCaseState(), { type: "KEY_READY" });
    state = caseReducer(state, { type: "FUEL_READY" });
    state = caseReducer(state, { type: "OPEN_STARTED" });
    assertNoPlaintext(state);
    state = caseReducer(state, withExtraFields({ type: "OPENED", id: 1n }));
    assertNoPlaintext(state);
    state = caseReducer(state, { type: "SEND_TURN" });
    assertNoPlaintext(state);
    state = caseReducer(state, { type: "TURN_MINED" });
    assertNoPlaintext(state);
    state = caseReducer(state, { type: "DECODE_STARTED" });
    expect(state.phase).toBe("decoding");
    expect(state.outcome).toBe(null);
    assertNoPlaintext(state);
    state = caseReducer(state, withExtraFields({ type: "TURN_DECODED", outcome: null }));
    expect(state.phase).toBe("planning");
    assertNoPlaintext(state);
  });

  it("does not expose a resumed report before its decrypt effect resolves", () => {
    let state = caseReducer(initialCaseState(), {
      type: "HYDRATED",
      id: 1n,
      turn: 4,
      cells,
      outcome: null,
      verified: false,
      reportResolved: false,
      revealed: false,
    });
    expect(state.phase).toBe("decoding");
    expect(state.outcome).toBe(null);
    assertNoPlaintext(state);
    state = caseReducer(state, withExtraFields({ type: "REPORT_RECOVERED", outcome: "escaped" }));
    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("escaped");
    assertNoPlaintext(state);
  });

  it("keeps hydration and failure states free of decrypted values", () => {
    let state = caseReducer(initialCaseState(), {
      type: "HYDRATED",
      id: 2n,
      turn: 2,
      cells,
      outcome: null,
      verified: false,
      reportResolved: true,
      revealed: false,
    });
    expect(state.phase).toBe("planning");
    assertNoPlaintext(state);
    state = caseReducer(state, { type: "FAILED", kind: "relayerSlow", retryTo: "decoding" });
    expect(state.phase).toBe("error");
    assertNoPlaintext(state);
    state = caseReducer(state, { type: "RETRY" });
    expect(state.phase).toBe("decoding");
    assertNoPlaintext(state);
  });
});
