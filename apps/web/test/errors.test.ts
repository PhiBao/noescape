import { afterEach, describe, expect, it, vi } from "vitest";
import { retryDelay, withRetry } from "../src/chain/clients.ts";
import { mapError } from "../src/chain/errors.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("error mapping", () => {
  it.each([
    ["TooSoon", "tooSoon"],
    ["AlreadyFunded", "alreadyFunded"],
    ["DailyCapReached", "dailyCapReached"],
    ["EnforcedPause", "paused"],
    ["BadOrders", "invalidOrders"],
    ["CaseActive", "activeCase"],
    ["ReportPending", "reportPending"],
    ["CaseOver", "caseOver"],
    ["NoTurns", "noTurns"],
    ["NotEnded", "notEnded"],
    ["AlreadyVerified", "alreadyVerified"],
  ])("maps %s", (name, expected) => {
    expect(mapError({ name })).toBe(expected);
  });

  it("maps provider and relayer failures", () => {
    expect(mapError(new Error("fetch failed"))).toBe("rpcUnreachable");
    expect(mapError(new Error("Zama relayer timeout"))).toBe("relayerSlow");
    expect(mapError(new Error("Account is not entitled to decrypt"))).toBe("aclRefused");
    expect(mapError(new Error("something else"))).toBe("unknown");
  });
});

describe("retry schedule", () => {
  it("uses the documented backoff and stops near 45 seconds", () => {
    expect([0, 1, 2, 3, 10].map(retryDelay)).toEqual([500, 1000, 2000, 3000, 3000]);
    const total = Array.from({ length: 17 }, (_, attempt) => retryDelay(attempt)).reduce(
      (sum, delay) => sum + delay,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(45_000);
    expect(total).toBeLessThan(46_000);
  });

  it("waits before retrying a transient failure", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ok");
    const pending = withRetry(operation);
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
