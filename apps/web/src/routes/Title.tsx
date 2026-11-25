import { useState } from "react";
import { Link, useLocation } from "wouter";
import { getOrCreateBurner } from "../chain/burner.ts";
import { requestDrip } from "../chain/drip.ts";
import { useCase } from "../game/useCase.ts";
import { Button } from "../ui/Button.tsx";
import { Wordmark } from "../ui/Wordmark.tsx";

export function Title() {
  const [, navigate] = useLocation();
  const { state, openNewCase } = useCase();
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);

  async function takeCase() {
    setMessage("");
    setStarting(true);
    try {
      const account = getOrCreateBurner();
      const drip = await requestDrip(account.address);
      if (drip.error !== undefined && drip.error !== "alreadyFunded") {
        setMessage(drip.error);
        return;
      }
      const id = await openNewCase(async () => undefined);
      if (id !== null) navigate(`/case/${id}`);
    } finally {
      setStarting(false);
    }
  }

  const busy = starting || state.phase === "opening";

  return (
    <main>
      <h1>
        <Wordmark />
      </h1>
      <p>A fugitive is hiding in this city. Find it before dawn.</p>
      {state.caseId !== null ? (
        <p>
          <Link href={`/case/${state.caseId}`}>Resume case #{state.caseId.toString()}</Link>
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={() => void takeCase()}>
        {busy ? "Requesting fuel…" : "Take the case"}
      </Button>
      {message !== "" ? <p role="alert">{message}</p> : null}
      {state.error !== null ? <p role="alert">{state.error.kind}</p> : null}
    </main>
  );
}
