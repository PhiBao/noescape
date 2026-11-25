import type { Hex } from "viem";
import { Button } from "./Button.tsx";

interface BriefingProps {
  caseId: bigint;
  address: Hex;
  onStart(): void;
}

export function Briefing({ caseId, address, onStart }: BriefingProps) {
  return (
    <section
      className="paper"
      aria-label="First case briefing"
      style={{ padding: "var(--space-5)" }}
    >
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)" }}>
        CASE #{caseId.toString()} · BADGE {address.slice(0, 6)}…{address.slice(-4)}
      </p>
      <p>Three detectives. One fugitive nobody can see.</p>
      <p>Move up to two corners while you search, or three if you skip searching.</p>
      <p>Search checks this corner and the four around it. Your stamps tell you what it found.</p>
      <Button type="button" onClick={onStart}>
        Start the night
      </Button>
    </section>
  );
}
