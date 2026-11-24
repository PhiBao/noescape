import { useState } from "react";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { mapError } from "../chain/errors.ts";
import { publicDecrypt } from "../chain/zama.ts";
import { Button } from "../ui/Button.tsx";
import { Wordmark } from "../ui/Wordmark.tsx";

export function Title() {
  const [message, setMessage] = useState("");

  async function decryptLatestReport() {
    try {
      const contract = getNoEscapeCaseReader();
      const opened = await contract.read.getCase([1n]);
      const turn = await contract.read.getTurn([1n, opened.turn]);
      const result = await publicDecrypt([turn.report]);
      setMessage(
        `Report ${result.clear[turn.report]?.toString() ?? "missing"} · proof ${(result.proof.length - 2) / 2} bytes`,
      );
    } catch (error) {
      setMessage(mapError(error));
    }
  }

  return (
    <main>
      <h1>
        <Wordmark />
      </h1>
      <p>Title route placeholder.</p>
      <Button type="button">Take the case</Button>
      <p>
        <Button variant="secondary" type="button" onClick={() => void decryptLatestReport()}>
          Decrypt latest report (dev)
        </Button>
      </p>
      <p>{message}</p>
    </main>
  );
}
