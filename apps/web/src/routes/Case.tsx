import { useState } from "react";
import { useParams } from "wouter";
import { useCase } from "../game/useCase.ts";
import { MapBoard } from "../ui/MapBoard.tsx";
import { OrdersPanel } from "../ui/OrdersPanel.tsx";

const codeNames = ["NOTHING", "COLD", "FRESH"] as const;

export function Case() {
  const { id } = useParams();
  const [selectedDetective, setSelectedDetective] = useState(0);
  const caseId = id === undefined ? null : BigInt(id);
  const valid = caseId !== null && caseId > 0n;
  const { state, log, setOrders, sendTurn, retry } = useCase(valid ? caseId : undefined);

  if (!valid || caseId === null)
    return (
      <main>
        <h1>Invalid case</h1>
      </main>
    );

  function toggleSearch(index: number) {
    if (state.phase !== "planning") return;
    setOrders({
      ...state.orders,
      searchFlags: state.orders.searchFlags ^ (1 << index),
    });
  }

  return (
    <main>
      <h1>Case #{caseId.toString()}</h1>
      <p>Turn {Math.min(state.turn + 1, 12)} of 12</p>
      <MapBoard
        cells={state.cells}
        orders={state.orders}
        selectedDetective={selectedDetective}
        search={(state.orders.searchFlags & (1 << selectedDetective)) !== 0}
        onSelectDetective={setSelectedDetective}
        onOrdersChange={setOrders}
        onSearchToggle={toggleSearch}
      />
      <OrdersPanel
        state={state}
        selectedDetective={selectedDetective}
        onSelectDetective={setSelectedDetective}
        onSearchToggle={toggleSearch}
        onSend={() => void sendTurn()}
        onRetry={() => void retry()}
      />
      <section aria-label="Radio log">
        <h2>Radio log</h2>
        <ol aria-live="polite">
          {log.map((entry) => (
            <li key={entry.turn}>
              Turn {entry.turn} · report {entry.report} · camera {entry.camera} · codes{" "}
              {entry.codes
                .map((code) => (code === null ? "—" : `${code} ${codeNames[code] ?? "UNKNOWN"}`))
                .join(" / ")}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
