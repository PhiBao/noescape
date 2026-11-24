# Spike A — one full encrypted turn on Sepolia

**Result: PASS**  
Date: 2026-11-24 UTC  
Network: Ethereum Sepolia (`11155111`)  
Harness: [`0x62b33b59500f9569b3996e51ee9E486eaaA9F788`](https://sepolia.etherscan.io/address/0x62b33b59500f9569b3996e51ee9E486eaaA9F788)  
Deploy tx: [`0xce9fa9c7c7ca7b466a54e93aae1d9d1cfef4150cefef7c9068311bef828741e6`](https://sepolia.etherscan.io/tx/0xce9fa9c7c7ca7b466a54e93aae1d9d1cfef4150cefef7c9068311bef828741e6)

## Pass criteria

| Criterion                                 |                Measured | Status |
| ----------------------------------------- | ----------------------: | ------ |
| Three `fullTurn` transactions succeed     |                     3/3 | PASS   |
| Maximum `fullTurn` gas below 12,000,000   |               5,647,344 | PASS   |
| Three public decryptions below 15 seconds | 2.917 / 2.791 / 2.778 s | PASS   |

The pre-approved split fallback is **not** needed. One complete turn fits comfortably in one transaction.

## Final turn run

| Step         | Transaction                                                                                                         |      Block | Wall time |  Gas used |  Status | HCU         |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ---------: | --------: | --------: | ------: | ----------- |
| `init`       | [`0xa90a53e…`](https://sepolia.etherscan.io/tx/0xa90a53e5afad35f54375fd27dced26ffadc02377325fd0e7e821613275e617c9)  | 12,201,648 |  13.888 s |   715,744 | success | not exposed |
| `fullTurn` 1 | [`0xeca51a37…`](https://sepolia.etherscan.io/tx/0xeca51a37e92af432117458541304deb44c6b1a17085d97b0dd4c6eefdd59209d) | 12,201,649 |  11.879 s | 5,647,344 | success | not exposed |
| `fullTurn` 2 | [`0x072f51cc…`](https://sepolia.etherscan.io/tx/0x072f51cc327f9eda692cc3322b5804e32923b7ecc23ce24e9f8a7f4442c8d7b3) | 12,201,650 |   9.865 s | 5,443,938 | success | not exposed |
| `fullTurn` 3 | [`0x3600bf1b…`](https://sepolia.etherscan.io/tx/0x3600bf1b46de3c3ba09ceddc74648d34ec689cbe15cb663d72ab1c859de6d1f4) | 12,201,651 |  10.657 s | 5,455,938 | success | not exposed |

The deployer balance moved from 1.049991 ETH to 1.047462 ETH after harness deployment, before the turn runs.

## Public decryption

Report handle: `0x6b8dce55f296c79b3e6e3c76b7ce149827c8a8d5efff0000000000aa36a70200`

| Attempt | Clear value |  Status | Camera | Latency |
| ------- | ----------: | ------: | -----: | ------: |
| 1       |           0 | running |   none | 2.917 s |
| 2       |           0 | running |   none | 2.791 s |
| 3       |           0 | running |   none | 2.778 s |

The Zama Sepolia relayer required no API key.

## Stress and protocol findings

- `fullTurnPlusStep` reverted during gas estimation with `HCUTransactionLimitExceeded()`. This is a two-brain-step stress case, not the product turn shape. It confirms the architecture's one-night-move-per-transaction boundary.
- A transaction requesting gas limit **16,777,217** was accepted on this Sepolia route. The EIP-7825 16,777,216 cap described as `[S]` in A§5 was **not enforced** at test time. Product turns remain far below either limit.
- The plugin did not expose per-transaction HCU on Sepolia, so HCU is recorded as “not exposed”.
- `spike:allow` was exercised successfully in [`0xd1aa4134…`](https://sepolia.etherscan.io/tx/0xd1aa41343ac441137f1e72049433918640a32d049430214a1ba658cdb7bf903d) (40,535 gas).

## Reproduce

```sh
pnpm -F contracts exec hardhat spike:deploy --network sepolia
pnpm -F contracts exec hardhat spike:turn --network sepolia --runs 3
pnpm -F contracts exec hardhat spike:decrypt --network sepolia
pnpm -F contracts exec hardhat spike:allow --network sepolia --to <address>
```
