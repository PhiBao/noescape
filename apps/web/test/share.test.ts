import { describe, expect, it } from "vitest";
import { type ShareCase, shareLine } from "../src/game/share.ts";

const base: ShareCase = {
  caseId: 412n,
  hour: "03:00",
  searches: 9,
  fresh: 3,
  sightings: 1,
  url: "https://noescape-case.vercel.app",
  verified: true,
};

describe("share line", () => {
  it("writes the caught line", () => {
    expect(shareLine({ ...base, outcome: "caught" })).toBe(
      "noescape case #412 — caught at 03:00 · 9 searches · 3 FRESH · 1 sighting · " +
        "verified onchain https://noescape-case.vercel.app/case/412/file",
    );
  });

  it("writes the escaped line with the exit name", () => {
    expect(shareLine({ ...base, outcome: "escaped", hour: "05:00", exitName: "Harbour" })).toBe(
      "noescape case #412 — it escaped via the Harbour at 05:00 · 9 searches · 3 FRESH · " +
        "1 sighting · verified onchain https://noescape-case.vercel.app/case/412/file",
    );
  });

  it("writes the dawn line", () => {
    expect(shareLine({ ...base, outcome: "dawn", hour: "08:00" })).toBe(
      "noescape case #412 — it got away at dawn at 08:00 · 9 searches · 3 FRESH · " +
        "1 sighting · verified onchain https://noescape-case.vercel.app/case/412/file",
    );
  });

  it("writes the abandoned line and pluralises sightings", () => {
    expect(shareLine({ ...base, outcome: "abandoned", hour: "21:00", sightings: 2 })).toBe(
      "noescape case #412 — abandoned at 21:00 · 9 searches · 3 FRESH · 2 sightings · " +
        "verified onchain https://noescape-case.vercel.app/case/412/file",
    );
  });

  it("marks an unverified case as pending", () => {
    expect(shareLine({ ...base, outcome: "caught", verified: false })).toContain(
      "verification pending https://noescape-case.vercel.app/case/412/file",
    );
  });
});
