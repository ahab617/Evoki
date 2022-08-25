const { ethers } = require("hardhat");

async function main ()  {

    var exchangeRouter;
    var exchangeFactory;
    var safuu;
    var wBNB;

    //deploy factory contract for test
    var [owner] = await  ethers.getSigners();

    const Factory = await ethers.getContractFactory("PancakeFactory");
    
    exchangeFactory = await Factory.deploy(owner.address);
    await exchangeFactory.deployed();

    console.log(await exchangeFactory.INIT_CODE_PAIR_HASH());

    console.log("exchange factory", exchangeFactory.address);

    //deploy wBNB contract for test

    const WBNB = await ethers.getContractFactory("WBNB");
    wBNB = await WBNB.deploy();
    await wBNB.deployed();

    console.log("wBNB", wBNB.address);

    //deploy router contract for test

    const Router = await ethers.getContractFactory("PancakeRouter");
    exchangeRouter = await Router.deploy(
        exchangeFactory.address,
        wBNB.address
    );
    await exchangeRouter.deployed();
    console.log("exchange router",exchangeRouter.address);

    // deploy safuu contract for test

    const Safuu = await ethers.getContractFactory("Safuu");
    safuu = await Safuu.deploy(exchangeRouter.address);
    await safuu.deployed();

    console.log("safuu token", safuu.address);

    //initial setting 

    {
        //approve
        var tx = await safuu.approve(
            exchangeRouter.address,
            ethers.utils.parseUnits("100000", 2)
        );
        await tx.wait();

        console.log("approve success");
    
        //add liquidity
        tx = await exchangeRouter.addLiquidityETH(
            safuu.address,
            ethers.utils.parseUnits("50000", 2),
            0,
            0,
            owner.address,
            "111111111111111111111",
            { value: ethers.utils.parseUnits("0.1", 18) }
        );
        await tx.wait();
    }
}

main()
    .then(() => {
        console.log("complete");
    })
    .catch((error) => {
        console.log(error);
        process.exit(1);
    });