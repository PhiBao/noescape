# Spike C — official cUSDTMock on Sepolia

- **Date:** 2026-11-25
- **Result:** PASS
- **Network:** Ethereum Sepolia (`11155111`)

## Contracts and ABI sources

| Item                                           | Address                                      | Source                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| cUSDTMock wrapper proxy                        | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` | [Blockscout](https://eth-sepolia.blockscout.com/address/0x4E7B06D78965594eB5EF5414c357ca21E1554491)                    |
| Wrapper implementation (`ConfidentialWrapper`) | `0xAe37b998d453E1FaBE85DD46cf04295ca4A3af04` | [Blockscout ABI](https://eth-sepolia.blockscout.com/api/v2/smart-contracts/0xAe37b998d453E1FaBE85DD46cf04295ca4A3af04) |
| Underlying `USDTMock`                          | `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0` | [Blockscout ABI](https://eth-sepolia.blockscout.com/api/v2/smart-contracts/0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0) |
| FeeProbe                                       | `0x1Ac013868A1546Cf04b9Ddc87aa8760fAdfE99E9` | [Sepolia Etherscan](https://sepolia.etherscan.io/address/0x1Ac013868A1546Cf04b9Ddc87aa8760fAdfE99E9)                   |

The wrapper is an EIP-1967 proxy. Its proxy endpoint exposes only proxy ABI entries; the functional ABI was read from the verified implementation listed by Blockscout. Both the wrapper and underlying report **6 decimals** onchain.

Relevant signatures, with Solidity `euint64` ABI-encoded as `bytes32`:

```solidity
function decimals() external view returns (uint8);
function underlying() external view returns (address);
function wrap(address to, uint256 amount) external returns (euint64);
function setOperator(address operator, uint48 until) external;
function isOperator(address holder, address spender) external view returns (bool);
function confidentialBalanceOf(address account) external view returns (euint64);
function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64);
function confidentialTransfer(address to, euint64 amount) external returns (euint64);
```

The underlying ERC-20 exposes `mint(address,uint256)`, `approve(address,uint256)` and `decimals()`.

## Setup

`pnpm -F contracts exec hardhat token:setup --network sepolia` deployed FeeProbe with a five-token fee, minted 100 underlying tokens, approved the wrapper, wrapped 100 cUSDTMock, and approved FeeProbe as operator until `2026-12-25 04:25:36 UTC`.

| Step            | Transaction                                                                                                         |       Gas |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | --------: |
| Deploy FeeProbe | [`0xb4ca8b32…`](https://sepolia.etherscan.io/tx/0xb4ca8b32a33068d7ccc12518953979c785b5fb5a4c64e4bec6ebcaea1e1d781f) | 3,729,046 |
| Mint underlying | [`0xd3129e4e…`](https://sepolia.etherscan.io/tx/0xd3129e4ed5597a2d9d05d538459f98f890e62a41bb33d7d9976b44841c0836a1) |   140,980 |
| Approve wrapper | [`0xacbccd2f…`](https://sepolia.etherscan.io/tx/0xacbccd2ff81ba449f4dd5ccfe3443e11e0a971987a5e9e4cf078672c8feb69e3) |   128,620 |
| Wrap            | [`0x9a8e22ad…`](https://sepolia.etherscan.io/tx/0x9a8e22ad56ff1af66a5fb723667db47213bfd12ed1b408bbb1f554a06ca9371e) |   923,533 |
| Set operator    | [`0x69e48858…`](https://sepolia.etherscan.io/tx/0x69e48858b2f9be5ba3c5c84989224f6d78a9ef84017d6edfba349709afb48c88) |   133,549 |

## Probe

`pnpm -F contracts exec hardhat token:probe --network sepolia` ran the final passing probe:

| Step                           | Transaction                                                                                                         |       Gas |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------: |
| Funded pull and send-back      | [`0xa9e0becc…`](https://sepolia.etherscan.io/tx/0xa9e0becc33d22dd2bd0c63d2bde4ea3cb264b03bd913f2a5aee7a0720ca4a7da) | 2,218,617 |
| Grant funded balance ACL       | [`0x877f21b5…`](https://sepolia.etherscan.io/tx/0x877f21b5622ed46220b87dd668f4c6f3042dc35c331d4e5ea6f4cac4fb850088) |   157,527 |
| Underfunded pull and send-back | [`0x7d1e1209…`](https://sepolia.etherscan.io/tx/0x7d1e120958a0356157c59605190fe9f48b0326c399b3ba90f1c348d26342a0e2) | 2,099,383 |
| Grant underfunded balance ACL  | [`0x76cc5af7…`](https://sepolia.etherscan.io/tx/0x76cc5af7b3fe19e34f7aa738137f06d4075a37bd28a1e4fe2a4e552c6930f9ff) |   157,527 |

User-decrypted results:

| Case        |    `sent` | `paid` |            Sender balance | FeeProbe balance |
| ----------- | --------: | ------ | ------------------------: | ---------------: |
| Funded      | 5,000,000 | true   | 100,000,000 → 100,000,000 |            0 → 0 |
| Underfunded |         0 | false  | 100,000,000 → 100,000,000 |            0 → 0 |

Both the funded and underfunded transactions succeeded. The underfunded transfer did not revert.

## Findings for MostWanted

- `FHE.allowTransient(amount, token)` is required before `confidentialTransferFrom`; without it the wrapper rejects use of the ciphertext.
- The wrapper returns a fresh `transferred` handle and grants the caller transient access. A consuming contract must promote handles it needs later with `FHE.allowThis`/`FHE.allow` in the same transaction.
- `FHE.eq(sent, fee)` correctly distinguishes a full pull from an underfunded pull. An underfunded pull returns encrypted zero rather than reverting.
- `confidentialTransfer` sends the pulled amount back successfully using the contract's persistent allowance.
- Confidential balance handles rotate after transfers. Any ACL grant for a balance must be repeated after the balance-changing transaction; granting an earlier handle does not authorize the new one.
- The official token is suitable for T30–T34. The D36a fallback token is **not** needed.

## Reproduction

```bash
pnpm -F contracts exec hardhat token:setup --network sepolia
pnpm -F contracts exec hardhat token:probe --network sepolia
```

`token:probe` exits non-zero unless the funded pull equals five tokens, `paid` is true, the underfunded pull is zero with `paid=false`, both transactions succeed, and all decrypted balances match.
