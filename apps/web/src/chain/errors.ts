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
  if (names.has("TooSoon")) return "tooSoon";
  if (names.has("AlreadyFunded")) return "alreadyFunded";
  if (names.has("DailyCapReached")) return "dailyCapReached";
  if (names.has("EnforcedPause") || names.has("Paused")) return "paused";
  if (names.has("InsufficientFundsError")) return "outOfFuel";
  if (names.has("BadOrders")) return "invalidOrders";
  if (names.has("CaseActive")) return "activeCase";
  if (names.has("ReportPending")) return "reportPending";
  if (names.has("CaseOver")) return "caseOver";
  if (names.has("NoTurns")) return "noTurns";
  if (names.has("NotEnded")) return "notEnded";
  if (names.has("AlreadyVerified")) return "alreadyVerified";
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
