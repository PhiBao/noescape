import { FhevmType, type FhevmTypeEuint } from "@fhevm/mock-utils";
import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { HDNodeWallet, Signer } from "ethers";
import { ethers, fhevm } from "hardhat";
import type { MostWanted, TestToken } from "../types";

const { time } = networkHelpers;
const FEE = 5_000_000n;
const MINT = 100_000_000n;
const OPERATOR_SECONDS = 30 * 24 * 60 * 60;

async function deployFixture() {
  const [deployer, hunter, other] = await ethers.getSigners();
  if (deployer === undefined || hunter === undefined || other === undefined) {
    throw new Error("missing Hardhat signers");
  }
  const tokenFactory = await ethers.getContractFactory("TestToken");
  const token = await tokenFactory.deploy();
  await token.waitForDeployment();
  const rules = await (await ethers.getContractFactory("CaseRules")).deploy();
  await rules.waitForDeployment();
  const wantedFactory = await ethers.getContractFactory("MostWanted", {
    libraries: { CaseRules: rules.target },
  });
  const wanted = await wantedFactory.deploy(await token.getAddress(), FEE);
  await wanted.waitForDeployment();
  return { token, wanted, deployer, hunter, other };
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

async function randomHunter(): Promise<HDNodeWallet> {
  const wallet = ethers.Wallet.createRandom();
  await ethers.provider.send("hardhat_setBalance", [
    wallet.address,
    ethers.toBeHex(ethers.parseEther("1")),
  ]);
  return wallet.connect(ethers.provider);
}

async function currentDay(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  if (block === null) throw new Error("missing latest block");
  return Math.floor(block.timestamp / 86400);
}

async function decryptUint(type: FhevmTypeEuint, handle: string) {
  return fhevm.debugger.decryptEuint(type, handle);
}

async function decryptBool(handle: string): Promise<bigint> {
  return (await fhevm.debugger.decryptEbool(handle)) ? 1n : 0n;
}

describe("mw.join", () => {
  it("opens the day on first join and assigns the first precinct detective", async () => {
    const { token, wanted, hunter } = await deployFixture();
    const { PRECINCT, STARTS, cellOf } = await import("@noescape/engine");
    const day = await currentDay();
    expect((await wanted.getDay(day)).status).to.equal(0n);
    await prepareHunter(token, wanted, hunter);

    await expect(wanted.connect(hunter).join())
      .to.emit(wanted, "DayOpened")
      .withArgs(day)
      .and.to.emit(wanted, "HunterJoined")
      .withArgs(day, hunter.address, PRECINCT[0].cell, 0n);

    const opened = await wanted.getDay(day);
    expect(opened.day).to.equal(BigInt(day));
    expect(opened.status).to.equal(1n);
    expect(opened.hunters).to.equal(1n);
    expect(opened.steps).to.equal(0n);
    expect(opened.pos).to.equal(opened.startPos);
    expect(opened.p1).to.equal(opened.startPos);
    expect(opened.p2).to.equal(opened.startPos);
    expect(opened.trail).to.equal(opened.startPos);
    const start = await decryptUint(FhevmType.euint128, opened.startPos);
    expect(STARTS).to.include(cellOf(start));

    const joined = await wanted.getHunter(day, hunter.address);
    expect(joined.joined).to.equal(true);
    expect(joined.cell).to.equal(BigInt(PRECINCT[0].cell));
    expect(joined.lastWatch).to.equal(0n);
    expect(joined.actions).to.equal(0n);
    expect(await decryptBool(joined.paid)).to.equal(1n);
    expect(await decryptUint(FhevmType.euint64, opened.pot)).to.equal(FEE);
    expect(await wanted.actionsOf(day, 0, 10)).to.have.length(0);
  });

  it("pulls the fee into the daily pot", async () => {
    const { token, wanted, hunter } = await deployFixture();
    const day = await currentDay();
    await prepareHunter(token, wanted, hunter);
    const senderBefore = await decryptUint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(hunter.address),
    );

    await wanted.connect(hunter).join();

    const senderAfter = await decryptUint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(hunter.address),
    );
    const potBalance = await decryptUint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(await wanted.getAddress()),
    );
    expect(senderBefore).to.equal(MINT);
    expect(senderAfter).to.equal(MINT - FEE);
    expect(potBalance).to.equal(FEE);
    expect(await decryptUint(FhevmType.euint64, (await wanted.getDay(day)).pot)).to.equal(FEE);
  });

  it("rejects a second join by the same hunter", async () => {
    const { token, wanted, hunter } = await deployFixture();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();

    await expect(wanted.connect(hunter).join()).to.be.revertedWithCustomError(
      wanted,
      "AlreadyJoined",
    );
  });

  it("rolls an unfinished day and its pot into the next UTC day", async () => {
    const { token, wanted, hunter, other } = await deployFixture();
    const firstDay = await currentDay();
    await prepareHunter(token, wanted, hunter);
    await wanted.connect(hunter).join();
    const firstPaid = await wanted.getHunter(firstDay, hunter.address);
    const firstPot = await wanted.getDay(firstDay);
    expect(await decryptBool(firstPaid.paid)).to.equal(1n);
    expect(await decryptUint(FhevmType.euint64, firstPot.pot)).to.equal(FEE);
    await prepareHunter(token, wanted, other);
    await time.increaseTo((firstDay + 1) * 86400);

    await expect(wanted.connect(other).join())
      .to.emit(wanted, "DayClosed")
      .withArgs(firstDay, 3)
      .and.to.emit(wanted, "DayOpened")
      .withArgs(firstDay + 1);

    const previous = await wanted.getDay(firstDay);
    const opened = await wanted.getDay(firstDay + 1);
    expect(previous.status).to.equal(3n);
    expect(opened.status).to.equal(1n);
    expect(opened.hunters).to.equal(1n);
    expect(await decryptUint(FhevmType.euint64, opened.pot)).to.equal(FEE * 2n);
  });

  it("rejects the 65th hunter", async () => {
    const { token, wanted } = await deployFixture();
    const day = await currentDay();
    const block = await ethers.provider.getBlock("latest");
    if (block === null) throw new Error("missing latest block");
    const until = block.timestamp + OPERATOR_SECONDS;

    for (let index = 0; index < 64; index += 1) {
      const hunter = await randomHunter();
      await (await token.mint(hunter.address, MINT)).wait();
      await (await token.connect(hunter).setOperator(await wanted.getAddress(), until)).wait();
      await (await wanted.connect(hunter).join()).wait();
    }

    expect((await wanted.getDay(day)).hunters).to.equal(64n);
    expect(await decryptUint(FhevmType.euint64, (await wanted.getDay(day)).pot)).to.equal(
      FEE * 64n,
    );
    const extra = await randomHunter();
    await expect(wanted.connect(extra).join()).to.be.revertedWithCustomError(wanted, "DayFull");
  });

  it("records an underfunded join as unpaid without reverting", async () => {
    const { token, wanted, hunter } = await deployFixture();
    const day = await currentDay();
    const block = await ethers.provider.getBlock("latest");
    if (block === null) throw new Error("missing latest block");
    await (
      await token
        .connect(hunter)
        .setOperator(await wanted.getAddress(), block.timestamp + OPERATOR_SECONDS)
    ).wait();

    await expect(wanted.connect(hunter).join()).not.to.be.reverted;

    const joined = await wanted.getHunter(day, hunter.address);
    const opened = await wanted.getDay(day);
    expect(joined.joined).to.equal(true);
    expect(await decryptBool(joined.paid)).to.equal(0n);
    expect(await decryptUint(FhevmType.euint64, opened.pot)).to.equal(0n);
  });
});
