import type { Hex } from "viem";
import { type Account, generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const STORAGE_KEY = "noescape.detective.v1";

export function loadBurner(): Account | null {
  const privateKey = window.localStorage.getItem(STORAGE_KEY);
  if (privateKey === null) return null;
  return accountFromPrivateKey(privateKey);
}

export function createBurner(): Account {
  const privateKey = generatePrivateKey();
  const account = accountFromPrivateKey(privateKey);
  window.localStorage.setItem(STORAGE_KEY, privateKey);
  return account;
}

export function getOrCreateBurner(): Account {
  return loadBurner() ?? createBurner();
}

export function exportBurner(): Hex {
  getOrCreateBurner();
  const privateKey = window.localStorage.getItem(STORAGE_KEY);
  if (privateKey === null) throw new Error("detective key is missing");
  return privateKey as Hex;
}

export function importBurner(privateKey: string): Account {
  const account = accountFromPrivateKey(privateKey.trim());
  window.localStorage.setItem(STORAGE_KEY, privateKey.trim());
  return account;
}

export function forgetBurner(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

function accountFromPrivateKey(privateKey: string): Account {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("invalid detective key");
  }
  return privateKeyToAccount(privateKey as Hex);
}
