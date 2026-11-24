import { FhevmType } from "@fhevm/hardhat-plugin";
import type { ContractTransactionResponse, TransactionReceipt } from "ethers";
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { BrainHarness } from "../types";

const SEPOLIA_CHAIN_ID = 11155111;
const MINIMUM_BALANCE = 0.05;
const GAS_CAP = 16_777_216;

async function requireSepolia(hre: HardhatRuntimeEnvironment): Promise<void> {
  if (Number(hre.network.config.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("spike tasks may only run on Sepolia");
  }
  const [signer] = await hre.ethers.getSigners();
  if (signer === undefined) throw new Error("missing deployer signer");
  const balance = await hre.ethers.provider.getBalance(signer.address);
  if (balance < hre.ethers.parseEther(String(MINIMUM_BALANCE))) {
    throw new Error(`deployer balance ${hre.ethers.formatEther(balance)} ETH is below 0.05 ETH`);
  }
}

async function getHarness(hre: HardhatRuntimeEnvironment): Promise<BrainHarness> {
  const deployment = await hre.deployments.getOrNull("BrainHarnessSpike");
  if (deployment === null) {
    throw new Error("BrainHarnessSpike is not deployed; run spike:deploy first");
  }
  return hre.ethers.getContractAt("BrainHarness", deployment.address);
}

async function recordTransaction(
  hre: HardhatRuntimeEnvironment,
  label: string,
  transaction: ContractTransactionResponse,
): Promise<TransactionReceipt> {
  const startedAt = Date.now();
  const receipt = await transaction.wait();
  if (receipt === null) throw new Error(`${label} was not mined`);
  const hcu = "not exposed";
  const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
  console.log(
    JSON.stringify({
      label,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockTimestamp: block?.timestamp ?? null,
      wallSeconds: (Date.now() - startedAt) / 1000,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
      hcu,
    }),
  );
  return receipt;
}

task("spike:deploy", "Deploys the BrainHarness spike contract on Sepolia").setAction(
  async (_taskArguments, hre) => {
    await requireSepolia(hre);
    const [signer] = await hre.ethers.getSigners();
    if (signer === undefined) throw new Error("missing deployer signer");
    const balanceBefore = await hre.ethers.provider.getBalance(signer.address);
    const factory = await hre.ethers.getContractFactory("BrainHarness", signer);
    const contract = await factory.deploy();
    const deploymentTransaction = contract.deploymentTransaction();
    if (deploymentTransaction === null) throw new Error("missing deployment transaction");
    const receipt = await recordTransaction(hre, "deploy", deploymentTransaction);
    const address = await contract.getAddress();
    const artifact = await hre.artifacts.readArtifact("BrainHarness");
    await hre.deployments.save("BrainHarnessSpike", {
      address,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      deployedBytecode: artifact.deployedBytecode,
    });
    const balanceAfter = await hre.ethers.provider.getBalance(signer.address);
    console.log(
      JSON.stringify({
        harness: address,
        deployer: signer.address,
        balanceBefore: hre.ethers.formatEther(balanceBefore),
        balanceAfter: hre.ethers.formatEther(balanceAfter),
        receiptStatus: receipt.status,
      }),
    );
  },
);

task("spike:turn", "Runs encrypted full turns on Sepolia")
  .addOptionalParam("runs", "Number of fullTurn calls", "3")
  .setAction(async (taskArguments, hre) => {
    await requireSepolia(hre);
    await hre.fhevm.initializeCLIApi();
    const runs = Number(taskArguments.runs);
    if (!Number.isInteger(runs) || runs < 1 || runs > 3) {
      throw new Error("--runs must be an integer from 1 to 3");
    }
    const [signer] = await hre.ethers.getSigners();
    if (signer === undefined) throw new Error("missing deployer signer");
    const harness = await getHarness(hre);
    const connected = harness.connect(signer);
    await recordTransaction(hre, "init", await connected.init());

    const turns: { det: [number, number, number]; flags: number }[] = [
      { det: [29, 30, 41], flags: 0b111 },
      { det: [31, 32, 41], flags: 0b011 },
      { det: [28, 30, 41], flags: 0b101 },
    ];
    for (let index = 0; index < runs; index += 1) {
      const turn = turns[index];
      if (turn === undefined) throw new Error("missing turn definition");
      await recordTransaction(
        hre,
        `fullTurn-${index + 1}`,
        await connected.fullTurn(turn.det, turn.flags),
      );
    }
    try {
      await recordTransaction(
        hre,
        "fullTurnPlusStep",
        await connected.fullTurnPlusStep([27, 30, 41], 0b110),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          label: "fullTurnPlusStep",
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    let capRejected = false;
    let capError = "none";
    try {
      const transaction = await signer.sendTransaction({
        to: signer.address,
        value: 0n,
        gasLimit: GAS_CAP + 1,
      });
      await transaction.wait();
    } catch (error) {
      capRejected = true;
      capError = error instanceof Error ? error.message : String(error);
    }
    console.log(
      JSON.stringify({
        label: "gas-cap-probe",
        testedGasLimit: GAS_CAP + 1,
        expectedCap: GAS_CAP,
        capRejected,
        capError,
      }),
    );
  });

task("spike:decrypt", "Publicly decrypts the latest spike report three times").setAction(
  async (_taskArguments, hre) => {
    await requireSepolia(hre);
    await hre.fhevm.initializeCLIApi();
    const harness = await getHarness(hre);
    const handle = await harness.getReport();
    if (handle === hre.ethers.ZeroHash) throw new Error("spike report has not been created");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const startedAt = Date.now();
      let clear: bigint | undefined;
      let errorMessage = "none";
      const delays = [500, 1000, 2000, 3000, 3000, 3000, 3000, 3000, 3000];
      for (const delay of delays) {
        try {
          clear = await hre.fhevm.publicDecryptEuint(FhevmType.euint8, handle);
          break;
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      if (clear === undefined) throw new Error(`public decryption failed: ${errorMessage}`);
      console.log(
        JSON.stringify({
          label: `public-decrypt-${attempt + 1}`,
          handle,
          clear: clear.toString(),
          status: Number(clear & 3n),
          camera: Number(clear >> 2n),
          latencySeconds: (Date.now() - startedAt) / 1000,
        }),
      );
    }
  },
);

task("spike:allow", "Allows the latest spike search code to an address")
  .addParam("to", "Address to allow")
  .setAction(async (taskArguments, hre) => {
    await requireSepolia(hre);
    if (!hre.ethers.isAddress(taskArguments.to)) throw new Error("--to must be an address");
    const [signer] = await hre.ethers.getSigners();
    if (signer === undefined) throw new Error("missing deployer signer");
    const harness = await getHarness(hre);
    const connected = harness.connect(signer);
    await recordTransaction(hre, "allow-code", await connected.allowCode(taskArguments.to));
  });
