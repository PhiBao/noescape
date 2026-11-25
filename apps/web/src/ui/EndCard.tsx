import { EXITS } from "@noescape/engine";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import type { CaseMachineState } from "../game/caseMachine.ts";
import { shareLine } from "../game/share.ts";
import type { DecodedTurn } from "../game/useCase.ts";
import { Button } from "./Button.tsx";
import { hourOf } from "./TurnClock.tsx";

interface EndCardProps {
  caseId: bigint;
  state: CaseMachineState;
  entries: readonly DecodedTurn[];
  onOpenCaseFile(): void;
}

interface VerifyTiming {
  filed: number | null;
  decrypted: number | null;
  checked: number | null;
}

const emptyTiming: VerifyTiming = { filed: null, decrypted: null, checked: null };

function seconds(from: number | null, to: number | null): string {
  if (from === null || to === null) return "—";
  return `${Math.max(0, (to - from) / 1000).toFixed(1)}s`;
}

export function EndCard({ caseId, state, entries, onOpenCaseFile }: EndCardProps) {
  const [, navigate] = useLocation();
  const [exitName, setExitName] = useState("exit");
  const [copied, setCopied] = useState(false);
  const [requested, setRequested] = useState(false);
  const [timing, setTiming] = useState<VerifyTiming>(emptyTiming);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.outcome !== "escaped") return;
    void getNoEscapeCaseReader()
      .read.getCase([caseId])
      .then((opened) => setExitName(EXITS[Number(opened.exitClear)]?.name ?? "exit"))
      .catch(() => undefined);
  }, [caseId, state.outcome]);

  useEffect(() => {
    const timestamp = Date.now();
    if (state.phase === "resolving") {
      setTiming((previous) => ({ ...previous, filed: previous.filed ?? timestamp }));
    } else if (state.phase === "revealing") {
      setTiming((previous) => ({
        ...previous,
        filed: previous.filed ?? timestamp,
        decrypted: previous.decrypted ?? timestamp,
      }));
    } else if (state.phase === "verified") {
      setTiming((previous) => ({
        filed: previous.filed ?? timestamp,
        decrypted: previous.decrypted ?? timestamp,
        checked: previous.checked ?? timestamp,
      }));
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "resolving" && state.phase !== "revealing") return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (!requested || !state.verified) return;
    const timer = window.setTimeout(() => navigate(`/case/${caseId}/file`), 1800);
    return () => window.clearTimeout(timer);
  }, [caseId, navigate, requested, state.verified]);

  const counts = useMemo(() => {
    let searches = 0;
    let fresh = 0;
    let sightings = 0;
    for (const entry of entries) {
      for (const code of entry.codes) {
        if (code === null || code === undefined) continue;
        searches += 1;
        if (code === 2) fresh += 1;
      }
      if (entry.camera > 0) sightings += 1;
    }
    return { searches, fresh, sightings };
  }, [entries]);

  const outcome = state.outcome ?? "abandoned";
  const hour = outcome === "dawn" ? "08:00" : hourOf(Math.max(state.turn, 1));
  const stamp =
    outcome === "caught"
      ? `CAUGHT ${hour}`
      : outcome === "escaped"
        ? `ESCAPED · ${exitName.toUpperCase()}`
        : outcome === "dawn"
          ? "GONE AT DAWN"
          : "CASE ABANDONED";
  const stampColor =
    outcome === "caught"
      ? "var(--grease)"
      : outcome === "abandoned"
        ? "var(--ink-2)"
        : "var(--ink)";
  const text = shareLine({
    caseId,
    outcome,
    hour,
    searches: counts.searches,
    fresh: counts.fresh,
    sightings: counts.sightings,
    exitName,
    url: window.location.origin,
    verified: state.verified,
  });

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function openFile() {
    setRequested(true);
    onOpenCaseFile();
  }

  const steps = [
    { key: "filed", label: "Report filed", at: timing.filed, from: timing.filed },
    { key: "decrypted", label: "Path decrypted (KMS)", at: timing.decrypted, from: timing.filed },
    { key: "checked", label: "Checked on chain", at: timing.checked, from: timing.decrypted },
  ];

  return (
    <section
      aria-label="Case result"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 7,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "#15120fcc",
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: stampColor,
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 6vw, 88px)",
          fontWeight: 800,
          lineHeight: 0.95,
          maxWidth: "94%",
          transform: "rotate(-6deg)",
          opacity: 0.94,
          pointerEvents: "none",
        }}
      >
        {stamp}
      </div>
      <div className="paper" style={{ padding: "var(--space-5)", maxWidth: "520px" }}>
        <p style={{ marginBottom: "var(--space-4)" }}>
          {state.turn} hours · {counts.searches} searches · {counts.fresh} FRESH ·{" "}
          {counts.sightings} {counts.sightings === 1 ? "sighting" : "sightings"}
        </p>
        {requested ? (
          <ol
            aria-label="Case file progress"
            style={{
              listStyle: "none",
              margin: "0 0 var(--space-4)",
              padding: 0,
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-small)",
            }}
          >
            {steps.map((step) => (
              <li key={step.key} style={{ display: "flex", gap: "var(--space-2)" }}>
                <span aria-hidden="true" style={{ width: "1em" }}>
                  {step.at === null ? "·" : "✓"}
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>{step.label}</span>
                <span>{seconds(step.from, step.at ?? now)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            justifyContent: "center",
          }}
        >
          <Button type="button" disabled={requested} onClick={openFile}>
            Open the case file
          </Button>
          <Button type="button" variant="secondary" onClick={() => void copyResult()}>
            {copied ? "Copied" : "Copy result"}
          </Button>
        </div>
        <p
          style={{
            margin: "var(--space-3) 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            color: "var(--ink-2)",
            overflowWrap: "anywhere",
          }}
        >
          {text}
        </p>
      </div>
    </section>
  );
}
