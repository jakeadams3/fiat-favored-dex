require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    // Add Base mainnet configuration
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453, // Base mainnet chain ID
      gasPrice: 1000000000 // 1 gwei
    }
  }
};