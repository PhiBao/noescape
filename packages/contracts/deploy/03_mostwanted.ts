import type { DeployFunction } from "hardhat-deploy/types";

const TOKEN_ADDRESS = "0x4E7B06D78965594eB5EF5414c357ca21E1554491";
const FEE_TOKENS = 5n;

const func: DeployFunction = async (hre) => {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const balance = await hre.ethers.provider.getBalance(deployer);
  if (balance < hre.ethers.parseEther("0.05")) {
    throw new Error(`deployer balance ${hre.ethers.formatEther(balance)} ETH is below 0.05 ETH`);
  }
  const token = await hre.ethers.getContractAt(
    ["function decimals() view returns (uint8)"],
    TOKEN_ADDRESS,
  );
  const fee = FEE_TOKENS * 10n ** (await token.decimals());
  const rules = await deploy("CaseRulesMostWanted", { from: deployer, contract: "CaseRules" });
  await deploy("MostWanted", {
    from: deployer,
    args: [TOKEN_ADDRESS, fee],
    libraries: { CaseRules: rules.address },
  });
};

func.tags = ["mostwanted"];
func.id = "03_mostwanted";
export default func;
