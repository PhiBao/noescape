import { MostWantedAbi, sepoliaAddresses } from "@noescape/contracts/abi";
import {
  CAMERAS,
  type CaseRecord,
  cellOf,
  DETECTIVES,
  EXITS,
  H,
  verifyCase,
  W,
  xy,
} from "@noescape/engine";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { type Hex, parseAbiItem } from "viem";
import { Link, useParams } from "wouter";
import { getOrCreateBurner } from "../chain/burner.ts";
import { publicClient } from "../chain/clients.ts";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { requestDrip } from "../chain/drip.ts";
import { type ErrorKey, mapError } from "../chain/errors.ts";
import { config } from "../config.ts";
import { useCase } from "../game/useCase.ts";
import { BrainTable } from "../ui/BrainTable.tsx";
import { Button } from "../ui/Button.tsx";
import { MapBoard } from "../ui/MapBoard.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Sighting, Stamp } from "../ui/Stamp.tsx";
import { hourOf } from "../ui/TurnClock.tsx";

const caseOpenedEvent = parseAbiItem(
  "event CaseOpened(uint256 indexed id, address indexed detective)",
);
const caseVerifiedEvent = parseAbiItem(
  "event CaseVerified(uint256 indexed id, bool indexed ok, uint8 failCode, uint8 failTurn)",
);
const dayVerifiedEvent = parseAbiItem(
  "event DayVerified(uint32 indexed day, bool indexed ok, uint8 failCode)",
);

type ChainResult = { ok: boolean; failCode: number; failTurn: number };
type TxLinks = { opened: Hex | null; verified: Hex | null };
type DayInfo = {
  day: number;
  status: number;
  hunters: number;
  steps: number;
  verified: boolean;
  verifyOk: boolean;
  failCode: number;
  winner: string;
};

function bytesToValues(bytes: Hex): number[] {
  return Array.from(bytes.slice(2).match(/.{2}/g) ?? [], (byte) => Number(`0x${byte}`));
}

function hourLabel(index: number): string {
  return `${String((20 + index) % 24).padStart(2, "0")}:00`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
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

function useMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 900,
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

export function CaseFile() {
  const { id } = useParams();
  const caseId = id === undefined ? null : BigInt(id);
  const valid = caseId !== null && caseId > 0n;
  const isDay =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("day");
  const { state, resolveAndReveal, retry } = useCase(
    isDay ? undefined : valid ? caseId : undefined,
  );
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [chainResult, setChainResult] = useState<ChainResult | null>(null);
  const [localResult, setLocalResult] = useState<ReturnType<typeof verifyCase> | null>(null);
  const [txLinks, setTxLinks] = useState<TxLinks>({ opened: null, verified: null });
  const [meta, setMeta] = useState<{ detective: string; status: number } | null>(null);
  const [dayInfo, setDayInfo] = useState<DayInfo | null>(null);
  const [dayTx, setDayTx] = useState<Hex | null>(null);
  const [message, setMessage] = useState<ErrorKey | null>(null);
  const [selectedTurn, setSelectedTurn] = useState(1);
  const mobile = useMobile();
  const mapRef = useRef<HTMLDivElement>(null);
  const [overlayRect, setOverlayRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nightFacts = useMemo(() => {
    if (record === null) return null;
    let searches = 0;
    let sightings = 0;
    for (const turn of record.turns) {
      for (let detective = 0; detective < 3; detective += 1) {
        if ((turn.searchFlags & (1 << detective)) !== 0) searches += 1;
      }
      if (turn.report >> 2 > 0) sightings += 1;
    }
    return { turns: record.turns.length, searches, sightings };
  }, [record]);

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
        setMeta({ detective: opened.detective, status: Number(opened.status) });
      } catch (error) {
        if (!cancelled) setMessage(mapError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, state.verified, valid]);

  useEffect(() => {
    if (!isDay || caseId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const day = Number(caseId);
        const opened = await publicClient.readContract({
          address: sepoliaAddresses.MostWanted.address,
          abi: MostWantedAbi,
          functionName: "getDay",
          args: [day],
        });
        if (cancelled) return;
        setDayInfo({
          day,
          status: Number(opened.status),
          hunters: Number(opened.hunters),
          steps: Number(opened.steps),
          verified: opened.verified,
          verifyOk: opened.verifyOk,
          failCode: Number(opened.failCode),
          winner: opened.winner,
        });
        const latest = await publicClient.getBlockNumber();
        const deployBlock = BigInt(sepoliaAddresses.MostWanted.deployBlock ?? 0);
        const logs = await publicClient.getLogs({
          address: sepoliaAddresses.MostWanted.address,
          event: dayVerifiedEvent,
          args: { day },
          fromBlock: deployBlock,
          toBlock: latest,
        });
        if (!cancelled) setDayTx(logs[0]?.transactionHash ?? null);
      } catch (error) {
        if (!cancelled) setMessage(mapError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, isDay]);

  useEffect(() => {
    if (record !== null)
      setSelectedTurn((turn) => Math.min(Math.max(turn, 1), record.turns.length));
  }, [record]);

  const hasRecord = record !== null;
  useEffect(() => {
    if (!hasRecord) return;
    const wrapper = mapRef.current;
    const svg = wrapper?.querySelector("svg.map-svg");
    if (wrapper == null || svg == null) return;
    const update = () => {
      const outer = wrapper.getBoundingClientRect();
      const inner = svg.getBoundingClientRect();
      setOverlayRect({
        left: inner.left - outer.left,
        top: inner.top - outer.top,
        width: inner.width,
        height: inner.height,
      });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [hasRecord]);

  const stampCells = useMemo(() => {
    if (record === null || caseId === null) return [];
    return record.turns.flatMap((entry, index) => {
      const hour = hourOf(index + 1);
      const codes = entry.codes.flatMap((code, detective) => {
        const cell = entry.to[detective];
        const name = DETECTIVES[detective] ?? "?";
        if (cell === undefined || code === null || code < 0) return [];
        return [
          <Stamp
            key={`stamp-${hour}-${name}`}
            caseId={caseId}
            turn={index + 1}
            detective={detective}
            cell={cell}
            code={code}
            hour={hour}
            latest
          />,
        ];
      });
      const camera = CAMERAS.find((item) => item.id === entry.report >> 2);
      const sightings =
        camera === undefined
          ? []
          : [<Sighting key={`sighting-${hour}`} cell={camera.cell} hour={hour} latest />];
      return [...codes, ...sightings];
    });
  }, [caseId, record]);

  if (!valid || caseId === null)
    return (
      <main>
        <h1>Invalid case</h1>
      </main>
    );

  async function verifyNow() {
    setMessage(null);
    const account = getOrCreateBurner();
    const drip = await requestDrip(account.address);
    if (drip.error !== undefined && drip.error !== "alreadyFunded") {
      setMessage(drip.error);
      return;
    }
    await resolveAndReveal();
  }

  const pathPoints = record?.path.map((cell) => {
    const { x, y } = xy(cell);
    return { x: x + 0.5, y: y + 0.5 };
  });
  const pathLength =
    pathPoints?.reduce((total, point, index) => {
      const previous = pathPoints[index - 1];
      if (previous === undefined) return total;
      return total + Math.hypot(point.x - previous.x, point.y - previous.y);
    }, 0) ?? 0;
  const turn = record?.turns[selectedTurn - 1];
  const exitName = EXITS[record?.exitIdx ?? 0]?.name ?? "exit";
  const featuredId = config.featuredCaseId.trim() === "" ? null : Number(config.featuredCaseId);
  const featured = featuredId !== null && featuredId === Number(caseId);
  const busy = state.phase === "resolving" || state.phase === "revealing";
  const verified = state.verified && chainResult?.ok === true && record !== null;
  const outcomeTitle =
    meta?.status === 2
      ? `Caught at ${hourOf(record?.turns.length ?? 1)}`
      : meta?.status === 3
        ? `Escaped via the ${exitName} at ${hourOf(record?.turns.length ?? 1)}`
        : meta?.status === 4
          ? "Gone at dawn"
          : meta?.status === 5
            ? "Abandoned"
            : "Case file";
  function moveScrubber(direction: number) {
    if (record === null) return;
    setSelectedTurn((turn) =>
      Math.min(Math.max(turn + direction, 1), Math.max(record.turns.length, 1)),
    );
  }

  const checklist: { label: string; detail: string; href?: Hex | null }[] = [
    {
      label: "Start square came from onchain randomness",
      detail: txLinks.opened === null ? "reading chain" : "KMS draw verified",
      href: txLinks.opened,
    },
    {
      label: `${localResult?.counts.moves ?? 0} moves followed the rules`,
      detail: "legal step and AI top score",
    },
    {
      label: `${localResult?.counts.answers ?? 0} search answers were true`,
      detail: localResult?.ok === true ? "all matched" : "see local replay",
    },
    {
      label: `${localResult?.counts.reports ?? 0} turn reports were true`,
      detail: localResult?.ok === true ? "all matched" : "see local replay",
    },
    {
      label: "KMS signatures checked onchain",
      detail:
        chainResult?.ok === true ? `CaseVerified ok · fail ${chainResult.failCode}` : "pending",
      href: txLinks.verified,
    },
  ];

  const columnsStyle: CSSProperties = {
    display: "flex",
    flexDirection: mobile ? "column" : "row",
    alignItems: "flex-start",
    gap: mobile ? "var(--space-4)" : "var(--space-6)",
  };

  if (isDay) {
    return (
      <main
        style={{
          width: "min(100%, 900px)",
          maxWidth: "none",
          margin: "0 auto",
          padding: "var(--space-6)",
          display: "grid",
          gap: "var(--space-5)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            color: "var(--chalk-2)",
          }}
        >
          {dayInfo === null ? "Reading the daily ledger…" : `Most Wanted · day ${dayInfo.day}`}
        </p>
        {dayInfo !== null ? (
          <>
            <h1>{dayInfo.status === 2 ? "Caught" : "Got away"}</h1>
            {dayInfo.status === 2 &&
            dayInfo.winner !== "0x0000000000000000000000000000000000000000" ? (
              <p style={{ fontFamily: "var(--font-mono)" }}>
                Caught by {dayInfo.winner.slice(0, 6)}…{dayInfo.winner.slice(-4)}
              </p>
            ) : null}
            <section
              className="paper"
              aria-label="Daily verification"
              style={{ padding: "var(--space-5)", display: "grid", gap: "var(--space-2)" }}
            >
              {dayInfo.verified && dayInfo.verifyOk ? (
                <p
                  style={{
                    color: "var(--verified)",
                    fontFamily: "var(--font-display)",
                    fontSize: "56px",
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  VERIFIED
                </p>
              ) : (
                <p>Daily verification pending</p>
              )}
              <p>
                ✓ {dayInfo.hunters} hunters · {dayInfo.steps} watched steps
              </p>
              <p>✓ KMS signatures checked onchain · fail code {dayInfo.failCode}</p>
              {dayTx !== null ? (
                <a href={`https://sepolia.etherscan.io/tx/${dayTx}`}>DayVerified transaction</a>
              ) : null}
            </section>
          </>
        ) : null}
        {message !== null ? <Notice tone="error" kind={message} /> : null}
        <p>
          <Link href="/most-wanted">Back to Most Wanted</Link>
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        width: "min(100%, 1440px)",
        maxWidth: "none",
        margin: "0 auto",
        padding: mobile ? "var(--space-3)" : "var(--space-6)",
        overflowX: "hidden",
      }}
    >
      <h1 className="sr-only">Case file #{caseId.toString()}</h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono)",
          color: "var(--chalk-2)",
        }}
      >
        Case #{caseId.toString()}
        {meta !== null ? ` · Detective ${shortAddress(meta.detective)}` : ""}
        {record !== null ? ` · ${outcomeTitle}` : ""}
      </p>
      {featured ? (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            color: "var(--brass)",
          }}
        >
          FEATURED — played by the team on Sepolia
        </p>
      ) : null}
      {nightFacts !== null ? (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            color: "var(--chalk-2)",
          }}
        >
          The night: {nightFacts.turns} turns · {nightFacts.searches} searches · {nightFacts.turns}{" "}
          reports · {nightFacts.sightings} camera{" "}
          {nightFacts.sightings === 1 ? "sighting" : "sightings"}. Scrub the hour bar to inspect any
          move.
        </p>
      ) : null}
      {!state.verified && state.phase === "ended" ? (
        <Button type="button" onClick={() => void verifyNow()}>
          Verify now
        </Button>
      ) : null}
      {busy ? (
        <p>{state.phase === "resolving" ? "Filing report…" : "Decrypting path with KMS…"}</p>
      ) : null}
      {state.error !== null ? (
        <Notice
          tone="error"
          kind={state.error.kind}
          action={
            <Button type="button" onClick={() => void retry()}>
              Try again
            </Button>
          }
        />
      ) : null}
      {message !== null ? <Notice tone="error" kind={message} /> : null}
      {chainResult !== null && !chainResult.ok ? (
        <p role="alert" style={{ color: "var(--grease)", fontWeight: 600 }}>
          MISMATCH — fail code {chainResult.failCode} · turn {chainResult.failTurn}
        </p>
      ) : null}
      {record !== null && localResult !== null && !localResult.ok ? (
        <p role="alert" style={{ color: "var(--grease)" }}>
          Local replay FAIL — code {localResult.failCode} · turn {localResult.failTurn}
        </p>
      ) : null}
      {record !== null ? (
        <div style={columnsStyle}>
          <div
            style={{
              flex: mobile ? "1 1 auto" : "0 1 62%",
              minWidth: 0,
              maxWidth: "860px",
              width: mobile ? "100%" : undefined,
            }}
          >
            <div ref={mapRef} style={{ position: "relative" }}>
              <MapBoard
                cells={turn?.to ?? [0, 1, 2]}
                orders={{ to: turn?.to ?? [0, 1, 2], searchFlags: turn?.searchFlags ?? 0 }}
                selectedDetective={0}
                search={((turn?.searchFlags ?? 0) & 1) !== 0}
                onSelectDetective={() => undefined}
                onOrdersChange={() => undefined}
                onSearchToggle={() => undefined}
              />
              {overlayRect.width > 0 ? (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: overlayRect.left,
                    top: overlayRect.top,
                    width: overlayRect.width,
                    height: overlayRect.height,
                    overflow: "visible",
                    pointerEvents: "none",
                  }}
                >
                  {pathPoints !== undefined ? (
                    <g key={selectedTurn}>
                      <polyline
                        points={pathPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                        fill="none"
                        stroke="var(--grease)"
                        strokeWidth="0.09"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={pathLength}
                        strokeDashoffset={reducedMotion ? 0 : pathLength}
                      >
                        {reducedMotion ? null : (
                          <animate
                            attributeName="stroke-dashoffset"
                            from={pathLength}
                            to="0"
                            dur="2.4s"
                            fill="freeze"
                          />
                        )}
                      </polyline>
                      {pathPoints.map((point, index) =>
                        index === pathPoints.length - 1 ? null : (
                          <text
                            key={hourLabel(index)}
                            x={point.x}
                            y={point.y - 0.45}
                            textAnchor="middle"
                            fill="var(--grease)"
                            fontFamily="var(--font-mono)"
                            fontSize="0.18"
                          >
                            {hourLabel(index)}
                          </text>
                        ),
                      )}
                      <circle
                        cx={pathPoints[0]?.x}
                        cy={pathPoints[0]?.y}
                        r="0.14"
                        fill="var(--paper)"
                        stroke="var(--grease)"
                        strokeWidth="0.05"
                      />
                      <circle
                        cx={pathPoints[pathPoints.length - 1]?.x}
                        cy={pathPoints[pathPoints.length - 1]?.y}
                        r="0.16"
                        fill="var(--grease)"
                      />
                      {DETECTIVES.map((name, detective) => {
                        const cell = turn?.to[detective];
                        if (cell === undefined) return null;
                        const { x, y } = xy(cell);
                        return (
                          <g key={name}>
                            <circle
                              cx={x + 0.5}
                              cy={y + 0.5}
                              r="0.34"
                              fill="var(--brass)"
                              stroke="var(--desk)"
                              strokeWidth="0.04"
                            />
                            <text
                              x={x + 0.5}
                              y={y + 0.54}
                              textAnchor="middle"
                              fill="var(--desk)"
                              fontFamily="var(--font-mono)"
                              fontSize="0.18"
                            >
                              {name[0]}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  ) : null}
                  {stampCells}
                </svg>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
                marginTop: "var(--space-4)",
              }}
            >
              <p style={{ fontFamily: "var(--font-mono)", color: "var(--chalk-2)" }}>
                Click an hour to inspect it. White = played · brass = selected · dark = unplayed.
              </p>
              <Button
                type="button"
                disabled={selectedTurn === record.turns.length}
                onClick={() => setSelectedTurn(record.turns.length)}
              >
                Back to latest
              </Button>
            </div>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Turn scrubber — click an hour to inspect, use arrow keys to move"
              aria-valuemin={1}
              aria-valuemax={Math.max(record.turns.length, 1)}
              aria-valuenow={selectedTurn}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  moveScrubber(-1);
                } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveScrubber(1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setSelectedTurn(1);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setSelectedTurn(record.turns.length);
                }
              }}
              style={{
                display: "grid",
                gap: "2px",
                gridTemplateColumns: "repeat(12, 1fr)",
                marginTop: "var(--space-4)",
                padding: "var(--space-2)",
                border: "1px solid var(--desk-line)",
              }}
            >
              {Array.from({ length: 12 }, (_, index) => {
                const turnNo = index + 1;
                return (
                  <button
                    key={hourOf(turnNo)}
                    type="button"
                    title={`${hourOf(turnNo)} · turn ${turnNo} of ${record.turns.length}${turnNo > record.turns.length ? " — not played" : ""}`}
                    aria-label={`Turn ${turnNo}, ${hourOf(turnNo)}`}
                    aria-pressed={turnNo === selectedTurn}
                    disabled={turnNo > record.turns.length}
                    onClick={() => setSelectedTurn(turnNo)}
                    style={{
                      height: "12px",
                      border: "1px solid var(--desk-line)",
                      background:
                        turnNo === selectedTurn
                          ? "var(--brass)"
                          : turnNo <= record.turns.length
                            ? "var(--chalk)"
                            : "var(--desk-line)",
                      cursor: turnNo <= record.turns.length ? "pointer" : "not-allowed",
                    }}
                  />
                );
              })}
            </div>
            <p style={{ fontFamily: "var(--font-mono)", color: "var(--chalk-2)" }}>
              {hourOf(selectedTurn)} · turn {selectedTurn} of {record.turns.length} · cell{" "}
              {record.path[selectedTurn]}
            </p>
          </div>
          <aside
            style={{
              flex: "1 1 38%",
              display: "grid",
              gap: "var(--space-4)",
              minWidth: mobile ? 0 : "340px",
            }}
          >
            <section
              className="paper"
              aria-label="Verification checklist"
              style={{ padding: "var(--space-5)" }}
            >
              {chainResult?.ok === true ? (
                <p
                  style={{
                    color: "var(--verified)",
                    fontFamily: "var(--font-display)",
                    fontSize: "56px",
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  VERIFIED
                </p>
              ) : null}
              <p
                style={{
                  marginTop: "var(--space-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-mono)",
                  color: "var(--ink-2)",
                }}
              >
                The fugitive stayed a ciphertext handle until these signatures released it. On a
                transparent chain this path would have been readable from the first move.
              </p>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "var(--space-2)",
                }}
              >
                {checklist.map((item) => (
                  <li key={item.label}>
                    <span aria-hidden="true">✓ </span>
                    {item.href !== undefined && item.href !== null ? (
                      <a href={`https://sepolia.etherscan.io/tx/${item.href}`}>{item.label}</a>
                    ) : (
                      item.label
                    )}{" "}
                    <span style={{ color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>
                      {item.detail}
                    </span>
                  </li>
                ))}
              </ul>
              {localResult !== null ? (
                <p style={{ marginTop: "var(--space-4)", fontFamily: "var(--font-mono)" }}>
                  Local replay: {localResult.ok ? "PASS" : "FAIL"} · {localResult.counts.moves}{" "}
                  moves · {localResult.counts.answers} answers · {localResult.counts.reports}{" "}
                  reports
                </p>
              ) : null}
            </section>
            {verified ? (
              <BrainTable record={record} turnIndex={selectedTurn} exitName={exitName} />
            ) : null}
            <p>
              <Link href={`/case/${caseId}`}>Back to case</Link>
            </p>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
