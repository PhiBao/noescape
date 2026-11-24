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
