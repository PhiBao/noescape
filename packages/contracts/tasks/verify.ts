import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { task } from "hardhat/config";

type DeploymentFile = {
  address: string;
  args?: unknown[];
};

function readDeployment(name: string): DeploymentFile {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `deployments/sepolia/${name}.json`), "utf8"),
  ) as DeploymentFile;
}

task("verify:sepolia", "Verifies the deployed Sepolia contracts on Etherscan").setAction(
  async (_taskArguments, hre) => {
    if (Number(hre.network.config.chainId) !== 11155111) {
      throw new Error("verify:sepolia may only run on Sepolia");
    }
    const soloRules = readDeployment("CaseRules");
    const dailyRules = readDeployment("CaseRulesMostWanted");
    for (const [name, fullyQualifiedName] of [
      ["GasTap", "contracts/GasTap.sol:GasTap"],
      ["CaseRules", "contracts/lib/CaseRules.sol:CaseRules"],
      ["NoEscapeCase", "contracts/NoEscapeCase.sol:NoEscapeCase"],
      ["CaseRulesMostWanted", "contracts/lib/CaseRules.sol:CaseRules"],
      ["MostWanted", "contracts/MostWanted.sol:MostWanted"],
    ] as const) {
      const deployment = readDeployment(name);
      try {
        await hre.run("verify:etherscan", {
          address: deployment.address,
          constructorArgsParams: deployment.args ?? [],
          contract: fullyQualifiedName,
          libraries:
            name === "NoEscapeCase"
              ? { CaseRules: soloRules.address }
              : name === "MostWanted"
                ? { CaseRules: dailyRules.address }
                : undefined,
        });
        console.log(`${name} verified: ${deployment.address}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes("already verified")) throw error;
        console.log(`${name} already verified: ${deployment.address}`);
      }
    }
  },
);
