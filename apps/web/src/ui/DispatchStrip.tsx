import type { CasePhase } from "../game/caseMachine.ts";

export interface DispatchInfo {
  turn: number;
  signedAt: number | null;
  minedAt: number | null;
  block: string | null;
  computedAt: number | null;
  decodedAt: number | null;
}

interface DispatchStripProps {
  phase: CasePhase;
  info: DispatchInfo | null;
  now: number;
}

function seconds(from: number | null, to: number | null): string {
  if (from === null || to === null) return "—";
  return `${Math.max(0, (to - from) / 1000).toFixed(1)}s`;
}

export function DispatchStrip({ phase, info, now }: DispatchStripProps) {
  if (info === null || (phase !== "sending" && phase !== "mining" && phase !== "decoding")) {
    return null;
  }

  const steps = [
    { key: "signed", label: "Orders signed", at: info.signedAt, from: info.signedAt },
    {
      key: "mined",
      label: info.block === null ? "On chain" : `On chain · block ${info.block}`,
      at: info.minedAt,
      from: info.signedAt,
    },
    {
      key: "computed",
      label: "Night move computed",
      at: info.computedAt,
      from: info.minedAt,
    },
    {
      key: "decoded",
      label: "Dispatch decoded",
      at: info.decodedAt,
      from: info.computedAt,
    },
  ];
  const totalSeconds = seconds(info.signedAt, info.decodedAt ?? now);
  const narrative =
    phase === "decoding"
      ? "The city is moving. The report is being decrypted."
      : phase === "mining"
        ? "Your orders are on the way. Waiting for the block."
        : "Signing your orders.";

  return (
    <section aria-label="Dispatch progress" aria-live="polite">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-small)",
          color: "var(--chalk-2)",
        }}
      >
        <span>Dispatch · turn {info.turn}</span>
        <span>{totalSeconds}</span>
      </div>
      <p
        style={{
          margin: "var(--space-2) 0 0",
          color: "var(--chalk)",
          fontSize: "var(--text-small)",
        }}
      >
        {narrative}
      </p>
      <ol
        style={{
          listStyle: "none",
          margin: "var(--space-2) 0 0",
          padding: 0,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-small)",
          lineHeight: "var(--leading-small)",
        }}
      >
        {steps.map((step) => (
          <li
            key={step.key}
            style={{
              display: "flex",
              gap: "var(--space-2)",
              color: step.at === null ? "var(--chalk-2)" : "var(--chalk)",
            }}
          >
            <span aria-hidden="true" style={{ width: "1em" }}>
              {step.at === null ? "·" : "✓"}
            </span>
            <span style={{ flex: 1 }}>{step.label}</span>
            <span>{seconds(step.from, step.at ?? now)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
