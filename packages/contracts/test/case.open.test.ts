import { FhevmType } from "@fhevm/mock-utils";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

async function caseFactory() {
  const rulesFactory = await ethers.getContractFactory("CaseRules");
  const rules = await rulesFactory.deploy();
  await rules.waitForDeployment();
  return ethers.getContractFactory("NoEscapeCase", {
    libraries: { CaseRules: rules.target },
  });
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

describe("case.open", () => {
  it("opens a case, assigns its id and updates stats", async () => {
    const [deployer, detective] = await ethers.getSigners();
    if (deployer === undefined || detective === undefined) throw new Error("missing signers");
    const factory = await caseFactory();
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    await expect(contract.connect(detective).openCase())
      .to.emit(contract, "CaseOpened")
      .withArgs(1n, detective.address);

    const opened = await contract.getCase(1n);
    expect(opened.detective).to.equal(detective.address);
    expect(opened.status).to.equal(1n);
    expect(opened.turn).to.equal(0n);
    expect(opened.openedAt).to.be.greaterThan(0n);
    expect(opened.closedAt).to.equal(0n);
    expect(await contract.activeCaseOf(detective.address)).to.equal(1n);
    expect(await contract.activeCaseOf(deployer.address)).to.equal(0n);
    expect((await contract.statsOf(detective.address)).opened).to.equal(1n);
    expect((await contract.recentClosed()).every((id) => id === 0n)).to.equal(true);

    await contract.connect(deployer).openCase();
    expect(await contract.activeCaseOf(deployer.address)).to.equal(2n);
  });

  it("rejects a second active case for the same detective", async () => {
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const factory = await caseFactory();
    const contract = await factory.deploy();
    await contract.connect(detective).openCase();

    await expect(contract.connect(detective).openCase())
      .to.be.revertedWithCustomError(contract, "CaseActive")
      .withArgs(1n);
  });

  it("draws a legal encrypted start and exit", async () => {
    const { STARTS, cellOf } = await import("@noescape/engine");
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const factory = await caseFactory();
    const contract = await factory.deploy();
    await contract.connect(detective).openCase();
    const opened = await contract.getCase(1n);
    const address = await contract.getAddress();

    const start = await fhevm.debugger.decryptEuint(FhevmType.euint128, opened.startPos);
    const exitIdx = await fhevm.debugger.decryptEuint(FhevmType.euint8, opened.exitIdx);
    expect(STARTS).to.include(cellOf(start));
    expect(exitIdx).to.be.lessThanOrEqual(3n);
    expect(opened.pos).to.equal(opened.startPos);
    expect(opened.p1).to.equal(opened.startPos);
    expect(opened.p2).to.equal(opened.startPos);
    expect(opened.trail).to.equal(opened.startPos);
    expect(await contract.posHandle(1n)).to.equal(opened.pos);
    expect(address).to.not.equal(ethers.ZeroAddress);
  });

  it("denies position decryption to both the detective and the deployer", async () => {
    const [deployer, detective, other] = await ethers.getSigners();
    if (deployer === undefined || detective === undefined || other === undefined) {
      throw new Error("missing signers");
    }
    const factory = await caseFactory();
    const contract = await factory.deploy();
    await contract.connect(detective).openCase();
    const address = await contract.getAddress();
    const handle = await contract.posHandle(1n);

    await expectUserDecryptRejection(
      fhevm.userDecryptEuint(FhevmType.euint128, handle, address, detective),
    );
    await expectUserDecryptRejection(
      fhevm.userDecryptEuint(FhevmType.euint128, handle, address, deployer),
    );
    await expectUserDecryptRejection(
      fhevm.userDecryptEuint(FhevmType.euint128, handle, address, other),
    );
  });
});
