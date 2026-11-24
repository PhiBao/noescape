import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { ContractTransactionResponse, TransactionReceipt } from "ethers";
import { task } from "hardhat/config";

type TxRecord = {
  label: string;
  hash: string;
  block: number;
  gas: bigint;
  seconds: number;
};

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

task("case:play", "Plays and verifies a full solo case on Sepolia")
  .addOptionalParam("bot", "Bot used for orders", "naive")
  .setAction(async (taskArguments, hre) => {
    if (Number(hre.network.config.chainId) !== 11155111) {
      throw new Error("case:play may only run on Sepolia");
    }
    if (taskArguments.bot !== "naive") throw new Error("only --bot naive is supported");
    const [signer] = await hre.ethers.getSigners();
    if (signer === undefined) throw new Error("missing deployer signer");
    const balance = await hre.ethers.provider.getBalance(signer.address);
    if (balance < hre.ethers.parseEther("0.05")) {
      throw new Error(`deployer balance ${hre.ethers.formatEther(balance)} ETH is below 0.05 ETH`);
    }

    const { register } = await import("tsx/esm/api");
    register();
    const { chooseOrders, createRng, initialParticles, updateParticles } = await import(
      "../../engine/src/sim/bots.ts"
    );
    await hre.fhevm.initializeCLIApi();
    const caseDeployment = await hre.deployments.get("NoEscapeCase");
    const tapDeployment = await hre.deployments.get("GasTap");
    const contract = await hre.ethers.getContractAt("NoEscapeCase", caseDeployment.address, signer);
    const tap = await hre.ethers.getContractAt("GasTap", tapDeployment.address, signer);
    const records: TxRecord[] = [];
    let totalGas = 0n;

    const send = async (
      label: string,
      operation: () => Promise<ContractTransactionResponse>,
    ): Promise<TransactionReceipt> => {
      const startedAt = Date.now();
      const transaction = await operation();
      const receipt = await transaction.wait();
      if (receipt === null) throw new Error(`${label} was not mined`);
      const record = {
        label,
        hash: receipt.hash,
        block: receipt.blockNumber,
        gas: receipt.gasUsed,
        seconds: (Date.now() - startedAt) / 1000,
      };
      records.push(record);
      totalGas += receipt.gasUsed;
      console.log(JSON.stringify({ ...record, gas: record.gas.toString() }));
      return receipt;
    };

    await send("openCase", () => contract.openCase());
    const id = await contract.activeCaseOf(signer.address);
    if (id === 0n) throw new Error("case did not open");
    console.log(`CASE ${id}`);

    const rng = createRng(20261124);
    let particles = initialParticles(rng);
    let previousEncoded = "0x" as `0x${string}`;
    let previousProof = "0x" as `0x${string}`;
    let finalStatus = 0;

    for (let turn = 1; turn <= 12; turn += 1) {
      const cells =
        turn === 1
          ? ([29, 30, 41] as [number, number, number])
          : ((await contract.getTurn(id, turn - 1)).cells.map((cell) => Number(cell)) as [
              number,
              number,
              number,
            ]);
      const orders = chooseOrders("naive", particles, cells);
      await send(`playTurn-${turn}`, () =>
        contract.playTurn(id, orders.to, orders.searchFlags, previousEncoded, previousProof),
      );
      const record = await contract.getTurn(id, turn);
      const report = await retry(`report-${turn}`, () => hre.fhevm.publicDecrypt([record.report]));
      const clear = report.clearValues[record.report as `0x${string}`];
      if (typeof clear !== "bigint") throw new Error(`missing report ${turn}`);
      finalStatus = Number(clear & 3n);
      const camera = Number(clear >> 2n);
      const codes: (number | null)[] = [];
      for (let detective = 0; detective < 3; detective += 1) {
        if ((orders.searchFlags & (1 << detective)) === 0) {
          codes.push(null);
          continue;
        }
        const code = await retry(`code-${turn}-${detective}`, () =>
          hre.fhevm.userDecryptEuint(
            FhevmType.euint8,
            record.codes[detective],
            caseDeployment.address,
            signer,
          ),
        );
        codes.push(Number(code));
      }
      console.log(
        JSON.stringify({
          turn,
          status: finalStatus,
          camera,
          codes,
          orders,
          report: clear.toString(),
        }),
      );
      if (finalStatus !== 0 || turn === 12) {
        await send("resolveReport", () =>
          contract.resolveReport(id, report.abiEncodedClearValues, report.decryptionProof),
        );
        break;
      }
      previousEncoded = report.abiEncodedClearValues;
      previousProof = report.decryptionProof;
      particles = updateParticles(particles, "naive", orders.to, turn, codes, camera, rng);
    }

    const handles = await contract.revealHandles(id);
    const batchA = await retry("reveal-A", () => hre.fhevm.publicDecrypt(handles.a));
    const batchB = await retry("reveal-B", () => hre.fhevm.publicDecrypt(handles.b));
    await send("submitReveal", () =>
      contract.submitReveal(
        id,
        batchA.abiEncodedClearValues,
        batchA.decryptionProof,
        batchB.abiEncodedClearValues,
        batchB.decryptionProof,
      ),
    );
    const verified = await contract.getCase(id);
    if (
      !verified.verified ||
      !verified.verifyOk ||
      verified.failCode !== 0n ||
      verified.failTurn !== 0n
    ) {
      throw new Error(`CaseVerified failed: ${verified.failCode}/${verified.failTurn}`);
    }

    const caseGas = totalGas;
    const minimumDrip = hre.ethers.parseEther("0.002");
    const maximumDrip = hre.ethers.parseEther("0.02");
    const rawDrip = (caseGas * 3_000_000_000n * 3n + 1n) / 2n;
    const dripWei =
      rawDrip < minimumDrip ? minimumDrip : rawDrip > maximumDrip ? maximumDrip : rawDrip;
    await send("setDrip", () => tap.setDrip(dripWei));
    console.log(
      JSON.stringify({
        caseId: id.toString(),
        finalStatus,
        totalGas: caseGas.toString(),
        dripWei: dripWei.toString(),
        dripEth: hre.ethers.formatEther(dripWei),
        verified: true,
      }),
    );

    const proofPath = resolve(process.cwd(), "../../docs/proof.md");
    const outcomeName = finalStatus === 1 ? "Caught" : finalStatus === 2 ? "Escaped" : "Dawn";
    const lines = [
      "",
      `## Solo case #${id}`,
      "",
      `- CaseVerified: [\`${records.find((record) => record.label === "submitReveal")?.hash}\`](https://sepolia.etherscan.io/tx/${records.find((record) => record.label === "submitReveal")?.hash})`,
      `- Outcome: ${outcomeName} at turn ${verified.turn.toString()}`,
      `- Total case gas: ${caseGas.toString()}`,
      `- Final GasTap drip: ${hre.ethers.formatEther(dripWei)} ETH`,
      "",
      "| Step | Transaction | Block | Gas | Wall time |",
      "|---|---|---:|---:|---:|",
      ...records.map(
        (record) =>
          `| ${record.label} | [\`${record.hash}\`](https://sepolia.etherscan.io/tx/${record.hash}) | ${record.block} | ${record.gas.toString()} | ${record.seconds.toFixed(3)} s |`,
      ),
      "",
    ];
    appendFileSync(proofPath, lines.join("\n"));
  });
