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
      address: "0x0Ef4b145f8123356478aBB67C1429eDd4D9F65DA",
      deployBlock: 12204705,
      txHash: "0xfd58defdfac5fe4955bba860b44cdd4f1121271e13885b7369fede07c0154718",
    },
    CaseRulesMostWanted: {
      address: "0xb9fBf0953397311f91c6C0A1fb15fcfABC321ba4",
      deployBlock: 12208147,
      txHash: "0xc5a73b83a8cf3f006886c71442705207349ad769a6091a294001ba7f37b755e1",
    },
    MostWanted: {
      address: "0x31606A8123D2e47450A06D94694A51AD7A20EfBD",
      deployBlock: 12208148,
      txHash: "0xe4cfb0d62f5bc20c00ce2ea2b0aff2a41b1aa7f81ad8a9fbbe27a584b61a240f",
    },
  },
} as const;

export const sepoliaAddresses = contractAddresses[11155111];
