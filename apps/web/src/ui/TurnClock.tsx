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
  const planning = phase === "planning";
  const closed = phase === "ended" || phase === "verified";
  const currentTurn = inFlight || planning ? completedTurns + 1 : Math.max(completedTurns, 1);

  const status = inFlight
    ? `Resolving ${hourOf(currentTurn)} — waiting for the report`
    : planning
      ? `Planning ${hourOf(currentTurn)} — send orders`
      : closed
        ? `Case closed at ${hourOf(Math.min(currentTurn, TURNS))}`
        : "Opening the case file";

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
          const resolving = inFlight && turn === currentTurn;
          const ready = planning && turn === currentTurn;
          const mark = past
            ? "already played"
            : resolving
              ? "resolving now"
              : ready
                ? "ready for orders"
                : "still ahead";
          return (
            <div
              key={hourOf(turn)}
              title={`${hourOf(turn)} · ${mark}`}
              role="img"
              aria-label={`${hourOf(turn)} ${mark}`}
              style={{
                height: "6px",
                cursor: "default",
                border: `1px solid ${resolving || ready ? "var(--brass)" : "var(--desk-line)"}`,
                background: past
                  ? "var(--chalk)"
                  : resolving
                    ? "var(--brass)"
                    : ready
                      ? "var(--desk)"
                      : "var(--desk-line)",
              }}
            />
          );
        })}
      </div>
      <h2 style={{ marginTop: "var(--space-3)" }}>
        Night 1 · {hourOf(Math.min(currentTurn, TURNS))}
      </h2>
      <p
        style={{
          marginTop: "var(--space-1)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono)",
          color: "var(--chalk)",
        }}
      >
        {status}
      </p>
      <p
        style={{
          marginTop: "var(--space-1)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono)",
          color: "var(--chalk-2)",
        }}
      >
        White = past · brass = current hour · dark = ahead. Not a control.
      </p>
    </section>
  );
}
