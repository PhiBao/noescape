import { expect } from "chai";
import { ethers } from "hardhat";

describe("Grid", () => {
  it("matches the engine for every cell and fifty seeded masks", async () => {
    const { ALL, WALK, bit, cellOf, isOneHot, neighbors, plus, reach } = await import(
      "@noescape/engine"
    );
    const factory = await ethers.getContractFactory("GridHarness");
    const grid = await factory.deploy();
    await grid.waitForDeployment();

    for (let cell = 0; cell < 120; cell += 1) {
      expect(await grid.bit(cell)).to.equal(bit(cell));
      expect(await grid.plus(cell)).to.equal(plus(cell));
      expect(await grid.neighbors(bit(cell))).to.equal(neighbors(bit(cell)));
      expect(await grid.isOneHot(bit(cell))).to.equal(true);
      expect(Number(await grid.cellOf(bit(cell)))).to.equal(cell);
    }

    const limit = (1n << 128n) - 1n;
    let seed = 0x1234_5678_9abc_def0n;
    for (let sample = 0; sample < 50; sample += 1) {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & limit;
      expect(await grid.neighbors(seed)).to.equal(neighbors(seed));
      expect(await grid.isOneHot(seed)).to.equal(isOneHot(seed));
      expect(Number(await grid.cellOf(seed))).to.equal(cellOf(seed));
      for (const walk of [ALL, WALK]) {
        for (let steps = 0; steps <= 3; steps += 1) {
          expect(await grid.reach(seed, steps, walk)).to.equal(reach(seed, steps, walk));
        }
      }
    }
  });
});
