import type { Address, Hex } from "viem";
import { config } from "../config.ts";
import { publicClient } from "./clients.ts";
import type { ErrorKey } from "./errors.ts";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileWidget = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: "invisible";
      callback(token: string): void;
      "error-callback"(): void;
    },
  ): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

export interface DripResult {
  txHash?: Hex;
  error?: ErrorKey;
}

let scriptPromise: Promise<void> | undefined;

export function loadTurnstileScript(): Promise<void> {
  if (window.turnstile !== undefined) return Promise.resolve();
  if (scriptPromise !== undefined) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function requestToken(sitekey: string): Promise<{ token: string; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const turnstile = window.turnstile;
    if (turnstile === undefined) {
      reject(new Error("Turnstile is unavailable"));
      return;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    let settled = false;
    let widgetId: string | undefined;
    let timeout: number | undefined;
    const cleanup = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (widgetId !== undefined) turnstile.remove(widgetId);
      container.remove();
    };
    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    timeout = window.setTimeout(() => finishReject(new Error("Turnstile timed out")), 30_000);
    widgetId = turnstile.render(container, {
      sitekey,
      action: "drip",
      size: "invisible",
      callback: (token) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve({ token, cleanup });
      },
      "error-callback": () => finishReject(new Error("Turnstile challenge failed")),
    });
    turnstile.execute(widgetId);
  });
}

async function pollBalance(address: Address, startingBalance: bigint): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const balance = await publicClient.getBalance({ address });
      if (balance > startingBalance) return true;
    } catch {
      // Keep polling through transient public-RPC lag.
    }
  }
  return false;
}

export async function requestDrip(address: Address): Promise<DripResult> {
  if (config.turnstileSiteKey.trim() === "") return { error: "unknown" };
  const startingBalance = await publicClient.getBalance({ address });
  if (startingBalance >= 10_000_000_000_000_000n) return { error: "alreadyFunded" };
  try {
    await loadTurnstileScript();
    const challenge = await requestToken(config.turnstileSiteKey);
    try {
      const response = await fetch("/api/drip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, token: challenge.token }),
      });
      const body = (await response.json()) as { txHash?: Hex; error?: ErrorKey };
      if (!response.ok) return { error: body.error ?? "unknown" };
      if (body.txHash === undefined) return { error: "unknown" };
      const funded = await pollBalance(address, startingBalance);
      return funded ? { txHash: body.txHash } : { txHash: body.txHash, error: "rpcUnreachable" };
    } finally {
      challenge.cleanup();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return {
      error: message.includes("fetch") || message.includes("rpc") ? "rpcUnreachable" : "unknown",
    };
  }
}
