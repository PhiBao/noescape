import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";

import "./tasks/spike";
import "./tasks/verify";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: vars.get("ETHERSCAN_API_KEY", ""),
  },
  sourcify: {
    enabled: true,
  },
  gasReporter: {
    currency: "USD",
    enabled: !!process.env.REPORT_GAS,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      accounts: vars.has("DEPLOYER_PRIVATE_KEY") ? [vars.get("DEPLOYER_PRIVATE_KEY")] : [],
      chainId: 11155111,
      url: vars.get("SEPOLIA_RPC_URL", ""),
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
