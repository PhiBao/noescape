export const contractAddresses = {
  11155111: {
    GasTap: {
      address: "0xBEE30A5CD444992887cCFb98D7B1d2832bA15aeb",
      deployBlock: 12202836,
      txHash: "0xf8aae8acf825a1114b2366ea0c1bff383b9df6ca316398836a572558dca5e5b3",
    },
    CaseRules: {
      address: "0xE7414B17E561a4eB82e8Fc57F91D1EdFA0302631",
      deployBlock: 12202837,
      txHash: "0xb3749ff2c1521950d0e183e7e631aa0fc294ae702107669b5de00d6965547be2",
    },
    NoEscapeCase: {
      address: "0xaEAd151329AA54B6cce184ac26a4D9c0577b05cF",
      deployBlock: 12202838,
      txHash: "0x845537534ac40f1baf0c5e79d1615e3a4a475ed95e71aea2f24f906406c3c103",
    },
  },
} as const;

export const sepoliaAddresses = contractAddresses[11155111];
