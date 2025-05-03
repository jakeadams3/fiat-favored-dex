// DEX App Front-end Logic
const DEX = {
    // Contract addresses
    contractAddress: '0xbb6AaADe88BFAc04b9B8B1E0CD42baE96782F11A',
    fiatTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    
    // Contract instances
    dexContract: null,
    fiatTokenContract: null,
    
    // Contract ABIs
    dexABI: [
        // Updated ABI for the ETH version of the contract
        {"inputs":[{"internalType":"uint256","name":"fiatAmount","type":"uint256"}],"name":"exchangeFiatToEth","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[],"name":"exchangeEthToFiat","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"fiatAmount","type":"uint256"}],"name":"addLiquidity","outputs":[],"stateMutability":"payable","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"fiatAmount","type":"uint256"},{"internalType":"uint256","name":"ethAmount","type":"uint256"}],"name":"removeLiquidity","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[],"name":"getPoolInfo","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserContributions","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"fiatAmount","type":"uint256"}],"name":"convertFiatToEth","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"ethAmount","type":"uint256"}],"name":"convertEthToFiat","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"getLatestPrice","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"fiatToEthRewardRate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"ethToFiatFeeRate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ],
    
    erc20ABI: [
        // Standard ERC20 functions needed for USDC
        {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
        // Add allowance method
        {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ],
    
    // User account
    account: null,
    
    // Initialize the application
    init: async function() {
        // Check if MetaMask is installed
        if (window.ethereum) {
            try {
                // Request account access
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                DEX.account = accounts[0];
                
                // Initialize Web3
                window.web3 = new Web3(window.ethereum);
                
                // Update connection status
                document.querySelector('.alert-info').textContent = 'Connected: ' + DEX.shortenAddress(DEX.account);
                document.querySelector('.alert-info').classList.remove('alert-info');
                document.querySelector('.alert').classList.add('alert-success');
                
                // Initialize contracts
                DEX.dexContract = new web3.eth.Contract(DEX.dexABI, DEX.contractAddress);
                DEX.fiatTokenContract = new web3.eth.Contract(DEX.erc20ABI, DEX.fiatTokenAddress);
                
                // Load initial data
                await DEX.loadContractData();
                
                // Add event listeners
                DEX.addEventListeners();
                
                // Setup input listeners for real-time calculations
                DEX.setupInputListeners();
                
                // Run diagnostic check
                await DEX.checkDexStatus();
                
                // Refresh data periodically
                setInterval(DEX.loadContractData, 30000); // Refresh every 30 seconds
                
            } catch (error) {
                console.error("User denied account access or error occurred:", error);
                document.querySelector('.alert-info').textContent = 'Error connecting wallet. Please try again.';
                document.querySelector('.alert-info').classList.remove('alert-info');
                document.querySelector('.alert').classList.add('alert-danger');
            }
        } else {
            console.error('MetaMask is not installed!');
            document.querySelector('.alert-info').textContent = 'Please install MetaMask to use this application.';
            document.querySelector('.alert-info').classList.remove('alert-info');
            document.querySelector('.alert').classList.add('alert-warning');
        }
    },
    
    // Helper function to shorten address
    shortenAddress: function(address) {
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    },
    
    // Check if allowance is sufficient
    checkAllowance: async function(owner, spender, amount) {
        try {
            const currentAllowance = await DEX.fiatTokenContract.methods.allowance(owner, spender).call();
            console.log("Current allowance:", Web3.utils.fromWei(currentAllowance, 'mwei'), "USDC");
            return BigInt(currentAllowance) >= BigInt(amount);
        } catch (error) {
            console.error("Error checking allowance:", error);
            return false;
        }
    },
    
    // Diagnostic function to check DEX status
    checkDexStatus: async function() {
        try {
            console.log("=== DEX STATUS CHECK ===");
            console.log("Connected account:", DEX.account);
            
            // Check chain ID
            const chainId = await web3.eth.getChainId();
            console.log("Current chain ID:", chainId);
            
            // Check contract existence
            const dexCode = await web3.eth.getCode(DEX.contractAddress);
            console.log("DEX contract code exists:", dexCode !== '0x' && dexCode !== '0x0');
            
            // Check USDC token
            const tokenSymbol = await DEX.fiatTokenContract.methods.symbol().call();
            const tokenDecimals = await DEX.fiatTokenContract.methods.decimals().call();
            console.log("Token symbol:", tokenSymbol);
            console.log("Token decimals:", tokenDecimals);
            
            // Check user USDC balance
            const userBalance = await DEX.fiatTokenContract.methods.balanceOf(DEX.account).call();
            console.log("User USDC balance:", Web3.utils.fromWei(userBalance, 'mwei'));
            
            // Check user allowance
            const userAllowance = await DEX.fiatTokenContract.methods.allowance(DEX.account, DEX.contractAddress).call();
            console.log("User USDC allowance for DEX:", Web3.utils.fromWei(userAllowance, 'mwei'));
            
            // Get pool info
            const poolInfo = await DEX.dexContract.methods.getPoolInfo().call();
            console.log("Pool USDC:", Web3.utils.fromWei(poolInfo[0], 'mwei'));
            console.log("Pool ETH:", Web3.utils.fromWei(poolInfo[1], 'ether'));
            
            // Check if contract can call sample view functions
            try {
                const fiatToEthRate = await DEX.dexContract.methods.fiatToEthRewardRate().call();
                console.log("Fiat to ETH reward rate:", fiatToEthRate);
            } catch (e) {
                console.error("Failed to call fiatToEthRewardRate:", e);
            }
            
            console.log("=== END STATUS CHECK ===");
            return true;
        } catch (error) {
            console.error("DEX status check failed:", error);
            return false;
        }
    },
    
    // Load data from the contract
    loadContractData: async function() {
        try {
            // Get pool info
            const poolInfo = await DEX.dexContract.methods.getPoolInfo().call();
            document.getElementById('fiatLiquidity').textContent = Web3.utils.fromWei(poolInfo[0], 'mwei'); // USDC has 6 decimals
            document.getElementById('cryptoLiquidity').textContent = Web3.utils.fromWei(poolInfo[1], 'ether');
            
            // Get latest price
            const price = await DEX.dexContract.methods.getLatestPrice().call();
            // Price in USDC per ETH (with 8 decimal precision from Chainlink)
            document.getElementById('exchangeRate').textContent = (price / 1e8).toFixed(2);
            
            // Get user contributions if connected
            if (DEX.account) {
                const userContributions = await DEX.dexContract.methods.getUserContributions(DEX.account).call();
                document.getElementById('userFiatContribution').textContent = Web3.utils.fromWei(userContributions[0], 'mwei');
                document.getElementById('userCryptoContribution').textContent = Web3.utils.fromWei(userContributions[1], 'ether');
            }
            
        } catch (error) {
            console.error("Error loading contract data:", error);
        }
    },
    
    // Add event listeners to forms
    addEventListeners: function() {
        // Fiat to ETH form
        document.getElementById('fiatToCryptoForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            const fiatAmount = document.getElementById('fiatAmount').value;
            
            if (!fiatAmount || parseFloat(fiatAmount) <= 0) {
                alert('Please enter a valid amount');
                return;
            }
            
            try {
                const fiatAmountWei = Web3.utils.toWei(fiatAmount, 'mwei'); // USDC has 6 decimals
                
                console.log("Starting fiat to ETH exchange...");
                console.log("USDC amount:", fiatAmount);
                
                // Check allowance first
                const hasAllowance = await DEX.checkAllowance(DEX.account, DEX.contractAddress, fiatAmountWei);
                
                if (!hasAllowance) {
                    console.log("Insufficient allowance, requesting approval...");
                    try {
                        // Use a higher allowance to avoid future approval transactions
                        const approvalAmount = BigInt(fiatAmountWei) * BigInt(10); // 10x the current amount for future use
                        const approvalTx = await DEX.fiatTokenContract.methods.approve(
                            DEX.contractAddress, 
                            approvalAmount.toString()
                        ).send({ 
                            from: DEX.account,
                            gas: 100000 // Explicitly set gas limit for approval
                        });
                        
                        console.log("Approval transaction successful:", approvalTx);
                    } catch (approvalError) {
                        console.error("Approval transaction failed:", approvalError);
                        alert('USDC approval failed: ' + (approvalError.message || 'Unknown error'));
                        return;
                    }
                } else {
                    console.log("Sufficient allowance exists");
                }
                
                // Then exchange USDC for ETH
                console.log("Exchanging USDC for ETH...");
                
                // Get gas estimate for the transaction
                const exchangeMethod = DEX.dexContract.methods.exchangeFiatToEth(fiatAmountWei);
                const gasEstimate = await exchangeMethod.estimateGas({ from: DEX.account }).catch(error => {
                    console.error("Gas estimation failed:", error);
                    return 300000; // Default gas limit if estimation fails
                });
                
                console.log("Estimated gas for exchange:", gasEstimate);
                
                // Execute with higher gas limit
                const receipt = await exchangeMethod.send({ 
                    from: DEX.account,
                    gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
                });
                
                console.log("Exchange transaction receipt:", receipt);
                
                if (receipt.status) {
                    alert('Exchange successful!');
                    
                    // Reload contract data
                    await DEX.loadContractData();
                    
                    // Reset form
                    document.getElementById('fiatAmount').value = '';
                    document.getElementById('cryptoOutput').textContent = '0';
                } else {
                    alert('Exchange transaction failed. Please check console for details.');
                }
                
            } catch (error) {
                console.error("Error exchanging fiat to ETH:", error);
                alert('Error exchanging: ' + (error.message || 'See console for details.'));
            }
        });
        
        // ETH to Fiat form
        document.getElementById('cryptoToFiatForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            const ethAmount = document.getElementById('cryptoAmount').value;
            
            if (!ethAmount || parseFloat(ethAmount) <= 0) {
                alert('Please enter a valid amount');
                return;
            }
            
            try {
                const ethAmountWei = Web3.utils.toWei(ethAmount, 'ether');
                
                console.log("Starting ETH to fiat exchange...");
                console.log("ETH amount:", ethAmount);
                
                // Estimate gas
                const exchangeMethod = DEX.dexContract.methods.exchangeEthToFiat();
                const gasEstimate = await exchangeMethod.estimateGas({ 
                    from: DEX.account, 
                    value: ethAmountWei 
                }).catch(error => {
                    console.error("Gas estimation failed:", error);
                    return 300000; // Default gas limit
                });
                
                console.log("Estimated gas for exchange:", gasEstimate);
                
                // For native ETH, we need to send ETH with the transaction
                const receipt = await exchangeMethod.send({ 
                    from: DEX.account, 
                    value: ethAmountWei,
                    gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
                });
                
                console.log("Exchange transaction receipt:", receipt);
                
                if (receipt.status) {
                    alert('Exchange successful!');
                    
                    // Reload contract data
                    await DEX.loadContractData();
                    
                    // Reset form
                    document.getElementById('cryptoAmount').value = '';
                    document.getElementById('fiatOutput').textContent = '0';
                    document.getElementById('feeAmount').textContent = '0';
                } else {
                    alert('Exchange transaction failed. Please check console for details.');
                }
                
            } catch (error) {
                console.error("Error exchanging ETH to fiat:", error);
                alert('Error exchanging: ' + (error.message || 'See console for details.'));
            }
        });
        
        // Add Liquidity form
        document.getElementById('addLiquidityForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            const fiatAmount = document.getElementById('liquidityFiatAmount').value;
            const ethAmount = document.getElementById('liquidityCryptoAmount').value;
            
            if ((!fiatAmount || parseFloat(fiatAmount) <= 0) && (!ethAmount || parseFloat(ethAmount) <= 0)) {
                alert('Please enter at least one valid amount');
                return;
            }
            
            try {
                const fiatAmountWei = fiatAmount ? Web3.utils.toWei(fiatAmount, 'mwei') : '0';
                const ethAmountWei = ethAmount ? Web3.utils.toWei(ethAmount, 'ether') : '0';
                
                console.log("Starting liquidity addition process...");
                console.log("USDC amount:", fiatAmount, "ETH amount:", ethAmount);
                console.log("Contract address:", DEX.contractAddress);
                
                // Verify that contract addresses are valid
                if (!web3.utils.isAddress(DEX.contractAddress)) {
                    throw new Error("Invalid DEX contract address");
                }
                if (!web3.utils.isAddress(DEX.fiatTokenAddress)) {
                    throw new Error("Invalid USDC token address");
                }
                
                // Validate contract interfaces
                try {
                    const contractCode = await web3.eth.getCode(DEX.contractAddress);
                    if (contractCode === '0x' || contractCode === '0x0') {
                        throw new Error("DEX contract has no code at address - possible wrong network");
                    }
                    console.log("DEX contract exists at specified address");
                } catch (error) {
                    console.error("Contract validation error:", error);
                    alert('Contract validation failed. Make sure you are on the correct network.');
                    return;
                }
                
                // First, check if USDC approval is needed
                if (parseFloat(fiatAmount) > 0) {
                    console.log("USDC amount > 0, checking allowance...");
                    try {
                        const allowance = await DEX.fiatTokenContract.methods.allowance(DEX.account, DEX.contractAddress).call();
                        console.log("Current allowance:", allowance);
                        
                        if (BigInt(allowance) < BigInt(fiatAmountWei)) {
                            console.log("Insufficient allowance, requesting approval...");
                            
                            try {
                                // Use a higher allowance to avoid future approval transactions
                                const approvalAmount = BigInt(fiatAmountWei) * BigInt(10); // 10x the current amount
                                const approvalTx = await DEX.fiatTokenContract.methods.approve(
                                    DEX.contractAddress, 
                                    approvalAmount.toString()
                                ).send({ 
                                    from: DEX.account,
                                    gas: 100000 // Explicitly set gas limit for approval
                                });
                                
                                console.log("Approval transaction successful:", approvalTx);
                                
                                // Verify allowance was updated
                                const newAllowance = await DEX.fiatTokenContract.methods.allowance(DEX.account, DEX.contractAddress).call();
                                console.log("Updated allowance:", newAllowance);
                                
                                if (BigInt(newAllowance) < BigInt(fiatAmountWei)) {
                                    throw new Error("Allowance was not increased enough after approval");
                                }
                            } catch (approvalError) {
                                console.error("Approval transaction failed:", approvalError);
                                alert('USDC approval failed: ' + (approvalError.message || 'Unknown error'));
                                return;
                            }
                        } else {
                            console.log("Sufficient allowance exists");
                        }
                        
                        // Verify USDC balance
                        const usdcBalance = await DEX.fiatTokenContract.methods.balanceOf(DEX.account).call();
                        console.log("USDC balance:", Web3.utils.fromWei(usdcBalance, 'mwei'));
                        
                        if (BigInt(usdcBalance) < BigInt(fiatAmountWei)) {
                            throw new Error("Insufficient USDC balance");
                        }
                    } catch (error) {
                        console.error("Error during allowance/balance check:", error);
                        alert('Error checking USDC allowance or balance: ' + (error.message || 'Unknown error'));
                        return;
                    }
                }
                
                // Now attempt to add liquidity with explicit gas settings
                console.log("Adding liquidity with parameters:", {
                    fiatAmount: fiatAmountWei,
                    ethValue: ethAmountWei
                });
                
                try {
                    // Create the contract method call
                    const addLiquidityMethod = DEX.dexContract.methods.addLiquidity(fiatAmountWei);
                    
                    // Estimate gas for the transaction
                    const gasEstimate = await addLiquidityMethod.estimateGas({ 
                        from: DEX.account,
                        value: ethAmountWei 
                    }).catch(error => {
                        console.error("Gas estimation failed:", error);
                        // Default gas limit if estimation fails
                        return 300000;
                    });
                    
                    console.log("Estimated gas for addLiquidity:", gasEstimate);
                    
                    // Execute with slightly higher gas limit
                    const receipt = await addLiquidityMethod.send({ 
                        from: DEX.account,
                        value: ethAmountWei,
                        gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer to gas estimate
                    });
                    
                    console.log("Transaction receipt:", receipt);
                    
                    // Check transaction events
                    if (receipt.events && receipt.events.LiquidityAdded) {
                        console.log("LiquidityAdded event found:", receipt.events.LiquidityAdded);
                        alert('Liquidity added successfully!');
                    } else {
                        console.warn("Transaction completed but no LiquidityAdded event found");
                        
                        // Verify if liquidity was actually added despite missing event
                        const updatedPoolInfo = await DEX.dexContract.methods.getPoolInfo().call();
                        const updatedUserContributions = await DEX.dexContract.methods.getUserContributions(DEX.account).call();
                        
                        console.log("Updated pool info:", updatedPoolInfo);
                        console.log("Updated user contributions:", updatedUserContributions);
                        
                        alert('Transaction completed. Please check your balances and pool status.');
                    }
                    
                    // Reload contract data
                    await DEX.loadContractData();
                    
                    // Reset form
                    document.getElementById('liquidityFiatAmount').value = '';
                    document.getElementById('liquidityCryptoAmount').value = '';
                } catch (addLiquidityError) {
                    console.error("addLiquidity transaction failed:", addLiquidityError);
                    alert('Failed to add liquidity: ' + (addLiquidityError.message || 'Unknown error'));
                }
                
            } catch (error) {
                console.error("General error:", error);
                alert('Error: ' + (error.message || 'Unknown error'));
            }
        });
        
        // Remove Liquidity form
        document.getElementById('removeLiquidityForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            const fiatAmount = document.getElementById('withdrawFiatAmount').value;
            const ethAmount = document.getElementById('withdrawCryptoAmount').value;
            
            if ((!fiatAmount || parseFloat(fiatAmount) <= 0) && (!ethAmount || parseFloat(ethAmount) <= 0)) {
                alert('Please enter at least one valid amount');
                return;
            }
            
            try {
                const fiatAmountWei = fiatAmount ? Web3.utils.toWei(fiatAmount, 'mwei') : '0';
                const ethAmountWei = ethAmount ? Web3.utils.toWei(ethAmount, 'ether') : '0';
                
                console.log("Starting liquidity removal process...");
                console.log("USDC amount:", fiatAmount, "ETH amount:", ethAmount);
                
                // Create the contract method call
                const removeLiquidityMethod = DEX.dexContract.methods.removeLiquidity(fiatAmountWei, ethAmountWei);
                
                // Estimate gas for the transaction
                const gasEstimate = await removeLiquidityMethod.estimateGas({ 
                    from: DEX.account
                }).catch(error => {
                    console.error("Gas estimation failed:", error);
                    return 300000; // Default gas limit if estimation fails
                });
                
                console.log("Estimated gas for removeLiquidity:", gasEstimate);
                
                // Remove liquidity with explicit gas limit
                const receipt = await removeLiquidityMethod.send({ 
                    from: DEX.account,
                    gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
                });
                
                console.log("Transaction receipt:", receipt);
                
                if (receipt.status) {
                    alert('Liquidity removed successfully!');
                    
                    // Reload contract data
                    await DEX.loadContractData();
                    
                    // Reset form
                    document.getElementById('withdrawFiatAmount').value = '';
                    document.getElementById('withdrawCryptoAmount').value = '';
                } else {
                    alert('Failed to remove liquidity. Please check console for details.');
                }
                
            } catch (error) {
                console.error("Error removing liquidity:", error);
                alert('Error removing liquidity: ' + (error.message || 'Unknown error'));
            }
        });
    },
    
    // Setup input listeners for real-time calculations
    setupInputListeners: function() {
        // Fiat to ETH calculation
        document.getElementById('fiatAmount').addEventListener('input', async function() {
            const fiatAmount = this.value;
            
            if (!fiatAmount || parseFloat(fiatAmount) <= 0) {
                document.getElementById('cryptoOutput').textContent = '0';
                return;
            }
            
            try {
                const fiatAmountWei = Web3.utils.toWei(fiatAmount, 'mwei');
                // Get base ETH amount
                const ethAmount = await DEX.dexContract.methods.convertFiatToEth(fiatAmountWei).call();
                // Get reward rate
                const rewardRate = await DEX.dexContract.methods.fiatToEthRewardRate().call();
                // Calculate reward
                const reward = (BigInt(ethAmount) * BigInt(rewardRate)) / BigInt(10000);
                const totalEthAmount = BigInt(ethAmount) + BigInt(reward);
                
                document.getElementById('cryptoOutput').textContent = parseFloat(Web3.utils.fromWei(totalEthAmount.toString(), 'ether')).toFixed(8);
                
            } catch (error) {
                console.error("Error calculating ETH output:", error);
            }
        });
        
        // ETH to Fiat calculation
        document.getElementById('cryptoAmount').addEventListener('input', async function() {
            const ethAmount = this.value;
            
            if (!ethAmount || parseFloat(ethAmount) <= 0) {
                document.getElementById('fiatOutput').textContent = '0';
                document.getElementById('feeAmount').textContent = '0';
                return;
            }
            
            try {
                const ethAmountWei = Web3.utils.toWei(ethAmount, 'ether');
                // Get fiat amount
                const fiatAmount = await DEX.dexContract.methods.convertEthToFiat(ethAmountWei).call();
                // Get fee rate
                const feeRate = await DEX.dexContract.methods.ethToFiatFeeRate().call();
                // Calculate fee
                const fee = (BigInt(ethAmountWei) * BigInt(feeRate)) / BigInt(10000);
                
                document.getElementById('fiatOutput').textContent = parseFloat(Web3.utils.fromWei(fiatAmount, 'mwei')).toFixed(2);
                document.getElementById('feeAmount').textContent = parseFloat(Web3.utils.fromWei(fee.toString(), 'ether')).toFixed(8);
                
            } catch (error) {
                console.error("Error calculating fiat output:", error);
            }
        });
    }
};

// Initialize the application when the page loads
window.addEventListener('load', DEX.init);