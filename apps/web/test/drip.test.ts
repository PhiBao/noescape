import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandler, type DripDependencies } from "../api/drip.ts";

const ADDRESS = "0x0000000000000000000000000000000000000001";
const TOKEN = "turnstile-token-must-not-be-logged";
const TX_HASH = `0x${"ab".repeat(32)}` as const;

function dependencies(): DripDependencies {
  return {
    verifyTurnstile: vi.fn(async () => true),
    simulate: vi.fn(async () => undefined),
    write: vi.fn(async () => TX_HASH),
  };
}

function request(
  method = "POST",
  body: unknown = { address: ADDRESS, token: TOKEN },
  headers: Record<string, string> = {},
): VercelRequest {
  return {
    method,
    body,
    headers,
    socket: { remoteAddress: "203.0.113.1" },
  } as unknown as VercelRequest;
}

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as VercelResponse & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

let logs: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logs = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  logs.mockRestore();
});

describe("drip handler", () => {
  it("rejects non-POST requests", async () => {
    const deps = dependencies();
    const res = response();
    await createHandler(deps)(request("GET"), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("rejects bad input", async () => {
    const deps = dependencies();
    const res = response();
    await createHandler(deps)(request("POST", { address: "nope", token: TOKEN }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    await createHandler(deps)(request("POST", { address: ADDRESS }), response());
    expect(deps.simulate).not.toHaveBeenCalled();
  });

  it("rejects a failed Turnstile challenge", async () => {
    const deps = dependencies();
    deps.verifyTurnstile = vi.fn(async () => false);
    const res = response();
    await createHandler(deps)(request(), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(deps.simulate).not.toHaveBeenCalled();
  });

  it.each([
    ["AlreadyFunded", 409],
    ["TooSoon", 409],
    ["DailyCapReached", 429],
    ["EnforcedPause", 503],
  ])("maps %s to HTTP %i", async (name, status) => {
    const deps = dependencies();
    deps.simulate = vi.fn(async () => {
      throw { name };
    });
    const res = response();
    await createHandler(deps)(request(), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(deps.write).not.toHaveBeenCalled();
  });

  it("writes one drip and never logs the token", async () => {
    const deps = dependencies();
    const res = response();
    await createHandler(deps)(request(), res);
    expect(deps.simulate).toHaveBeenCalledWith(ADDRESS);
    expect(deps.write).toHaveBeenCalledWith(ADDRESS);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ txHash: TX_HASH });
    expect(JSON.stringify(logs.mock.calls)).not.toContain(TOKEN);
  });

  it("returns a generic 500 when the write fails", async () => {
    const deps = dependencies();
    deps.write = vi.fn(async () => {
      throw new Error("rpc disappeared");
    });
    const res = response();
    await createHandler(deps)(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "unknown" });
  });
});
