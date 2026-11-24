import { sepoliaAddresses } from "@noescape/contracts/abi";
import { ZamaSDK } from "@zama-fhe/sdk";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import type { Address, Hex } from "viem";
import { getOrCreateBurner } from "./burner.ts";
import { publicClient, walletClientFor, withRetry } from "./clients.ts";

export interface DecryptPair {
  encryptedValue: Hex;
  contractAddress: Address;
}

let sdk: ZamaSDK | null = null;
let sdkAddress: Address | null = null;

function getSdk(): ZamaSDK {
  const account = getOrCreateBurner();
  if (sdk !== null && sdkAddress === account.address) return sdk;
  sdk = new ZamaSDK(
    createConfig({
      chains: [zamaSepolia],
      publicClient: publicClient as never,
      walletClient: walletClientFor(account) as never,
      relayers: { [zamaSepolia.id]: web() },
    }),
  );
  sdkAddress = account.address;
  return sdk;
}

function clearBigInt(value: unknown, handle: Hex): bigint {
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  throw new Error(`missing decrypted value ${handle}`);
}

function retryableDecryptError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("not entitled") || message.includes("acl")) return false;
  return (
    message.includes("not authorized") ||
    message.includes("timeout") ||
    message.includes("relayer") ||
    message.includes("404") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  );
}

export async function publicDecrypt(handles: readonly Hex[]): Promise<{
  clear: Record<Hex, bigint>;
  abi: Hex;
  proof: Hex;
}> {
  const result = await withRetry(
    () => getSdk().decryption.decryptPublicValues([...handles]),
    retryableDecryptError,
  );
  const clear = Object.fromEntries(
    handles.map((handle) => [handle, clearBigInt(result.clearValues[handle], handle)]),
  ) as Record<Hex, bigint>;
  return { clear, abi: result.abiEncodedClearValues, proof: result.decryptionProof };
}

export async function userDecrypt(pairs: readonly DecryptPair[]): Promise<Record<Hex, bigint>> {
  const result = await withRetry(
    () => getSdk().decryption.decryptValues([...pairs]),
    retryableDecryptError,
  );
  return Object.fromEntries(
    pairs.map(({ encryptedValue }) => [
      encryptedValue,
      clearBigInt(result[encryptedValue], encryptedValue),
    ]),
  ) as Record<Hex, bigint>;
}

export async function ensurePermits(
  contracts: readonly Address[] = [sepoliaAddresses.NoEscapeCase.address],
): Promise<void> {
  await getSdk().permits.grantPermit([...contracts]);
}
