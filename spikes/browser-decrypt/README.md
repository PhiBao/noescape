# Browser decryption spike

Standalone proof that `@zama-fhe/sdk` 3.8.0 can use a viem local-account signer in Chromium without a wallet extension.

## Run

```sh
pnpm install --ignore-workspace
npx playwright test
```

The Playwright test builds the Vite page, starts `vite preview`, then:

1. Publicly decrypts the latest Sepolia report and checks proof length.
2. Simulates `BrainHarness.checkReport(clear, proof)`.
3. Prints a fresh burner address. The test grants that address access to the latest search code with the Hardhat `spike:allow` task, then decrypts the code.
4. Attempts to user-decrypt the fugitive position and requires the real ACL refusal.

It also logs every request host for the production CSP and prints the burner address. No private key is persisted or sent anywhere.
