# noescape — Sepolia proof

Network: Ethereum Sepolia (`11155111`)  
Deployer: `0xDbFe5c4d0256D2459bB216caB905999Ca41bE349`

## Solo contracts

| Contract     | Address                                                                                                                         | Deploy block | Deploy transaction                                                                                                  | Verified source                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GasTap       | [`0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb`](https://sepolia.etherscan.io/address/0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb) |   12,202,836 | [`0xf8aae8ac…`](https://sepolia.etherscan.io/tx/0xf8aae8acf825a1114b2366ea0c1bff383b9df6ca316398836a572558dca5e5b3) | [Etherscan](https://sepolia.etherscan.io/address/0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb#code) |
| CaseRules    | [`0xE7414B17E561a4eB82e8Fc57F91D1EdFA0302631`](https://sepolia.etherscan.io/address/0xE7414B17E561a4eB82e8Fc57F91D1EdFA0302631) |   12,202,837 | [`0xb3749ff2…`](https://sepolia.etherscan.io/tx/0xb3749ff2c1521950d0e183e7e631aa0fc294ae702107669b5de00d6965547be2) | [Etherscan](https://sepolia.etherscan.io/address/0xE7414B17E561a4eB82e8Fc57F91D1EdFA0302631#code) |
| NoEscapeCase | [`0x0Ef4b145f8123356478aBB67C1429eDd4D9F65DA`](https://sepolia.etherscan.io/address/0x0Ef4b145f8123356478aBB67C1429eDd4D9F65DA) |   12,204,705 | [`0xfd58defd…`](https://sepolia.etherscan.io/tx/0xfd58defdfac5fe4955bba860b44cdd4f1121271e13885b7369fede07c0154718) | [Etherscan](https://sepolia.etherscan.io/address/0x0Ef4b145f8123356478aBB67C1429eDd4D9F65DA#code) |

GasTap's measured drip is 0.02 ETH with a 0.25 ETH daily cap.

## Spike harness

The T06/T07 test harness is [`0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77`](https://sepolia.etherscan.io/address/0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77). It is test-only and is not part of the product contracts.

## Solo case #1 — superseded reveal-order deployment

This case verified on the initial NoEscapeCase deployment. Its reveal batch B used the corrected interface's predecessor ordering and is retained only as history.

- CaseVerified: [`0x47520a8e4c51ba8fce2866f96b81a8866e93dfc9dfac6c0dc3b8af028338633e`](https://sepolia.etherscan.io/tx/0x47520a8e4c51ba8fce2866f96b81a8866e93dfc9dfac6c0dc3b8af028338633e)
- Outcome: Caught at turn 6
- Total case gas: 59434787
- Final GasTap drip: 0.02 ETH

| Step          | Transaction                                                                                                                                                                |    Block |     Gas | Wall time |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: | ------: | --------: |
| openCase      | [`0xa066054af75eda270059b77588b6feaacedada4d4d896fb9be375b3e2574773e`](https://sepolia.etherscan.io/tx/0xa066054af75eda270059b77588b6feaacedada4d4d896fb9be375b3e2574773e) | 12203077 | 1665067 |   8.784 s |
| playTurn-1    | [`0x181faae763313c40db2843c20836e0ef609718a01223c399837554763a3a47ac`](https://sepolia.etherscan.io/tx/0x181faae763313c40db2843c20836e0ef609718a01223c399837554763a3a47ac) | 12203078 | 7589593 |  12.146 s |
| playTurn-2    | [`0xe15b89ffd094cf656bed9d426f86525a9c91b362bf38d4d2656042862e672f3a`](https://sepolia.etherscan.io/tx/0xe15b89ffd094cf656bed9d426f86525a9c91b362bf38d4d2656042862e672f3a) | 12203081 | 8055414 |  56.451 s |
| playTurn-3    | [`0x8643796dc79f72bd52f6f366d1195d37f16cbdea1358bc06aacea85b1a0a5440`](https://sepolia.etherscan.io/tx/0x8643796dc79f72bd52f6f366d1195d37f16cbdea1358bc06aacea85b1a0a5440) | 12203087 | 8067426 |  12.114 s |
| playTurn-4    | [`0xf0838eb42e80e91007d670ec2c93f7b9927ea191ea646d3257870b2720f3967c`](https://sepolia.etherscan.io/tx/0xf0838eb42e80e91007d670ec2c93f7b9927ea191ea646d3257870b2720f3967c) | 12203090 | 8067414 |  12.513 s |
| playTurn-5    | [`0x2f706c713d2279c55df9f15c1e73809ac11f8034ec34d81e731d1abfd58dad04`](https://sepolia.etherscan.io/tx/0x2f706c713d2279c55df9f15c1e73809ac11f8034ec34d81e731d1abfd58dad04) | 12203097 | 8067414 |   9.623 s |
| playTurn-6    | [`0xe4dbd745e235aa88ed2cf423d068927db0b25af140df707e5da2bca089c7ef6f`](https://sepolia.etherscan.io/tx/0xe4dbd745e235aa88ed2cf423d068927db0b25af140df707e5da2bca089c7ef6f) | 12203100 | 8067398 |  10.668 s |
| resolveReport | [`0x24c77454e12bbb00755228067b3fe45e048f493cfc350660d1fd923c36b5bf59`](https://sepolia.etherscan.io/tx/0x24c77454e12bbb00755228067b3fe45e048f493cfc350660d1fd923c36b5bf59) | 12203102 | 7584343 |  11.936 s |
| submitReveal  | [`0x47520a8e4c51ba8fce2866f96b81a8866e93dfc9dfac6c0dc3b8af028338633e`](https://sepolia.etherscan.io/tx/0x47520a8e4c51ba8fce2866f96b81a8866e93dfc9dfac6c0dc3b8af028338633e) | 12203108 | 2270718 |  31.360 s |
| setDrip       | [`0x9a2ac5fe249e9b66b14ac19cac7e12aeab97f4e39d9a12fd298201bed73b4985`](https://sepolia.etherscan.io/tx/0x9a2ac5fe249e9b66b14ac19cac7e12aeab97f4e39d9a12fd298201bed73b4985) | 12203110 |   31009 |  22.435 s |

## Solo case #1 — current deployment

- Independent CLI: `case #1 · start ✓ · 4 moves ✓ · 12 answers ✓ · 4 reports ✓ · onchain CaseVerified ✓`
- CaseVerified: [`0x0a0f71e6ccaf5e1929fea25b31140d01e2d1b5ce2917587821071fb4d8143368`](https://sepolia.etherscan.io/tx/0x0a0f71e6ccaf5e1929fea25b31140d01e2d1b5ce2917587821071fb4d8143368)
- Outcome: Escaped at turn 4
- Total case gas: 40710931
- Final GasTap drip: 0.02 ETH

| Step          | Transaction                                                                                                                                                                |    Block |     Gas | Wall time |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: | ------: | --------: |
| openCase      | [`0xd9f35208e51cf0f94541a504a438cd3abe0a39a02c0753ea97e23371a615255d`](https://sepolia.etherscan.io/tx/0xd9f35208e51cf0f94541a504a438cd3abe0a39a02c0753ea97e23371a615255d) | 12204712 | 1665067 |   6.053 s |
| playTurn-1    | [`0x2a51e2dda9e686e63babf2740e96d76e8804b5b7ae6b7d287cf498e25c6c0e1e`](https://sepolia.etherscan.io/tx/0x2a51e2dda9e686e63babf2740e96d76e8804b5b7ae6b7d287cf498e25c6c0e1e) | 12204713 | 7589593 |  13.340 s |
| playTurn-2    | [`0xd2046be5ead87b0a0588ef549d352cec9c80ca207b0fa9c94440a9d9f42cb463`](https://sepolia.etherscan.io/tx/0xd2046be5ead87b0a0588ef549d352cec9c80ca207b0fa9c94440a9d9f42cb463) | 12204716 | 8055426 |  11.307 s |
| playTurn-3    | [`0x9e8296367f1dafcab9bc5889bccdda448676ffc35462f4124ca10ec54205e62e`](https://sepolia.etherscan.io/tx/0x9e8296367f1dafcab9bc5889bccdda448676ffc35462f4124ca10ec54205e62e) | 12204719 | 8067402 |  13.346 s |
| playTurn-4    | [`0xf7effe57b2e3e0a4f00267deb611fa3c01c31ea47207802b206bc5d8d795a59a`](https://sepolia.etherscan.io/tx/0xf7effe57b2e3e0a4f00267deb611fa3c01c31ea47207802b206bc5d8d795a59a) | 12204722 | 8067414 |  11.319 s |
| resolveReport | [`0x664fb557901b99dd669db8df09a9764cd8094cc59c3736508c92bc04628d94cd`](https://sepolia.etherscan.io/tx/0x664fb557901b99dd669db8df09a9764cd8094cc59c3736508c92bc04628d94cd) | 12204725 | 5415218 |  58.149 s |
| submitReveal  | [`0x0a0f71e6ccaf5e1929fea25b31140d01e2d1b5ce2917587821071fb4d8143368`](https://sepolia.etherscan.io/tx/0x0a0f71e6ccaf5e1929fea25b31140d01e2d1b5ce2917587821071fb4d8143368) | 12204730 | 1850811 |   7.838 s |
| setDrip       | [`0x3f19ecb31b98b6c45f100e2bfcc223401a612bb9a4ed49b22925c1ca04d3b819`](https://sepolia.etherscan.io/tx/0x3f19ecb31b98b6c45f100e2bfcc223401a612bb9a4ed49b22925c1ca04d3b819) | 12204731 |   21009 |  11.163 s |

## Most Wanted contracts

| Contract            | Address                                                                                                                         | Deploy block | Deploy transaction                                                                                                  | Verified source                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| CaseRulesMostWanted | [`0xb9fBf0953397311f91c6C0A1fb15fcfABC321ba4`](https://sepolia.etherscan.io/address/0xb9fBf0953397311f91c6C0A1fb15fcfABC321ba4) |   12,208,147 | [`0xc5a73b83…`](https://sepolia.etherscan.io/tx/0xc5a73b83a8cf3f006886c71442705207349ad769a6091a294001ba7f37b755e1) | [Etherscan](https://sepolia.etherscan.io/address/0xb9fBf0953397311f91c6C0A1fb15fcfABC321ba4#code) |
| MostWanted          | [`0x31606A8123D2e47450A06D94694A51AD7A20EfBD`](https://sepolia.etherscan.io/address/0x31606A8123D2e47450A06D94694A51AD7A20EfBD) |   12,208,148 | [`0xe4cfb0d6…`](https://sepolia.etherscan.io/tx/0xe4cfb0d62f5bc20c00ce2ea2b0aff2a41b1aa7f81ad8a9fbbe27a584b61a240f) | [Etherscan](https://sepolia.etherscan.io/address/0x31606A8123D2e47450A06D94694A51AD7A20EfBD#code) |

The daily verifier uses a separate `CaseRulesMostWanted` deployment so the existing solo contract keeps its original linked library.

## Most Wanted day 20782 — first CLI hunt

- UTC day: 2026-11-25 (`20782`)
- Hunter: deployer `0xDbFe5c4d0256D2459bB216caB905999Ca41bE349`
- Action: index 0, step 1, cell 29 → 29, searched
- Public camera report: `0` (camera 0)
- User-decrypted search code: `0`

| Step        | Transaction                                                                                                         |    Block |     Gas | Wall time |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | -------: | ------: | --------: |
| setOperator | [`0xbc74aa6a…`](https://sepolia.etherscan.io/tx/0xbc74aa6a6767cbb7fff9959f14a0057c5b157185b13a53274a70641fb50b5eba) | 12208157 |  133549 |  29.101 s |
| join        | [`0xba01e2b8…`](https://sepolia.etherscan.io/tx/0xba01e2b8be7fdb6e371338868fbf12e133e3c5864fc09cb7e066cf359b80a095) | 12208158 | 3224152 |   4.577 s |
| hunt        | [`0xaa38ff39…`](https://sepolia.etherscan.io/tx/0xaa38ff39148e8b53b9af0f381dcb20c3b4bcd16002af04fe2c73ee08221fba91) | 12208159 | 6102050 |  24.105 s |

`pnpm -F contracts exec hardhat mw:status --network sepolia` reports day 20782 active with one hunter, one step and action index 0.

## Final proof index (T41)

| Artifact                               | Link or command                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live app                               | https://noescape-case.vercel.app                                                                                                                                                                                                                                                          |
| Verified featured case                 | https://noescape-case.vercel.app/case/2/file                                                                                                                                                                                                                                              |
| Live ACL refusal                       | https://noescape-case.vercel.app/secret                                                                                                                                                                                                                                                   |
| Source repository                      | https://github.com/PhiBao/noescape                                                                                                                                                                                                                                                        |
| Solo contracts                         | [NoEscapeCase](https://sepolia.etherscan.io/address/0x0Ef4b145f8123356478aBB67C1429eDd4D9F65DA), [MostWanted](https://sepolia.etherscan.io/address/0x31606A8123D2e47450A06D94694A51AD7A20EfBD), [GasTap](https://sepolia.etherscan.io/address/0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb) |
| Featured `CaseVerified(2, true, 0, 0)` | [tx `0xb53fc288…0568a`](https://sepolia.etherscan.io/tx/0xb53fc28822e2d9ae98f05aa80248a4415b9af681ec8a13b07df80b2ab060568a)                                                                                                                                                               |
| Featured case open tx                  | [tx `0xf9b194af…c25d`](https://sepolia.etherscan.io/tx/0xf9b194af247bd4bd67888abf234a143bf1333eab8b1cd901ae661777264bf25d)                                                                                                                                                                |
| Independent replay                     | `pnpm verify-case 2`                                                                                                                                                                                                                                                                      |
| Featured case reveal batch B           | [tx `0xb53fc288…0568a`](https://sepolia.etherscan.io/tx/0xb53fc28822e2d9ae98f05aa80248a4415b9af681ec8a13b07df80b2ab060568a)                                                                                                                                                               |
| Security review                        | https://github.com/PhiBao/noescape/blob/main/docs/security.md                                                                                                                                                                                                                             |
| Trust model                            | https://github.com/PhiBao/noescape/blob/main/docs/trust-model.md                                                                                                                                                                                                                          |
| Community validation                   | https://github.com/PhiBao/noescape/blob/main/docs/validation.md                                                                                                                                                                                                                           |
| Diagram: who can read what             | https://github.com/PhiBao/noescape/blob/main/docs/diagrams/who-can-read-what.svg                                                                                                                                                                                                          |
| Diagram: one turn                      | https://github.com/PhiBao/noescape/blob/main/docs/diagrams/one-turn.svg                                                                                                                                                                                                                   |
| Responsive review screenshots          | https://github.com/PhiBao/noescape/tree/main/docs/screens/review                                                                                                                                                                                                                          |
| Forced failure-state screenshots       | https://github.com/PhiBao/noescape/tree/main/docs/screens/states                                                                                                                                                                                                                          |
| Full test command                      | `pnpm test` (CI runs lint + all non-e2e tests)                                                                                                                                                                                                                                            |
| Guest e2e                              | `PREVIEW_URL=<preview> pnpm -F web e2e`                                                                                                                                                                                                                                                   |

The only labelled item in the product is the featured case; it is real Sepolia data played through the production UI. All FHEVM mock usage is confined to Hardhat tests.
