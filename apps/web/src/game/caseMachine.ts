import type { DetectiveCells } from "@noescape/engine";
import { PRECINCT, validOrders } from "@noescape/engine";
import type { ErrorKey } from "../chain/errors.ts";

export type CasePhase =
  | "noKey"
  | "funding"
  | "idle"
  | "opening"
  | "planning"
  | "sending"
  | "mining"
  | "decoding"
  | "ended"
  | "resolving"
  | "revealing"
  | "verified"
  | "error";

export type CaseOutcome = "caught" | "escaped" | "dawn" | "abandoned";

export interface CaseOrders {
  to: DetectiveCells;
  searchFlags: number;
}

export interface CaseMachineState {
  phase: CasePhase;
  caseId: bigint | null;
  turn: number;
  cells: DetectiveCells;
  orders: CaseOrders;
  outcome: CaseOutcome | null;
  verified: boolean;
  decodingNewTurn: boolean;
  orderError: string | null;
  error: { kind: ErrorKey; retryTo: CasePhase } | null;
}

export type CaseEvent =
  | { type: "KEY_READY" }
  | { type: "FUEL_READY" }
  | { type: "OPEN_STARTED" }
  | { type: "OPENED"; id: bigint }
  | {
      type: "HYDRATED";
      id: bigint;
      turn: number;
      cells: DetectiveCells;
      outcome: CaseOutcome | null;
      verified: boolean;
      reportResolved: boolean;
      revealed: boolean;
    }
  | { type: "ORDERS_CHANGED"; orders: CaseOrders }
  | { type: "SEND_TURN" }
  | { type: "TURN_MINED" }
  | { type: "DECODE_STARTED" }
  | { type: "TURN_DECODED"; outcome: CaseOutcome | null }
  | { type: "REPORT_RECOVERED"; outcome?: CaseOutcome | null }
  | { type: "RESOLVE_STARTED" }
  | { type: "REVEAL_STARTED" }
  | { type: "VERIFIED" }
  | { type: "FAILED"; kind: ErrorKey; retryTo: CasePhase }
  | { type: "RETRY" }
  | { type: "RESET" };

const precinctCells: DetectiveCells = [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell];

export function initialCaseState(): CaseMachineState {
  return {
    phase: "noKey",
    caseId: null,
    turn: 0,
    cells: [...precinctCells],
    orders: { to: [...precinctCells], searchFlags: 0b111 },
    outcome: null,
    verified: false,
    decodingNewTurn: false,
    orderError: null,
    error: null,
  };
}

function withOrders(state: CaseMachineState, orders: CaseOrders): CaseMachineState {
  const check = validOrders(state.cells, orders.to, orders.searchFlags);
  return {
    ...state,
    orders,
    orderError: check.ok ? null : `${check.reason}: detective ${check.detective}`,
  };
}

export function caseReducer(state: CaseMachineState, event: CaseEvent): CaseMachineState {
  switch (event.type) {
    case "RESET":
      return initialCaseState();
    case "KEY_READY":
      return state.phase === "noKey" ? { ...state, phase: "funding" } : state;
    case "FUEL_READY":
      return state.phase === "funding" ? { ...state, phase: "idle" } : state;
    case "OPEN_STARTED":
      return state.phase === "idle" ? { ...state, phase: "opening" } : state;
    case "OPENED":
      return state.phase === "opening"
        ? {
            ...state,
            phase: "planning",
            caseId: event.id,
            turn: 0,
            cells: [...precinctCells],
            orders: { to: [...precinctCells], searchFlags: 0b111 },
            outcome: null,
            verified: false,
            orderError: null,
            error: null,
          }
        : state;
    case "HYDRATED":
      return {
        ...state,
        caseId: event.id,
        turn: event.turn,
        cells: [...event.cells],
        orders: { to: [...event.cells], searchFlags: 0b111 },
        outcome: event.outcome,
        verified: event.verified,
        decodingNewTurn: false,
        orderError: null,
        error: null,
        phase: event.verified
          ? "verified"
          : event.outcome !== null
            ? event.revealed
              ? "revealing"
              : "ended"
            : event.turn > 0 && !event.reportResolved
              ? "decoding"
              : "planning",
      };
    case "ORDERS_CHANGED":
      return state.phase === "planning" ? withOrders(state, event.orders) : state;
    case "SEND_TURN":
      return state.phase === "planning" && state.orderError === null
        ? { ...state, phase: "sending", error: null }
        : state;
    case "TURN_MINED":
      return state.phase === "sending" ? { ...state, phase: "mining" } : state;
    case "DECODE_STARTED":
      return state.phase === "mining"
        ? { ...state, phase: "decoding", decodingNewTurn: true }
        : state;
    case "TURN_DECODED":
      return state.phase === "decoding" && state.decodingNewTurn
        ? {
            ...state,
            phase: event.outcome === null ? "planning" : "ended",
            turn: state.turn + 1,
            cells: [...state.orders.to],
            orders: { to: [...state.orders.to], searchFlags: 0b111 },
            outcome: event.outcome,
            decodingNewTurn: false,
            orderError: null,
          }
        : state;
    case "REPORT_RECOVERED":
      return state.phase === "decoding" && !state.decodingNewTurn
        ? {
            ...state,
            phase: event.outcome == null ? "planning" : "ended",
            outcome: event.outcome ?? null,
            decodingNewTurn: false,
            orderError: null,
          }
        : state;
    case "RESOLVE_STARTED":
      return state.phase === "ended" ? { ...state, phase: "resolving" } : state;
    case "REVEAL_STARTED":
      return state.phase === "resolving" ? { ...state, phase: "revealing" } : state;
    case "VERIFIED":
      return state.phase === "revealing" ? { ...state, phase: "verified", verified: true } : state;
    case "FAILED":
      return { ...state, phase: "error", error: { kind: event.kind, retryTo: event.retryTo } };
    case "RETRY":
      return state.phase === "error" && state.error !== null
        ? { ...state, phase: state.error.retryTo, error: null }
        : state;
  }
}
