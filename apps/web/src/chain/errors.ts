export type ErrorKey =
  | "rpcUnreachable"
  | "relayerSlow"
  | "aclRefused"
  | "alreadyFunded"
  | "tooSoon"
  | "dailyCapReached"
  | "paused"
  | "outOfFuel"
  | "txReverted"
  | "invalidOrders"
  | "activeCase"
  | "reportPending"
  | "caseOver"
  | "noTurns"
  | "notEnded"
  | "alreadyVerified"
  | "unknown";

export interface ErrorContext {
  caseId?: bigint | number;
  address?: string;
  watchSeconds?: number;
  elapsedMs?: number;
  step?: string;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function errorCopy(kind: ErrorKey, context: ErrorContext = {}): string {
  switch (kind) {
    case "rpcUnreachable":
      return "Lost the radio. Sepolia isn't answering.";
    case "relayerSlow":
      return (context.elapsedMs ?? 0) >= 45_000
        ? "Still nothing. Your move is safe on chain."
        : "Dispatch is still decoding (Zama relayer). This usually takes under 20 seconds.";
    case "alreadyFunded":
      return "Your badge already has fuel.";
    case "tooSoon":
      return "Fuel is issued once a day per badge.";
    case "dailyCapReached":
      return "The fuel depot is empty for today. Watch a solved case, or come back after 00:00 UTC.";
    case "paused":
      return "The fuel depot is paused. Try again later.";
    case "outOfFuel":
      return context.address === undefined
        ? "Your detective is out of fuel."
        : `Your detective is out of fuel. Fund ${shortAddress(context.address)} with Sepolia ETH.`;
    case "txReverted":
      return "That transaction was reverted. Reload state.";
    case "caseOver":
      return "That case is already closed.";
    case "invalidOrders":
      return "Those orders are not valid. Check reach and shared corners.";
    case "activeCase":
      return `You already have case #${context.caseId ?? "?"} open.`;
    case "reportPending":
      return "The previous report is still pending.";
    case "noTurns":
      return "No turns to replay yet.";
    case "notEnded":
      return "That case is not ended.";
    case "alreadyVerified":
      return "That case is already verified.";
    case "aclRefused":
      return "REFUSED — this key is not on the ACL for that handle.";
    default:
      return "That request failed. Retry when you are ready.";
  }
}

function collect(error: unknown, names: Set<string>, messages: Set<string>): void {
  if (error instanceof Error) {
    names.add(error.name);
    messages.add(error.message);
    const walk = (error as Error & { walk?: (fn: (item: Error) => void) => void }).walk;
    if (typeof walk === "function") walk((item) => collect(item, names, messages));
  } else if (typeof error === "string") {
    messages.add(error);
  } else if (error !== null && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.name === "string") names.add(record.name);
    if (typeof record.message === "string") messages.add(record.message);
    if (typeof record.errorName === "string") names.add(record.errorName);
    if (typeof record.shortMessage === "string") messages.add(record.shortMessage);
  }
}

export function mapError(error: unknown): ErrorKey {
  const names = new Set<string>();
  const messages = new Set<string>();
  collect(error, names, messages);
  const text = [...messages].join(" ").toLowerCase();

  if (names.has("NotOperator")) return "txReverted";
  if (names.has("TooSoon") || text.includes("toosoon")) return "tooSoon";
  if (names.has("AlreadyFunded") || text.includes("alreadyfunded")) return "alreadyFunded";
  if (names.has("DailyCapReached") || text.includes("dailycapreached")) return "dailyCapReached";
  if (names.has("EnforcedPause") || names.has("Paused")) return "paused";
  if (names.has("InsufficientFundsError") || text.includes("insufficient funds"))
    return "outOfFuel";
  if (names.has("BadOrders") || text.includes("badorders")) return "invalidOrders";
  if (names.has("CaseActive") || text.includes("caseactive")) return "activeCase";
  if (names.has("ReportPending") || text.includes("reportpending")) return "reportPending";
  if (names.has("CaseOver") || text.includes("caseover")) return "caseOver";
  if (names.has("NoTurns") || text.includes("noturns")) return "noTurns";
  if (names.has("NotEnded") || text.includes("notended")) return "notEnded";
  if (names.has("AlreadyVerified") || text.includes("alreadyverified")) return "alreadyVerified";
  if (text.includes("not entitled") || text.includes("acl")) return "aclRefused";
  if (text.includes("not authorized") || text.includes("relayer") || text.includes("timeout")) {
    return "relayerSlow";
  }
  if (
    text.includes("fetch failed") ||
    text.includes("network") ||
    text.includes("http request failed") ||
    text.includes("rpc")
  ) {
    return "rpcUnreachable";
  }
  if (
    names.has("ContractFunctionRevertedError") ||
    names.has("TransactionExecutionError") ||
    names.has("UserRejectedError")
  ) {
    return "txReverted";
  }
  return "unknown";
}
