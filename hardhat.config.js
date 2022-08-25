require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
// require('@openzeppelin/hardhat-defender');
require("@openzeppelin/hardhat-upgrades");
require("hardhat-interface-generator");
require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 const accounts = process.env.PRIVATE_KEY
 ? [
     process.env.PRIVATE_KEY,
     process.env.PRIVATE_KEY1,
     process.env.PRIVATE_KEY2,
     process.env.PRIVATE_KEY3,
     process.env.PRIVATE_KEY4,
     process.env.PRIVATE_KEY5,
     process.env.PRIVATE_KEY6
   ]
 : [];

module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.4",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.8.2",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.6.12",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.6.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.6.0",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.4.18",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        rinkeby: {
            url: process.env.RINKEBY_RPC_URL || '',
            accounts: accounts,
            gasMultiplier: 3,
            timeout: 600000,
            addressBook: process.env.RINKEBY_ADDRESS_BOOK || '',
        },
        bsctestnet: {
            url: process.env.BSC_TESTNET_RPC_URL || '',
            accounts: accounts,
            gasMultiplier: 3,
            timeout: 60000,
        },
        bsc: {
            url: process.env.BSC_RPC_URL || '',
            accounts: accounts,
            gasMultiplier: 5,
            timeout: 60000,
        },
    },
    etherscan: {
        apiKey: {
            rinkeby: process.env.ETHERSCAN_API_KEY,
            bsc: process.env.BSCSCAN_API_KEY,
            bscTestnet: process.env.BSCSCAN_API_KEY,
        },
    },
    gasReporter: {
        enabled: true,
        currency: 'USD',
        gasPrice: 21,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY || '',
    },
    // defender: {
    //     apiKey: process.env.DEFENDER_API_KEY || '',
    //     apiSecret: process.env.DEFENDER_API_SECRET || '',
    // },
};
