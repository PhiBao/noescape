import { TURNS } from "@noescape/engine";

interface TurnClockProps {
  completedTurns: number;
  phase: string;
}

export function hourOf(turn: number): string {
  return `${String((19 + turn) % 24).padStart(2, "0")}:00`;
}

export function TurnClock({ completedTurns, phase }: TurnClockProps) {
  const inFlight = phase === "sending" || phase === "mining" || phase === "decoding";
  const currentTurn =
    inFlight || phase === "planning" ? completedTurns + 1 : Math.max(completedTurns, 1);

  return (
    <section aria-label="Turn clock">
      <div
        style={{
          display: "grid",
          gap: "2px",
          gridTemplateColumns: `repeat(${TURNS}, 1fr)`,
          fontFamily: "var(--font-mono)",
        }}
      >
        {Array.from({ length: TURNS }, (_, index) => {
          const turn = index + 1;
          const past = turn <= completedTurns;
          const active = inFlight && turn === currentTurn;
          return (
            <div
              key={hourOf(turn)}
              title={hourOf(turn)}
              style={{
                height: "6px",
                border: `1px solid ${active ? "var(--brass)" : "var(--desk-line)"}`,
                background: past ? "var(--chalk)" : active ? "var(--brass)" : "var(--desk-line)",
              }}
            />
          );
        })}
      </div>
      <h2 style={{ marginTop: "var(--space-3)" }}>
        Night 1 · {hourOf(Math.min(currentTurn, TURNS))}
      </h2>
    </section>
  );
}
