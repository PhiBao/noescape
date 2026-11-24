import { useState } from "react";
import { getNoEscapeCaseReader } from "../chain/contracts.ts";
import { mapError } from "../chain/errors.ts";
import { publicDecrypt } from "../chain/zama.ts";

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
      <h1>noescape</h1>
      <p>Title route placeholder.</p>
      <button type="button" onClick={() => void decryptLatestReport()}>
        Decrypt latest report (dev)
      </button>
      <p>{message}</p>
    </main>
  );
}
