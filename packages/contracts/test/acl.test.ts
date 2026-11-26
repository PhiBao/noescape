import { FhevmType } from "@fhevm/mock-utils";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { NoEscapeCase } from "../types";

type Handle = { name: string; value: string; type: FhevmType };

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

async function expectRejection(promise: Promise<unknown>): Promise<void> {
  let rejection: unknown;
  try {
    await promise;
  } catch (error) {
    rejection = error;
  }
  expect(rejection, "expected user decryption to be refused").not.to.equal(undefined);
}

async function expectNotPublic(handle: string): Promise<void> {
  let publicClear: unknown;
  try {
    const result = await fhevm.publicDecrypt([handle as `0x${string}`]);
    publicClear = result.clearValues[handle as `0x${string}`];
  } catch {
    return;
  }
  expect(publicClear, `handle ${handle.slice(0, 10)} must not be publicly decryptable`).to.equal(
    undefined,
  );
}

function fugitiveHandles(opened: Awaited<ReturnType<NoEscapeCase["getCase"]>>): Handle[] {
  return [
    { name: "startPos", value: opened.startPos, type: FhevmType.euint128 },
    { name: "pos", value: opened.pos, type: FhevmType.euint128 },
    { name: "p1", value: opened.p1, type: FhevmType.euint128 },
    { name: "p2", value: opened.p2, type: FhevmType.euint128 },
    { name: "trail", value: opened.trail, type: FhevmType.euint128 },
    { name: "exitIdx", value: opened.exitIdx, type: FhevmType.euint8 },
  ];
}

describe("case.acl", () => {
  it("refuses user decryption of every fugitive handle to all three signers", async () => {
    const [deployer, detective, other] = await ethers.getSigners();
    if (deployer === undefined || detective === undefined || other === undefined) {
      throw new Error("missing signers");
    }
    const contract = await deployCase();
    const address = await contract.getAddress();
    await contract.connect(detective).openCase();
    const opened = await contract.getCase(1n);

    const handles = fugitiveHandles(opened);
    expect(handles.length).to.equal(6);
    for (const handle of handles) {
      expect(handle.value).to.match(/^0x[0-9a-fA-F]{64}$/);
      for (const signer of [detective, other, deployer]) {
        await expectRejection(fhevm.userDecryptEuint(handle.type, handle.value, address, signer));
      }
    }
    expect(await contract.posHandle(1n)).to.equal(opened.pos);
  });

  it("publishes only the report before the case ends", async () => {
    const [, detective] = await ethers.getSigners();
    if (detective === undefined) throw new Error("missing detective");
    const contract = await deployCase();
    await contract.connect(detective).openCase();
    const opened = await contract.getCase(1n);

    for (const handle of fugitiveHandles(opened)) {
      await expectNotPublic(handle.value);
    }

    await contract.connect(detective).playTurn(1n, [29, 30, 41], 0b111, "0x", "0x");
    const turn = await contract.getTurn(1n, 1);
    const result = await fhevm.publicDecrypt([turn.report as `0x${string}`]);
    expect(result.clearValues[turn.report as `0x${string}`]).to.be.a("bigint");

    for (const handle of fugitiveHandles(await contract.getCase(1n))) {
      await expectNotPublic(handle.value);
    }
    await expectNotPublic(turn.posAfter);
    for (const noise of turn.noise) await expectNotPublic(noise);
    for (const code of turn.codes) await expectNotPublic(code);
  });
});
