import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

const { loadFixture, time } = networkHelpers;

const DRIP = ethers.parseEther("0.005");
const CAP = ethers.parseEther("0.025");
const FUNDING = ethers.parseEther("0.1");

async function deployTap(dailyCap = CAP) {
  const [owner, operator, recipient, other] = await ethers.getSigners();
  if (
    owner === undefined ||
    operator === undefined ||
    recipient === undefined ||
    other === undefined
  ) {
    throw new Error("missing Hardhat signer");
  }
  await ethers.provider.send("hardhat_setBalance", [recipient.address, "0x0"]);
  await ethers.provider.send("hardhat_setBalance", [other.address, "0x0"]);
  const factory = await ethers.getContractFactory("GasTap");
  const tap = await factory.deploy(owner.address, operator.address, DRIP, dailyCap);
  await owner.sendTransaction({ to: tap.target, value: FUNDING });
  return { tap, owner, operator, recipient, other };
}

async function deployFixture() {
  return deployTap();
}

async function emptyBalance(address: string): Promise<void> {
  await ethers.provider.send("hardhat_setBalance", [address, "0x0"]);
}

describe("gastap", () => {
  it("drips once and records the spend", async () => {
    const { tap, operator, recipient } = await loadFixture(deployFixture);
    await expect(tap.connect(operator).drip(recipient.address))
      .to.emit(tap, "Dripped")
      .withArgs(recipient.address, DRIP);
    expect(await ethers.provider.getBalance(recipient.address)).to.equal(DRIP);
    expect(await tap.spentToday()).to.equal(DRIP);
    expect(await tap.lastDrip(recipient.address)).to.be.greaterThan(0n);
  });

  it("rejects a non-operator", async () => {
    const { tap, recipient } = await loadFixture(deployFixture);
    let rejection: unknown;
    try {
      await tap.connect(recipient).drip(recipient.address);
    } catch (error) {
      rejection = error;
    }
    expect(rejection).not.to.equal(undefined);
  });

  it("rejects while paused with the custom error", async () => {
    const { tap, owner, operator, recipient } = await loadFixture(deployFixture);
    await tap.connect(owner).pause();
    await expect(tap.connect(operator).drip(recipient.address)).to.be.revertedWithCustomError(
      tap,
      "EnforcedPause",
    );
  });

  it("enforces the one-day cooldown", async () => {
    const { tap, operator, recipient } = await loadFixture(deployFixture);
    await tap.connect(operator).drip(recipient.address);
    await emptyBalance(recipient.address);
    await expect(tap.connect(operator).drip(recipient.address)).to.be.revertedWithCustomError(
      tap,
      "TooSoon",
    );
  });

  it("rejects an already-funded badge", async () => {
    const { tap, operator, recipient } = await loadFixture(deployFixture);
    await ethers.provider.send("hardhat_setBalance", [
      recipient.address,
      ethers.toBeHex(DRIP / 2n),
    ]);
    await expect(tap.connect(operator).drip(recipient.address)).to.be.revertedWithCustomError(
      tap,
      "AlreadyFunded",
    );
  });

  it("enforces the daily cap and resets it at UTC midnight", async () => {
    const { tap, operator, recipient, other } = await deployTap(DRIP);
    await tap.connect(operator).drip(recipient.address);
    await expect(tap.connect(operator).drip(other.address)).to.be.revertedWithCustomError(
      tap,
      "DailyCapReached",
    );

    const block = await ethers.provider.getBlock("latest");
    if (block === null) throw new Error("missing latest block");
    const nextUtcDay = (Math.floor(block.timestamp / 86400) + 1) * 86400;
    await time.increaseTo(nextUtcDay);
    expect(await tap.spentToday()).to.equal(0n);
    await tap.connect(operator).drip(other.address);
    expect(await ethers.provider.getBalance(other.address)).to.equal(DRIP);
    expect(await tap.spentToday()).to.equal(DRIP);
  });

  it("reverts when the recipient rejects ETH", async () => {
    const { tap, operator, recipient } = await loadFixture(deployFixture);
    await ethers.provider.send("hardhat_setCode", [recipient.address, "0x60006000fd"]);
    await expect(tap.connect(operator).drip(recipient.address)).to.be.revertedWithCustomError(
      tap,
      "SendFailed",
    );
  });

  it("caps constructor and configured amounts", async () => {
    const { tap, owner, operator } = await loadFixture(deployFixture);
    const factory = await ethers.getContractFactory("GasTap");
    await expect(
      factory.deploy(
        owner.address,
        operator.address,
        ethers.parseEther("0.020000000000000001"),
        CAP,
      ),
    ).to.be.revertedWithCustomError(factory, "DripTooLarge");
    await expect(
      factory.deploy(
        owner.address,
        operator.address,
        DRIP,
        ethers.parseEther("1.000000000000000001"),
      ),
    ).to.be.revertedWithCustomError(factory, "CapTooLarge");
    await expect(
      tap.connect(owner).setDrip(ethers.parseEther("0.020000000000000001")),
    ).to.be.revertedWithCustomError(tap, "DripTooLarge");
    await expect(
      tap.connect(owner).setDailyCap(ethers.parseEther("1.000000000000000001")),
    ).to.be.revertedWithCustomError(tap, "CapTooLarge");
    await tap.connect(owner).setDrip(ethers.parseEther("0.002"));
    await tap.connect(owner).setDailyCap(ethers.parseEther("0.5"));
    expect(await tap.dripWei()).to.equal(ethers.parseEther("0.002"));
    expect(await tap.dailyCapWei()).to.equal(ethers.parseEther("0.5"));
  });

  it("allows only the owner to configure, pause and withdraw", async () => {
    const { tap, owner, operator, other } = await loadFixture(deployFixture);
    for (const call of [
      tap.connect(operator).setOperator(other.address),
      tap.connect(operator).setDrip(DRIP),
      tap.connect(operator).setDailyCap(CAP),
      tap.connect(operator).pause(),
      tap.connect(operator).unpause(),
      tap.connect(operator).withdraw(other.address, 1n),
    ]) {
      await expect(call).to.be.revertedWithCustomError(tap, "OwnableUnauthorizedAccount");
    }
    await tap.connect(owner).setOperator(other.address);
    expect(await tap.operator()).to.equal(other.address);
    await tap.connect(owner).pause();
    await tap.connect(owner).unpause();
  });

  it("withdraws only through the owner and reports failed sends", async () => {
    const { tap, owner, recipient } = await loadFixture(deployFixture);
    const before = await ethers.provider.getBalance(recipient.address);
    await expect(tap.connect(owner).withdraw(recipient.address, DRIP))
      .to.emit(tap, "Withdrawn")
      .withArgs(recipient.address, DRIP);
    expect(await ethers.provider.getBalance(recipient.address)).to.equal(before + DRIP);

    await ethers.provider.send("hardhat_setCode", [recipient.address, "0x60006000fd"]);
    await expect(tap.connect(owner).withdraw(recipient.address, 1n)).to.be.revertedWithCustomError(
      tap,
      "SendFailed",
    );
  });

  it("accepts direct funding", async () => {
    const { tap, owner } = await loadFixture(deployFixture);
    const before = await ethers.provider.getBalance(tap.target);
    await owner.sendTransaction({ to: tap.target, value: DRIP });
    expect(await ethers.provider.getBalance(tap.target)).to.equal(before + DRIP);
  });
});
