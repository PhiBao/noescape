import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { exportBurner, getOrCreateBurner, importBurner } from "../chain/burner.ts";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { Button } from "../ui/Button.tsx";
import { hourOf } from "../ui/TurnClock.tsx";

interface CaseStats {
  opened: number;
  caught: number;
  escaped: number;
  dawn: number;
  abandoned: number;
  bestTurn: number;
}

interface RecentCase {
  id: bigint;
  turn: number;
  status: number;
  detective: string;
}

const statusCopy: Record<number, { label: string; color: string }> = {
  2: { label: "CAUGHT", color: "var(--grease)" },
  3: { label: "ESCAPED", color: "var(--ink)" },
  4: { label: "DAWN", color: "var(--ink)" },
  5: { label: "ABANDONED", color: "var(--ink-2)" },
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Record() {
  const [address, setAddress] = useState("");
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [recent, setRecent] = useState<RecentCase[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const keyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refresh;
    const account = getOrCreateBurner();
    setAddress(account.address);
    let cancelled = false;
    void (async () => {
      try {
        const contract = getNoEscapeCaseReader();
        const raw = await contract.read.statsOf([account.address]);
        const ids = [...(await contract.read.recentClosed())].filter((id) => id !== 0n);
        ids.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        const rows = await Promise.all(
          ids.map(async (id) => {
            const opened = await contract.read.getCase([id]);
            return {
              id,
              turn: Number(opened.turn),
              status: Number(opened.status),
              detective: opened.detective,
            };
          }),
        );
        if (cancelled) return;
        setStats({
          opened: Number(raw[0]),
          caught: Number(raw[1]),
          escaped: Number(raw[2]),
          dawn: Number(raw[3]),
          abandoned: Number(raw[4]),
          bestTurn: Number(raw[5]),
        });
        setRecent(rows);
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Record unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const lines = useMemo(() => {
    if (stats === null) return "";
    const best = stats.bestTurn === 0 ? "—" : hourOf(stats.bestTurn);
    return `${stats.opened} opened · ${stats.caught} caught · ${stats.escaped} escaped · ${stats.dawn} dawn · ${stats.abandoned} abandoned · best capture ${best}`;
  }, [stats]);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(exportBurner());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function importAnotherKey() {
    const value = keyInput.current?.value ?? "";
    try {
      const account = importBurner(value);
      if (keyInput.current !== null) keyInput.current.value = "";
      setAddress(account.address);
      setError("");
      setRefresh((count) => count + 1);
    } catch {
      setError("Invalid detective key");
    }
  }

  return (
    <main
      style={{
        width: "min(100%, 1100px)",
        maxWidth: "none",
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "grid",
        gap: "var(--space-5)",
      }}
    >
      <h1>Detective {address === "" ? "preparing…" : shortAddress(address)}</h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono)",
          color: "var(--chalk-2)",
        }}
      >
        {stats === null ? "Reading the dispatch ledger…" : lines}
      </p>
      <section
        className="paper"
        aria-label="Detective key"
        style={{ padding: "var(--space-5)", display: "grid", gap: "var(--space-3)" }}
      >
        <Button type="button" onClick={() => void copyKey()}>
          {copied ? "Copied" : "Copy detective key"}
        </Button>
        <p style={{ margin: 0, color: "var(--ink-2)" }}>
          Anyone with this key can play as you. It holds only test funds.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <input
            ref={keyInput}
            type="password"
            aria-label="Paste another detective key"
            placeholder="Paste another detective key"
            autoComplete="off"
            style={{
              flex: "1 1 320px",
              padding: "var(--space-2)",
              border: "1px solid var(--ink-2)",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono)",
            }}
          />
          <Button type="button" variant="secondary" onClick={importAnotherKey}>
            Use another key
          </Button>
        </div>
      </section>
      {error !== "" ? (
        <p role="alert" style={{ color: "var(--grease)" }}>
          {error}
        </p>
      ) : null}
      <section aria-label="Recent cases" style={{ display: "grid", gap: "var(--space-2)" }}>
        <h2>Recent cases</h2>
        {recent.length === 0 ? (
          <p>No closed cases yet. Be the first.</p>
        ) : (
          recent.map((entry) => {
            const outcome = statusCopy[entry.status] ?? { label: "CLOSED", color: "var(--ink-2)" };
            return (
              <article
                key={entry.id.toString()}
                className="paper"
                style={{
                  padding: "var(--space-3)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                }}
              >
                <span
                  style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700 }}
                >
                  #{entry.id.toString()}
                </span>
                <span
                  role="img"
                  aria-label={`${entry.turn} of 12 hours`}
                  style={{ display: "flex", gap: "2px", flex: "1 1 auto" }}
                >
                  {Array.from({ length: 12 }, (_, index) => {
                    const hour = index + 1;
                    return (
                      <span
                        key={hourOf(hour)}
                        title={hourOf(hour)}
                        style={{
                          height: "10px",
                          flex: 1,
                          background: hour <= entry.turn ? "var(--grease)" : "var(--paper-2)",
                          opacity: hour <= entry.turn ? 0.9 : 0.5,
                        }}
                      />
                    );
                  })}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: outcome.color,
                    minWidth: "96px",
                  }}
                >
                  {outcome.label} {hourOf(Math.max(entry.turn, 1))}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-small)" }}>
                  {shortAddress(entry.detective)}
                </span>
                <Link href={`/case/${entry.id.toString()}/file`}>Case file</Link>
              </article>
            );
          })
        )}
      </section>
      <p>
        <Link href="/">Back to the desk</Link>
      </p>
    </main>
  );
}
