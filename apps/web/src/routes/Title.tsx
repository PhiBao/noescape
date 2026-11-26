import { type DetectiveCells, PRECINCT } from "@noescape/engine";
import { useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { Link, useLocation } from "wouter";
import { getOrCreateBurner } from "../chain/burner.ts";
import { publicClient } from "../chain/clients.ts";
import { getNoEscapeCase, getNoEscapeCaseReader } from "../chain/contracts.ts";
import { requestDrip } from "../chain/drip.ts";
import { type ErrorKey, mapError } from "../chain/errors.ts";
import { config } from "../config.ts";
import { useCase } from "../game/useCase.ts";
import { Briefing } from "../ui/Briefing.tsx";
import { Button } from "../ui/Button.tsx";
import { MapBoard } from "../ui/MapBoard.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Wordmark } from "../ui/Wordmark.tsx";

const previewCells: DetectiveCells = [PRECINCT[0].cell, PRECINCT[1].cell, PRECINCT[2].cell];
const previewOrders = { to: previewCells, searchFlags: 0 };

interface BadgeState {
  badge: string | null;
  fuelSeconds: number | null;
  block: string | null;
  error: ErrorKey | null;
}

const emptyBadge: BadgeState = { badge: null, fuelSeconds: null, block: null, error: null };

function shortAddress(address: Hex): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function useMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

export function Title() {
  const [, navigate] = useLocation();
  const { state, openNewCase, retry } = useCase();
  const [badge, setBadge] = useState<BadgeState>(emptyBadge);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [briefing, setBriefing] = useState<{ id: bigint; address: Address } | null>(null);
  const fuelAt = useRef(0);
  const mobile = useMobile();

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  async function startCase() {
    setBadge(emptyBadge);
    setBriefing(null);
    setConfirmAbandon(false);
    setRunning(true);
    try {
      const account = getOrCreateBurner();
      setBadge((previous) => ({ ...previous, badge: shortAddress(account.address) }));
      const forced = window.location.search.match(/[?&]state=([a-zA-Z]+)/)?.[1];
      const forcedKeys: ErrorKey[] = [
        "alreadyFunded",
        "tooSoon",
        "dailyCapReached",
        "outOfFuel",
        "rpcUnreachable",
        "relayerSlow",
      ];
      if (forcedKeys.includes(forced as ErrorKey)) {
        setBadge((previous) => ({ ...previous, error: forced as ErrorKey }));
        return;
      }
      fuelAt.current = Date.now();
      setNow(fuelAt.current);
      const drip = await requestDrip(account.address);
      if (drip.error !== undefined && drip.error !== "alreadyFunded") {
        setBadge((previous) => ({ ...previous, error: drip.error ?? null }));
        return;
      }
      setBadge((previous) => ({
        ...previous,
        fuelSeconds: (Date.now() - fuelAt.current) / 1000,
      }));
      const id = await openNewCase(async () => undefined);
      if (id === null) {
        setBadge((previous) => ({
          ...previous,
          error: "unknown",
        }));
        return;
      }
      const block = await publicClient.getBlockNumber();
      setBadge((previous) => ({ ...previous, block: block.toString() }));
      const stats = await getNoEscapeCaseReader().read.statsOf([account.address]);
      if (
        Number(stats[0]) === 1 &&
        window.localStorage.getItem("noescape.briefing.v1") !== account.address
      ) {
        setBriefing({ id, address: account.address });
      } else {
        navigate(`/case/${id}`);
      }
    } catch (error) {
      setBadge((previous) => ({ ...previous, error: mapError(error) }));
    } finally {
      setRunning(false);
    }
  }

  async function abandonAndStart() {
    if (state.caseId === null) return;
    try {
      const account = getOrCreateBurner();
      const hash = await getNoEscapeCase(account).write.abandonCase([state.caseId]);
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (error) {
      setBadge({ ...emptyBadge, error: mapError(error) });
      return;
    }
    await startCase();
  }

  function startBriefing() {
    if (briefing === null) return;
    window.localStorage.setItem("noescape.briefing.v1", briefing.address);
    navigate(`/case/${briefing.id}`);
  }

  const featured = config.featuredCaseId.trim() === "" ? null : Number(config.featuredCaseId);
  const showFlow = running || badge.badge !== null || badge.block !== null || badge.error !== null;

  return (
    <main
      style={{
        position: "relative",
        display: "flex",
        width: "min(100%, 1440px)",
        maxWidth: "none",
        minHeight: "100vh",
        alignItems: "center",
        margin: "0 auto",
        padding: mobile ? "var(--space-5)" : "var(--space-9)",
        overflow: "hidden",
      }}
    >
      <style>{`.title-map .map-pins,.title-map .map-cameras,.title-map .map-cells,.title-map .map-key{display:none}`}</style>
      <div style={{ position: "relative", zIndex: 1, width: "min(100%, 560px)" }}>
        <h1>
          <Wordmark />
        </h1>
        <p style={{ maxWidth: "34ch", fontSize: "20px" }}>
          A fugitive is hiding in this city. Nobody knows where — not you, not the chain, not us.
          Find it before dawn.
        </p>
        <p style={{ display: "grid", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {featured !== null && Number.isInteger(featured) && featured > 0 ? (
            <Link href={`/case/${featured}/file`}>Watch a solved case →</Link>
          ) : null}
          <Link href="/most-wanted">Most Wanted today →</Link>
        </p>
        {typeof window !== "undefined" && window.location.search.includes("state=activeCase") ? (
          <Notice
            tone="warning"
            kind="activeCase"
            context={{ caseId: Number(window.location.search.match(/case=(\d+)/)?.[1] ?? 2) }}
            action={<Link href="/case/2">Resume</Link>}
          />
        ) : null}
        {state.caseId !== null ? (
          <Notice
            tone="warning"
            kind="activeCase"
            context={{ caseId: state.caseId }}
            action={<Link href={`/case/${state.caseId}`}>Resume</Link>}
          />
        ) : null}
        {state.caseId !== null ? (
          <Link className="button button--primary" href={`/case/${state.caseId}`}>
            Resume case #{state.caseId.toString()}
          </Link>
        ) : (
          <Button type="button" disabled={running} onClick={() => void startCase()}>
            Take the case
          </Button>
        )}
        {state.caseId !== null ? (
          <p style={{ marginTop: "var(--space-2)" }}>
            {confirmAbandon ? (
              <>
                Abandon case #{state.caseId.toString()}?{" "}
                <button type="button" onClick={() => void abandonAndStart()}>
                  Confirm
                </button>{" "}
                <button type="button" onClick={() => setConfirmAbandon(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setConfirmAbandon(true)}
              >
                Abandon and start new
              </button>
            )}
          </p>
        ) : null}
        <p
          style={{
            marginTop: "var(--space-4)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            color: "var(--chalk-2)",
          }}
        >
          Runs on Sepolia · encrypted with Zama FHEVM · no wallet needed
        </p>
        <section aria-label="How to play" style={{ marginTop: "var(--space-5)", maxWidth: "60ch" }}>
          <h2 style={{ marginBottom: "var(--space-2)" }}>How to play</h2>
          <ol
            style={{
              margin: 0,
              paddingLeft: "var(--space-5)",
              color: "var(--chalk-2)",
              fontSize: "var(--text-small)",
              lineHeight: "var(--leading-small)",
            }}
          >
            <li>Take the case — a burner key is made in your browser. No wallet needed.</li>
            <li>
              Each hour, select a detective, click a brass square, choose Search or Sprint, then
              send orders.
            </li>
            <li>
              Read the stamps: NOTHING, COLD or FRESH tell you how close the trail was. Catch the
              fugitive before dawn.
            </li>
          </ol>
        </section>
        {showFlow ? (
          <div
            aria-live="polite"
            style={{
              marginTop: "var(--space-5)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--leading-mono)",
              color: "var(--chalk-2)",
            }}
          >
            <p>
              {badge.badge !== null ? "✓" : "·"} ISSUING BADGE ………… {badge.badge ?? ""}
            </p>
            <p>
              {badge.fuelSeconds !== null ? "✓" : "·"} REQUESTING FUEL ………{" "}
              {badge.fuelSeconds !== null
                ? `${badge.fuelSeconds.toFixed(1)}s`
                : `${((now - fuelAt.current) / 1000).toFixed(1)}s`}
            </p>
            <p>
              {badge.block !== null ? "✓" : "·"} OPENING CASE FILE ……{" "}
              {badge.block !== null ? `block #${badge.block}` : ""}
            </p>
            {badge.error !== null ? (
              <Notice
                tone="error"
                kind={badge.error}
                action={
                  <>
                    <Link href={state.caseId !== null ? `/case/${state.caseId}` : "/case/2/file"}>
                      {state.caseId !== null ? "Continue" : "Watch a solved case"}
                    </Link>{" "}
                    <Button type="button" onClick={() => void startCase()}>
                      Retry
                    </Button>
                  </>
                }
              />
            ) : null}
          </div>
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
        {briefing !== null ? (
          <div style={{ marginTop: "var(--space-5)" }}>
            <Briefing caseId={briefing.id} address={briefing.address} onStart={startBriefing} />
          </div>
        ) : null}
      </div>
      {!mobile ? (
        <div
          className="title-map"
          aria-hidden="true"
          inert
          style={{
            position: "absolute",
            right: "4vw",
            top: "50%",
            width: "min(420px, 33vw)",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        >
          <MapBoard
            cells={previewCells}
            orders={previewOrders}
            selectedDetective={0}
            search={false}
            onSelectDetective={() => undefined}
            onOrdersChange={() => undefined}
            onSearchToggle={() => undefined}
          />
        </div>
      ) : null}
    </main>
  );
}
