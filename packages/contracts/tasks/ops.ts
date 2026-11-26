import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

const SEPOLIA_CHAIN_ID = 11155111;

async function requireSepolia(hre: HardhatRuntimeEnvironment): Promise<void> {
  if (Number(hre.network.config.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("ops tasks may only run on Sepolia");
  }
}

task("ops:set-operator", "Sets the GasTap drip operator")
  .addParam("address", "New operator address")
  .setAction(async (taskArguments, hre) => {
    await requireSepolia(hre);
    if (!hre.ethers.isAddress(taskArguments.address)) throw new Error("invalid operator address");
    const [owner] = await hre.ethers.getSigners();
    if (owner === undefined) throw new Error("missing owner signer");
    const deployment = await hre.deployments.get("GasTap");
    const tap = await hre.ethers.getContractAt("GasTap", deployment.address, owner);
    const transaction = await tap.setOperator(taskArguments.address);
    const receipt = await transaction.wait();
    if (receipt === null) throw new Error("setOperator was not mined");
    console.log(
      JSON.stringify({
        operator: taskArguments.address,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      }),
    );
  });

task("ops:set-cap", "Sets the GasTap daily cap in ETH for a forced failure state")
  .addParam("eth", "New cap in ETH")
  .setAction(async (taskArguments, hre) => {
    await requireSepolia(hre);
    const [owner] = await hre.ethers.getSigners();
    if (owner === undefined) throw new Error("missing owner signer");
    const deployment = await hre.deployments.get("GasTap");
    const tap = await hre.ethers.getContractAt("GasTap", deployment.address, owner);
    const transaction = await tap.setDailyCap(hre.ethers.parseEther(String(taskArguments.eth)));
    const receipt = await transaction.wait();
    if (receipt === null) throw new Error("setDailyCap was not mined");
    console.log(
      JSON.stringify({
        capEth: taskArguments.eth,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      }),
    );
  });

task("ops:tap-status", "Prints GasTap balances and drip configuration").setAction(
  async (_taskArguments, hre) => {
    await requireSepolia(hre);
    const deployment = await hre.deployments.get("GasTap");
    const tap = await hre.ethers.getContractAt("GasTap", deployment.address);
    const [operator, dripWei, dailyCapWei, spentToday, currentDay, paused, balance] =
      await Promise.all([
        tap.operator(),
        tap.dripWei(),
        tap.dailyCapWei(),
        tap.spentToday(),
        tap.currentDay(),
        tap.paused(),
        hre.ethers.provider.getBalance(deployment.address),
      ]);
    console.log(
      JSON.stringify({
        contract: deployment.address,
        operator,
        balance: hre.ethers.formatEther(balance),
        dripWei: hre.ethers.formatEther(dripWei),
        dailyCapWei: hre.ethers.formatEther(dailyCapWei),
        spentToday: hre.ethers.formatEther(spentToday),
        currentDay: currentDay.toString(),
        paused,
      }),
    );
  },
);
