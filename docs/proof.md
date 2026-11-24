# noescape — Sepolia proof

Network: Ethereum Sepolia (`11155111`)  
Deployer: `0xDbFe5c4d0256D2459bB216caB905999Ca41bE349`

## Solo contracts

| Contract     | Address                                                                                                                         | Deploy block | Deploy transaction                                                                                                  | Verified source                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GasTap       | [`0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb`](https://sepolia.etherscan.io/address/0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb) |   12,202,836 | [`0xf8aae8ac…`](https://sepolia.etherscan.io/tx/0xf8aae8acf825a1114b2366ea0c1bff383b9df6ca316398836a572558dca5e5b3) | [Etherscan](https://sepolia.etherscan.io/address/0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb#code) |
| CaseRules    | [`0xE7414B17E561a4eB82e8Fc57F91D1EdFA0302631`](https://sepolia.etherscan.io/address/0xE7414B17E561a4eB82e8Fc57F91D1EdFA0302631) |   12,202,837 | [`0xb3749ff2…`](https://sepolia.etherscan.io/tx/0xb3749ff2c1521950d0e183e7e631aa0fc294ae702107669b5de00d6965547be2) | [Etherscan](https://sepolia.etherscan.io/address/0xE7414B17E561a4eB82e8Fc57F91D1EdFA0302631#code) |
| NoEscapeCase | [`0xaEAd151329AA54B6cce184ac26a4D9c0577b05cF`](https://sepolia.etherscan.io/address/0xaEAd151329AA54B6cce184ac26a4D9c0577b05cF) |   12,202,838 | [`0x84553753…`](https://sepolia.etherscan.io/tx/0x845537534ac40f1baf0c5e79d1615e3a4a475ed95e71aea2f24f906406c3c103) | [Etherscan](https://sepolia.etherscan.io/address/0xaEAd151329AA54B6cce184ac26a4D9c0577b05cF#code) |

GasTap starts with a provisional 0.005 ETH drip and a 0.25 ETH daily cap. T13 sets the final drip from measured full-case gas.

## Spike harness

The T06/T07 test harness is [`0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77`](https://sepolia.etherscan.io/address/0x57AF7934A2f3bE503eF7b3c9A0CED26D95205F77). It is test-only and is not part of the product contracts.

## Solo case #1

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
