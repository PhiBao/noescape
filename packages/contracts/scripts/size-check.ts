import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const artifactPath = resolve(
  process.cwd(),
  "artifacts/contracts/NoEscapeCase.sol/NoEscapeCase.json",
);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
  deployedBytecode: string;
};
const bytes = (artifact.deployedBytecode.length - 2) / 2;
const limit = 24_576;
console.log(`NoEscapeCase deployed bytecode: ${bytes} bytes (limit ${limit})`);
if (bytes > limit) process.exitCode = 1;
