const { ethers, upgrades } = require("hardhat");
require("dotenv").config();


async function main() {
    const Evoki = await ethers.getContractFactory("Evoki");
    const evoki = await upgrades.deployProxy(Evoki,[0xb7926c0430afb07aa7defde6da862ae0bde767bc, 0x9820e62D07Ef2bc25147347ecfB111D95ba3A65f, 0x1CcCF75aFFcCC00845Ca689aADE55dF1Aa2132Bd]);
    await evoki.deployed();
    console.log("Evoki proxy deployed to:", evoki.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
