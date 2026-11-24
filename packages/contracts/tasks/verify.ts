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

task("verify:sepolia", "Verifies the deployed solo contracts on Etherscan").setAction(
  async (_taskArguments, hre) => {
    if (Number(hre.network.config.chainId) !== 11155111) {
      throw new Error("verify:sepolia may only run on Sepolia");
    }
    const rules = readDeployment("CaseRules");
    for (const [name, fullyQualifiedName] of [
      ["GasTap", "contracts/GasTap.sol:GasTap"],
      ["CaseRules", "contracts/lib/CaseRules.sol:CaseRules"],
      ["NoEscapeCase", "contracts/NoEscapeCase.sol:NoEscapeCase"],
    ] as const) {
      const deployment = readDeployment(name);
      await hre.run("verify:etherscan", {
        address: deployment.address,
        constructorArgsParams: deployment.args ?? [],
        contract: fullyQualifiedName,
        libraries:
          name === "NoEscapeCase"
            ? {
                CaseRules: rules.address,
              }
            : undefined,
      });
      console.log(`${name} verified: ${deployment.address}`);
    }
  },
);
