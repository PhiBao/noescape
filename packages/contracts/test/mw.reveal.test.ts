import type { DailyRecord } from "@noescape/engine";
import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { Signer } from "ethers";
import { ethers, fhevm } from "hardhat";
import type { MostWanted, TestToken } from "../types";

const { time } = networkHelpers;
const FEE = 5_000_000n;
const MINT = 100_000_000n;
const OPERATOR_SECONDS = 30 * 24 * 60 * 60;

type SolidityDaily = {
  path: bigint[];
  detMasks: bigint[];
  noise: number[];
  hunters: number[];
  actionSteps: number[];
  fromCells: number[];
  toCells: number[];
  searched: boolean[];
  codes: number[];
  hunterCount: number;
  finalStatus: number;
};

async function deployFixture() {
  const now = await currentTimestamp();
  const dayStart = Math.floor(now / 86400) * 86400;
  const noon = dayStart + 12 * 3600;
  await time.increaseTo(noon > now ? noon : dayStart + 86400 + 12 * 3600);

  const [deployer, hunter, other, third] = await ethers.getSigners();
  if (
    deployer === undefined ||
    hunter === undefined ||
    other === undefined ||
    third === undefined
  ) {
    throw new Error("missing Hardhat signers");
  }
  const token = await (await ethers.getContractFactory("TestToken")).deploy();
  await token.waitForDeployment();
  const rules = await (await ethers.getContractFactory("CaseRules")).deploy();
  await rules.waitForDeployment();
  const harness = await (
    await ethers.getContractFactory("CaseRulesHarness", {
      libraries: { CaseRules: rules.target },
    })
  ).deploy();
  await harness.waitForDeployment();
  const wanted = await (
    await ethers.getContractFactory("MostWanted", {
      libraries: { CaseRules: rules.target },
    })
  ).deploy(await token.getAddress(), FEE);
  await wanted.waitForDeployment();
  return { token, rules, harness, wanted, deployer, hunter, other, third };
}

async function prepareHunter(token: TestToken, wanted: MostWanted, hunter: Signer): Promise<void> {
  const address = await hunter.getAddress();
  await (await token.mint(address, MINT)).wait();
  const block = await ethers.provider.getBlock("latest");
  if (block === null) throw new Error("missing latest block");
  await (
    await token
      .connect(hunter)
      .setOperator(await wanted.getAddress(), block.timestamp + OPERATOR_SECONDS)
  ).wait();
}

async function currentTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  if (block === null) throw new Error("missing latest block");
  return block.timestamp;
}

async function currentDay(): Promise<number> {
  return Math.floor((await currentTimestamp()) / 86400);
}

async function nextWatch(): Promise<void> {
  const now = await currentTimestamp();
  await time.increaseTo((Math.floor(now / 1800) + 1) * 1800);
}

async function playDay(token: TestToken, wanted: MostWanted, hunters: Signer[]): Promise<number> {
  const { PRECINCT } = await import("@noescape/engine");
  const day = await currentDay();
  for (const hunter of hunters) {
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
  }
  for (let step = 1; step <= 10; step += 1) {
    if (step > 1) await nextWatch();
    const hunterIndex = (step - 1) % hunters.length;
    const hunter = hunters[hunterIndex];
    const cell = PRECINCT[hunterIndex]?.cell;
    if (hunter === undefined || cell === undefined) throw new Error("missing hunter or precinct");
    await wanted.connect(hunter).hunt(cell, true);
  }
  await time.increaseTo((day + 1) * 86400);
  await wanted.closeDay(day);
  return day;
}

async function decryptPart(part: { kind: bigint; start: bigint; handles: string[] }) {
  const handles = part.handles as `0x${string}`[];
  const result = await fhevm.publicDecrypt(handles);
  const values = handles.map((handle) => {
    const value = result.clearValues[handle];
    if (typeof value !== "bigint") throw new Error(`missing clear value for ${handle}`);
    return value;
  });
  return { values, encoded: result.abiEncodedClearValues, proof: result.decryptionProof };
}

async function recordsForDay(wanted: MostWanted, day: number) {
  const { bit, cellOf, PRECINCT } = await import("@noescape/engine");
  const plan = await wanted.revealPlan(day);
  const pathValues: bigint[] = [];
  const noiseValues: number[] = [];
  const codeValues: number[] = [];
  for (const part of plan) {
    const decoded = await decryptPart(part);
    if (part.kind === 0n) {
      for (let index = 0; index < decoded.values.length; index += 1) {
        pathValues[Number(part.start) + index] = decoded.values[index] ?? 0n;
      }
    } else if (part.kind === 1n) {
      noiseValues.push(...decoded.values.map(Number));
    } else {
      for (let index = 0; index < decoded.values.length; index += 1) {
        codeValues[Number(part.start) + index] = Number(decoded.values[index]);
      }
    }
  }

  const actions = await wanted.actionsOf(day, 0, 100);
  const hunterCells = PRECINCT.map((entry) => entry.cell);
  const detMasks: bigint[] = [];
  const engineActions: DailyRecord["actions"] = [];
  const solidityActions: SolidityDaily = {
    path: pathValues,
    detMasks,
    noise: noiseValues,
    hunters: [],
    actionSteps: [],
    fromCells: [],
    toCells: [],
    searched: [],
    codes: codeValues,
    hunterCount: Number((await wanted.getDay(day)).hunters),
    finalStatus: 3,
  };

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (action === undefined) throw new Error("missing action");
    const hunter = index % 3;
    const cell = hunterCells[hunter];
    if (cell === undefined) throw new Error("missing hunter cell");
    detMasks.push(hunterCells.reduce((mask, value) => mask | bit(value), 0n));
    engineActions.push({
      hunter,
      step: Number(action.step),
      fromCell: Number(action.fromCell),
      toCell: Number(action.toCell),
      searched: action.searched,
      code: codeValues[engineActions.length] ?? 0,
    });
    solidityActions.hunters.push(hunter);
    solidityActions.actionSteps.push(Number(action.step));
    solidityActions.fromCells.push(Number(action.fromCell));
    solidityActions.toCells.push(Number(action.toCell));
    solidityActions.searched.push(action.searched);
    hunterCells[hunter] = Number(action.toCell);
  }

  const engineRecord: DailyRecord = {
    path: pathValues.map((mask) => cellOf(mask)),
    steps: detMasks.map((detMask, index) => ({
      detMask,
      noise: noiseValues.slice(index * 5, index * 5 + 5) as [
        number,
        number,
        number,
        number,
        number,
      ],
    })),
    actions: engineActions,
    hunterCount: solidityActions.hunterCount,
    finalStatus: "gotAway",
  };
  return { engineRecord, solidityRecord: solidityActions, plan };
}

describe("mw.reveal", () => {
  it("verifies a three-hunter ten-step day onchain and in the engine", async () => {
    const { token, wanted, harness, hunter, other, third } = await deployFixture();
    const day = await playDay(token, wanted, [hunter, other, third]);
    const { engineRecord, solidityRecord, plan } = await recordsForDay(wanted, day);
    const { verifyDaily } = await import("@noescape/engine");
    const engineResult = verifyDaily(engineRecord);
    const chainResult = await harness.verifyDaily(solidityRecord);
    expect(engineResult.ok).to.equal(true);
    expect(engineResult.failCode).to.equal(0);
    expect(engineResult.failTurn).to.equal(0);
    expect(engineResult.counts).to.deep.equal({ moves: 10, answers: 10, reports: 10 });
    expect(chainResult.ok).to.equal(true);
    expect(chainResult.failCode).to.equal(0n);
    expect(chainResult.failTurn).to.equal(0n);
    expect(chainResult.moves).to.equal(10n);
    expect(chainResult.answers).to.equal(10n);
    expect(chainResult.reportsCount).to.equal(10n);

    for (const part of [...plan].reverse()) {
      const decoded = await decryptPart(part);
      await wanted.submitDailyReveal(day, part.kind, part.start, decoded.encoded, decoded.proof);
    }
    const opened = await wanted.getDay(day);
    expect(opened.verified).to.equal(true);
    expect(opened.verifyOk).to.equal(true);
    expect(opened.failCode).to.equal(0n);
    await expect(wanted.submitDailyReveal(day, 0, 0, "0x", "0x")).to.be.revertedWithCustomError(
      wanted,
      "AlreadyVerified",
    );
  });

  it("returns the same tamper codes in Solidity and TypeScript", async () => {
    const { token, wanted, harness, hunter, other, third } = await deployFixture();
    const day = await playDay(token, wanted, [hunter, other, third]);
    const { engineRecord, solidityRecord } = await recordsForDay(wanted, day);
    const { verifyDaily } = await import("@noescape/engine");
    const { bit, neighbors, plus, PRECINCT, WALK } = await import("@noescape/engine");

    const firstStep = engineRecord.steps[0];
    const firstAction = engineRecord.actions[0];
    if (firstStep === undefined || firstAction === undefined)
      throw new Error("missing daily record");
    const check = async (failCode: number, failTurn: number) => {
      const engineResult = verifyDaily(engineRecord);
      const chainResult = await harness.verifyDaily(solidityRecord);
      expect(engineResult.ok).to.equal(false);
      expect(engineResult.failCode).to.equal(failCode);
      expect(engineResult.failTurn).to.equal(failTurn);
      expect(chainResult.ok).to.equal(false);
      expect(chainResult.failCode).to.equal(BigInt(failCode));
      expect(chainResult.failTurn).to.equal(BigInt(failTurn));
    };

    const originalStart = engineRecord.path[0];
    if (originalStart === undefined) throw new Error("missing start");
    engineRecord.path[0] = 5 * 10 + 2;
    solidityRecord.path[0] = bit(engineRecord.path[0]);
    await check(1, 0);
    engineRecord.path[0] = originalStart;
    solidityRecord.path[0] = bit(originalStart);

    const originalNoise = solidityRecord.noise[0] ?? 0;
    solidityRecord.noise[0] = 8;
    firstStep.noise[0] = 8;
    await check(4, 1);
    solidityRecord.noise[0] = originalNoise;
    firstStep.noise[0] = originalNoise;

    const firstCode = solidityRecord.codes[0] ?? 0;
    solidityRecord.codes[0] = firstCode === 2 ? 0 : 2;
    firstAction.code = solidityRecord.codes[0] ?? 0;
    await check(5, 1);
    solidityRecord.codes[0] = firstCode;
    firstAction.code = firstCode;

    solidityRecord.fromCells[0] = 255;
    firstAction.fromCell = 255;
    await check(8, 1);
    solidityRecord.fromCells[0] = PRECINCT[0].cell;
    firstAction.fromCell = PRECINCT[0].cell;

    const current = engineRecord.path[0];
    const originalNext = engineRecord.path[1];
    if (current === undefined || originalNext === undefined) throw new Error("missing path");
    const used = new Set(engineRecord.path);
    const adjacent = neighbors(bit(current)) & WALK;
    const searchedShapes = PRECINCT.reduce((mask, entry) => mask | plus(entry.cell), 0n);
    const replacement = Array.from({ length: 120 }, (_, cell) => cell).find(
      (cell) =>
        (WALK & bit(cell)) !== 0n &&
        (adjacent & bit(cell)) === 0n &&
        (searchedShapes & bit(cell)) === 0n &&
        !used.has(cell) &&
        cell !== originalNext,
    );
    if (replacement === undefined) throw new Error("no alternate path cell");
    engineRecord.path[1] = replacement;
    solidityRecord.path[1] = bit(replacement);
    await check(3, 1);
  });

  it("rejects early close and duplicate or forged reveal parts", async () => {
    const { token, wanted, hunter } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    await expect(wanted.closeDay(day)).to.be.revertedWithCustomError(wanted, "NotEnded");
    await wanted.connect(hunter).hunt(29, false);
    await time.increaseTo((day + 1) * 86400);
    await wanted.closeDay(day);
    const part = (await wanted.revealPlan(day))[0];
    if (part === undefined) throw new Error("missing path part");
    const decoded = await decryptPart(part);
    await wanted.submitDailyReveal(day, part.kind, part.start, decoded.encoded, decoded.proof);
    await expect(
      wanted.submitDailyReveal(day, part.kind, part.start, decoded.encoded, decoded.proof),
    ).to.be.revertedWithCustomError(wanted, "AlreadySubmitted");

    const noise = (await wanted.revealPlan(day)).find((entry) => entry.kind === 1n);
    if (noise === undefined) throw new Error("missing noise part");
    const noiseDecoded = await decryptPart(noise);
    const forged = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8[]"],
      [noiseDecoded.values.map((value) => Number(value) + 1)],
    );
    await expect(wanted.submitDailyReveal(day, noise.kind, noise.start, forged, noiseDecoded.proof))
      .to.be.reverted;
  });
});
