# Decentralized Crypto-Fiat Exchange

A fully decentralized and autonomous exchange system that facilitates crypto-to-fiat and fiat-to-crypto trading with incentive mechanisms to maintain liquidity.

## Key Features

- **Incentivized Fiat Deposits**: Users who exchange fiat for crypto receive a small reward (more crypto than the equal value of the fiat they're depositing)
- **Disincentivized Fiat Withdrawals**: Users who exchange crypto for fiat pay a small fee, which helps fund the rewards for fiat depositors
- **Developer Fee**: A small percentage of the crypto-to-fiat exchange fees is directed to the developer wallet
- **Liquidity Provision**: Users can add both fiat and crypto to the liquidity pool and withdraw their contributions later
- **Fully Decentralized**: All operations are handled by smart contracts on the blockchain

## Smart Contract Architecture

The main smart contract (`DEXLiquidityPool.sol`) manages the following:

- Liquidity pool for both fiat and crypto assets
- Exchange rates using Chainlink price feeds
- Fee and reward calculations
- Developer fee distribution
- Liquidity provider tracking

## How It Works

1. **Fiat to Crypto Exchange**:
   - User deposits fiat tokens (e.g., USDC)
   - System calculates the equivalent crypto amount + reward
   - User receives crypto tokens plus the reward

2. **Crypto to Fiat Exchange**:
   - User deposits crypto tokens (e.g., ETH)
   - System calculates the equivalent fiat amount
   - A fee is deducted from the crypto amount
   - A portion of the fee goes to the developer wallet
   - User receives fiat tokens

3. **Liquidity Provision**:
   - Users can add liquidity to the pool in the form of fiat, crypto, or both
   - Their contributions are tracked
   - They can withdraw their contributions at any time

## Frontend Integration

The system includes a user-friendly frontend that allows users to:

- View current liquidity pool status
- Exchange fiat for crypto (with reward)
- Exchange crypto for fiat (with fee)
- Add liquidity to the pool
- Remove liquidity from the pool

## Deployment Instructions

1. **Deploy Smart Contract**:
   - Deploy `DEXLiquidityPool.sol` with the following parameters:
     - Fiat token address (e.g., USDC contract address)
     - Crypto token address (e.g., WETH contract address)
     - Chainlink price feed address for the crypto/fiat pair

2. **Configure Frontend**:
   - Update the contract addresses in `app.js`:
     - `DEX.contractAddress`: Address of the deployed DEXLiquidityPool contract
     - `DEX.fiatTokenAddress`: Address of the fiat token contract
     - `DEX.cryptoTokenAddress`: Address of the crypto token contract

3. **Host Frontend**:
   - Host the HTML, CSS, and JS files on a web server
   - Users can now interact with the DEX through the frontend

## Security Considerations

- The contract uses OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks
- The contract uses OpenZeppelin's SafeERC20 for safe token transfers
- Only the contract owner can update fee and reward rates
- Fee and reward rates are capped to prevent abuse

## Fees and Rewards

- Current crypto-to-fiat fee: 0.5%
- Current fiat-to-crypto reward: 0.3%
- Developer fee: 10% of the crypto-to-fiat fee

## Developer

Developer wallet address: 0xeefd3e2cf0c5b38b26a95c317da3c23e10de5336