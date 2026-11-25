import { sepoliaAddresses } from "@noescape/contracts/abi";
import { type CaseRecord, cellOf, verifyCase } from "@noescape/engine";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { parseAbiItem } from "viem";
import { Link, useParams } from "wouter";
import { getOrCreateBurner } from "../chain/burner.ts";
import { publicClient } from "../chain/clients.ts";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { requestDrip } from "../chain/drip.ts";
import { mapError } from "../chain/errors.ts";
import { useCase } from "../game/useCase.ts";
import { Button } from "../ui/Button.tsx";
import { Notice } from "../ui/Notice.tsx";

const caseOpenedEvent = parseAbiItem(
  "event CaseOpened(uint256 indexed id, address indexed detective)",
);
const caseVerifiedEvent = parseAbiItem(
  "event CaseVerified(uint256 indexed id, bool indexed ok, uint8 failCode, uint8 failTurn)",
);

type ChainResult = {
  ok: boolean;
  failCode: number;
  failTurn: number;
};

type TxLinks = {
  opened: Hex | null;
  verified: Hex | null;
};

function bytesToValues(bytes: Hex): number[] {
  return Array.from(bytes.slice(2).match(/.{2}/g) ?? [], (byte) => Number(`0x${byte}`));
}

function hourLabel(index: number): string {
  return `${String((20 + index) % 24).padStart(2, "0")}:00`;
}

async function findCaseTx(
  id: bigint,
  event: typeof caseOpenedEvent | typeof caseVerifiedEvent,
): Promise<Hex | null> {
  const latest = await publicClient.getBlockNumber();
  const deployBlock = BigInt(sepoliaAddresses.NoEscapeCase.deployBlock ?? 0);
  for (let to = latest; to >= deployBlock; to -= 5_000n) {
    const from = to - 4_999n < deployBlock ? deployBlock : to - 4_999n;
    const logs = await publicClient.getLogs({
      address: sepoliaAddresses.NoEscapeCase.address,
      event,
      args: { id },
      fromBlock: from,
      toBlock: to,
    });
    const log = logs[0];
    if (log !== undefined) return log.transactionHash;
    if (from === deployBlock) break;
  }
  return null;
}

export function CaseFile() {
  const { id } = useParams();
  const caseId = id === undefined ? null : BigInt(id);
  const valid = caseId !== null && caseId > 0n;
  const { state, resolveAndReveal, retry } = useCase(valid ? caseId : undefined);
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [chainResult, setChainResult] = useState<ChainResult | null>(null);
  const [localResult, setLocalResult] = useState<ReturnType<typeof verifyCase> | null>(null);
  const [txLinks, setTxLinks] = useState<TxLinks>({ opened: null, verified: null });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!valid || caseId === null || !state.verified) return;
    let cancelled = false;
    void (async () => {
      try {
        const contract = getNoEscapeCaseReader();
        const opened = await contract.read.getCase([caseId]);
        if (!opened.verified) return;
        const noise = bytesToValues(opened.noiseClear);
        const codes = bytesToValues(opened.codesClear);
        const turns: CaseRecord["turns"] = [];
        let noiseCursor = 0;
        let codeCursor = 0;
        for (let turn = 1; turn <= Number(opened.turn); turn += 1) {
          const stored = await contract.read.getTurn([caseId, turn]);
          const turnNoise = Array.from({ length: 5 }, () => noise[noiseCursor++] ?? 0);
          const turnCodes: [number | null, number | null, number | null] = [null, null, null];
          for (let detective = 0; detective < 3; detective += 1) {
            if ((stored.searchFlags & (1 << detective)) !== 0) {
              turnCodes[detective] = codes[codeCursor++] ?? null;
            }
          }
          turns.push({
            to: stored.cells.map((cell) => Number(cell)) as [number, number, number],
            searchFlags: Number(stored.searchFlags),
            noise: turnNoise as [number, number, number, number, number],
            codes: turnCodes,
            report: Number(stored.reportClear),
          });
        }
        const replay: CaseRecord = {
          path: opened.path.map((mask) => cellOf(mask)),
          exitIdx: Number(opened.exitClear),
          turns,
        };
        const [openedTx, verifiedTx] = await Promise.all([
          findCaseTx(caseId, caseOpenedEvent),
          findCaseTx(caseId, caseVerifiedEvent),
        ]);
        if (cancelled) return;
        setRecord(replay);
        setChainResult({
          ok: opened.verifyOk,
          failCode: Number(opened.failCode),
          failTurn: Number(opened.failTurn),
        });
        setLocalResult(verifyCase(replay));
        setTxLinks({ opened: openedTx, verified: verifiedTx });
      } catch (error) {
        if (!cancelled) setMessage(mapError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, state.verified, valid]);

  if (!valid || caseId === null)
    return (
      <main>
        <h1>Invalid case</h1>
      </main>
    );

  async function verifyNow() {
    setMessage("");
    const account = getOrCreateBurner();
    const drip = await requestDrip(account.address);
    if (drip.error !== undefined && drip.error !== "alreadyFunded") {
      setMessage(drip.error);
      return;
    }
    await resolveAndReveal();
  }

  const busy = state.phase === "resolving" || state.phase === "revealing";

  return (
    <main>
      <h1>Case file #{caseId.toString()}</h1>
      {state.verified && chainResult !== null ? (
        <Notice tone={chainResult.ok ? "success" : "error"}>
          Onchain CaseVerified: {chainResult.ok ? "PASS" : "FAIL"} · fail code{" "}
          {chainResult.failCode} · turn {chainResult.failTurn}
        </Notice>
      ) : null}
      {!state.verified && state.phase === "ended" ? (
        <Button type="button" onClick={() => void verifyNow()}>
          Verify now
        </Button>
      ) : null}
      {busy ? (
        <p>
          {state.phase === "resolving" ? "Resolving final report…" : "Revealing and verifying…"}
        </p>
      ) : null}
      {state.error !== null ? (
        <>
          <Notice tone="error">{state.error.kind}</Notice>
          <Button type="button" onClick={() => void retry()}>
            Try again
          </Button>
        </>
      ) : null}
      {message !== "" ? <Notice tone="error">{message}</Notice> : null}
      {localResult !== null ? (
        <Notice tone={localResult.ok ? "success" : "error"}>
          Local replay: {localResult.ok ? "PASS" : "FAIL"} · {localResult.counts.moves} moves ·{" "}
          {localResult.counts.answers} answers · {localResult.counts.reports} reports
        </Notice>
      ) : null}
      {record !== null ? (
        <section aria-label="Revealed path">
          <h2>Path</h2>
          <ol>
            {record.path.map((cell, index) => (
              <li key={hourLabel(index)}>
                {hourLabel(index)} · cell {cell}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {txLinks.opened !== null || txLinks.verified !== null ? (
        <section aria-label="Transactions">
          <h2>Transactions</h2>
          {txLinks.opened !== null ? (
            <p>
              <a href={`https://sepolia.etherscan.io/tx/${txLinks.opened}`}>Open case</a>
            </p>
          ) : null}
          {txLinks.verified !== null ? (
            <p>
              <a href={`https://sepolia.etherscan.io/tx/${txLinks.verified}`}>Reveal and verify</a>
            </p>
          ) : null}
        </section>
      ) : null}
      {!state.verified && state.phase !== "ended" && !busy && state.error === null ? (
        <p>
          <Link href={`/case/${caseId}`}>Back to case</Link>
        </p>
      ) : null}
    </main>
  );
}
