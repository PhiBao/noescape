import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const limit = 24_576;
const contracts = ["NoEscapeCase", "MostWanted"];
for (const contract of contracts) {
  const artifactPath = resolve(
    process.cwd(),
    `artifacts/contracts/${contract}.sol/${contract}.json`,
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    deployedBytecode: string;
  };
  const bytes = (artifact.deployedBytecode.length - 2) / 2;
  console.log(`${contract} deployed bytecode: ${bytes} bytes (limit ${limit})`);
  if (bytes > limit) process.exitCode = 1;
}
