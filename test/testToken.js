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

var owner;
var treasury;
var user1;
var user2;
var liquidityReceiver;
var growthfundReceiver;

var isOnchain = true; //true: bsc testnet, false: hardhat net

var deployedAddress = {
  exchangeFactory: "0xb7926c0430afb07aa7defde6da862ae0bde767bc",
  wBNB: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
  exchangeRouter: "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
  token: "0xffe9CB038F971992cbAb528a07DEd7640B1148f0",
};

/**
 owner 0x5a0f19cE6eE22De387BF4ff308ecF091A91C3a5E
  user1 0xCF020c184602073Fe0E0b242F96389267F283adE
  user2 0x882Cc95439b8129526805f5438494BeFacDa21d9
  treasury 0x1429c316c52B9535483236726629412B746C1afF
  liquidityReceiver 0x9820e62D07Ef2bc25147347ecfB111D95ba3A65f
  growthfundReceiver 0x1CcCF75aFFcCC00845Ca689aADE55dF1Aa2132Bd

  pair: 0x29483E20b03C7464805F4cCc9418Ca30a32C3026
 */
describe("Create Account and wallet", () => {
  it("Create Wallet", async () => {
    [owner, user1, user2, treasury, liquidityReceiver, growthfundReceiver] = await ethers.getSigners();

    console.log("owner", owner.address);
    console.log("user1", user1.address);
    console.log("user2", user2.address);
    console.log("treasury", treasury.address);
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

  it("Token deploy and set", async () => {
    Token = await ethers.getContractFactory("Evoki");
    if (!isOnchain) {
      token = await upgrades.deployProxy(Token, [exchangeRouter.address, treasury.address, liquidityReceiver.address, growthfundReceiver.address]);
      await token.deployed();
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
  // it("check initial balances", async () => {
  //   //  await checkBNBBalance();
  //   await checkTokenBalance();
  // });

  it("creat pool, check users token balance and Fee receivers token balance", async () => {
    if (!isOnchain) {
      var tx = await token.connect(treasury).approve(
        exchangeRouter.address,
        toBigNum("264000", 8)
      );
      await tx.wait();

      var tx = await exchangeRouter.connect(treasury).addLiquidityETH(
        token.address,
        toBigNum("264000", 8),
        0,
        0,
        treasury.address,
        "1234325432314321",
        { value: ethers.utils.parseUnits("0.6", 18) }
      );
      await tx.wait();

      var tx = await token.setAutoRebase(true);
      await tx.wait();

      // await checkTokenBalance();  
      // await checkFeeReceiversTokenBalance();

      // await network.provider.send("evm_increaseTime", [86400]);
      // await network.provider.send("evm_mine");

      var pair = await exchangeFactory.getPair(wBNB.address, token.address);
      pairContract = new ethers.Contract(pair, ERC20ABI, owner);
      console.log("pair address", pairContract.address);

    }
  });

  it("treasury transfer 10000 token to user1, check rebase after a day", async () => {
    if(!isOnchain){
      var tx =await token.connect(treasury).transfer(user1.address, toBigNum("10000", 8));
      await tx.wait();
      await checkTokenBalance();

      // await network.provider.send("evm_increaseTime", [86400]);
      // await network.provider.send("evm_mine");
    }
  });

  it("treasury transfer 10000 token to user2, check rebase after a day", async () => {
    if(!isOnchain){
      var tx =await token.connect(treasury).transfer(user2.address, toBigNum("10000", 8));
      await tx.wait();
      await checkTokenBalance();
    }
  });

  it("user2 sell 10000 Evoki", async () => {
    if(!isOnchain){

      var tx = await token.connect(user2).approve(exchangeRouter.address, toBigNum("10000", 8));
      await tx.wait();
      
      var tx = await exchangeRouter.connect(user2).swapExactTokensForETHSupportingFeeOnTransferTokens(
        toBigNum("10000", 8),
        0,
        [token.address, wBNB.address],
        user2.address,
        "124325454365443"
      );
      await tx.wait();
      await checkTokenBalance();
      await checkFeeReceiversTokenBalance();


      // await network.provider.send("evm_increaseTime", [600]);
      // await network.provider.send("evm_mine");
    }
  });

  it("user1 transfer all token to user2 after 10 min to check burn", async () => {
    if(!isOnchain){
      var tx =await token.connect(user1).transfer(user2.address, token.balanceOf(user1.address));
      await tx.wait();
      await checkTokenBalance();

      // await network.provider.send("evm_increaseTime", [600]);
      // await network.provider.send("evm_mine");
    }
  });

  it("user2 buy with 0.05 BNB", async () => {
    if(!isOnchain){
      var tx = await exchangeRouter.connect(user2).swapExactETHForTokensSupportingFeeOnTransferTokens(
        0,
        [
          wBNB.address,
          token.address
        ],
        user2.address,
        "341443532432123",
        {value: ethers.utils.parseUnits("0.05", 18)}
      );
      await tx.wait();

      await checkTokenBalance();
      await checkFeeReceiversTokenBalance();

      // await network.provider.send("evm_increaseTime", [600]);
      // await network.provider.send("evm_mine");
    }
  });

  it("user2 sell 30133  Evoki", async () => {
    if(!isOnchain){
      var tx = await token.connect(user2).approve(exchangeRouter.address, toBigNum("30133", 8));
      await tx.wait();
      
      var tx = await exchangeRouter.connect(user2).swapExactTokensForETHSupportingFeeOnTransferTokens(
        toBigNum("30133", 8),
        0,
        [token.address, wBNB.address],
        user2.address,
        "124325454365443"
      );
      await tx.wait();
      await checkTokenBalance();
      await checkFeeReceiversTokenBalance();
      await checkBurnAmount();
      await checkTotalReflectionAmount();
      await checkLPBalance();

      // await network.provider.send("evm_increaseTime", [600]);
      // await network.provider.send("evm_mine");
    }
  });

  it("user2 transfer 906  token to user1", async () => {
    if(!isOnchain){
      var tx =await token.connect(user2).transfer(user1.address, toBigNum("906", 8));
      await tx.wait();
      await checkTokenBalance();

    }
  });

  // it("check claimable reflection rewards", async () => {

  //   await checkClaimableTokenBalance();
  // });

  // it("check user1 claim reflection reward", async () => {
  //   var tx =await token.connect(user1).claimDividend();
  //   await tx.wait();
  //   await checkTokenBalance();

  //   await network.provider.send("evm_increaseTime", [600]);
  //   await network.provider.send("evm_mine");
  // });

  // it("check LP balance", async () => {
  //   await checkLPBalance();
  // });

});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const checkBNBBalance = async () =>{
  console.log("owner wBNB balance", fromBigNum(await ethers.provider.getBalance(owner.address), 18));
  console.log("treasury wBNB balance", fromBigNum(await ethers.provider.getBalance(treasury.address), 18));
  console.log("user1 wBNB balance", fromBigNum(await ethers.provider.getBalance(user1.address), 18));
  console.log("user2 wBNB balance", fromBigNum(await ethers.provider.getBalance(user2.address), 18));
}

const checkTokenBalance = async () =>{
  // console.log("owner Evoki balance", fromBigNum(await token.balanceOf(owner.address), 8));
  console.log("treasury Evoki balance", fromBigNum(await token.balanceOf(treasury.address), 8));
  console.log("user1 Evoki balance", fromBigNum(await token.balanceOf(user1.address), 8));
  console.log("user2 Evoki balance", fromBigNum(await token.balanceOf(user2.address), 8));
}

const checkFeeReceiversTokenBalance = async () =>{
  console.log("liquidityReceiver Evoki balance", fromBigNum(await token.balanceOf(liquidityReceiver.address), 8));
  console.log("growthfundReceiver Evoki balance", fromBigNum(await token.balanceOf(growthfundReceiver.address), 8));
  console.log("contract Evoki balance(for reflection)", fromBigNum(await token.balanceOf(token.address), 8));
}

const checkClaimableTokenBalance = async () =>{
  // console.log("owner claimable Evoki balance", fromBigNum(await token.getUnpaidEarnings(owner.address), 8));
  console.log("user1 claimable Evoki balance", fromBigNum(await token.getUnpaidEarnings(user1.address), 8));
  console.log("user2 claimable Evoki balance", fromBigNum(await token.getUnpaidEarnings(user2.address), 8));
  // console.log("treasury claimable Evoki balance", fromBigNum(await token.getUnpaidEarnings(treasury.address), 8));
}

const checkLPBalance = async () =>{
  console.log("addliquidityReceiver LP balance", fromBigNum(await pairContract.balanceOf(liquidityReceiver.address), 18));
}

const checkBurnAmount = async () =>{
  console.log("burned evoki balance", fromBigNum(await token.totalBurnAmount(), 8));
}

const checkTotalReflectionAmount = async () =>{
  console.log("total reflection evoki balance", fromBigNum(await token.totalReflectionAmount(), 8));
}



