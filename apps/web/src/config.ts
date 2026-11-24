function required(name: "VITE_SEPOLIA_RPC_URL" | "VITE_SEPOLIA_RPC_FALLBACK"): string {
  const value = import.meta.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export const config = {
  sepoliaRpcUrl: required("VITE_SEPOLIA_RPC_URL"),
  sepoliaRpcFallback: required("VITE_SEPOLIA_RPC_FALLBACK"),
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "",
  featuredCaseId: import.meta.env.VITE_FEATURED_CASE_ID ?? "",
} as const;
