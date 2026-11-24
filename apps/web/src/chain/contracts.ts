import { GasTapAbi, NoEscapeCaseAbi, sepoliaAddresses } from "@noescape/contracts/abi";
import { type Account, getContract } from "viem";
import { publicClient, walletClientFor } from "./clients.ts";

export function getNoEscapeCase(account: Account) {
  return getContract({
    address: sepoliaAddresses.NoEscapeCase.address,
    abi: NoEscapeCaseAbi,
    client: walletClientFor(account),
  });
}

export function getNoEscapeCaseReader() {
  return getContract({
    address: sepoliaAddresses.NoEscapeCase.address,
    abi: NoEscapeCaseAbi,
    client: publicClient,
  });
}

export function getGasTap(account: Account) {
  return getContract({
    address: sepoliaAddresses.GasTap.address,
    abi: GasTapAbi,
    client: walletClientFor(account),
  });
}
