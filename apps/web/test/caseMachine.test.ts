import { PRECINCT } from "@noescape/engine";
import { describe, expect, it } from "vitest";
import {
  type CaseEvent,
  type CaseMachineState,
  type CaseOutcome,
  caseReducer,
  initialCaseState,
} from "../src/game/caseMachine.ts";

const cells: [number, number, number] = [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell];

function hydrated(
  overrides: Partial<Extract<CaseEvent, { type: "HYDRATED" }>> = {},
): CaseMachineState {
  return caseReducer(initialCaseState(), {
    type: "HYDRATED",
    id: 1n,
    turn: 0,
    cells,
    outcome: null,
    verified: false,
    reportResolved: true,
    revealed: false,
    ...overrides,
  });
}

function playTurn(state: CaseMachineState, outcome: CaseOutcome | null = null): CaseMachineState {
  let next = caseReducer(state, { type: "SEND_TURN" });
  next = caseReducer(next, { type: "TURN_MINED" });
  next = caseReducer(next, { type: "DECODE_STARTED" });
  return caseReducer(next, { type: "TURN_DECODED", outcome });
}

describe("case machine", () => {
  it("runs a happy path through twelve turns and verification", () => {
    let state = hydrated();
    for (let turn = 1; turn <= 12; turn += 1) {
      state = playTurn(state, turn === 12 ? "dawn" : null);
      expect(state.turn).toBe(turn);
    }
    expect(state.phase).toBe("ended");
    state = caseReducer(state, { type: "RESOLVE_STARTED" });
    state = caseReducer(state, { type: "REVEAL_STARTED" });
    state = caseReducer(state, { type: "VERIFIED" });
    expect(state.phase).toBe("verified");
    expect(state.verified).toBe(true);
  });

  it("ends on capture at turn four", () => {
    let state = hydrated();
    for (let turn = 1; turn <= 4; turn += 1) {
      state = playTurn(state, turn === 4 ? "caught" : null);
    }
    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("caught");
  });

  it("ends on escape", () => {
    let state = hydrated();
    state = playTurn(state, "escaped");
    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("escaped");
  });

  it("resumes an unresolved report at the same turn", () => {
    const state = hydrated({ turn: 3, reportResolved: false });
    expect(state.phase).toBe("decoding");
    expect(state.decodingNewTurn).toBe(false);
    const recovered = caseReducer(state, { type: "REPORT_RECOVERED" });
    expect(recovered.phase).toBe("planning");
    expect(recovered.turn).toBe(3);
  });

  it("resumes ended and revealed cases", () => {
    expect(hydrated({ turn: 4, outcome: "caught" }).phase).toBe("ended");
    expect(hydrated({ turn: 4, outcome: "caught", revealed: true }).phase).toBe("revealing");
    expect(hydrated({ turn: 4, outcome: "caught", verified: true }).phase).toBe("verified");
  });

  it("returns to the failed step on retry", () => {
    let state = hydrated();
    state = caseReducer(state, { type: "SEND_TURN" });
    state = caseReducer(state, { type: "TURN_MINED" });
    state = caseReducer(state, { type: "DECODE_STARTED" });
    state = caseReducer(state, { type: "FAILED", kind: "relayerSlow", retryTo: "decoding" });
    expect(state.phase).toBe("error");
    state = caseReducer(state, { type: "RETRY" });
    expect(state.phase).toBe("decoding");
    expect(state.decodingNewTurn).toBe(true);
  });

  it("blocks invalid orders", () => {
    let state = hydrated();
    state = caseReducer(state, {
      type: "ORDERS_CHANGED",
      orders: { to: [119, 30, 41], searchFlags: 0b111 },
    });
    expect(state.orderError).not.toBeNull();
    const blocked = caseReducer(state, { type: "SEND_TURN" });
    expect(blocked.phase).toBe("planning");
  });
});
