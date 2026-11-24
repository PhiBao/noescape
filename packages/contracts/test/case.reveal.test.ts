import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { CaseRulesHarness, NoEscapeCase } from "../types";

type Cells = [number, number, number];

async function deployCase(): Promise<{ contract: NoEscapeCase; rules: CaseRulesHarness }> {
  const rulesFactory = await ethers.getContractFactory("CaseRules");
  const rules = await rulesFactory.deploy();
  await rules.waitForDeployment();
  const harnessFactory = await ethers.getContractFactory("CaseRulesHarness", {
    libraries: { CaseRules: rules.target },
  });
  const rulesHarness = await harnessFactory.deploy();
  await rulesHarness.waitForDeployment();
  const factory = await ethers.getContractFactory("NoEscapeCase", {
    libraries: { CaseRules: rules.target },
  });
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return { contract, rules: rulesHarness };
}

function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

async function decryptBatch(handles: string[]) {
  const result = await fhevm.publicDecrypt(handles);
  const values = handles.map((handle) => {
    const value = result.clearValues[handle as `0x${string}`];
    if (typeof value !== "bigint") throw new Error(`missing clear value for ${handle}`);
    return value;
  });
  return { values, encoded: result.abiEncodedClearValues, proof: result.decryptionProof };
}

async function playRandomCase(
  contract: NoEscapeCase,
  detective: HardhatEthersSigner,
  seed: number,
) {
  const { PRECINCT, WALK, bit, reach } = await import("@noescape/engine");
  const rng = randomSource(seed);
  await contract.connect(detective).openCase();
  const id = await contract.activeCaseOf(detective.address);
  let previousEncoded = "0x" as `0x${string}`;
  let previousProof = "0x" as `0x${string}`;
  const reports: number[] = [];

  for (let turn = 1; turn <= 12; turn += 1) {
    const cells: Cells =
      turn === 1
        ? (PRECINCT.map((entry) => entry.cell) as Cells)
        : ((await contract.getTurn(id, turn - 1)).cells.map((cell) => Number(cell)) as Cells);
    const used = new Set<number>();
    const to: Cells = [...cells];
    let flags = 0;
    for (let detectiveIndex = 0; detectiveIndex < 3; detectiveIndex += 1) {
      const from = cells[detectiveIndex];
      if (from === undefined) throw new Error("missing detective");
      const search = rng() > 0.2;
      if (search) flags |= 1 << detectiveIndex;
      const reachable = reach(bit(from), search ? 2 : 3, WALK);
      const options = Array.from({ length: 120 }, (_, cell) => cell).filter(
        (cell) => (reachable & bit(cell)) !== 0n && !used.has(cell),
      );
      const choice = options[Math.floor(rng() * options.length)];
      if (choice === undefined) throw new Error("no reachable cell");
      to[detectiveIndex] = choice;
      used.add(choice);
    }

    await contract.connect(detective).playTurn(id, to, flags, previousEncoded, previousProof);
    const record = await contract.getTurn(id, turn);
    const report = await decryptBatch([record.report]);
    const clear = report.values[0];
    if (clear === undefined) throw new Error("missing report");
    reports.push(Number(clear));
    if ((clear & 3n) !== 0n || turn === 12) {
      await contract.connect(detective).resolveReport(id, report.encoded, report.proof);
      break;
    }
    previousEncoded = report.encoded;
    previousProof = report.proof;
  }
  return id;
}

async function revealRecord(contract: NoEscapeCase, id: bigint) {
  const { cellOf } = await import("@noescape/engine");
  const handles = await contract.revealHandles(id);
  const batchA = await decryptBatch(handles.a);
  const batchB = await decryptBatch(handles.b);
  const pathMasks = batchA.values;
  const path = pathMasks.map(cellOf);
  const values = batchB.values.map((value) => Number(value));
  const exitIdx = values[0];
  if (exitIdx === undefined) throw new Error("missing exit");
  const opened = await contract.getCase(id);
  const orders: Cells[] = [];
  const flags: number[] = [];
  const reports: number[] = [];
  const noise: number[] = [];
  const codes: number[] = [];
  const engineTurns: {
    to: Cells;
    searchFlags: number;
    noise: [number, number, number, number, number];
    codes: [number | null, number | null, number | null];
    report: number;
  }[] = [];
  let cursor = 1;

  for (let turn = 1; turn <= Number(opened.turn); turn += 1) {
    const record = await contract.getTurn(id, turn);
    const to = record.cells.map((cell) => Number(cell)) as Cells;
    const turnFlags = Number(record.searchFlags);
    const turnNoise = Array.from({ length: 5 }, () => {
      const value = values[cursor++];
      if (value === undefined) throw new Error("missing noise");
      return value;
    }) as [number, number, number, number, number];
    const engineCodes: [number | null, number | null, number | null] = [null, null, null];
    const captured = to.includes(path[turn - 1] ?? -1);
    orders.push(to);
    flags.push(turnFlags);
    reports.push(Number(record.reportClear));
    noise.push(...turnNoise);
    engineTurns.push({
      to,
      searchFlags: turnFlags,
      noise: captured ? [0, 0, 0, 0, 0] : turnNoise,
      codes: engineCodes,
      report: Number(record.reportClear),
    });
  }

  for (let index = 0; index < engineTurns.length; index += 1) {
    const turn = engineTurns[index];
    if (turn === undefined) throw new Error("missing engine turn");
    const captured = turn.to.includes(path[index] ?? -1);
    for (let detective = 0; detective < 3; detective += 1) {
      if ((turn.searchFlags & (1 << detective)) === 0) continue;
      const value = values[cursor++];
      if (value === undefined) throw new Error("missing code");
      codes.push(value);
      if (!captured) turn.codes[detective] = value;
    }
  }

  const reveal = {
    path: pathMasks,
    exitIdx,
    turnCount: Number(opened.turn),
    orders,
    flags,
    reports,
    noise,
    codes,
    finalStatus: Number(opened.status),
  };
  const engineRecord = { path, exitIdx, turns: engineTurns };
  return { reveal, engineRecord, batchA, batchB, values };
}

async function resolveLatest(contract: NoEscapeCase, detective: HardhatEthersSigner, id: bigint) {
  const opened = await contract.getCase(id);
  const record = await contract.getTurn(id, opened.turn);
  const report = await decryptBatch([record.report]);
  await contract.connect(detective).resolveReport(id, report.encoded, report.proof);
}

describe("case.reveal", () => {
  it("verifies seeded cases on chain and in the engine with identical counts", async function () {
    this.timeout(process.env.SOLIDITY_COVERAGE === "true" ? 900_000 : 300_000);
    const { verifyCase } = await import("@noescape/engine");
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const { contract, rules } = await deployCase();

    const caseCount = process.env.SOLIDITY_COVERAGE === "true" ? 2 : 20;
    for (let seed = 1; seed <= caseCount; seed += 1) {
      const id = await playRandomCase(contract, detective, seed);
      const { reveal, engineRecord, batchA, batchB } = await revealRecord(contract, id);
      const rulesResult = await rules.verifyCase(reveal);
      const engineResult = verifyCase(engineRecord);
      expect(rulesResult.ok, `rules seed ${seed}`).to.equal(true);
      expect(engineResult.ok, `engine seed ${seed}`).to.equal(true);
      expect(Number(rulesResult.moves)).to.equal(engineResult.counts.moves);
      expect(Number(rulesResult.answers)).to.equal(engineResult.counts.answers);
      expect(Number(rulesResult.reportsCount)).to.equal(engineResult.counts.reports);
      await expect(
        contract
          .connect(detective)
          .submitReveal(id, batchA.encoded, batchA.proof, batchB.encoded, batchB.proof),
      )
        .to.emit(contract, "CaseVerified")
        .withArgs(id, true, 0, 0);
      const opened = await contract.getCase(id);
      expect(opened.verified).to.equal(true);
      expect(opened.verifyOk).to.equal(true);
    }
  });

  it("rejects swapped or tampered clears, verifies once, and accepts abandoned cases", async () => {
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const { contract } = await deployCase();
    await contract.connect(detective).openCase();
    const id = await contract.activeCaseOf(detective.address);
    await contract.connect(detective).playTurn(id, [29, 30, 41], 7, "0x", "0x");
    await resolveLatest(contract, detective, id);
    await contract.connect(detective).abandonCase(id);
    const { batchA, batchB, values } = await revealRecord(contract, id);
    const swapped = [...batchA.values].reverse();
    const swappedEncoded = ethers.AbiCoder.defaultAbiCoder().encode(["uint128[]"], [swapped]);
    await expect(
      contract.submitReveal(id, swappedEncoded, batchA.proof, batchB.encoded, batchB.proof),
    ).to.be.reverted;
    const tampered = [...values];
    tampered[0] = (tampered[0] ?? 0) + 1;
    const tamperedEncoded = ethers.AbiCoder.defaultAbiCoder().encode(["uint8[]"], [tampered]);
    await expect(
      contract.submitReveal(id, batchA.encoded, batchA.proof, tamperedEncoded, batchB.proof),
    ).to.be.reverted;

    await expect(
      contract.submitReveal(id, batchA.encoded, batchA.proof, batchB.encoded, batchB.proof),
    )
      .to.emit(contract, "CaseVerified")
      .withArgs(id, true, 0, 0);
    await expect(
      contract.submitReveal(id, batchA.encoded, batchA.proof, batchB.encoded, batchB.proof),
    ).to.be.revertedWithCustomError(contract, "AlreadyVerified");
  });

  it("requires an ended case before revealing", async () => {
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const { contract } = await deployCase();
    await contract.connect(detective).openCase();
    const id = await contract.activeCaseOf(detective.address);
    await expect(contract.revealHandles(id)).to.be.revertedWithCustomError(contract, "NotEnded");
    await expect(contract.submitReveal(id, "0x", "0x", "0x", "0x")).to.be.revertedWithCustomError(
      contract,
      "NotEnded",
    );
  });

  it("returns each plaintext verifier failure code", async () => {
    const { CAMERAS, bit, neighbors, WALK } = await import("@noescape/engine");
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const { contract, rules } = await deployCase();
    await contract.connect(detective).openCase();
    const id = await contract.activeCaseOf(detective.address);
    await contract.connect(detective).playTurn(id, [29, 30, 41], 7, "0x", "0x");
    await resolveLatest(contract, detective, id);
    await contract.connect(detective).abandonCase(id);
    const { reveal } = await revealRecord(contract, id);
    expect((await rules.verifyCase(reveal)).ok).to.equal(true);
    for (const camera of CAMERAS) {
      expect(Number(await rules.camera(bit(camera.cell)))).to.equal(camera.id);
    }

    const mutant = () => structuredClone(reveal);
    const cases: [number, (record: typeof reveal) => void][] = [
      [
        1,
        (record) => {
          record.path[0] = bit(29);
        },
      ],
      [
        2,
        (record) => {
          record.path[1] = 0n;
        },
      ],
      [
        3,
        (record) => {
          record.path[1] = bit(119);
        },
      ],
      [
        5,
        (record) => {
          record.codes[0] = ((record.codes[0] ?? 0) + 1) % 3;
        },
      ],
      [
        6,
        (record) => {
          record.reports[0] = (record.reports[0] ?? 0) ^ 4;
        },
      ],
      [
        7,
        (record) => {
          record.exitIdx = 4;
        },
      ],
      [
        8,
        (record) => {
          record.orders[0] = [119, 30, 41];
        },
      ],
      [
        5,
        (record) => {
          record.codes = [];
        },
      ],
      [
        4,
        (record) => {
          record.noise[0] = 8;
        },
      ],
      [
        2,
        (record) => {
          record.path.pop();
        },
      ],
      [
        8,
        (record) => {
          record.orders.pop();
        },
      ],
      [
        4,
        (record) => {
          record.noise.pop();
        },
      ],
      [
        5,
        (record) => {
          record.codes.push(0);
        },
      ],
      [
        6,
        (record) => {
          record.finalStatus = 2;
        },
      ],
    ];
    const current = reveal.path[0] ?? 0n;
    const alternative = Array.from({ length: 120 }, (_, cell) => cell).find(
      (cell) =>
        (neighbors(current) & bit(cell)) !== 0n &&
        (bit(cell) & WALK) !== 0n &&
        bit(cell) !== reveal.path[1] &&
        !reveal.orders[0]?.includes(cell),
    );
    if (alternative !== undefined) {
      cases.splice(3, 0, [
        4,
        (record) => {
          record.path[1] = bit(alternative);
        },
      ]);
    }
    for (const [expected, mutate] of cases) {
      const record = mutant();
      mutate(record);
      const result = await rules.verifyCase(record);
      expect(result.ok, `fail ${expected}`).to.equal(false);
      expect(Number(result.failCode)).to.equal(expected);
    }
  });
});
