import { type CaseRecord, cellOf, verifyCase } from "@noescape/engine";
import { createConfig, memoryStorage, ZamaSDK } from "@zama-fhe/sdk";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";
import { node } from "@zama-fhe/sdk/node";
import { ViemProvider } from "@zama-fhe/sdk/viem";
import { createPublicClient, type Hex, http, sepolia } from "viem";
import { sepoliaAddresses } from "../abi/addresses.ts";
import { NoEscapeCaseAbi } from "../abi/NoEscapeCase.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const delay of [500, 1000, 2000, 3000, 3000, 3000]) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

function bytesToValues(bytes: Hex): bigint[] {
  return Array.from(bytes.slice(2).match(/.{2}/g) ?? [], (byte) => BigInt(`0x${byte}`));
}

function clearBigInt(value: unknown, handle: Hex): bigint {
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  throw new Error(`missing clear value ${handle}`);
}

async function main(): Promise<void> {
  const rawId = process.argv.slice(2).find((value) => !value.startsWith("--"));
  ensure(rawId !== undefined, "usage: pnpm verify-case <id> [--rpc <url>]");
  const id = BigInt(rawId);
  ensure(id > 0n, "case id must be positive");
  const rpcUrl =
    argument("rpc") ??
    process.env.VITE_SEPOLIA_RPC_FALLBACK ??
    "https://ethereum-sepolia-rpc.publicnode.com";
  const address = sepoliaAddresses.NoEscapeCase.address;
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const sdk = new ZamaSDK(
    createConfig({
      chains: [zamaSepolia],
      provider: new ViemProvider({ publicClient }),
      storage: memoryStorage,
      relayers: { [zamaSepolia.id]: node() },
    }),
  );

  const opened = await publicClient.readContract({
    address,
    abi: NoEscapeCaseAbi,
    functionName: "getCase",
    args: [id],
  });
  ensure(opened.verified && opened.verifyOk, "case is not verified onchain");
  ensure(opened.failCode === 0 && opened.failTurn === 0, "onchain verification failed");
  const [handlesA, handlesB] = await publicClient.readContract({
    address,
    abi: NoEscapeCaseAbi,
    functionName: "revealHandles",
    args: [id],
  });
  const batchA = await retry(() => sdk.decryption.decryptPublicValues(handlesA));
  const batchB = await retry(() => sdk.decryption.decryptPublicValues(handlesB));
  const pathMasks = handlesA.map((handle) => clearBigInt(batchA.clearValues[handle], handle));
  const values = handlesB.map((handle) => clearBigInt(batchB.clearValues[handle], handle));

  ensure(
    pathMasks.length === opened.path.length &&
      pathMasks.every((value, index) => value === opened.path[index]),
    "path does not match onchain clears",
  );
  const expectedB = [
    BigInt(opened.exitClear),
    ...bytesToValues(opened.noiseClear),
    ...bytesToValues(opened.codesClear),
  ];
  ensure(
    values.length === expectedB.length &&
      values.every((value, index) => value === expectedB[index]),
    "exit/noise/codes do not match onchain clears",
  );

  const path = pathMasks.map(cellOf);
  const exitIdx = Number(values[0]);
  let cursor = 1;
  const turns: CaseRecord["turns"] = [];
  for (let turn = 1; turn <= Number(opened.turn); turn += 1) {
    const record = await publicClient.readContract({
      address,
      abi: NoEscapeCaseAbi,
      functionName: "getTurn",
      args: [id, turn],
    });
    const to = record.cells.map((cell) => Number(cell)) as [number, number, number];
    const searchFlags = Number(record.searchFlags);
    const noise = Array.from({ length: 5 }, () => {
      const value = values[cursor++];
      ensure(value !== undefined, "missing noise value");
      return Number(value);
    }) as [number, number, number, number, number];
    const codes: [number | null, number | null, number | null] = [null, null, null];
    turns.push({ to, searchFlags, noise, codes, report: Number(record.reportClear) });
  }

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn === undefined) throw new Error("missing turn");
    const captured = turn.to.includes(path[index] ?? -1);
    for (let detective = 0; detective < 3; detective += 1) {
      if ((turn.searchFlags & (1 << detective)) === 0) continue;
      const value = values[cursor++];
      ensure(value !== undefined, "missing code value");
      if (!captured) turn.codes[detective] = Number(value);
    }
  }

  const result = verifyCase({ path, exitIdx, turns });
  ensure(result.ok, `engine verification failed: code ${result.failCode}, turn ${result.failTurn}`);
  console.log(
    `case #${id} · start ✓ · ${result.counts.moves} moves ✓ · ${result.counts.answers} answers ✓ · ${result.counts.reports} reports ✓ · onchain CaseVerified ✓`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
