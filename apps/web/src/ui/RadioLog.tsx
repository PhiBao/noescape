import { CAMERAS, DETECTIVES, type DetectiveCells, xy } from "@noescape/engine";
import { useEffect, useRef, useState } from "react";
import type { DecodedTurn } from "../game/useCase.ts";
import { hourOf } from "./TurnClock.tsx";

interface RadioLogProps {
  entries: readonly DecodedTurn[];
  cellsByTurn: Readonly<Record<number, DetectiveCells>>;
  collapsible?: boolean;
}

const codeCopy = ["NOTHING", "COLD TRAIL", "FRESH TRAIL"] as const;

function cellLabel(cell: number): string {
  const { x, y } = xy(cell);
  return `${String.fromCharCode(65 + x)}${y + 1}`;
}

interface LogLine {
  id: string;
  text: string;
}

function linesFor(
  entries: readonly DecodedTurn[],
  cellsByTurn: Readonly<Record<number, DetectiveCells>>,
): LogLine[] {
  const lines: LogLine[] = [];
  for (const entry of [...entries].sort((a, b) => a.turn - b.turn)) {
    const hour = hourOf(entry.turn);
    for (let detective = 0; detective < DETECTIVES.length; detective += 1) {
      const name = DETECTIVES[detective];
      const code = entry.codes[detective];
      const cell = cellsByTurn[entry.turn]?.[detective];
      if (name === undefined || cell === undefined || code == null || code < 0 || code > 2) {
        continue;
      }
      lines.push({
        id: `search-${entry.turn}-${name}`,
        text: `${hour} ${name.toUpperCase()} SEARCHED ${cellLabel(cell)} — ${codeCopy[code]}`,
      });
    }
    const camera = CAMERAS.find((item) => item.id === entry.camera);
    if (camera !== undefined) {
      lines.push({
        id: `camera-${entry.turn}`,
        text: `${hour} CAMERA ${camera.id} (${camera.label.toUpperCase()}) — SUSPECT SEEN`,
      });
    }
    lines.push({
      id: `move-${entry.turn}`,
      text: `${hour} NIGHT MOVE COMPUTED ON CIPHERTEXT · 0 PLAINTEXT`,
    });
  }
  return lines;
}

export function RadioLog({ entries, cellsByTurn, collapsible = false }: RadioLogProps) {
  const [open, setOpen] = useState(!collapsible);
  const listRef = useRef<HTMLOListElement>(null);
  const lines = linesFor(entries, cellsByTurn).slice(-8);

  useEffect(() => {
    const list = listRef.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  });

  return (
    <section aria-label="Radio log">
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{
            width: "100%",
            minHeight: "var(--space-7)",
            border: "1px solid var(--desk-line)",
            borderRadius: "var(--radius)",
            color: "var(--chalk)",
            background: "var(--desk-2)",
            fontFamily: "var(--font-mono)",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          Radio · {lines.length} {lines.length === 1 ? "line" : "lines"}
        </button>
      ) : null}
      {open ? (
        <ol
          ref={listRef}
          aria-live="polite"
          style={{
            maxHeight: "144px",
            margin: "var(--space-2) 0 0",
            padding: "0 0 0 var(--space-4)",
            overflowY: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--leading-mono)",
            color: "var(--chalk-2)",
          }}
        >
          {lines.map((line) => (
            <li key={line.id}>{line.text}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
