import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { Contract, ContractTransactionResponse, TransactionReceipt } from "ethers";
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { FeeProbe } from "../types";

const SEPOLIA_CHAIN_ID = 11155111;
const MINIMUM_BALANCE = 0.05;
const WRAPPER_ADDRESS = "0x4E7B06D78965594eB5EF5414c357ca21E1554491";
const UNDERLYING_ADDRESS = "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0";
const FEE_TOKENS = 5n;
const SETUP_TOKENS = 100n;
const OPERATOR_SECONDS = 30 * 24 * 60 * 60;

const wrapperAbi = [
  "function decimals() view returns (uint8)",
  "function underlying() view returns (address)",
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
] as const;

const underlyingAbi = [
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 value) returns (bool)",
] as const;

type WrapperContract = Contract & {
  decimals(): Promise<bigint>;
  underlying(): Promise<string>;
  wrap(to: string, amount: bigint): Promise<ContractTransactionResponse>;
  setOperator(operator: string, until: number): Promise<ContractTransactionResponse>;
  isOperator(holder: string, spender: string): Promise<boolean>;
  confidentialBalanceOf(account: string): Promise<string>;
};

type UnderlyingContract = Contract & {
  decimals(): Promise<bigint>;
  mint(to: string, amount: bigint): Promise<ContractTransactionResponse>;
  approve(spender: string, amount: bigint): Promise<ContractTransactionResponse>;
};

async function requireSepolia(hre: HardhatRuntimeEnvironment): Promise<HardhatEthersSigner> {
  if (Number(hre.network.config.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("token spike tasks may only run on Sepolia");
  }
  const [signer] = await hre.ethers.getSigners();
  if (signer === undefined) throw new Error("missing deployer signer");
  await requireBalances(hre, signer);
  return signer;
}

async function requireBalances(
  hre: HardhatRuntimeEnvironment,
  signer: HardhatEthersSigner,
): Promise<void> {
  const minimum = hre.ethers.parseEther(String(MINIMUM_BALANCE));
  const deployerBalance = await hre.ethers.provider.getBalance(signer.address);
  const tap = await hre.deployments.get("GasTap");
  const tapBalance = await hre.ethers.provider.getBalance(tap.address);
  if (deployerBalance < minimum) {
    throw new Error(
      `deployer balance ${hre.ethers.formatEther(deployerBalance)} ETH is below 0.05 ETH`,
    );
  }
  if (tapBalance < minimum) {
    throw new Error(`GasTap balance ${hre.ethers.formatEther(tapBalance)} ETH is below 0.05 ETH`);
  }
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

function wrapper(hre: HardhatRuntimeEnvironment, signer: HardhatEthersSigner): WrapperContract {
  return new hre.ethers.Contract(WRAPPER_ADDRESS, wrapperAbi, signer) as WrapperContract;
}

function underlying(
  hre: HardhatRuntimeEnvironment,
  signer: HardhatEthersSigner,
): UnderlyingContract {
  return new hre.ethers.Contract(UNDERLYING_ADDRESS, underlyingAbi, signer) as UnderlyingContract;
}

async function getProbe(hre: HardhatRuntimeEnvironment): Promise<FeeProbe> {
  const deployment = await hre.deployments.getOrNull("FeeProbeSpike");
  if (deployment === null) {
    throw new Error("FeeProbeSpike is not deployed; run token:setup first");
  }
  return hre.ethers.getContractAt("FeeProbe", deployment.address);
}

task(
  "token:setup",
  "Mints, wraps and approves the official Sepolia cUSDTMock for FeeProbe",
).setAction(async (_taskArguments, hre) => {
  const signer = await requireSepolia(hre);
  const token = wrapper(hre, signer);
  const tokenUnderlying = await token.underlying();
  if (tokenUnderlying.toLowerCase() !== UNDERLYING_ADDRESS.toLowerCase()) {
    throw new Error(`unexpected underlying token ${tokenUnderlying}`);
  }
  const decimals = await token.decimals();
  const underlyingDecimals = await underlying(hre, signer).decimals();
  const unit = 10n ** decimals;
  const fee = FEE_TOKENS * unit;
  const amount = SETUP_TOKENS * unit;

  let probe = await hre.deployments.getOrNull("FeeProbeSpike");
  if (probe === undefined || probe === null) {
    const factory = await hre.ethers.getContractFactory("FeeProbe", signer);
    const deployed = await sendWithRetry("deployFeeProbe", () =>
      factory.deploy(WRAPPER_ADDRESS, fee),
    );
    const deploymentTransaction = deployed.deploymentTransaction();
    if (deploymentTransaction === null) throw new Error("missing FeeProbe deployment transaction");
    await recordTransaction("deployFeeProbe", deploymentTransaction);
    const address = await deployed.getAddress();
    const artifact = await hre.artifacts.readArtifact("FeeProbe");
    await hre.deployments.save("FeeProbeSpike", {
      address,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      deployedBytecode: artifact.deployedBytecode,
    });
    probe = await hre.deployments.get("FeeProbeSpike");
  }
  const probeContract = await hre.ethers.getContractAt("FeeProbe", probe.address, signer);
  if ((await probeContract.FEE()) !== fee) {
    throw new Error("deployed FeeProbe fee does not match the wrapper decimals");
  }

  const asset = underlying(hre, signer);
  await recordTransaction(
    "mintUnderlying",
    await sendWithRetry("mintUnderlying", () => asset.mint(signer.address, amount)),
  );
  await recordTransaction(
    "approveWrapper",
    await sendWithRetry("approveWrapper", () => asset.approve(WRAPPER_ADDRESS, amount)),
  );
  await recordTransaction(
    "wrap",
    await sendWithRetry("wrap", () => token.wrap(signer.address, amount)),
  );
  const block = await hre.ethers.provider.getBlock("latest");
  if (block === null) throw new Error("missing latest block");
  const until = block.timestamp + OPERATOR_SECONDS;
  await recordTransaction(
    "setOperator",
    await sendWithRetry("setOperator", () => token.setOperator(probe.address, until)),
  );
  if (!(await token.isOperator(signer.address, probe.address))) {
    throw new Error("FeeProbe operator approval was not stored");
  }
  await requireBalances(hre, signer);
  console.log(
    JSON.stringify({
      wrapper: WRAPPER_ADDRESS,
      underlying: UNDERLYING_ADDRESS,
      implementation: "0xAe37b998d453E1FaBE85DD46cf04295ca4A3af04",
      wrapperDecimals: decimals.toString(),
      underlyingDecimals: underlyingDecimals.toString(),
      fee: fee.toString(),
      wrapped: amount.toString(),
      operator: probe.address,
      operatorUntil: until,
    }),
  );
});

task(
  "token:probe",
  "Probes funded and underfunded confidential fee transfers on Sepolia",
).setAction(async (_taskArguments, hre) => {
  const signer = await requireSepolia(hre);
  await hre.fhevm.initializeCLIApi();
  const token = wrapper(hre, signer);
  const probe = await getProbe(hre);
  const probeAddress = await probe.getAddress();
  const fee = await probe.FEE();
  const expectedFee = FEE_TOKENS * 10n ** (await token.decimals());
  if (fee !== expectedFee) throw new Error("FeeProbe fee does not match five wrapper tokens");
  if (!(await token.isOperator(signer.address, probeAddress))) {
    throw new Error(`FeeProbe is not an operator for ${signer.address}; run token:setup first`);
  }

  const decryptBalance = async (holder: string) => {
    const handle = await token.confidentialBalanceOf(holder);
    return retry(`balance-${holder}`, () =>
      hre.fhevm.userDecryptEuint(FhevmType.euint64, handle, WRAPPER_ADDRESS, signer),
    );
  };
  const decryptProbe = async (kind: "sent" | "paid"): Promise<bigint> => {
    const handle = kind === "sent" ? await probe.sent() : await probe.paid();
    if (kind === "sent") {
      return retry("probe-sent", () =>
        hre.fhevm.userDecryptEuint(FhevmType.euint64, handle, probeAddress, signer),
      );
    }
    const paid = await retry("probe-paid", () =>
      hre.fhevm.userDecryptEbool(handle, probeAddress, signer),
    );
    return paid ? 1n : 0n;
  };

  const senderBefore = await decryptBalance(signer.address);
  const probeBefore = 0n;

  await recordTransaction("fundedProbe", await sendWithRetry("fundedProbe", () => probe.probe()));
  await recordTransaction(
    "allowFundedBalance",
    await sendWithRetry("allowFundedBalance", () => probe.allowBalance(signer.address)),
  );
  const fundedSent = await decryptProbe("sent");
  const fundedPaid = await decryptProbe("paid");
  const senderAfterFunded = await decryptBalance(signer.address);
  const probeAfterFunded = await decryptBalance(probeAddress);

  await recordTransaction(
    "underfundedProbe",
    await sendWithRetry("underfundedProbe", () => probe.probeUnderfunded()),
  );
  await recordTransaction(
    "allowUnderfundedBalance",
    await sendWithRetry("allowUnderfundedBalance", () => probe.allowBalance(signer.address)),
  );
  const underfundedSent = await decryptProbe("sent");
  const underfundedPaid = await decryptProbe("paid");
  const senderAfterUnderfunded = await decryptBalance(signer.address);
  const probeAfterUnderfunded = await decryptBalance(probeAddress);

  const pass =
    fundedSent === fee &&
    fundedPaid === 1n &&
    senderAfterFunded === senderBefore &&
    probeAfterFunded === probeBefore &&
    underfundedSent === 0n &&
    underfundedPaid === 0n &&
    senderAfterUnderfunded === senderAfterFunded &&
    probeAfterUnderfunded === probeAfterFunded;
  console.log(
    JSON.stringify({
      pass,
      fee: fee.toString(),
      funded: {
        sent: fundedSent.toString(),
        paid: fundedPaid === 1n,
        senderBefore: senderBefore.toString(),
        senderAfter: senderAfterFunded.toString(),
        probeBefore: probeBefore.toString(),
        probeAfter: probeAfterFunded.toString(),
      },
      underfunded: {
        sent: underfundedSent.toString(),
        paid: underfundedPaid === 1n,
        senderAfter: senderAfterUnderfunded.toString(),
        probeAfter: probeAfterUnderfunded.toString(),
      },
    }),
  );
  if (!pass) throw new Error("ERC-7984 fee probe assertions failed");
  await requireBalances(hre, signer);
});
