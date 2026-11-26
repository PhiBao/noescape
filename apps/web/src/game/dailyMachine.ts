import type { Address, Hex } from "viem";
import type { ErrorKey } from "../chain/errors.ts";

export type DailyPhase =
  | "noKey"
  | "idle"
  | "minting"
  | "approving"
  | "wrapping"
  | "operator"
  | "joining"
  | "planning"
  | "hunting"
  | "decoding"
  | "claiming"
  | "dayOver"
  | "verified"
  | "error";

export interface DailyOrders {
  to: number;
  search: boolean;
}

export interface DailyTx {
  mint?: Hex;
  approve?: Hex;
  wrap?: Hex;
  operator?: Hex;
  join?: Hex;
  hunt?: Hex;
  claim?: Hex;
}

export interface DailyState {
  phase: DailyPhase;
  day: number | null;
  watch: number;
  joined: boolean;
  cell: number;
  lastWatch: number;
  actions: number;
  status: number;
  winner: Address | null;
  verified: boolean;
  orders: DailyOrders;
  tx: DailyTx;
  error: { kind: ErrorKey; retryTo: DailyPhase } | null;
}

export type DailyEvent =
  | { type: "KEY_READY" }
  | {
      type: "HYDRATED";
      day: number;
      watch: number;
      joined: boolean;
      cell: number;
      lastWatch: number;
      actions: number;
      status: number;
      winner: Address | null;
      verified: boolean;
    }
  | { type: "MINT_STARTED" }
  | { type: "MINT_DONE"; tx: Hex }
  | { type: "APPROVE_STARTED" }
  | { type: "APPROVE_DONE"; tx: Hex }
  | { type: "WRAP_STARTED" }
  | { type: "WRAP_DONE"; tx: Hex }
  | { type: "OPERATOR_STARTED" }
  | { type: "OPERATOR_DONE"; tx: Hex }
  | { type: "JOIN_STARTED" }
  | { type: "JOIN_DONE"; day: number; cell: number; tx: Hex }
  | { type: "ORDERS_CHANGED"; orders: DailyOrders }
  | { type: "HUNT_STARTED" }
  | { type: "HUNT_MINED"; tx: Hex }
  | { type: "HUNT_DECODED"; watch: number; actions: number }
  | { type: "CLAIM_STARTED" }
  | { type: "CLAIM_DONE"; winner: Address; tx: Hex }
  | { type: "DAY_OVER"; status: number; winner: Address | null }
  | { type: "VERIFIED" }
  | { type: "FAILED"; kind: ErrorKey; retryTo: DailyPhase }
  | { type: "RETRY" };

export function initialDailyState(): DailyState {
  return {
    phase: "noKey",
    day: null,
    watch: 0,
    joined: false,
    cell: 0,
    lastWatch: 0,
    actions: 0,
    status: 0,
    winner: null,
    verified: false,
    orders: { to: 0, search: true },
    tx: {},
    error: null,
  };
}

export function dailyReducer(state: DailyState, event: DailyEvent): DailyState {
  switch (event.type) {
    case "KEY_READY":
      return state.phase === "noKey" ? { ...state, phase: "idle" } : state;
    case "HYDRATED":
      return {
        ...state,
        phase:
          event.status === 2 || event.status === 3
            ? "dayOver"
            : event.verified
              ? "verified"
              : event.joined
                ? "planning"
                : "idle",
        day: event.day,
        watch: event.watch,
        joined: event.joined,
        cell: event.cell,
        lastWatch: event.lastWatch,
        actions: event.actions,
        status: event.status,
        winner: event.winner,
        verified: event.verified,
        orders: { ...state.orders, to: event.cell },
        error: null,
      };
    case "MINT_STARTED":
      return { ...state, phase: "minting", error: null };
    case "MINT_DONE":
      return { ...state, phase: "approving", tx: { ...state.tx, mint: event.tx } };
    case "APPROVE_STARTED":
      return { ...state, phase: "approving", error: null };
    case "APPROVE_DONE":
      return { ...state, phase: "wrapping", tx: { ...state.tx, approve: event.tx } };
    case "WRAP_STARTED":
      return { ...state, phase: "wrapping", error: null };
    case "WRAP_DONE":
      return { ...state, phase: "operator", tx: { ...state.tx, wrap: event.tx } };
    case "OPERATOR_STARTED":
      return { ...state, phase: "operator", error: null };
    case "OPERATOR_DONE":
      return { ...state, phase: "joining", tx: { ...state.tx, operator: event.tx } };
    case "JOIN_STARTED":
      return { ...state, phase: "joining", error: null };
    case "JOIN_DONE":
      return {
        ...state,
        phase: "planning",
        joined: true,
        day: event.day,
        cell: event.cell,
        orders: { ...state.orders, to: event.cell },
        tx: { ...state.tx, join: event.tx },
      };
    case "ORDERS_CHANGED":
      return state.phase === "planning" ? { ...state, orders: event.orders } : state;
    case "HUNT_STARTED":
      return state.phase === "planning" && state.watch > state.lastWatch
        ? { ...state, phase: "hunting", error: null }
        : state;
    case "HUNT_MINED":
      return state.phase === "hunting"
        ? { ...state, phase: "decoding", tx: { ...state.tx, hunt: event.tx } }
        : state;
    case "HUNT_DECODED":
      return state.phase === "decoding"
        ? {
            ...state,
            phase: "planning",
            cell: state.orders.to,
            lastWatch: event.watch,
            actions: event.actions,
          }
        : state;
    case "CLAIM_STARTED":
      return { ...state, phase: "claiming", error: null };
    case "CLAIM_DONE":
      return {
        ...state,
        phase: "dayOver",
        status: 2,
        winner: event.winner,
        tx: { ...state.tx, claim: event.tx },
      };
    case "DAY_OVER":
      return { ...state, phase: "dayOver", status: event.status, winner: event.winner };
    case "VERIFIED":
      return state.phase === "dayOver" ? { ...state, phase: "verified", verified: true } : state;
    case "FAILED":
      return { ...state, phase: "error", error: { kind: event.kind, retryTo: event.retryTo } };
    case "RETRY":
      return state.phase === "error" && state.error !== null
        ? { ...state, phase: state.error.retryTo, error: null }
        : state;
  }
}
