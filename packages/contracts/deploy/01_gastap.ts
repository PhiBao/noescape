import { parseEther } from "ethers";
import type { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre) => {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  await deploy("GasTap", {
    from: deployer,
    args: [deployer, deployer, parseEther("0.005"), parseEther("0.25")],
  });
};

func.tags = ["gastap"];
func.id = "01_gastap";
export default func;
