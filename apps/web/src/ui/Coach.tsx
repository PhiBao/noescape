import { type CSSProperties, useEffect, useState } from "react";
import { getOrCreateBurner } from "../chain/burner.ts";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { Button } from "./Button.tsx";

const STORAGE_KEY = "noescape.coach.v1";

type Layout = "desktop" | "tablet" | "mobile";

interface CoachProps {
  caseId: bigint;
  displayTurn: number;
  planning: boolean;
  layout: Layout;
}

interface Mark {
  id: string;
  turn: number;
  title: string;
  text: string;
  anchor: "ada" | "search" | "send" | "stamp";
}

const marks: Mark[] = [
  {
    id: "1-ada",
    turn: 1,
    title: "Move a detective",
    text: "Goal: catch the fugitive before dawn. Drag a detective up to two corners. Or three, if it skips searching.",
    anchor: "ada",
  },
  {
    id: "1-search",
    turn: 1,
    title: "Search",
    text: "Searching checks this corner and the four around it.",
    anchor: "search",
  },
  {
    id: "1-send",
    turn: 1,
    title: "Send orders",
    text: "Then the fugitive moves. Nobody sees where.",
    anchor: "send",
  },
  {
    id: "2-stamp",
    turn: 2,
    title: "Read the stamps",
    text: "FRESH means it was here in the last three hours. COLD means earlier. Box it in.",
    anchor: "stamp",
  },
];

function loadDismissed(caseId: bigint): string[] {
  try {
    const record = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      string[]
    >;
    return record[caseId.toString()] ?? [];
  } catch {
    return [];
  }
}

function saveDismissed(caseId: bigint, dismissed: string[]): void {
  try {
    const record = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      string[]
    >;
    record[caseId.toString()] = dismissed;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Coaching is optional; a blocked storage write never blocks play.
  }
}

function anchorStyle(anchor: Mark["anchor"], layout: Layout): CSSProperties {
  if (layout === "desktop") {
    if (anchor === "ada" || anchor === "stamp") {
      return { left: "22%", top: anchor === "ada" ? "26%" : "34%" };
    }
    return { left: "67%", top: anchor === "search" ? "54%" : "72%" };
  }
  if (layout === "tablet") {
    if (anchor === "ada" || anchor === "stamp") {
      return { left: "8%", top: anchor === "ada" ? "24%" : "32%" };
    }
    return { right: "8%", top: anchor === "search" ? "62%" : "78%" };
  }
  if (anchor === "ada" || anchor === "stamp") {
    return { left: "6%", top: anchor === "ada" ? "24%" : "32%" };
  }
  return { right: "6%", bottom: anchor === "search" ? "28%" : "10%" };
}

export function Coach({ caseId, displayTurn, planning, layout }: CoachProps) {
  const [firstCase, setFirstCase] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed(caseId));

  useEffect(() => {
    const account = getOrCreateBurner();
    void getNoEscapeCaseReader()
      .read.statsOf([account.address])
      .then((stats) =>
        setFirstCase(Number(stats[0]) === 1 || window.localStorage.getItem(STORAGE_KEY) === null),
      )
      .catch(() => setFirstCase(false));
  }, []);

  useEffect(() => {
    setDismissed(loadDismissed(caseId));
  }, [caseId]);

  if (!planning) return null;
  const active = marks.find((mark) => mark.turn <= displayTurn && !dismissed.includes(mark.id));
  if (active === undefined) return null;
  if (firstCase !== true && dismissed.length === 0) return null;
  const activeIndex = marks.indexOf(active) + 1;

  const gotIt = () => {
    const next = [...dismissed, active.id];
    setDismissed(next);
    saveDismissed(caseId, next);
  };

  return (
    <section
      className="paper"
      aria-live="polite"
      aria-label={`Coach mark: ${active.title}`}
      style={{
        position: "absolute",
        zIndex: 6,
        pointerEvents: "none",
        width: "min(280px, 74vw)",
        padding: "var(--space-4)",
        ...anchorStyle(active.anchor, layout),
      }}
    >
      <p
        style={{
          margin: "0 0 var(--space-2)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono)",
          color: "var(--ink-2)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {active.title} · {activeIndex}/{marks.length}
      </p>
      <p style={{ margin: "0 0 var(--space-3)" }}>{active.text}</p>
      <span style={{ pointerEvents: "auto" }}>
        <Button type="button" onClick={gotIt}>
          Got it
        </Button>
      </span>
    </section>
  );
}
