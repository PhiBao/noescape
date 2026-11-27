import { vi } from "vitest";

// Unit tests import the chain clients, which build a public client from config.
// Use harmless local values so CI does not need deployment or Sepolia secrets.
vi.stubEnv("VITE_SEPOLIA_RPC_URL", "http://127.0.0.1:8545");
vi.stubEnv("VITE_SEPOLIA_RPC_FALLBACK", "http://127.0.0.1:8545");
vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test");
