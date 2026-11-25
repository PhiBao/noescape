import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { Contract, ContractTransactionResponse, TransactionReceipt } from "ethers";
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { MostWanted } from "../types";

const SEPOLIA_CHAIN_ID = 11155111;
const MINIMUM_BALANCE = 0.05;
const WRAPPER_ADDRESS = "0x4E7B06D78965594eB5EF5414c357ca21E1554491";
const UNDERLYING_ADDRESS = "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0";
const SETUP_TOKENS = 100n;
const OPERATOR_SECONDS = 30 * 24 * 60 * 60;

const wrapperAbi = [
  "function decimals() view returns (uint8)",
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
] as const;

const underlyingAbi = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 value) returns (bool)",
] as const;

type WrapperContract = Contract & {
  decimals(): Promise<bigint>;
  wrap(to: string, amount: bigint): Promise<ContractTransactionResponse>;
  setOperator(operator: string, until: number): Promise<ContractTransactionResponse>;
  isOperator(holder: string, spender: string): Promise<boolean>;
  confidentialBalanceOf(account: string): Promise<string>;
};

type UnderlyingContract = Contract & {
  mint(to: string, amount: bigint): Promise<ContractTransactionResponse>;
  approve(spender: string, amount: bigint): Promise<ContractTransactionResponse>;
};

async function requireSepolia(hre: HardhatRuntimeEnvironment): Promise<HardhatEthersSigner> {
  if (Number(hre.network.config.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("Most Wanted tasks may only run on Sepolia");
  }
  const [signer] = await hre.ethers.getSigners();
  if (signer === undefined) throw new Error("missing deployer signer");
  const minimum = hre.ethers.parseEther(String(MINIMUM_BALANCE));
  const balance = await hre.ethers.provider.getBalance(signer.address);
  const tap = await hre.deployments.get("GasTap");
  const tapBalance = await hre.ethers.provider.getBalance(tap.address);
  if (balance < minimum) {
    throw new Error(`deployer balance ${hre.ethers.formatEther(balance)} ETH is below 0.05 ETH`);
  }
  if (tapBalance < minimum) {
    throw new Error(`GasTap balance ${hre.ethers.formatEther(tapBalance)} ETH is below 0.05 ETH`);
  }
  return signer;
}

async function recordTransaction(
  label: string,
  transaction: ContractTransactionResponse,
): Promise<TransactionReceipt> {
  const startedAt = Date.now();
  const receipt = await transaction.wait();
  if (receipt === null) throw new Error(`${label} was not mined`);
  console.log(
    JSON.stringify({
      label,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      wallSeconds: (Date.now() - startedAt) / 1000,
      status: receipt.status,
    }),
  );
  return receipt;
}

async function retry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const delays = [500, 1000, 2000, 3000, 3000, 3000, 3000, 3000, 3000];
  let lastError: unknown;
  for (const delay of delays) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw new Error(
    `${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function sendWithRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const retryable =
      message.includes("nonce too low") ||
      message.includes("nonce too high") ||
      message.includes("underpriced");
    if (!retryable) throw error;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
    try {
      return await operation();
    } catch (retryError) {
      throw new Error(
        `${label} failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
      );
    }
  }
}

async function currentDay(hre: HardhatRuntimeEnvironment): Promise<number> {
  const block = await hre.ethers.provider.getBlock("latest");
  if (block === null) throw new Error("missing latest block");
  return Math.floor(block.timestamp / 86400);
}

async function getMostWanted(
  hre: HardhatRuntimeEnvironment,
  signer: HardhatEthersSigner,
): Promise<MostWanted> {
  const deployment = await hre.deployments.get("MostWanted");
  return hre.ethers.getContractAt("MostWanted", deployment.address, signer);
}

async function ensureJoined(
  hre: HardhatRuntimeEnvironment,
  signer: HardhatEthersSigner,
  wanted: MostWanted,
): Promise<number> {
  const day = await currentDay(hre);
  if ((await wanted.getHunter(day, signer.address)).joined) return day;
  const token = new hre.ethers.Contract(WRAPPER_ADDRESS, wrapperAbi, signer) as WrapperContract;
  const wantedAddress = await wanted.getAddress();
  if (!(await token.isOperator(signer.address, wantedAddress))) {
    const block = await hre.ethers.provider.getBlock("latest");
    if (block === null) throw new Error("missing latest block");
    await recordTransaction(
      "setOperator",
      await sendWithRetry("setOperator", () =>
        token.setOperator(wantedAddress, block.timestamp + OPERATOR_SECONDS),
      ),
    );
  }

  const fee = await wanted.FEE();
  const handle = await token.confidentialBalanceOf(signer.address);
  let balance = 0n;
  try {
    balance = await retry("tokenBalance", () =>
      hre.fhevm.userDecryptEuint(FhevmType.euint64, handle, WRAPPER_ADDRESS, signer),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("not initialized")) throw error;
  }
  if (balance < fee) {
    const amount = SETUP_TOKENS * 10n ** (await token.decimals());
    const underlying = new hre.ethers.Contract(
      UNDERLYING_ADDRESS,
      underlyingAbi,
      signer,
    ) as UnderlyingContract;
    await recordTransaction(
      "mintUnderlying",
      await sendWithRetry("mintUnderlying", () => underlying.mint(signer.address, amount)),
    );
    await recordTransaction(
      "approveWrapper",
      await sendWithRetry("approveWrapper", () => underlying.approve(WRAPPER_ADDRESS, amount)),
    );
    await recordTransaction(
      "wrap",
      await sendWithRetry("wrap", () => token.wrap(signer.address, amount)),
    );
  }
  await recordTransaction("join", await sendWithRetry("join", () => wanted.join()));
  return day;
}

task("mw:hunt", "Joins the current Sepolia day and hunts once").setAction(async (_args, hre) => {
  const signer = await requireSepolia(hre);
  await hre.fhevm.initializeCLIApi();
  const wanted = await getMostWanted(hre, signer);
  const day = await ensureJoined(hre, signer, wanted);
  const hunter = await wanted.getHunter(day, signer.address);
  const receipt = await recordTransaction(
    "hunt",
    await sendWithRetry("hunt", () => wanted.hunt(hunter.cell, true)),
  );
  const actions = await wanted.actionsOf(day, 0, 100);
  const action = actions[actions.length - 1];
  if (action === undefined) throw new Error("hunt action was not stored");
  const reportHandle = await wanted.stepReportOf(day, action.step);
  const wantedAddress = await wanted.getAddress();
  const report = await retry("cameraReport", () =>
    hre.fhevm.publicDecryptEuint(FhevmType.euint8, reportHandle),
  );
  const code = await retry("searchCode", () =>
    hre.fhevm.userDecryptEuint(FhevmType.euint8, action.code, wantedAddress, signer),
  );
  console.log(
    JSON.stringify({
      day,
      actionIdx: actions.length - 1,
      hunter: signer.address,
      step: action.step.toString(),
      fromCell: action.fromCell.toString(),
      toCell: action.toCell.toString(),
      searched: action.searched,
      report: report.toString(),
      camera: Number(report >> 2n),
      code: code.toString(),
      txHash: receipt.hash,
    }),
  );
});

task("mw:status", "Prints the current Sepolia Most Wanted day").setAction(async (_args, hre) => {
  if (Number(hre.network.config.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("mw:status may only run on Sepolia");
  }
  const [signer] = await hre.ethers.getSigners();
  if (signer === undefined) throw new Error("missing deployer signer");
  const wanted = await getMostWanted(hre, signer);
  const day = await currentDay(hre);
  const opened = await wanted.getDay(day);
  const hunter = await wanted.getHunter(day, signer.address);
  const actions = await wanted.actionsOf(day, 0, 20);
  console.log(
    JSON.stringify({
      contract: await wanted.getAddress(),
      day,
      status: opened.status.toString(),
      steps: opened.steps.toString(),
      lastStepWatch: opened.lastStepWatch.toString(),
      hunters: opened.hunters.toString(),
      verified: opened.verified,
      verifyOk: opened.verifyOk,
      failCode: opened.failCode.toString(),
      deployer: {
        joined: hunter.joined,
        cell: hunter.cell.toString(),
        lastWatch: hunter.lastWatch.toString(),
        actions: hunter.actions.toString(),
      },
      actions: actions.map((action) => ({
        hunter: action.hunter,
        step: action.step.toString(),
        fromCell: action.fromCell.toString(),
        toCell: action.toCell.toString(),
        searched: action.searched,
        resolved: action.resolved,
      })),
    }),
  );
});
