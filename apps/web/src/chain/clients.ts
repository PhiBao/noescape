import { type Account, createPublicClient, createWalletClient, fallback, http } from "viem";
import { sepolia } from "viem/chains";
import { config } from "../config.ts";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback([http(config.sepoliaRpcUrl), http(config.sepoliaRpcFallback)], {
    retryCount: 2,
  }),
});

export function walletClientFor(account: Account) {
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(config.sepoliaRpcUrl),
  });
}

export function retryDelay(attempt: number): number {
  if (attempt === 0) return 500;
  if (attempt === 1) return 1000;
  if (attempt === 2) return 2000;
  return 3000;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= 17; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === 17 || !shouldRetry(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
    }
  }
  throw lastError;
}
