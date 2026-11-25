import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

declare const process: { env: Record<string, string | undefined> };

const gasTapDripAbi = [
  {
    type: "function",
    name: "drip",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "error", name: "NotOperator", inputs: [] },
  { type: "error", name: "TooSoon", inputs: [] },
  { type: "error", name: "AlreadyFunded", inputs: [] },
  { type: "error", name: "DailyCapReached", inputs: [] },
  { type: "error", name: "DripTooLarge", inputs: [] },
  { type: "error", name: "CapTooLarge", inputs: [] },
  { type: "error", name: "SendFailed", inputs: [] },
  { type: "error", name: "EnforcedPause", inputs: [] },
  { type: "error", name: "ExpectedPause", inputs: [] },
] as const;

type DripErrorKey = "alreadyFunded" | "tooSoon" | "dailyCapReached" | "paused" | "unknown";

function collectError(error: unknown, names: Set<string>, messages: Set<string>): void {
  if (error instanceof Error) {
    names.add(error.name);
    messages.add(error.message);
    const walk = (error as Error & { walk?: (fn: (item: Error) => void) => void }).walk;
    if (typeof walk === "function") walk((item) => collectError(item, names, messages));
  } else if (error !== null && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.name === "string") names.add(record.name);
    if (typeof record.message === "string") messages.add(record.message);
  }
}

function mapDripError(error: unknown): DripErrorKey {
  const names = new Set<string>();
  const messages = new Set<string>();
  collectError(error, names, messages);
  if (names.has("AlreadyFunded")) return "alreadyFunded";
  if (names.has("TooSoon")) return "tooSoon";
  if (names.has("DailyCapReached")) return "dailyCapReached";
  if (names.has("EnforcedPause") || names.has("Paused")) return "paused";
  if ([...messages].some((message) => message.toLowerCase().includes("insufficient funds"))) {
    return "unknown";
  }
  return "unknown";
}

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "drip";

export interface DripDependencies {
  verifyTurnstile(token: string, remoteIp: string | undefined): Promise<boolean>;
  simulate(address: Address): Promise<void>;
  write(address: Address): Promise<Hex>;
}

export interface DripBody {
  address?: unknown;
  token?: unknown;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") throw new Error(`missing ${name}`);
  return value;
}

function clientIp(req: VercelRequest): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || undefined;
  return req.socket?.remoteAddress;
}

async function verifyTurnstileToken(token: string, remoteIp: string | undefined): Promise<boolean> {
  const hostnames = new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );
  if (hostnames.size === 0) throw new Error("missing TURNSTILE_HOSTNAMES");
  const body = new URLSearchParams({
    secret: requiredEnv("TURNSTILE_SECRET_KEY"),
    response: token,
  });
  if (remoteIp !== undefined) body.set("remoteip", remoteIp);
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`siteverify ${response.status}`);
  const result = (await response.json()) as {
    success?: unknown;
    action?: unknown;
    hostname?: unknown;
  };
  const hostname = typeof result.hostname === "string" ? result.hostname : "";
  const previewHostname = process.env.VERCEL_ENV === "preview" && hostname.endsWith(".vercel.app");
  return (
    result.success === true &&
    result.action === TURNSTILE_ACTION &&
    (hostnames.has(hostname) || previewHostname)
  );
}

function retryableSendError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("nonce too low") ||
    message.includes("nonce too high") ||
    message.includes("underpriced")
  );
}

let realDependencies: DripDependencies | undefined;

function getRealDependencies(): DripDependencies {
  if (realDependencies !== undefined) return realDependencies;
  const rpcUrl = requiredEnv("SEPOLIA_RPC_URL_SERVER");
  const gasTap = requiredEnv("GASTAP_ADDRESS") as Address;
  const account = privateKeyToAccount(requiredEnv("DRIP_OPERATOR_PRIVATE_KEY") as Hex);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  realDependencies = {
    verifyTurnstile: verifyTurnstileToken,
    simulate: async (address) => {
      await publicClient.simulateContract({
        address: gasTap,
        abi: gasTapDripAbi,
        functionName: "drip",
        args: [address],
        account,
      });
    },
    write: async (address) => {
      try {
        return await walletClient.writeContract({
          address: gasTap,
          abi: gasTapDripAbi,
          functionName: "drip",
          args: [address],
          account,
          chain: sepolia,
        });
      } catch (error) {
        if (!retryableSendError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 750));
        return walletClient.writeContract({
          address: gasTap,
          abi: gasTapDripAbi,
          functionName: "drip",
          args: [address],
          account,
          chain: sepolia,
        });
      }
    },
  };
  return realDependencies;
}

function parseBody(body: unknown): DripBody {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as DripBody;
    } catch {
      return {};
    }
  }
  if (body !== null && typeof body === "object") return body as DripBody;
  return {};
}

function statusFor(error: unknown): number {
  switch (mapDripError(error)) {
    case "alreadyFunded":
    case "tooSoon":
      return 409;
    case "dailyCapReached":
      return 429;
    case "paused":
      return 503;
    default:
      return 500;
  }
}

export function createHandler(dependencies: DripDependencies) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "methodNotAllowed" });
      return;
    }
    const body = parseBody(req.body);
    if (typeof body.address !== "string" || !isAddress(body.address)) {
      res.status(400).json({ error: "badInput" });
      return;
    }
    if (typeof body.token !== "string" || body.token.length === 0 || body.token.length > 2048) {
      res.status(400).json({ error: "badInput" });
      return;
    }
    const address = body.address;
    try {
      const verified = await dependencies.verifyTurnstile(body.token, clientIp(req));
      if (!verified) {
        console.log(JSON.stringify({ address, outcome: "turnstileRejected" }));
        res.status(403).json({ error: "turnstileRejected" });
        return;
      }
    } catch {
      console.log(JSON.stringify({ address, outcome: "turnstileUnavailable" }));
      res.status(403).json({ error: "turnstileRejected" });
      return;
    }

    try {
      await dependencies.simulate(address);
    } catch (error) {
      const key = mapDripError(error);
      const status = statusFor(error);
      console.log(JSON.stringify({ address, outcome: key }));
      res.status(status).json({ error: status === 500 ? "unknown" : key });
      return;
    }

    try {
      const txHash = await dependencies.write(address);
      console.log(JSON.stringify({ address, outcome: "dripped", txHash }));
      res.status(200).json({ txHash });
    } catch (error) {
      console.log(JSON.stringify({ address, outcome: mapDripError(error) }));
      res.status(500).json({ error: "unknown" });
    }
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await createHandler(getRealDependencies())(req, res);
  } catch {
    console.error("drip configuration unavailable");
    res.status(500).json({ error: "unknown" });
  }
}
