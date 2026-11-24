import type { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre) => {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const rules = await deploy("CaseRules", { from: deployer });
  await deploy("NoEscapeCase", {
    from: deployer,
    libraries: { CaseRules: rules.address },
  });
};

func.tags = ["case"];
func.dependencies = ["01_gastap"];
func.id = "02_case";
export default func;
