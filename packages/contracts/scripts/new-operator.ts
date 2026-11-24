import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { Wallet } from "ethers";

async function addSecret(environment: "production" | "preview", privateKey: string): Promise<void> {
  const child = spawn("vercel", ["env", "add", "DRIP_OPERATOR_PRIVATE_KEY", environment], {
    cwd: resolve(process.cwd(), "../../apps/web"),
    stdio: ["pipe", "inherit", "inherit"],
  });
  child.stdin.end(`${privateKey}\n`);
  const code = await new Promise<number | null>((resolveExit) => {
    child.on("exit", resolveExit);
  });
  if (code !== 0) throw new Error(`vercel env add failed for ${environment}`);
}

async function main(): Promise<void> {
  const wallet = Wallet.createRandom();
  await addSecret("production", wallet.privateKey);
  await addSecret("preview", wallet.privateKey);
  console.log(wallet.address);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
