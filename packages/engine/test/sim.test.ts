import { describe, expect, it } from "vitest";
import { simulate } from "../src/sim/run.ts";

describe("balance", () => {
  it("meets the widened balance bands on 200 seeded cases", () => {
    const naiveAi = simulate({ cases: 200, seed: 7, bot: "naive", fugitive: "ai" });
    const expertAi = simulate({ cases: 200, seed: 7, bot: "expert", fugitive: "ai" });
    const naiveRandom = simulate({ cases: 200, seed: 7, bot: "naive", fugitive: "random" });
    const naiveCaught = (naiveAi.caught / naiveAi.cases) * 100;
    const expertCaught = (expertAi.caught / expertAi.cases) * 100;
    const randomCaught = (naiveRandom.caught / naiveRandom.cases) * 100;
    const aiEscaped = (naiveAi.escaped / naiveAi.cases) * 100;

    expect(naiveCaught).toBeGreaterThanOrEqual(40);
    expect(naiveCaught).toBeLessThanOrEqual(70);
    expect(expertCaught).toBeGreaterThanOrEqual(50);
    expect(expertCaught).toBeLessThanOrEqual(80);
    expect(randomCaught).toBeGreaterThanOrEqual(naiveCaught + 10);
    expect(aiEscaped).toBeGreaterThanOrEqual(10);
    expect(aiEscaped).toBeLessThanOrEqual(45);
    expect(naiveAi.averageCaptureTurn).toBeGreaterThanOrEqual(6.5);
  }, 120_000);
});
