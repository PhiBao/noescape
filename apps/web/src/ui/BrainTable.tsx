import { bit, brainStep, type CaseRecord, cellOf, W } from "@noescape/engine";
import { hourOf } from "./TurnClock.tsx";

interface BrainTableProps {
  record: CaseRecord;
  turnIndex: number;
  exitName: string;
}

const directions = ["stay", "north", "east", "south", "west"] as const;

function directionOf(from: number, to: number): number {
  if (from === to) return 0;
  if (to === from - W) return 1;
  if (to === from + 1) return 2;
  if (to === from + W) return 3;
  if (to === from - 1) return 4;
  return -1;
}

export function BrainTable({ record, turnIndex, exitName }: BrainTableProps) {
  const turn = record.turns[turnIndex - 1];
  const current = record.path[turnIndex - 1];
  const next = record.path[turnIndex];
  if (turn === undefined || current === undefined || next === undefined) return null;

  const detectiveMask = turn.to.reduce((mask, cell) => mask | bit(cell), 0n);
  const step = brainStep(bit(current), record.exitIdx, detectiveMask, turn.noise, true);
  const actual = directionOf(current, next);
  const matches = actual === step.chosen && cellOf(step.newPos) === next;

  return (
    <section aria-label="Brain table" style={{ marginTop: "var(--space-5)" }}>
      <h2>
        Why it went {directions[actual] ?? "somewhere"} at {hourOf(turnIndex)}
      </h2>
      {matches ? null : (
        <p role="alert" style={{ color: "var(--grease)", fontWeight: 600 }}>
          MISMATCH — engine choice {directions[step.chosen] ?? "unknown"}, path went{" "}
          {directions[actual] ?? "unknown"}
        </p>
      )}
      <div style={{ overflowX: "auto", width: "100%", maxWidth: "100%" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-small)",
          }}
        >
          <thead>
            <tr>
              {[
                "Move",
                "Free",
                "Safe +16",
                "Far +8",
                `Toward +8 (${exitName})`,
                "Unseen +4",
                "Noise",
                "Score",
              ].map((label) => (
                <th
                  key={label}
                  style={{
                    padding: "var(--space-2)",
                    borderBottom: "1px solid var(--grease)",
                    textAlign: "left",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {directions.map((label, index) => (
              <tr
                key={label}
                style={{
                  background: index === step.chosen ? "var(--paper-2)" : "transparent",
                  fontWeight: index === step.chosen ? 600 : 400,
                }}
              >
                <td style={{ padding: "var(--space-2)" }}>{label}</td>
                <td style={{ padding: "var(--space-2)" }}>{step.valid[index] ? "✓" : "—"}</td>
                <td style={{ padding: "var(--space-2)" }}>{step.safe[index] ? "✓" : "—"}</td>
                <td style={{ padding: "var(--space-2)" }}>{step.far[index] ? "✓" : "—"}</td>
                <td style={{ padding: "var(--space-2)" }}>{step.toward[index] ? "✓" : "—"}</td>
                <td style={{ padding: "var(--space-2)" }}>{step.unseen[index] ? "✓" : "—"}</td>
                <td style={{ padding: "var(--space-2)" }}>{turn.noise[index] ?? 0}</td>
                <td style={{ padding: "var(--space-2)" }}>{step.scores[index] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
