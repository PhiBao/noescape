import { CAMERAS, DETECTIVES, type DetectiveCells, H, TURNS, W } from "@noescape/engine";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import type { Hex } from "viem";
import { useParams } from "wouter";
import { getOrCreateBurner } from "../chain/burner.ts";
import { publicClient } from "../chain/clients.ts";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { type ErrorKey, mapError } from "../chain/errors.ts";
import { ensurePermits, publicDecrypt, userDecrypt } from "../chain/zama.ts";
import { type DecodedTurn, useCase } from "../game/useCase.ts";
import { Button } from "../ui/Button.tsx";
import { Coach } from "../ui/Coach.tsx";
import { type DispatchInfo, DispatchStrip } from "../ui/DispatchStrip.tsx";
import { EndCard } from "../ui/EndCard.tsx";
import { MapBoard } from "../ui/MapBoard.tsx";
import { Notice } from "../ui/Notice.tsx";
import { OrdersPanel } from "../ui/OrdersPanel.tsx";
import { RadioLog } from "../ui/RadioLog.tsx";
import { Sighting, Stamp } from "../ui/Stamp.tsx";
import { hourOf, TurnClock } from "../ui/TurnClock.tsx";

type Layout = "desktop" | "tablet" | "mobile";

interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function bytesToValues(bytes: Hex): number[] {
  return Array.from(bytes.slice(2).match(/.{2}/g) ?? [], (byte) => Number(`0x${byte}`));
}

function useLayout(): Layout {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width >= 1024 ? "desktop" : width >= 768 ? "tablet" : "mobile";
}

export function Case() {
  const { id } = useParams();
  const caseId = id === undefined ? null : BigInt(id);
  const valid = caseId !== null && caseId > 0n;
  const { state, log, setOrders, sendTurn, resolveAndReveal, retry } = useCase(
    valid ? caseId : undefined,
  );
  const layout = useLayout();
  const [selectedDetective, setSelectedDetective] = useState(0);

  const [history, setHistory] = useState<DecodedTurn[]>([]);
  const [cellsByTurn, setCellsByTurn] = useState<Record<number, DetectiveCells>>({});
  const [historyError, setHistoryError] = useState<ErrorKey | null>(null);
  const historyKey = useRef("");

  useEffect(() => {
    if (caseId === null || state.caseId === null) return;
    if (state.phase === "noKey" || state.phase === "funding" || state.phase === "opening") return;
    const key = `${caseId}:${state.turn}`;
    if (historyKey.current === key) return;
    historyKey.current = key;
    let cancelled = false;
    void (async () => {
      const reader = getNoEscapeCaseReader();
      const opened = await reader.read.getCase([caseId]);
      const turns = Array.from({ length: Number(opened.turn) }, (_, index) => index + 1);
      const revealedCodes = bytesToValues(opened.codesClear);
      let codeCursor = 0;
      const cells: Record<number, DetectiveCells> = {};
      const decoded: DecodedTurn[] = [];
      for (const turn of turns) {
        const record = await reader.read.getTurn([caseId, turn]);
        cells[turn] = record.cells.map(Number) as DetectiveCells;
        const published = await publicDecrypt([record.report]);
        const report = Number(published.clear[record.report] ?? 0n);
        const status = report & 3;
        const outcome =
          status === 1 ? "caught" : status === 2 ? "escaped" : turn === TURNS ? "dawn" : null;
        let codes: (number | null)[] = [null, null, null];
        if (revealedCodes.length > 0) {
          codes = [0, 1, 2].map((detective) => {
            if ((record.searchFlags & (1 << detective)) === 0) return null;
            return revealedCodes[codeCursor++] ?? null;
          });
        } else {
          const pairs = DETECTIVES.flatMap((_, detective) => {
            const handle = record.codes[detective];
            if ((record.searchFlags & (1 << detective)) === 0 || handle === undefined) return [];
            return [{ encryptedValue: handle, contractAddress: reader.address }];
          });
          if (pairs.length > 0) {
            try {
              await ensurePermits([reader.address]);
              const clear = await userDecrypt(pairs);
              codes = [0, 1, 2].map((detective) => {
                const handle = record.codes[detective];
                if ((record.searchFlags & (1 << detective)) === 0 || handle === undefined) {
                  return null;
                }
                const value = clear[handle];
                return value === undefined ? null : Number(value);
              });
            } catch {
              codes = [null, null, null];
            }
          }
        }
        decoded.push({ turn, report, camera: report >> 2, outcome, codes });
        if (cancelled) return;
        setCellsByTurn({ ...cells });
        setHistory([...decoded]);
      }
    })().catch((error: unknown) => {
      if (!cancelled) setHistoryError(mapError(error));
    });
    return () => {
      cancelled = true;
    };
  }, [caseId, state.caseId, state.phase, state.turn]);

  const entries = useMemo(() => {
    const byTurn = new Map<number, DecodedTurn>();
    for (const entry of history) byTurn.set(entry.turn, entry);
    for (const entry of log) byTurn.set(entry.turn, entry);
    return [...byTurn.values()].sort((a, b) => a.turn - b.turn);
  }, [history, log]);

  const overlayCells = useMemo(() => {
    const cells = { ...cellsByTurn };
    if (state.turn > 0) cells[state.turn] = state.cells;
    return cells;
  }, [cellsByTurn, state.cells, state.turn]);

  const [dispatch, setDispatch] = useState<DispatchInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [decodeStart, setDecodeStart] = useState<number | null>(null);
  const dispatchTurn = useRef<number | null>(null);
  const trackedTurn = dispatch?.turn ?? null;

  useEffect(() => {
    const active =
      state.phase === "sending" || state.phase === "mining" || state.phase === "decoding";
    if (!active) {
      if (state.phase === "planning" || state.phase === "ended" || state.phase === "error") {
        dispatchTurn.current = null;
      }
      return;
    }
    const turn = state.turn + 1;
    const timestamp = Date.now();
    setDispatch((previous) => {
      const base: DispatchInfo =
        previous?.turn === turn
          ? previous
          : {
              turn,
              signedAt: null,
              minedAt: null,
              block: null,
              computedAt: null,
              decodedAt: null,
            };
      if (state.phase === "sending") return { ...base, signedAt: base.signedAt ?? timestamp };
      if (state.phase === "mining") {
        return {
          ...base,
          signedAt: base.signedAt ?? timestamp,
          minedAt: base.minedAt ?? timestamp,
        };
      }
      return {
        ...base,
        signedAt: base.signedAt ?? timestamp,
        minedAt: base.minedAt ?? timestamp,
        computedAt: base.computedAt ?? timestamp,
      };
    });
  }, [state.phase, state.turn]);

  useEffect(() => {
    if (state.phase !== "mining" || trackedTurn === null) return;
    let cancelled = false;
    void publicClient
      .getBlockNumber()
      .then((block) => {
        if (!cancelled) {
          setDispatch((previous) =>
            previous?.turn === trackedTurn ? { ...previous, block: block.toString() } : previous,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [trackedTurn, state.phase]);

  useEffect(() => {
    if (trackedTurn === null) return;
    const decoded = log.find((entry) => entry.turn === trackedTurn);
    if (decoded === undefined) return;
    setDispatch((previous) =>
      previous?.turn === trackedTurn && previous.decodedAt === null
        ? { ...previous, decodedAt: Date.now() }
        : previous,
    );
  }, [trackedTurn, log]);

  useEffect(() => {
    const active =
      state.phase === "sending" || state.phase === "mining" || state.phase === "decoding";
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "decoding") setDecodeStart((start) => start ?? Date.now());
    else if (state.phase !== "sending" && state.phase !== "mining") setDecodeStart(null);
  }, [state.phase]);

  useEffect(() => {
    if (state.error?.kind !== "rpcUnreachable") return;
    const timer = window.setInterval(() => retry(), 5_000);
    return () => window.clearInterval(timer);
  }, [retry, state.error?.kind]);

  const forcedInvalid = useRef(false);
  useEffect(() => {
    if (
      forcedInvalid.current ||
      state.phase !== "planning" ||
      !window.location.search.includes("invalidOrders=1")
    ) {
      return;
    }
    forcedInvalid.current = true;
    const target = state.cells.includes(0) ? 119 : 0;
    setOrders({
      ...state.orders,
      to: [target, state.orders.to[1] ?? 30, state.orders.to[2] ?? 41],
    });
  }, [setOrders, state.cells, state.orders, state.phase]);

  const mapRef = useRef<HTMLDivElement>(null);
  const [overlayRect, setOverlayRect] = useState<OverlayRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
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
  }, []);

  if (!valid || caseId === null) {
    return (
      <main>
        <h1>Invalid case</h1>
      </main>
    );
  }

  function toggleSearch(index: number) {
    if (state.phase !== "planning") return;
    setOrders({
      ...state.orders,
      searchFlags: state.orders.searchFlags ^ (1 << index),
    });
  }

  const latestTurn = entries.reduce((latest, entry) => Math.max(latest, entry.turn), 0);
  const latestEntry = entries[entries.length - 1];
  const stampWords = ["NOTHING", "COLD", "FRESH"] as const;
  const stamps = entries.flatMap((entry) => {
    const cells = overlayCells[entry.turn];
    if (cells === undefined) return [];
    return [0, 1, 2].flatMap((detective) => {
      const cell = cells[detective];
      const code = entry.codes[detective];
      if (cell === undefined || code == null || code < 0 || code > 2) return [];
      return [
        <Stamp
          key={`stamp-${entry.turn}-${detective}`}
          caseId={caseId}
          turn={entry.turn}
          detective={detective}
          cell={cell}
          code={code}
          hour={hourOf(entry.turn)}
          latest={entry.turn === latestTurn}
        />,
      ];
    });
  });
  const sightings = entries.flatMap((entry) => {
    const camera = CAMERAS.find((item) => item.id === entry.camera);
    if (camera === undefined) return [];
    return [
      <Sighting
        key={`sighting-${entry.turn}`}
        cell={camera.cell}
        hour={hourOf(entry.turn)}
        latest={entry.turn === latestTurn}
      />,
    ];
  });

  const desktop = layout === "desktop";
  const tablet = layout === "tablet";
  const inFlight =
    state.phase === "sending" || state.phase === "mining" || state.phase === "decoding";
  const clockTurn =
    inFlight || state.phase === "planning" ? state.turn + 1 : Math.max(state.turn, 1);
  const outerStyle = {
    width: "min(100%, 1440px)",
    maxWidth: "none",
    margin: "0 auto",
    padding: layout === "mobile" ? "var(--space-3)" : "var(--space-6)",
  };
  const forcedError = window.location.search.match(/[?&]state=([a-zA-Z]+)/)?.[1] as ErrorKey | null;
  const shownError = forcedError ?? state.error?.kind ?? null;
  const columnsStyle = {
    display: "flex",
    flexDirection: desktop ? "row" : "column",
    alignItems: "flex-start",
    gap: desktop ? "var(--space-6)" : "var(--space-4)",
  } as const;
  const mapStyle = {
    flex: desktop ? "0 1 62%" : "1 1 auto",
    width: "100%",
    maxWidth: "860px",
    minWidth: 0,
  };
  const asideStyle: CSSProperties = {
    flex: desktop ? "1 1 38%" : "1 1 auto",
    width: "100%",
    minWidth: desktop ? "340px" : 0,
    display: "grid",
    gap: "var(--space-5)",
    padding: layout === "mobile" ? "var(--space-4)" : "var(--space-5)",
    border: "1px solid var(--desk-line)",
    borderRadius: "var(--radius)",
    background: "var(--desk-2)",
    ...(tablet ? { gridTemplateColumns: "1fr 1fr" } : {}),
  };

  return (
    <main style={outerStyle}>
      <h1 style={{ marginBottom: "var(--space-5)" }}>Case #{caseId.toString()}</h1>
      <div style={{ position: "relative" }}>
        <div style={columnsStyle}>
          <div style={mapStyle}>
            <div ref={mapRef} style={{ position: "relative" }}>
              <MapBoard
                cells={state.cells}
                orders={state.orders}
                selectedDetective={selectedDetective}
                search={(state.orders.searchFlags & (1 << selectedDetective)) !== 0}
                onSelectDetective={setSelectedDetective}
                onOrdersChange={setOrders}
                onSearchToggle={toggleSearch}
              />
              {overlayRect.width > 0 ? (
                <svg
                  className="case-stamps"
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
                  {stamps}
                  {sightings}
                </svg>
              ) : null}
              {state.phase === "ended" || state.phase === "verified" ? (
                <EndCard
                  caseId={caseId}
                  state={state}
                  entries={entries}
                  onOpenCaseFile={() => void resolveAndReveal()}
                />
              ) : null}
            </div>
          </div>
          <aside style={asideStyle}>
            <TurnClock completedTurns={state.turn} phase={state.phase} />
            <details key={layout} open={layout === "mobile" ? undefined : true}>
              <summary
                style={{
                  display: layout === "mobile" ? "flex" : "none",
                  minHeight: "var(--space-7)",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  color: "var(--chalk)",
                }}
              >
                <span>Send orders</span>
                <span>{hourOf(Math.min(clockTurn, TURNS))}</span>
              </summary>
              <OrdersPanel
                state={state}
                selectedDetective={selectedDetective}
                onSelectDetective={setSelectedDetective}
                onSearchToggle={toggleSearch}
                onSend={() => void sendTurn()}
                onRetry={() => void retry()}
              />
            </details>
            <DispatchStrip phase={state.phase} info={dispatch} now={now} />
            <RadioLog
              entries={entries}
              cellsByTurn={overlayCells}
              collapsible={layout === "mobile"}
            />
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {latestEntry === undefined
                ? ""
                : `${hourOf(latestEntry.turn)} stamps: ${DETECTIVES.map((name, detective) => {
                    const code = latestEntry.codes[detective];
                    return `${name} ${code === null || code === undefined ? "no search" : (stampWords[code] ?? "NOTHING")}`;
                  }).join("; ")}`}
            </p>
            {shownError !== null ? (
              <Notice
                tone="error"
                kind={shownError}
                context={{
                  address: getOrCreateBurner().address,
                  elapsedMs: decodeStart === null ? 0 : now - decodeStart,
                }}
                action={
                  <>
                    {shownError === "outOfFuel" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(getOrCreateBurner().address)
                        }
                      >
                        Copy address
                      </button>
                    ) : null}{" "}
                    <Button type="button" onClick={() => void retry()}>
                      Try again
                    </Button>
                  </>
                }
              />
            ) : null}
            {historyError !== null ? (
              <Notice
                tone="warning"
                kind={historyError}
                action={
                  <Button type="button" onClick={() => void retry()}>
                    Try again
                  </Button>
                }
              />
            ) : null}
          </aside>
        </div>
        <Coach
          caseId={caseId}
          displayTurn={clockTurn}
          planning={state.phase === "planning"}
          layout={layout}
        />
      </div>
    </main>
  );
}
