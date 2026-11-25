import { FhevmType, type FhevmTypeEuint } from "@fhevm/mock-utils";
import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { Signer } from "ethers";
import { ethers, fhevm } from "hardhat";
import type { MostWanted, TestToken } from "../types";

const { time } = networkHelpers;
const FEE = 5_000_000n;
const MINT = 100_000_000n;
const OPERATOR_SECONDS = 30 * 24 * 60 * 60;

type CaptureProof = {
  caught: boolean;
  encoded: `0x${string}`;
  proof: `0x${string}`;
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
  const wanted = await (
    await ethers.getContractFactory("MostWanted", {
      libraries: { CaseRules: rules.target },
    })
  ).deploy(await token.getAddress(), FEE);
  await wanted.waitForDeployment();
  return { token, wanted, deployer, hunter, other, third };
}

async function prepareHunter(
  token: TestToken,
  wanted: MostWanted,
  hunter: Signer,
  amount = MINT,
): Promise<void> {
  const address = await hunter.getAddress();
  await (await token.mint(address, amount)).wait();
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

async function currentWatchNo(): Promise<number> {
  return Math.floor(((await currentTimestamp()) % 86400) / 1800) + 1;
}

async function decryptUint(type: FhevmTypeEuint, handle: string) {
  return fhevm.debugger.decryptEuint(type, handle);
}

async function decryptBool(handle: string): Promise<bigint> {
  return (await fhevm.debugger.decryptEbool(handle)) ? 1n : 0n;
}

async function publicCapture(action: { caught: string }): Promise<CaptureProof> {
  const handle = action.caught as `0x${string}`;
  const result = await fhevm.publicDecrypt([handle]);
  const caught = result.clearValues[handle];
  if (typeof caught !== "boolean") throw new Error("capture proof did not decode to a boolean");
  return {
    caught,
    encoded: result.abiEncodedClearValues,
    proof: result.decryptionProof,
  };
}

async function skipNightMove(wanted: MostWanted, day: number): Promise<void> {
  const address = await wanted.getAddress();
  const daySlot = BigInt(
    ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint32", "uint256"], [day, 0])),
  );
  const stateSlot = ethers.toBeHex(daySlot + 6n);
  const stored = ethers.getBytes(await ethers.provider.getStorage(address, stateSlot));
  stored[stored.length - 2] = await currentWatchNo();
  await ethers.provider.send("hardhat_setStorageAt", [address, stateSlot, ethers.hexlify(stored)]);
  expect((await wanted.getDay(day)).lastStepWatch).to.equal(BigInt(await currentWatchNo()));
}

async function nextWatch(): Promise<void> {
  const now = await currentTimestamp();
  await time.increaseTo((Math.floor(now / 1800) + 1) * 1800);
}

async function captureAtCurrentPosition(
  wanted: MostWanted,
  hunter: Signer,
  day: number,
): Promise<{ actionIndex: number; proof: CaptureProof }> {
  const { WALK, bit, neighbors, cellOf } = await import("@noescape/engine");
  const route = (from: number, target: number): number[] => {
    const queue = [from];
    const previous = new Map<number, number>([[from, -1]]);
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head];
      if (cell === undefined || cell === target) break;
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

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) await nextWatch();
    const opened = await wanted.getDay(day);
    const fugitive = cellOf(await decryptUint(FhevmType.euint128, opened.pos));
    const joined = await wanted.getHunter(day, await hunter.getAddress());
    const from = Number(joined.cell);
    const path = route(from, fugitive);
    const to = path[Math.min(3, path.length - 1)] ?? from;
    if (to === undefined) throw new Error("no route to fugitive");
    await skipNightMove(wanted, day);
    await (await wanted.connect(hunter).hunt(to, false)).wait();
    const actionIndex = Number((await wanted.actionsOf(day, 0, 100)).length - 1);
    const action = (await wanted.actionsOf(day, actionIndex, 1))[0];
    if (action === undefined) throw new Error("missing capture action");
    const proof = await publicCapture(action);
    if (proof.caught) return { actionIndex, proof };
  }
  throw new Error("hunter did not capture the stationary fugitive");
}

async function expectUserDecryptRejection(promise: Promise<unknown>): Promise<void> {
  let rejection: unknown;
  try {
    await promise;
  } catch (error) {
    rejection = error;
  }
  expect(rejection).not.to.equal(undefined);
}

describe("mw.hunt", () => {
  it("moves the fugitive once for two hunters in the same watch", async () => {
    const { token, wanted, hunter, other } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await prepareHunter(token, wanted, other);
    await wanted.connect(hunter).join();
    await wanted.connect(other).join();
    const watchNo = await currentWatchNo();

    await wanted.connect(hunter).hunt(29, false);
    await wanted.connect(other).hunt(30, false);

    const opened = await wanted.getDay(day);
    expect(opened.steps).to.equal(1n);
    expect(opened.lastStepWatch).to.equal(BigInt(watchNo));
    const actions = await wanted.actionsOf(day, 0, 10);
    expect(actions).to.have.length(2);
    expect(actions[0]?.step).to.equal(1n);
    expect(actions[1]?.step).to.equal(1n);
  });

  it("rejects a second action by the same hunter in one watch", async () => {
    const { token, wanted, hunter } = await deployFixture();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    await wanted.connect(hunter).hunt(29, false);

    await expect(wanted.connect(hunter).hunt(29, false)).to.be.revertedWithCustomError(
      wanted,
      "OncePerWatch",
    );
  });

  it("rejects non-hunters and invalid orders", async () => {
    const { token, wanted, hunter, other } = await deployFixture();
    await expect(wanted.connect(other).hunt(29, false)).to.be.revertedWithCustomError(
      wanted,
      "NotJoined",
    );
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    await expect(wanted.connect(hunter).hunt(65, false))
      .to.be.revertedWithCustomError(wanted, "BadOrders")
      .withArgs(3n);
  });

  it("allows a search code only to the acting hunter", async () => {
    const { token, wanted, hunter, other } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await prepareHunter(token, wanted, other);
    await wanted.connect(hunter).join();
    await wanted.connect(other).join();
    await wanted.connect(hunter).hunt(29, true);

    const action = (await wanted.actionsOf(day, 0, 1))[0];
    if (action === undefined) throw new Error("missing hunt action");
    const address = await wanted.getAddress();
    const expected = await decryptUint(FhevmType.euint8, action.code);
    const actual = await fhevm.userDecryptEuint(FhevmType.euint8, action.code, address, hunter);
    expect(actual).to.equal(expected);
    await expectUserDecryptRejection(
      fhevm.userDecryptEuint(FhevmType.euint8, action.code, address, other),
    );
  });

  it("pays a captured hunter who paid the fee", async () => {
    const { token, wanted, hunter } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    const balanceBefore = await decryptUint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(hunter.address),
    );
    const { actionIndex, proof } = await captureAtCurrentPosition(wanted, hunter, day);

    await expect(wanted.claimCapture(day, actionIndex, proof.encoded, proof.proof))
      .to.emit(wanted, "DayClosed")
      .withArgs(day, 2);

    const opened = await wanted.getDay(day);
    const action = (await wanted.actionsOf(day, actionIndex, 1))[0];
    expect(opened.status).to.equal(2n);
    expect(opened.winner).to.equal(hunter.address);
    expect(action?.resolved).to.equal(true);
    const balanceAfter = await decryptUint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(hunter.address),
    );
    expect(balanceAfter).to.equal(balanceBefore + FEE);
    expect(
      await decryptUint(
        FhevmType.euint64,
        await token.confidentialBalanceOf(await wanted.getAddress()),
      ),
    ).to.equal(0n);
    await expect(wanted.connect(hunter).hunt(29, false)).to.be.revertedWithCustomError(
      wanted,
      "DayOver",
    );
  });

  it("pays an unpaid winner zero and rolls the pot into the next day", async () => {
    const { token, wanted, hunter, other, third } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    await prepareHunter(token, wanted, other, 1_000_000n);
    await wanted.connect(other).join();
    expect(await decryptBool((await wanted.getHunter(day, other.address)).paid)).to.equal(0n);
    const balanceBefore = await decryptUint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(other.address),
    );
    const { actionIndex, proof } = await captureAtCurrentPosition(wanted, other, day);

    await wanted.claimCapture(day, actionIndex, proof.encoded, proof.proof);

    const balanceAfter = await decryptUint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(other.address),
    );
    expect(balanceAfter).to.equal(balanceBefore);
    expect(
      await decryptUint(
        FhevmType.euint64,
        await token.confidentialBalanceOf(await wanted.getAddress()),
      ),
    ).to.equal(FEE);

    await time.increaseTo((day + 1) * 86400 + 12 * 3600);
    await prepareHunter(token, wanted, third);
    await wanted.connect(third).join();
    expect(await decryptUint(FhevmType.euint64, (await wanted.getDay(day + 1)).pot)).to.equal(
      FEE * 2n,
    );
  });

  it("leaves the day unchanged for a valid false capture proof", async () => {
    const { token, wanted, hunter } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    const joined = await wanted.getHunter(day, hunter.address);
    await skipNightMove(wanted, day);
    await wanted.connect(hunter).hunt(Number(joined.cell), false);
    const action = (await wanted.actionsOf(day, 0, 1))[0];
    if (action === undefined) throw new Error("missing hunt action");
    const proof = await publicCapture(action);
    expect(proof.caught).to.equal(false);

    await wanted.claimCapture(day, 0, proof.encoded, proof.proof);

    const opened = await wanted.getDay(day);
    const stored = (await wanted.actionsOf(day, 0, 1))[0];
    expect(opened.status).to.equal(1n);
    expect(opened.winner).to.equal(ethers.ZeroAddress);
    expect(stored?.resolved).to.equal(false);
    expect(await decryptUint(FhevmType.euint64, opened.pot)).to.equal(FEE);
  });

  it("rejects a capture claim after the day ended", async () => {
    const { token, wanted, hunter, other } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    await wanted.connect(hunter).hunt(29, false);
    const action = (await wanted.actionsOf(day, 0, 1))[0];
    if (action === undefined) throw new Error("missing hunt action");
    const proof = await publicCapture(action);

    await time.increaseTo((day + 1) * 86400 + 12 * 3600);
    await prepareHunter(token, wanted, other);
    await wanted.connect(other).join();

    await expect(
      wanted.claimCapture(day, 0, proof.encoded, proof.proof),
    ).to.be.revertedWithCustomError(wanted, "DayOver");
  });
});
