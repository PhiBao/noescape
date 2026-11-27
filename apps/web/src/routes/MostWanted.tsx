import { xy } from "@noescape/engine";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import { Link } from "wouter";
import type { ErrorKey } from "../chain/errors.ts";
import { useDaily } from "../game/useDaily.ts";
import { Button } from "../ui/Button.tsx";
import { MapBoard } from "../ui/MapBoard.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Sighting, Stamp } from "../ui/Stamp.tsx";

function txLink(label: string, hash: Hex | undefined): ReactNode {
  if (hash === undefined) return null;
  return (
    <a href={`https://sepolia.etherscan.io/tx/${hash}`}>
      {label} · {hash.slice(0, 10)}…
    </a>
  );
}

function countdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MostWanted() {
  const daily = useDaily();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const mapRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const wrapper = mapRef.current;
    const svg = wrapper?.querySelector("svg.map-svg");
    if (wrapper == null || svg == null) return;
    const update = () => {
      const outer = wrapper.getBoundingClientRect();
      const inner = svg.getBoundingClientRect();
      setRect({
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

  const state = daily.state;
  const dayLabel =
    state.day === null ? "—" : new Date(state.day * 86_400_000).toISOString().slice(0, 10);
  const secondsLeft = 1_800 - (Math.floor(tick / 1000) % 1_800);
  const mine = daily.address !== null && state.winner === daily.address;
  const huntedThisWatch = state.joined && state.lastWatch === state.watch;
  const forcedError = window.location.search.match(/[?&]state=([a-zA-Z]+)/)?.[1] as ErrorKey | null;
  const shownError = forcedError ?? daily.errorKey ?? state.error?.kind ?? null;
  const forcedHunted = window.location.search.includes("once=1");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        width: "min(100%, 1200px)",
        maxWidth: "none",
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "grid",
        gap: "var(--space-5)",
      }}
    >
      <h1 className="sr-only">Most Wanted</h1>
      <section
        aria-label="Most Wanted header"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-5)",
          padding: "var(--space-4)",
          border: "1px solid var(--desk-line)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-small)",
        }}
      >
        <span>MOST WANTED · {dayLabel}</span>
        <span>Next watch in {countdown(secondsLeft)}</span>
        <span>Hunters {daily.hunterCount}</span>
        <span>Bounty: confidential cUSDT, 5 per entry</span>
      </section>
      <p
        style={{
          margin: 0,
          maxWidth: "70ch",
          color: "var(--chalk-2)",
          fontSize: "var(--text-small)",
        }}
      >
        One shared fugitive for everyone today. Your stamps are encrypted to you; other hunters only
        see where you stand. The bounty is paid in confidential cUSDT.
      </p>

      {!state.joined ? (
        <section
          className="paper"
          aria-label="Join today's hunt"
          style={{ padding: "var(--space-5)", display: "grid", gap: "var(--space-3)" }}
        >
          <h2 style={{ marginTop: 0 }}>Join today's hunt</h2>
          <div>
            <Button
              type="button"
              disabled={
                busy ||
                state.phase === "minting" ||
                state.phase === "approving" ||
                state.phase === "wrapping"
              }
              onClick={() => void run(daily.setupTokens)}
            >
              Get 100 test cUSDT
            </Button>{" "}
            {txLink("mint", state.tx.mint)} {txLink("approve", state.tx.approve)}{" "}
            {txLink("wrap", state.tx.wrap)}
          </div>
          <div>
            <Button
              type="button"
              disabled={
                busy ||
                state.phase === "minting" ||
                state.phase === "approving" ||
                state.phase === "wrapping"
              }
              onClick={() => void run(daily.authorise)}
            >
              Authorise the bounty desk
            </Button>{" "}
            {txLink("operator", state.tx.operator)}
          </div>
          <div>
            <Button
              type="button"
              disabled={busy || state.phase === "operator"}
              onClick={() => void run(daily.join)}
            >
              Join (5 cUSDT)
            </Button>{" "}
            {txLink("join", state.tx.join)}
          </div>
        </section>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        <div className="most-wanted-map" ref={mapRef} style={{ position: "relative", minWidth: 0 }}>
          <style>{`.most-wanted-map .map-pins,.most-wanted-map .map-cells{display:none}`}</style>
          <MapBoard
            cells={[state.cell, state.cell, state.cell]}
            orders={{
              to: [state.cell, state.cell, state.cell],
              searchFlags: state.orders.search ? 1 : 0,
            }}
            selectedDetective={0}
            search={state.orders.search}
            onSelectDetective={() => undefined}
            onOrdersChange={() => undefined}
            onSearchToggle={() => undefined}
          />
          {rect.width > 0 ? (
            <svg
              viewBox="0 0 12 10"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                overflow: "visible",
                pointerEvents: "none",
              }}
            >
              {daily.hunters.map((hunter) => {
                const { x, y } = xy(hunter.cell);
                return (
                  <circle
                    key={hunter.address}
                    cx={x + 0.5}
                    cy={y + 0.5}
                    r="0.16"
                    fill={hunter.address === daily.address ? "var(--brass)" : "var(--ink-2)"}
                    stroke="var(--desk)"
                    strokeWidth="0.03"
                  />
                );
              })}
              {daily.sightings.map((sighting) => (
                <Sighting
                  key={`${sighting.cell}-${sighting.hour}`}
                  cell={sighting.cell}
                  hour={sighting.hour}
                  latest
                />
              ))}
              {state.joined && daily.myCode !== null ? (
                <Stamp
                  caseId={BigInt(state.day ?? 0)}
                  turn={state.watch}
                  detective={0}
                  cell={state.cell}
                  code={daily.myCode}
                  hour={daily.watchLabel}
                  latest
                />
              ) : null}
            </svg>
          ) : null}
        </div>
        <aside style={{ display: "grid", gap: "var(--space-4)" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-small)",
              color: "var(--chalk-2)",
            }}
          >
            Your stamps are encrypted to you. Other hunters see only where you stand.
          </p>
          {forcedHunted ? (
            <Notice tone="warning">
              You've hunted this watch. Next watch in {countdown(secondsLeft)}.
            </Notice>
          ) : null}
          {state.joined && state.status === 1 ? (
            <section
              className="paper"
              aria-label="Hunt orders"
              style={{ padding: "var(--space-4)", display: "grid", gap: "var(--space-3)" }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={state.orders.search}
                  disabled={state.phase !== "planning"}
                  onChange={() =>
                    void daily.setOrders({ ...state.orders, search: !state.orders.search })
                  }
                />{" "}
                Search
              </label>
              <label style={{ fontFamily: "var(--font-mono)" }}>
                Destination{" "}
                <input
                  type="number"
                  min={0}
                  max={119}
                  value={state.orders.to}
                  disabled={state.phase !== "planning"}
                  onChange={(event) =>
                    void daily.setOrders({ ...state.orders, to: Number(event.target.value) })
                  }
                  style={{ width: "72px", padding: "var(--space-1)" }}
                />
              </label>
              {huntedThisWatch || forcedHunted ? (
                <Notice tone="warning">
                  You've hunted this watch. Next watch in {countdown(secondsLeft)}.
                </Notice>
              ) : null}
              <Button
                type="button"
                disabled={!daily.canHunt || !daily.validOrder(state.orders.to, state.orders.search)}
                onClick={() => void daily.hunt()}
              >
                {daily.canHunt ? "Hunt" : `Next watch in ${countdown(secondsLeft)}`}
              </Button>
              {txLink("hunt", state.tx.hunt)}
            </section>
          ) : null}
          {state.status === 2 && mine ? (
            <section aria-label="Capture">
              <p
                style={{
                  color: "var(--grease)",
                  fontFamily: "var(--font-display)",
                  fontSize: "40px",
                  fontWeight: 800,
                }}
              >
                CAUGHT BY YOU
              </p>
              <p>Bounty sent — only you can read the amount</p>
              <Button type="button" onClick={() => void daily.decryptPayout()}>
                Decrypt your cUSDT balance
              </Button>
              {daily.payout !== null ? (
                <p style={{ fontFamily: "var(--font-mono)" }}>{daily.payout}</p>
              ) : null}
              {txLink("claim", state.tx.claim)}
            </section>
          ) : null}
          {state.status === 2 && !mine ? (
            <p>
              {state.winner === null ? "Caught" : `CAUGHT BY ${daily.shortAddress(state.winner)}`}
            </p>
          ) : null}
          {state.status === 3 ? (
            <p style={{ fontFamily: "var(--font-display)", fontSize: "32px" }}>GOT AWAY</p>
          ) : null}
          {state.phase === "dayOver" || state.phase === "verified" ? (
            <section style={{ display: "grid", gap: "var(--space-2)" }}>
              <Button
                type="button"
                disabled={state.verified}
                onClick={() => void daily.verifyDay()}
              >
                {state.verified ? "Day verified" : "Verify day"}
              </Button>
              {state.verified && state.day !== null ? (
                <Link href={`/case/${state.day}/file?day=${state.day}`}>Open the day's file</Link>
              ) : null}
            </section>
          ) : null}
          {shownError !== null ? (
            <Notice
              tone="error"
              kind={shownError}
              context={{ address: daily.address ?? undefined }}
              action={
                <Button type="button" onClick={daily.retry}>
                  Retry this step
                </Button>
              }
            />
          ) : null}
          {daily.errorKey === null && daily.message !== "" ? (
            <p role="alert" style={{ color: "var(--grease)" }}>
              {daily.message}
            </p>
          ) : null}
          {state.error !== null ? (
            <Notice
              tone="error"
              kind={state.error.kind}
              action={
                <Button type="button" onClick={daily.retry}>
                  Retry
                </Button>
              }
            />
          ) : null}
        </aside>
      </div>
      <p>
        <Link href="/">Back to the desk</Link>
      </p>
    </main>
  );
}
