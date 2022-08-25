const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const EthCrypto = require("eth-crypto");
const { delay, toBigNum, fromBigNum } = require("./utils.js");

var ERC20ABI = artifacts.readArtifactSync("contracts/FakeUsdc.sol:IERC20").abi;
var pairContract;
var exchangeRouter;
var exchangeFactory;
let wBNB;

let token;
let distributor;

var owner;
var user1;
var user2;
var user3;
var liquidityReceiver;
var growthfundReceiver;

var isOnchain = false; //true: bsc testnet, false: hardhat net

var deployedAddress = {
  exchangeFactory: "0xb7926c0430afb07aa7defde6da862ae0bde767bc",
  wBNB: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
  exchangeRouter: "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
  token: "0xbeEA1e568B75C78611b9af840b68DFF605F853a1",
  distributor: "0x7F8CE1b5486F24cd4e5CB98e78d306cD71Ea337b",
};

describe("Create Account and wallet", () => {
  it("Create Wallet", async () => {
    [owner, user1, user2, user3, liquidityReceiver, growthfundReceiver] = await ethers.getSigners();

    console.log("owner", owner.address);
    console.log("user1", user1.address);
    console.log("user2", user2.address);
    console.log("user3", user3.address);
    console.log("liquidityReceiver", liquidityReceiver.address);
    console.log("growthfundReceiver", growthfundReceiver.address);

  });
});

describe("Contracts deploy", () => {
 // ------ dex deployment ------- //
  it("Factory deploy", async () => {
    const Factory = await ethers.getContractFactory("PancakeFactory");
    if (!isOnchain) {
      exchangeFactory = await Factory.deploy(owner.address);
      await exchangeFactory.deployed();
      console.log(await exchangeFactory.INIT_CODE_PAIR_HASH());
    } else {
      exchangeFactory = Factory.attach(deployedAddress.exchangeFactory);
    }
    console.log("Factory", exchangeFactory.address);
  });

  it("WBNB deploy", async () => {
    const WBNB_ = await ethers.getContractFactory("WBNB");
    if (!isOnchain) {
      wBNB = await WBNB_.deploy();
      await wBNB.deployed();
    } else {
      wBNB = WBNB_.attach(deployedAddress.wBNB);
    }
    console.log("WBNB", wBNB.address);
  });

  it("Router deploy", async () => {
    const Router = await ethers.getContractFactory("PancakeRouter");
    if (!isOnchain) {
      exchangeRouter = await Router.deploy(
        exchangeFactory.address,
        wBNB.address
      );
      await exchangeRouter.deployed();
    } else {
      exchangeRouter = Router.attach(deployedAddress.exchangeRouter);
    }
    console.log("Router", exchangeRouter.address);
  });

  it("Distributor deploy and set", async () => {
    Distributor = await ethers.getContractFactory("DividendDistributor");
    if (!isOnchain) {
      distributor = await upgrades.deployProxy(Distributor);
      await distributor.deployed();
    }
    else{
      distributor = Distributor.attach(deployedAddress.distributor);
    }
    console.log("distributor", distributor.address);
  });

  it("Token deploy and set", async () => {
    Token = await ethers.getContractFactory("Evoki");
    if (!isOnchain) {
      token = await upgrades.deployProxy(Token, [exchangeRouter.address, liquidityReceiver.address, growthfundReceiver.address, distributor.address]);
      await token.deployed();

      /* set token address in distributor contract */
      var tx = await distributor.setToken(token.address);
      await tx.wait();
    }
    else{
      token = Token.attach(deployedAddress.token);
    }
    console.log("token", token.address);
  });

});


/////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////


describe("test ", () => {
  it("check initial balances", async () => {
     await checkBNBBalance();
    await checkTokenBalance();
  });

  it("creat pool", async () => {
    if (!isOnchain) {
      var tx = await token.approve(
        exchangeRouter.address,
        toBigNum("26400000", 8)
      );
      await tx.wait();

      var tx = await exchangeRouter.addLiquidityETH(
        token.address,
        toBigNum("26400000", 8),
        0,
        0,
        owner.address,
        "1234325432314321",
        { value: ethers.utils.parseUnits("600", 18) }
      );
      await tx.wait();

      var tx = await token.setAutoRebase(true);
      await tx.wait();

      var pair = await exchangeFactory.getPair(wBNB.address, token.address);
      pairContract = new ethers.Contract(pair, ERC20ABI, owner);
      console.log("pair address", pairContract.address);

    }
  });

  it("check balances", async () => {
    // await checkBNBBalance();
    await checkTokenBalance();  
  });

  it("owner transfer 10000 token to user3", async () => {
    if(!isOnchain){
      var tx =await token.transfer(user3.address, toBigNum("10000", 8));
      await tx.wait();

      await checkTokenBalance();

      await network.provider.send("evm_increaseTime", [86400]);
      await network.provider.send("evm_mine");

    }
  });

  it("owner transfer 10000 token to user2, check rebase after a day", async () => {
    if(!isOnchain){
      var tx =await token.transfer(user2.address, toBigNum("10000", 8));
      await tx.wait();
      await checkTokenBalance();

      await network.provider.send("evm_increaseTime", [86400]);
      await network.provider.send("evm_mine");
    }
  });

  it("owner transfer 10000 token to user1, check rebase after a day", async () => {
    if(!isOnchain){
      var tx =await token.transfer(user1.address, toBigNum("10000", 8));
      await tx.wait();
      await checkTokenBalance();

      await network.provider.send("evm_increaseTime", [86400]);
      await network.provider.send("evm_mine");
    }
  });

  it("user2 sell 5000 Evoki", async () => {
    if(!isOnchain){
      var tx = await token.connect(user2).approve(exchangeRouter.address, toBigNum("5000", 8));
      await tx.wait();
      
      var tx = await exchangeRouter.connect(user2).swapExactTokensForETHSupportingFeeOnTransferTokens(
        toBigNum("5000", 8),
        0,
        [token.address, wBNB.address],
        user2.address,
        "124325454365443"
      );
      await tx.wait();

      await network.provider.send("evm_increaseTime", [86400]);
      await network.provider.send("evm_mine");
    }
  });

  it("check balances", async () => {
    await checkBNBBalance();
    await checkTokenBalance();
  });

  it("user2 buy with 10 BNB", async () => {
    if(!isOnchain){
      var tx = await exchangeRouter.connect(user2).swapExactETHForTokensSupportingFeeOnTransferTokens(
        0,
        [
          wBNB.address,
          token.address
        ],
        user2.address,
        "341443532432123",
        {value: ethers.utils.parseUnits("10", 18)}
      );
      await tx.wait();
    }
  });

  it("check balances", async () => {
    await checkBNBBalance();
    await checkTokenBalance();
    await checkFeeReceiversTokenBalance();
  });

  it("check claimable reflection rewards", async () => {
    await checkClaimableTokenBalance();
  });

  it("check share amount in distribution contract", async () => {
    await checkShareBalance();
  });

});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const checkBNBBalance = async () =>{
  console.log("owner wBNB balance", fromBigNum(await ethers.provider.getBalance(owner.address), 18));
  console.log("user1 wBNB balance", fromBigNum(await ethers.provider.getBalance(user1.address), 18));
  console.log("user2 wBNB balance", fromBigNum(await ethers.provider.getBalance(user2.address), 18));
  console.log("user3 wBNB balance", fromBigNum(await ethers.provider.getBalance(user3.address), 18));
}

const checkTokenBalance = async () =>{
  console.log("owner Evoki balance", fromBigNum(await token.balanceOf(owner.address), 8));
  console.log("user1 Evoki balance", fromBigNum(await token.balanceOf(user1.address), 8));
  console.log("user2 Evoki balance", fromBigNum(await token.balanceOf(user2.address), 8));
  console.log("user3 Evoki balance", fromBigNum(await token.balanceOf(user3.address), 8));
}

const checkFeeReceiversTokenBalance = async () =>{
  console.log("liquidityReceiver Evoki balance", fromBigNum(await token.balanceOf(liquidityReceiver.address), 8));
  console.log("growthfundReceiver Evoki balance", fromBigNum(await token.balanceOf(growthfundReceiver.address), 8));
  console.log("distributor contract Evoki balance", fromBigNum(await token.balanceOf(distributor.address), 8));
}

const checkClaimableTokenBalance = async () =>{
  console.log("user1 claimable Evoki balance", fromBigNum(await distributor.connect(user1).getUnpaidEarnings(user1.address), 8));
  console.log("user2 claimable Evoki balance", fromBigNum(await distributor.connect(user2).getUnpaidEarnings(user2.address), 8));
  console.log("user3 claimable Evoki balance", fromBigNum(await distributor.connect(user3).getUnpaidEarnings(user3.address), 8));
}

const checkShareBalance = async () =>{
  let user1ShareAmount = await distributor.shares(user1.address);
  console.log("user1 share amount", fromBigNum(user1ShareAmount.amount, 8));

  let user2ShareAmount = await distributor.shares(user2.address);
  console.log("user2 share amount", fromBigNum(user2ShareAmount.amount, 8));

  let user3ShareAmount = await distributor.shares(user3.address);
  console.log("user3 share amount", fromBigNum(user3ShareAmount.amount, 8));
}


