import { type DetectiveCells, PRECINCT } from "@noescape/engine";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { getOrCreateBurner } from "../chain/burner.ts";
import { publicClient } from "../chain/clients.ts";
import { getNoEscapeCase, getNoEscapeCaseReader } from "../chain/contracts.ts";
import { mapError } from "../chain/errors.ts";
import { ensurePermits, publicDecrypt, userDecrypt } from "../chain/zama.ts";
import {
  type CaseEvent,
  type CaseOrders,
  type CaseOutcome,
  type CasePhase,
  caseReducer,
  initialCaseState,
} from "./caseMachine.ts";

const precinctCells: DetectiveCells = [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell];

function retryableTxError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("nonce too low") ||
    message.includes("nonce too high") ||
    message.includes("underpriced")
  );
}

async function writeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!retryableTxError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 750));
    return operation();
  }
}

function outcomeFromStatus(status: number): CaseOutcome | null {
  if (status === 2) return "caught";
  if (status === 3) return "escaped";
  if (status === 4) return "dawn";
  if (status === 5) return "abandoned";
  return null;
}

export interface DecodedTurn {
  turn: number;
  report: number;
  camera: number;
  outcome: CaseOutcome | null;
  codes: (number | null)[];
}

export function useCase(caseId?: bigint) {
  const [state, dispatch] = useReducer(caseReducer, undefined, initialCaseState);
  const [log, setLog] = useState<DecodedTurn[]>([]);
  const decodingKey = useRef<string | null>(null);
  const readBlock = useRef<bigint | undefined>(undefined);

  const fail = useCallback((error: unknown, retryTo: CasePhase) => {
    dispatch({ type: "FAILED", kind: mapError(error), retryTo });
  }, []);

  const hydrate = useCallback(async (id: bigint) => {
    const contract = getNoEscapeCaseReader();
    const opened = await contract.read.getCase([id]);
    const turn = opened.turn;
    const lastTurn = turn === 0 ? null : await contract.read.getTurn([id, turn]);
    const cells = (lastTurn?.cells.map((cell) => Number(cell)) ?? precinctCells) as DetectiveCells;
    const event: CaseEvent = {
      type: "HYDRATED",
      id,
      turn,
      cells,
      outcome: outcomeFromStatus(opened.status),
      verified: opened.verified,
      reportResolved: turn === 0 || lastTurn?.resolved === true,
      revealed: opened.path.length > 0,
    };
    dispatch(event);
  }, []);

  useEffect(() => {
    if (caseId !== undefined) {
      void hydrate(caseId).catch((error) => fail(error, "planning"));
      return;
    }
    const account = getOrCreateBurner();
    const contract = getNoEscapeCaseReader();
    void contract.read
      .activeCaseOf([account.address])
      .then((id) => {
        if (id !== 0n) return hydrate(id);
        dispatch({ type: "KEY_READY" });
      })
      .catch((error) => fail(error, "noKey"));
  }, [caseId, fail, hydrate]);

  const decodeReport = useCallback(async (id: bigint, turn: number, isNewTurn: boolean) => {
    const contract = getNoEscapeCaseReader();
    const record = await contract.read.getTurn([id, turn], {
      blockNumber: readBlock.current,
    });
    const report = await publicDecrypt([record.report]);
    const clear = report.clear[record.report] ?? 0n;
    const pairs: { encryptedValue: Hex; contractAddress: Address }[] = [];
    for (let detective = 0; detective < 3; detective += 1) {
      if ((record.searchFlags & (1 << detective)) !== 0) {
        const encryptedValue = record.codes[detective];
        if (encryptedValue !== undefined) {
          pairs.push({ encryptedValue, contractAddress: contract.address });
        }
      }
    }
    let decrypted: Record<Hex, bigint> = {};
    if (pairs.length > 0) {
      await ensurePermits([contract.address]);
      decrypted = await userDecrypt(pairs);
    }
    const status = Number(clear & 3n);
    const outcome =
      status === 1 ? "caught" : status === 2 ? "escaped" : turn === 12 ? "dawn" : null;
    const codes = [0, 1, 2].map((detective) => {
      if ((record.searchFlags & (1 << detective)) === 0) return null;
      const handle = record.codes[detective];
      return handle === undefined ? null : Number(decrypted[handle] ?? -1n);
    });
    setLog((previous) => {
      const next = previous.filter((entry) => entry.turn !== turn);
      next.push({ turn, report: Number(clear), camera: Number(clear >> 2n), outcome, codes });
      return next.sort((a, b) => a.turn - b.turn);
    });
    dispatch(isNewTurn ? { type: "TURN_DECODED", outcome } : { type: "REPORT_RECOVERED", outcome });
    return { clear, abi: report.abi, proof: report.proof, outcome };
  }, []);

  useEffect(() => {
    if (state.phase !== "decoding" || state.caseId === null) return;
    const id = state.caseId;
    const turn = state.turn + (state.decodingNewTurn ? 1 : 0);
    const key = `${id}:${turn}:${state.decodingNewTurn}`;
    if (decodingKey.current === key) return;
    decodingKey.current = key;
    void decodeReport(id, turn, state.decodingNewTurn).catch((error) => {
      decodingKey.current = null;
      fail(error, "decoding");
    });
  }, [decodeReport, fail, state.caseId, state.decodingNewTurn, state.phase, state.turn]);

  const sendTurn = useCallback(async () => {
    if (state.phase !== "planning" || state.caseId === null || state.orderError !== null) return;
    const id = state.caseId;
    try {
      let previousEncoded = "0x" as Hex;
      let previousProof = "0x" as Hex;
      if (state.turn > 0) {
        const reader = getNoEscapeCaseReader();
        const previous = await reader.read.getTurn([id, state.turn]);
        if (!previous.resolved) {
          const decoded = await decodeReport(id, state.turn, false);
          previousEncoded = decoded.abi;
          previousProof = decoded.proof;
        }
      }
      const account = getOrCreateBurner();
      const contract = getNoEscapeCase(account);
      dispatch({ type: "SEND_TURN" });
      const hash = await writeWithRetry(() =>
        contract.write.playTurn([
          id,
          state.orders.to,
          state.orders.searchFlags,
          previousEncoded,
          previousProof,
        ]),
      );
      dispatch({ type: "TURN_MINED" });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      readBlock.current = receipt.blockNumber;
      dispatch({ type: "DECODE_STARTED" });
    } catch (error) {
      fail(error, "planning");
    }
  }, [decodeReport, fail, state.caseId, state.orderError, state.orders, state.phase, state.turn]);

  const submitReveal = useCallback(
    async (id: bigint) => {
      const account = getOrCreateBurner();
      const writer = getNoEscapeCase(account);
      const reader = getNoEscapeCaseReader();
      const [handlesA, handlesB] = await reader.read.revealHandles([id]);
      const batchA = await publicDecrypt(handlesA);
      const batchB = await publicDecrypt(handlesB);
      const hash = await writeWithRetry(() =>
        writer.write.submitReveal([id, batchA.abi, batchA.proof, batchB.abi, batchB.proof]),
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const opened = await reader.read.getCase([id], { blockNumber: receipt.blockNumber });
      if (opened.verified && opened.verifyOk) dispatch({ type: "VERIFIED" });
      else fail(new Error("onchain verification failed"), "revealing");
    },
    [fail],
  );

  const resolveAndReveal = useCallback(async () => {
    if (state.phase !== "ended" || state.caseId === null) return;
    const id = state.caseId;
    try {
      dispatch({ type: "RESOLVE_STARTED" });
      const account = getOrCreateBurner();
      const writer = getNoEscapeCase(account);
      const reader = getNoEscapeCaseReader();
      const opened = await reader.read.getCase([id]);
      if (opened.turn > 0) {
        const latest = await reader.read.getTurn([id, opened.turn]);
        if (!latest.resolved) {
          const decoded = await decodeReport(id, opened.turn, false);
          const hash = await writeWithRetry(() =>
            writer.write.resolveReport([id, decoded.abi, decoded.proof]),
          );
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }
      dispatch({ type: "REVEAL_STARTED" });
    } catch (error) {
      fail(error, "resolving");
    }
  }, [decodeReport, fail, state.caseId, state.phase]);

  useEffect(() => {
    if (state.phase !== "revealing" || state.caseId === null) return;
    void submitReveal(state.caseId).catch((error) => fail(error, "revealing"));
  }, [fail, state.caseId, state.phase, submitReveal]);

  const openNewCase = useCallback(
    async (beforeOpen: () => Promise<void>) => {
      try {
        getOrCreateBurner();
        dispatch({ type: "KEY_READY" });
        await beforeOpen();
        dispatch({ type: "FUEL_READY" });
        dispatch({ type: "OPEN_STARTED" });
        const account = getOrCreateBurner();
        const writer = getNoEscapeCase(account);
        const reader = getNoEscapeCaseReader();
        const hash = await writeWithRetry(() => writer.write.openCase());
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const id = await reader.read.activeCaseOf([account.address], {
          blockNumber: receipt.blockNumber,
        });
        if (id === 0n) throw new Error("case did not open");
        dispatch({ type: "OPENED", id });
        return id;
      } catch (error) {
        fail(error, "funding");
        return null;
      }
    },
    [fail],
  );

  const setOrders = useCallback(
    (orders: CaseOrders) => dispatch({ type: "ORDERS_CHANGED", orders }),
    [],
  );

  const retry = useCallback(async () => {
    if (state.phase !== "error" || state.caseId === null) return;
    const retryTo = state.error?.retryTo ?? "planning";
    dispatch({ type: "RETRY" });
    await hydrate(state.caseId);
    if (retryTo === "revealing") await submitReveal(state.caseId);
  }, [hydrate, state.caseId, state.error, state.phase, submitReveal]);

  return { state, log, setOrders, sendTurn, resolveAndReveal, openNewCase, retry };
}
