import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function main(): void {
  const root = process.cwd();
  const deploymentDirectory = resolve(root, "deployments/sepolia");
  const artifactDirectory = resolve(root, "artifacts/contracts");
  const outputDirectory = resolve(root, "abi");
  mkdirSync(outputDirectory, { recursive: true });

  const contracts = [
    { name: "GasTap", artifact: "GasTap.sol/GasTap.json" },
    { name: "CaseRules", artifact: "lib/CaseRules.sol/CaseRules.json" },
    { name: "NoEscapeCase", artifact: "NoEscapeCase.sol/NoEscapeCase.json" },
  ] as const;

  for (const { name, artifact } of contracts) {
    const deployment = JSON.parse(
      readFileSync(resolve(deploymentDirectory, `${name}.json`), "utf8"),
    ) as { address: string };
    const artifactJson = JSON.parse(readFileSync(resolve(artifactDirectory, artifact), "utf8")) as {
      abi: unknown[];
    };
    writeFileSync(
      resolve(outputDirectory, `${name}.ts`),
      `export const ${name}Abi = ${JSON.stringify(artifactJson.abi, null, 2)} as const;\n`,
    );
    console.log(`${name}: ${deployment.address}`);
  }

  const entries = contracts.map(({ name }) => {
    const deployment = JSON.parse(
      readFileSync(resolve(deploymentDirectory, `${name}.json`), "utf8"),
    ) as {
      address: string;
      receipt?: { blockNumber?: number };
      transactionHash?: string;
    };
    return [
      name,
      {
        address: deployment.address,
        deployBlock: deployment.receipt?.blockNumber ?? null,
        txHash: deployment.transactionHash ?? null,
      },
    ] as const;
  });

  const addressMap = Object.fromEntries(entries);
  writeFileSync(
    resolve(outputDirectory, "addresses.ts"),
    `export const contractAddresses = {\n  11155111: ${JSON.stringify(addressMap, null, 2)}\n} as const;\n\nexport const sepoliaAddresses = contractAddresses[11155111];\n`,
  );
  writeFileSync(
    resolve(outputDirectory, "index.ts"),
    contracts.map(({ name }) => `export * from "./${name}.ts";`).join("\n") +
      '\nexport * from "./addresses.ts";\n',
  );
}

main();
