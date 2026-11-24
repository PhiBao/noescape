import { ZamaSDK } from "@zama-fhe/sdk";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { type Address, createPublicClient, createWalletClient, type Hex, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const HARNESS = "0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77" as Address;
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const harnessAbi = [
  {
    type: "function",
    name: "getReport",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getCode",
    stateMutability: "view",
    inputs: [{ type: "uint8" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getPos",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "checkReport",
    stateMutability: "nonpayable",
    inputs: [{ type: "bytes" }, { type: "bytes" }],
    outputs: [],
  },
] as const;

const account = privateKeyToAccount(generatePrivateKey());
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
const sdk = new ZamaSDK(
  createConfig({
    chains: [zamaSepolia],
    publicClient,
    walletClient,
    relayers: { [zamaSepolia.id]: web() },
  }),
);

function output(testId: string, value: string): void {
  const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (element !== null) element.textContent = value;
}

function seconds(startedAt: number): string {
  return ((performance.now() - startedAt) / 1000).toFixed(3);
}

const burnerElement = document.querySelector<HTMLElement>('[data-testid="burner-address"]');
if (burnerElement === null) throw new Error("missing burner address element");
burnerElement.textContent = account.address;
document.body.dataset.burner = account.address;

async function readHandle(
  functionName: "getReport" | "getPos" | "getCode",
  index?: number,
): Promise<Hex> {
  if (functionName === "getCode") {
    return publicClient.readContract({
      address: HARNESS,
      abi: harnessAbi,
      functionName,
      args: [index ?? 0],
    });
  }
  return publicClient.readContract({ address: HARNESS, abi: harnessAbi, functionName });
}

async function publicFlow(): Promise<void> {
  const startedAt = performance.now();
  const reportHandle = await readHandle("getReport");
  const result = await sdk.decryption.decryptPublicValues([reportHandle]);
  const clear = result.clearValues[reportHandle];
  const proofBytes = (result.decryptionProof.length - 2) / 2;
  output(
    "public-result",
    `PUBLIC OK · clear=${String(clear)} · proofBytes=${proofBytes} · ${seconds(startedAt)}s`,
  );
  document.body.dataset.public = "ok";

  const checkStartedAt = performance.now();
  await publicClient.simulateContract({
    account,
    address: HARNESS,
    abi: harnessAbi,
    functionName: "checkReport",
    args: [result.abiEncodedClearValues, result.decryptionProof],
  });
  output("check-result", `CHECK OK · KMS signatures accepted · ${seconds(checkStartedAt)}s`);
  document.body.dataset.check = "ok";
}

async function codeFlow(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('[data-testid="decrypt-code"]');
  if (button !== null) button.disabled = true;
  const startedAt = performance.now();
  try {
    const handle = await readHandle("getCode", 0);
    const values = await sdk.decryption.decryptValues([
      { encryptedValue: handle, contractAddress: HARNESS },
    ]);
    output("code-result", `CODE OK · clear=${String(values[handle])} · ${seconds(startedAt)}s`);
    document.body.dataset.code = "ok";
  } catch (error) {
    output(
      "code-result",
      `CODE FAILED · ${error instanceof Error ? error.message : String(error)}`,
    );
    document.body.dataset.code = "failed";
  } finally {
    if (button !== null) button.disabled = false;
  }
}

async function positionFlow(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('[data-testid="decrypt-position"]');
  if (button !== null) button.disabled = true;
  const startedAt = performance.now();
  try {
    const handle = await readHandle("getPos");
    await sdk.decryption.decryptValues([{ encryptedValue: handle, contractAddress: HARNESS }]);
    output("position-result", "UNEXPECTED · position decrypted");
    document.body.dataset.position = "unexpected";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output("position-result", `REFUSED · ${message} · ${seconds(startedAt)}s`);
    document.body.dataset.position = "refused";
  } finally {
    if (button !== null) button.disabled = false;
  }
}

document
  .querySelector<HTMLButtonElement>('[data-testid="decrypt-code"]')
  ?.addEventListener("click", () => void codeFlow());
document
  .querySelector<HTMLButtonElement>('[data-testid="decrypt-position"]')
  ?.addEventListener("click", () => void positionFlow());

void publicFlow().catch((error) => {
  output(
    "public-result",
    `PUBLIC FAILED · ${error instanceof Error ? error.message : String(error)}`,
  );
  document.body.dataset.public = "failed";
});
