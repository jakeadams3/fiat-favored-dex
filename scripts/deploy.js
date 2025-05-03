const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Replace these with your actual token addresses
  const fiatTokenAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC or stable token address
  const priceFeedAddress = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"; // Chainlink ETH/USD price feed

  const DEXLiquidityPool = await ethers.getContractFactory("DEXLiquidityPool");
  const dex = await DEXLiquidityPool.deploy(
    fiatTokenAddress,
    priceFeedAddress
  );

  await dex.deployed();
  console.log("DEXLiquidityPool deployed to:", dex.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });