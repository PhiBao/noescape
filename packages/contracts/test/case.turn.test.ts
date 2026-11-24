import { FhevmType } from "@fhevm/mock-utils";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { NoEscapeCase } from "../types";

type Cells = [number, number, number];
type Strategy = (cells: Cells, fugitive: number) => { to: Cells; flags: number };

async function deployCase(): Promise<NoEscapeCase> {
  const rulesFactory = await ethers.getContractFactory("CaseRules");
  const rules = await rulesFactory.deploy();
  await rules.waitForDeployment();
  const factory = await ethers.getContractFactory("NoEscapeCase", {
    libraries: { CaseRules: rules.target },
  });
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

async function openCase(contract: NoEscapeCase, detective: HardhatEthersSigner): Promise<bigint> {
  await contract.connect(detective).openCase();
  return contract.activeCaseOf(detective.address);
}

async function decryptReport(contract: NoEscapeCase, id: bigint, turn: number) {
  const record = await contract.getTurn(id, turn);
  const handle = record.report as `0x${string}`;
  const result = await fhevm.publicDecrypt([handle]);
  const clear = result.clearValues[handle];
  if (typeof clear !== "bigint") throw new Error("missing clear report");
  return {
    clear,
    status: Number(clear & 3n),
    camera: Number(clear >> 2n),
    encoded: result.abiEncodedClearValues,
    proof: result.decryptionProof,
  };
}

async function playCase(
  contract: NoEscapeCase,
  detective: HardhatEthersSigner,
  id: bigint,
  strategy: Strategy,
): Promise<number> {
  let previousEncoded = "0x" as `0x${string}`;
  let previousProof = "0x" as `0x${string}`;
  for (let turn = 1; turn <= 12; turn += 1) {
    const opened = await contract.getCase(id);
    const fugitiveMask = await fhevm.debugger.decryptEuint(FhevmType.euint128, opened.pos);
    const fugitive = Number(fugitiveMask.toString(2).length - 1);
    const cells: Cells =
      turn === 1
        ? [29, 30, 41]
        : ((await contract.getTurn(id, turn - 1)).cells.map((cell) => Number(cell)) as Cells);
    const orders = strategy(cells, fugitive);
    await contract
      .connect(detective)
      .playTurn(id, orders.to, orders.flags, previousEncoded, previousProof);
    const report = await decryptReport(contract, id, turn);
    expect(report.status).to.be.lessThanOrEqual(2);
    expect(report.camera).to.be.lessThanOrEqual(6);
    if (report.status !== 0 || turn === 12) {
      await contract.connect(detective).resolveReport(id, report.encoded, report.proof);
      return report.status === 0 ? 4 : report.status === 1 ? 2 : 3;
    }
    previousEncoded = report.encoded;
    previousProof = report.proof;
  }
  throw new Error("case did not end");
}

const stay: Strategy = (cells) => ({ to: cells, flags: 0b111 });

async function expectationRejection(promise: Promise<unknown>): Promise<void> {
  let rejection: unknown;
  try {
    await promise;
  } catch (error) {
    rejection = error;
  }
  expect(rejection).not.to.equal(undefined);
}

describe("case.turn", () => {
  it("validates orders and access controls", async () => {
    const [deployer, detective, other] = await ethers.getSigners();
    if (deployer === undefined || detective === undefined || other === undefined) {
      throw new Error("missing signers");
    }
    const contract = await deployCase();
    const id = await openCase(contract, detective);

    await expectationRejection(contract.connect(other).playTurn(id, [29, 30, 41], 7, "0x", "0x"));
    await expect(contract.connect(detective).playTurn(id, [65, 30, 41], 7, "0x", "0x"))
      .to.be.revertedWithCustomError(contract, "BadOrders")
      .withArgs(3n, 0n);
    await expect(contract.connect(detective).playTurn(id, [119, 30, 41], 7, "0x", "0x"))
      .to.be.revertedWithCustomError(contract, "BadOrders")
      .withArgs(1n, 0n);
    await expect(contract.connect(detective).playTurn(id, [29, 29, 41], 7, "0x", "0x"))
      .to.be.revertedWithCustomError(contract, "BadOrders")
      .withArgs(2n, 1n);
    expect(await contract.activeCaseOf(deployer.address)).to.equal(0n);
  });

  it("requires the previous report proof and rejects a wrong cleartext", async () => {
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const contract = await deployCase();
    const id = await openCase(contract, detective);
    await contract.connect(detective).playTurn(id, [29, 30, 41], 7, "0x", "0x");

    await expect(
      contract.connect(detective).playTurn(id, [29, 30, 41], 7, "0x", "0x"),
    ).to.be.revertedWithCustomError(contract, "ReportPending");

    const report = await decryptReport(contract, id, 1);
    const wrong = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8"],
      [Number(report.clear & 3n) ^ 1],
    );
    await expectationRejection(contract.connect(detective).resolveReport(id, wrong, report.proof));
    await contract.connect(detective).resolveReport(id, report.encoded, report.proof);
    expect((await contract.getTurn(id, 1)).resolved).to.equal(true);
  });

  it("allows search codes only to the case detective", async () => {
    const [, detective, other] = await ethers.getSigners();
    if (detective === undefined || other === undefined) throw new Error("missing signers");
    const contract = await deployCase();
    const id = await openCase(contract, detective);
    await contract.connect(detective).playTurn(id, [29, 30, 41], 7, "0x", "0x");
    const record = await contract.getTurn(id, 1);
    const address = await contract.getAddress();
    const expected = await fhevm.debugger.decryptEuint(FhevmType.euint8, record.codes[0]);
    const actual = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      record.codes[0],
      address,
      detective,
    );
    expect(actual).to.equal(expected);
    await expectationRejection(
      fhevm.userDecryptEuint(FhevmType.euint8, record.codes[0], address, other),
    );
  });

  it("abandons, publishes the reveal handles and frees the detective slot", async () => {
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const contract = await deployCase();
    const id = await openCase(contract, detective);
    await expect(contract.connect(detective).abandonCase(id))
      .to.emit(contract, "CaseEnded")
      .withArgs(id, 5n, 0n);
    const opened = await contract.getCase(id);
    expect(opened.status).to.equal(5n);
    expect(await contract.activeCaseOf(detective.address)).to.equal(0n);
    expect((await contract.statsOf(detective.address)).abandoned).to.equal(1n);
    expect(await contract.recentClosed()).to.include(id);
    const publicStart = await fhevm.publicDecryptEuint(FhevmType.euint128, opened.startPos);
    expect(publicStart).to.be.greaterThan(0n);
    const next = await openCase(contract, detective);
    expect(next).to.equal(id + 1n);
  });

  it("plays well-formed cases through capture, escape and dawn", async function () {
    this.timeout(300_000);
    const { WALK, bit, neighbors } = await import("@noescape/engine");
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const contract = await deployCase();

    const pathTo = (from: number, target: number): number[] => {
      const queue = [from];
      const previous = new Map<number, number>([[from, -1]]);
      for (let head = 0; head < queue.length; head += 1) {
        const cell = queue[head];
        if (cell === undefined) break;
        if (cell === target) break;
        const adjacent = neighbors(bit(cell)) & WALK;
        for (let next = 0; next < 120; next += 1) {
          if ((adjacent & bit(next)) === 0n || previous.has(next)) continue;
          previous.set(next, cell);
          queue.push(next);
        }
      }
      const path = [target];
      let cursor = target;
      while (cursor !== from) {
        const parent = previous.get(cursor);
        if (parent === undefined || parent === -1) return [from];
        path.unshift(parent);
        cursor = parent;
      }
      return path;
    };

    const chase: Strategy = (cells, fugitive) => {
      const used = new Set<number>();
      const to: Cells = [...cells];
      const order = cells
        .map((cell, index) => ({ index, path: pathTo(cell, fugitive) }))
        .sort((a, b) => a.path.length - b.path.length);
      for (const { index, path } of order) {
        const options = [path[1], path[2], path[3], cells[index]].filter(
          (cell): cell is number => cell !== undefined && !used.has(cell),
        );
        const choice = options[0] ?? cells[index];
        if (choice === undefined) continue;
        to[index] = choice;
        used.add(choice);
      }
      return { to, flags: 0 };
    };

    const seen = new Set<number>();
    for (let attempt = 0; attempt < 40 && seen.size < 3; attempt += 1) {
      const id = await openCase(contract, detective);
      const status = await playCase(contract, detective, id, seen.has(2) ? stay : chase);
      seen.add(status);
    }
    expect(seen.has(2), "capture").to.equal(true);
    expect(seen.has(3), "escape").to.equal(true);
    expect(seen.has(4), "dawn").to.equal(true);
    const stats = await contract.statsOf(detective.address);
    expect(stats.opened).to.be.greaterThan(0n);
    expect(stats.caught + stats.escaped + stats.dawn).to.equal(stats.opened);
  });
});
