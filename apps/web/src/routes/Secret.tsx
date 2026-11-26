import { useEffect, useState } from "react";
import { getOrCreateBurner } from "../chain/burner.ts";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { userDecrypt } from "../chain/zama.ts";
import { Button } from "../ui/Button.tsx";

const PERMALINK =
  "https://github.com/PhiBao/noescape/blob/eda869add212fe87fa70ba129ee148ee3c70b18e";
const CONTRACT = `${PERMALINK}/packages/contracts/contracts/NoEscapeCase.sol#L140-L167`;
const WEB_ZAMA = `${PERMALINK}/apps/web/src/chain/zama.ts#L56-L96`;
const VERIFY = `${PERMALINK}/packages/engine/src/verify.ts#L28`;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const nested = error as Error & {
      shortMessage?: unknown;
      walk?: (fn: (item: Error) => void) => void;
    };
    const parts = [
      error.message,
      typeof nested.shortMessage === "string" ? nested.shortMessage : "",
    ];
    if (typeof nested.walk === "function") nested.walk((item) => parts.push(item.message));
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined && cause !== error) parts.push(errorText(cause));
    return parts.filter((part) => part.trim() !== "").join(" — ");
  }
  if (typeof error === "string") return error;
  if (error !== null && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.shortMessage, record.errorName]
      .filter((part): part is string => typeof part === "string" && part.trim() !== "")
      .join(" — ");
  }
  return "unknown relayer error";
}

export function Secret() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setAddress(getOrCreateBurner().address);
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  async function askRelayer() {
    setBusy(true);
    setResult("");
    const start = Date.now();
    setStartedAt(start);
    setElapsed(0);
    try {
      const account = getOrCreateBurner();
      const contract = getNoEscapeCaseReader();
      const active = await contract.read.activeCaseOf([account.address]);
      let caseId = active;
      if (caseId === 0n) {
        const recent = await contract.read.recentClosed();
        caseId = recent.find((id) => id !== 0n) ?? 0n;
      }
      if (caseId === 0n) throw new Error("No case exists to inspect yet");
      const encryptedValue = await contract.read.posHandle([caseId]);
      await userDecrypt([{ encryptedValue, contractAddress: contract.address }]);
      setResult(`ACCESS GRANTED — handle ${encryptedValue.slice(0, 10)}… was readable`);
    } catch (error) {
      const message = errorText(error).replace(/\s+/g, " ").trim();
      setResult(`REFUSED — ${message}`);
    } finally {
      setElapsed(Date.now() - start);
      setBusy(false);
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
      <h1>Nobody can see the fugitive. Try.</h1>
      <section className="paper" aria-label="Live ACL test" style={{ padding: "var(--space-5)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)" }}>
          Your detective key: {address === "" ? "preparing…" : shortAddress(address)}
        </p>
        <Button type="button" disabled={busy} onClick={() => void askRelayer()}>
          Ask the relayer for the fugitive's position
        </Button>
        {busy ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>
            Relayer request in flight · {(elapsed / 1000).toFixed(1)}s
          </p>
        ) : null}
        {result !== "" ? (
          <p
            role="status"
            style={{
              marginTop: "var(--space-4)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--leading-mono)",
              overflowWrap: "anywhere",
            }}
          >
            {result}
          </p>
        ) : null}
        <p style={{ marginTop: "var(--space-3)" }}>
          Handles for this case are readable only by the game contract until the case closes.
        </p>
      </section>
      <section aria-label="What is encrypted">
        <h2>What's encrypted</h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body)",
          }}
        >
          <thead>
            <tr>
              {["Thing", "Who can read it during the case", "When it becomes public"].map(
                (label) => (
                  <th
                    key={label}
                    style={{
                      borderBottom: "1px solid var(--grease)",
                      padding: "var(--space-2)",
                      textAlign: "left",
                    }}
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Fugitive position, path",
                "nobody (contract only)",
                "after the case ends, with KMS signatures",
              ],
              ["Secret exit", "nobody", "after the case ends"],
              ["AI noise", "nobody", "after the case ends"],
              ["Your search answers", "you", "after the case ends"],
              ["Turn report (caught / escaped / camera)", "everyone", "each turn"],
              ["Detective positions", "everyone (they're your moves)", "always"],
            ].map((row) => (
              <tr key={row[0] ?? ""}>
                {row.map((cell) => (
                  <td
                    key={cell}
                    style={{
                      borderBottom: "1px solid var(--desk-line)",
                      padding: "var(--space-2)",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <p>
          A zero-knowledge proof would still need someone to hold the secret and prove facts about
          it. Commit-reveal would need someone to keep the commit secret until the end. Here the
          game contract itself is the only holder: no address, not even ours, can read the position.
        </p>
        <p>
          Every turn the contract scores five candidate squares with encrypted noise, encrypted
          distances and encrypted camera masks. The highest score is selected inside the ciphertext,
          so the move happens without anyone learning which square it chose.
        </p>
        <p>
          At the end, KMS signatures decrypt the whole path and every answer. The contract re-runs
          the rules in plaintext and emits <strong>CaseVerified</strong>; anyone can check the
          result against the published path.
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            color: "var(--chalk-2)",
          }}
        >
          Code: <a href={CONTRACT}>NoEscapeCase.sol</a> · <a href={WEB_ZAMA}>zama.ts</a> ·{" "}
          <a href={VERIFY}>verify.ts</a>
        </p>
      </section>
    </main>
  );
}
