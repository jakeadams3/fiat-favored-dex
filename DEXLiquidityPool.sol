// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title DEXLiquidityPool
 * @dev A decentralized exchange liquidity pool with incentives for fiat deposits and disincentives for fiat withdrawals
 * This version supports native ETH directly instead of requiring WETH
 */
contract DEXLiquidityPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Stablecoin representing fiat (e.g., USDC, DAI)
    IERC20 public fiatToken;
    
    // Price feed for ETH/fiat exchange rate
    AggregatorV3Interface public priceFeed;
    
    // Fee and reward parameters (in basis points, 1 bp = 0.01%)
    uint256 public ethToFiatFeeRate = 50; // 0.5% fee
    uint256 public fiatToEthRewardRate = 30; // 0.3% reward
    
    // Developer wallet address that receives a portion of fees
    address public developerWallet = 0xEEFD3e2CF0c5b38B26a95C317DA3C23E10de5336;
    
    // Percentage of fee that goes to developer wallet (in basis points)
    uint256 public developerFeeShare = 1000; // 10% of the fee
    
    // Liquidity pool balances
    uint256 public fiatLiquidity;
    // Note: ETH liquidity is tracked by the contract's balance
    
    // Events
    event FiatToEthExchange(address indexed user, uint256 fiatAmount, uint256 ethAmount, uint256 reward);
    event EthToFiatExchange(address indexed user, uint256 ethAmount, uint256 fiatAmount, uint256 fee);
    event LiquidityAdded(address indexed provider, uint256 fiatAmount, uint256 ethAmount);
    event LiquidityRemoved(address indexed provider, uint256 fiatAmount, uint256 ethAmount);
    
    // Mapping to track liquidity provider contributions
    mapping(address => uint256) public fiatContributions;
    mapping(address => uint256) public ethContributions;
    
    /**
     * @dev Constructor to initialize the contract with tokens and price feed
     * @param _fiatToken Address of the stablecoin token contract
     * @param _priceFeed Address of the Chainlink price feed (ETH/USD)
     */
    constructor(address _fiatToken, address _priceFeed) {
        fiatToken = IERC20(_fiatToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
        _transferOwnership(msg.sender); // This properly sets the owner
    }
    
    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {}
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {}
    
    /**
     * @dev Get the latest price of ETH in fiat from Chainlink
     * @return The latest price with 8 decimals
     */
    function getLatestPrice() public view returns (int) {
        (
            /* uint80 roundID */,
            int price,
            /* uint startedAt */,
            /* uint timeStamp */,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();
        
        return price;
    }
    
    /**
     * @dev Converts fiat amount to ETH amount based on the current price
     * @param fiatAmount Amount of fiat to convert
     * @return Equivalent amount of ETH
     */
    function convertFiatToEth(uint256 fiatAmount) public view returns (uint256) {
        int256 price = getLatestPrice();
        require(price > 0, "Invalid price");
        
        // Price from Chainlink has 8 decimals, adjust accordingly
        uint256 priceUint = uint256(price);
        
        // Assume fiatToken has 6 decimals (like USDC) and ETH has 18 decimals
        // Convert to standardized units
        uint256 ethAmount = (fiatAmount * 10**18) / priceUint;
        
        return ethAmount;
    }
    
    /**
     * @dev Converts ETH amount to fiat amount based on the current price
     * @param ethAmount Amount of ETH to convert
     * @return Equivalent amount of fiat tokens
     */
    function convertEthToFiat(uint256 ethAmount) public view returns (uint256) {
        int256 price = getLatestPrice();
        require(price > 0, "Invalid price");
        
        // Price from Chainlink has 8 decimals, adjust accordingly
        uint256 priceUint = uint256(price);
        
        // Convert to fiat (assume 6 decimals like USDC)
        uint256 fiatAmount = (ethAmount * priceUint) / 10**18;
        
        return fiatAmount;
    }
    
    /**
     * @dev Adds liquidity to the pool
     * @param fiatAmount Amount of fiat tokens to add
     * ETH is sent directly with the transaction
     */
    function addLiquidity(uint256 fiatAmount) external payable nonReentrant {
        uint256 ethAmount = msg.value;
        require(fiatAmount > 0 || ethAmount > 0, "Must provide some liquidity");
        
        if (fiatAmount > 0) {
            fiatToken.safeTransferFrom(msg.sender, address(this), fiatAmount);
            fiatContributions[msg.sender] += fiatAmount;
            fiatLiquidity += fiatAmount;
        }
        
        if (ethAmount > 0) {
            ethContributions[msg.sender] += ethAmount;
        }
        
        emit LiquidityAdded(msg.sender, fiatAmount, ethAmount);
    }
    
    /**
     * @dev Removes liquidity from the pool
     * @param fiatAmount Amount of fiat tokens to remove
     * @param ethAmount Amount of ETH to remove
     */
    function removeLiquidity(uint256 fiatAmount, uint256 ethAmount) external nonReentrant {
        require(fiatAmount <= fiatContributions[msg.sender], "Insufficient fiat contribution");
        require(ethAmount <= ethContributions[msg.sender], "Insufficient ETH contribution");
        require(fiatAmount > 0 || ethAmount > 0, "Must remove some liquidity");
        require(ethAmount <= address(this).balance, "Insufficient ETH in contract");
        
        if (fiatAmount > 0) {
            fiatContributions[msg.sender] -= fiatAmount;
            fiatLiquidity -= fiatAmount;
            fiatToken.safeTransfer(msg.sender, fiatAmount);
        }
        
        if (ethAmount > 0) {
            ethContributions[msg.sender] -= ethAmount;
            (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
            require(success, "ETH transfer failed");
        }
        
        emit LiquidityRemoved(msg.sender, fiatAmount, ethAmount);
    }
    
    /**
     * @dev Exchange fiat for ETH with a reward
     * @param fiatAmount Amount of fiat to exchange
     * @return Amount of ETH received including reward
     */
    function exchangeFiatToEth(uint256 fiatAmount) external nonReentrant returns (uint256) {
        require(fiatAmount > 0, "Amount must be positive");
        require(fiatLiquidity + fiatAmount <= fiatToken.balanceOf(address(this)), "Exceeds available fiat");
        
        // Calculate base ETH amount
        uint256 ethAmount = convertFiatToEth(fiatAmount);
        
        // Calculate reward
        uint256 reward = (ethAmount * fiatToEthRewardRate) / 10000;
        uint256 totalEthAmount = ethAmount + reward;
        
        require(address(this).balance >= totalEthAmount, "Insufficient ETH liquidity");
        
        // Transfer fiat from user to contract
        fiatToken.safeTransferFrom(msg.sender, address(this), fiatAmount);
        fiatLiquidity += fiatAmount;
        
        // Transfer ETH (including reward) to user
        (bool success, ) = payable(msg.sender).call{value: totalEthAmount}("");
        require(success, "ETH transfer failed");
        
        emit FiatToEthExchange(msg.sender, fiatAmount, totalEthAmount, reward);
        
        return totalEthAmount;
    }
    
    /**
     * @dev Exchange ETH for fiat with a fee
     * @return Amount of fiat received after fee
     */
    function exchangeEthToFiat() external payable nonReentrant returns (uint256) {
        uint256 ethAmount = msg.value;
        require(ethAmount > 0, "Amount must be positive");
        
        // Calculate base fiat amount
        uint256 fiatAmount = convertEthToFiat(ethAmount);
        
        // Calculate fee
        uint256 fee = (ethAmount * ethToFiatFeeRate) / 10000;
        uint256 developerFee = (fee * developerFeeShare) / 10000;
        
        require(fiatLiquidity >= fiatAmount, "Insufficient fiat liquidity");
        
        // Transfer developer fee
        (bool devSuccess, ) = payable(developerWallet).call{value: developerFee}("");
        require(devSuccess, "Developer fee transfer failed");
        
        // Transfer fiat to user
        fiatLiquidity -= fiatAmount;
        fiatToken.safeTransfer(msg.sender, fiatAmount);
        
        emit EthToFiatExchange(msg.sender, ethAmount, fiatAmount, fee);
        
        return fiatAmount;
    }
    
    /**
     * @dev Update fee and reward rates
     * @param newEthToFiatFeeRate New fee rate for ETH to fiat exchanges (in basis points)
     * @param newFiatToEthRewardRate New reward rate for fiat to ETH exchanges (in basis points)
     * @param newDeveloperFeeShare New percentage of fee that goes to developer (in basis points)
     */
    function updateRates(
        uint256 newEthToFiatFeeRate,
        uint256 newFiatToEthRewardRate,
        uint256 newDeveloperFeeShare
    ) external onlyOwner {
        require(newEthToFiatFeeRate <= 1000, "Fee rate too high"); // Max 10%
        require(newFiatToEthRewardRate <= 1000, "Reward rate too high"); // Max 10%
        require(newDeveloperFeeShare <= 5000, "Developer fee share too high"); // Max 50%
        
        ethToFiatFeeRate = newEthToFiatFeeRate;
        fiatToEthRewardRate = newFiatToEthRewardRate;
        developerFeeShare = newDeveloperFeeShare;
    }
    
    /**
     * @dev Update developer wallet address
     * @param newDeveloperWallet New developer wallet address
     */
    function updateDeveloperWallet(address newDeveloperWallet) external onlyOwner {
        require(newDeveloperWallet != address(0), "Invalid address");
        developerWallet = newDeveloperWallet;
    }
    
    /**
     * @dev Get current liquidity pool information
     * @return Current fiat liquidity and ETH balance
     */
    function getPoolInfo() external view returns (uint256, uint256) {
        return (fiatLiquidity, address(this).balance);
    }
    
    /**
     * @dev Get user's liquidity contributions
     * @param user Address of the user
     * @return User's fiat and ETH contributions
     */
    function getUserContributions(address user) external view returns (uint256, uint256) {
        return (fiatContributions[user], ethContributions[user]);
    }
}