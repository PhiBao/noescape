import { FhevmType } from "@fhevm/mock-utils";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("FugitiveBrain equivalence", function () {
  this.timeout(1_200_000);

  it("matches the engine for seeded states with both toward settings", async function () {
    if (process.env.SOLIDITY_COVERAGE === "true") this.skip();
    const stateCount = 500;
    const { CELLS, bit, brainStep, isWalkableCell } = await import("@noescape/engine");
    const walkable = Array.from({ length: CELLS }, (_, index) => index).filter(isWalkableCell);
    const [signer] = await ethers.getSigners();
    if (signer === undefined) throw new Error("missing Hardhat signer");
    const factory = await ethers.getContractFactory("BrainHarness");
    const harness = await factory.deploy();
    await harness.waitForDeployment();

    let seed = 0x5eed_c0de_1234_5678n;
    const random = (): number => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
      return Number(seed >> 32n) / 0x1_0000_0000;
    };
    const cell = (): number => walkable[Math.floor(random() * walkable.length)] ?? 0;

    for (let stateIndex = 0; stateIndex < stateCount; stateIndex += 1) {
      const pos = bit(cell());
      const exitIdx = Math.floor(random() * 4);
      const detectiveCells = new Set<number>();
      while (detectiveCells.size < 3) detectiveCells.add(cell());
      const det = [...detectiveCells].reduce(
        (mask, detectiveCell) => mask | bit(detectiveCell),
        0n,
      );
      const noise: [number, number, number, number, number] = [
        Math.floor(random() * 8),
        Math.floor(random() * 8),
        Math.floor(random() * 8),
        Math.floor(random() * 8),
        Math.floor(random() * 8),
      ];

      for (const useToward of [false, true]) {
        await harness.stepPlain(pos, exitIdx, det, noise, useToward);
        const expected = brainStep(pos, exitIdx, det, noise, useToward);
        const actualPos = await fhevm.debugger.decryptEuint(
          FhevmType.euint128,
          await harness.getResultPos(),
        );
        expect(actualPos, `position at state ${stateIndex}, toward=${useToward}`).to.equal(
          expected.newPos,
        );
        for (let candidate = 0; candidate < 5; candidate += 1) {
          const actualScore = await fhevm.debugger.decryptEuint(
            FhevmType.euint8,
            await harness.getScore(candidate),
          );
          expect(
            actualScore,
            `score ${candidate} at state ${stateIndex}, toward=${useToward}`,
          ).to.equal(BigInt(expected.scores[candidate] ?? 0));
        }
      }
    }
  });

  it("runs a full encrypted turn and publishes a well-formed report", async () => {
    const { PRECINCT, isWalkableCell } = await import("@noescape/engine");
    const factory = await ethers.getContractFactory("BrainHarness");
    const harness = await factory.deploy();
    await harness.waitForDeployment();
    await harness.init();
    await harness.fullTurn(PRECINCT.map((entry) => entry.cell) as [number, number, number], 0b111);
    const report = await fhevm.publicDecryptEuint(FhevmType.euint8, await harness.getReport());
    expect(Number(report & 3n)).to.be.lessThanOrEqual(2);
    expect(Number(report >> 2n)).to.be.lessThanOrEqual(6);
    const pos = await fhevm.debugger.decryptEuint(FhevmType.euint128, await harness.getPos());
    expect(pos & (pos - 1n)).to.equal(0n);
    const cell = Number(pos.toString(2).length - 1);
    expect(isWalkableCell(cell)).to.equal(true);
  });
});
