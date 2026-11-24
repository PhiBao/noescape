# Spike B — browser decryption with a local-account signer

**Result: PASS**  
Date: 2026-11-24 UTC  
SDK: `@zama-fhe/sdk` 3.8.0 (`web()` relayer)  
Browser: bundled Playwright Chromium 156 (revision 1248)  
Harness: [`0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77`](https://sepolia.etherscan.io/address/0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77)  
Deploy tx: [`0xf45c313652636d92d0280a23ab9e1400fa8c105f2bb70884310fc9d46280334e`](https://sepolia.etherscan.io/tx/0xf45c313652636d92d0280a23ab9e1400fa8c105f2bb70884310fc9d46280334e)

## Pass criteria

| Step                                  | Result                         | Latency |
| ------------------------------------- | ------------------------------ | ------: |
| Public report decryption              | clear `0`, KMS proof 489 bytes | 5.119 s |
| Simulated `checkReport(clear, proof)` | KMS signatures accepted        | 0.091 s |
| User-decrypt allowed search code      | clear `0` after `spike:allow`  | 4.993 s |
| User-decrypt fugitive position        | real ACL refusal               | 0.388 s |

All four steps ran in Chromium with **no wallet extension**. The viem local-account `walletClient` signed the SDK's EIP-712 permit successfully, so the D25a fallback to `@zama-fhe/relayer-sdk` was **not** needed.

## ACL refusal

The position attempt returned the relayer's real refusal:

> Account `0xdbbd5709EeBD21010E2856BFc9754d3317CfEDF1` is not entitled to decrypt encrypted value `0x50796b8a3300a7605ca18bf52c5bef18697f0c579eff0000000000aa36a70600` on contract `0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77`. This is not a transient failure — the account needs an on-chain ACL grant before it can decrypt this encrypted value.

## Request hosts for CSP

The Playwright run recorded:

- `127.0.0.1:4387` — local Vite preview
- `ethereum-sepolia-rpc.publicnode.com` — public Sepolia reads
- `relayer.testnet.zama.org` — Zama relayer

The production CSP must allow the configured Sepolia RPC and `relayer.testnet.zama.org`. The SDK's WASM assets are bundled by Vite; its worker uses `blob:`.

## Reproduce

```sh
cd spikes/browser-decrypt
pnpm install --ignore-workspace
npx playwright test
```

The test builds the page, starts `vite preview`, grants the printed burner access with `spike:allow`, and asserts all four outcomes. It logs per-step latencies and every request host.
