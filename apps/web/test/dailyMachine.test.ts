import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import {
  type DailyEvent,
  type DailyState,
  dailyReducer,
  initialDailyState,
} from "../src/game/dailyMachine.ts";

const tx = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;
const winner = "0x0000000000000000000000000000000000000001" as Address;

function run(state: DailyState, events: DailyEvent[]): DailyState {
  return events.reduce(dailyReducer, state);
}

function joined(watch = 5, lastWatch = 4): DailyState {
  return dailyReducer(initialDailyState(), {
    type: "HYDRATED",
    day: 20782,
    watch,
    joined: true,
    cell: 29,
    lastWatch,
    actions: 1,
    status: 1,
    winner: null,
    verified: false,
  });
}

describe("daily machine", () => {
  it("runs the four join steps before planning", () => {
    let state = dailyReducer(initialDailyState(), { type: "KEY_READY" });
    state = run(state, [
      { type: "MINT_STARTED" },
      { type: "MINT_DONE", tx },
      { type: "APPROVE_STARTED" },
      { type: "APPROVE_DONE", tx },
      { type: "WRAP_STARTED" },
      { type: "WRAP_DONE", tx },
      { type: "OPERATOR_STARTED" },
      { type: "OPERATOR_DONE", tx },
      { type: "JOIN_STARTED" },
      { type: "JOIN_DONE", day: 20782, cell: 29, tx },
    ]);
    expect(state.phase).toBe("planning");
    expect(state.joined).toBe(true);
    expect(state.tx.mint).toBe(tx);
    expect(state.tx.approve).toBe(tx);
    expect(state.tx.wrap).toBe(tx);
    expect(state.tx.operator).toBe(tx);
    expect(state.tx.join).toBe(tx);
  });

  it("permits one hunt per watch", () => {
    const already = run(joined(5, 5), [{ type: "HUNT_STARTED" }]);
    expect(already.phase).toBe("planning");
    const fresh = run(joined(5, 4), [
      { type: "HUNT_STARTED" },
      { type: "HUNT_MINED", tx },
      { type: "HUNT_DECODED", watch: 5, actions: 2 },
    ]);
    expect(fresh.phase).toBe("planning");
    expect(fresh.lastWatch).toBe(5);
    expect(fresh.actions).toBe(2);
    expect(run(fresh, [{ type: "HUNT_STARTED" }]).phase).toBe("planning");
  });

  it("claims a capture and ends the day", () => {
    const state = run(joined(), [
      { type: "HUNT_STARTED" },
      { type: "HUNT_MINED", tx },
      { type: "HUNT_DECODED", watch: 5, actions: 2 },
      { type: "CLAIM_STARTED" },
      { type: "CLAIM_DONE", winner, tx },
    ]);
    expect(state.phase).toBe("dayOver");
    expect(state.status).toBe(2);
    expect(state.winner).toBe(winner);
    expect(state.tx.claim).toBe(tx);
  });

  it("shows day-over and verified states", () => {
    const over = dailyReducer(initialDailyState(), {
      type: "HYDRATED",
      day: 20782,
      watch: 5,
      joined: false,
      cell: 0,
      lastWatch: 0,
      actions: 0,
      status: 3,
      winner: null,
      verified: false,
    });
    expect(over.phase).toBe("dayOver");
    expect(dailyReducer(over, { type: "VERIFIED" }).phase).toBe("verified");
  });
});
