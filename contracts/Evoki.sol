// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./abstracts/BaseContract.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

/**
 * @title Evoki Token
 * @notice This is the ERC20 contract for EVOKI.
 */

contract Evoki is BaseContract, ERC20Upgradeable {
    // is necessary to receive unused bnb from the swaprouter
    receive() external payable {}

    using SafeMath for uint256;

    uint256 public constant DECIMALS = 8;
    uint256 public constant MAX_UINT = 1e40;
    uint8 public constant RATE_DECIMALS = 7;

    uint256 private constant INITIAL_FRAGMENTS_SUPPLY = 88000000 * 10**DECIMALS;
    uint256 private constant TOTAL_GONS =
        MAX_UINT - (MAX_UINT % INITIAL_FRAGMENTS_SUPPLY);
    uint256 private constant MAX_SUPPLY = 888888888 * 10**DECIMALS;

    /**
     * Contract initializer.
     * @dev This intializes all the parent contracts.
     */
    function initialize(
        address router_,
        address treasury_,
        address liquidityFeeReceiver_,
        address growthFundFeeReceiver_
    ) public initializer {
        __BaseContract_init();
        __ERC20_init("Evoki", "EVOKI");

        router = router_ != address(0)
            ? IUniswapV2Router02(router_)
            : IUniswapV2Router02(0x10ED43C718714eb63d5aA57B78B54704E256024E);

        pair = IUniswapV2Factory(router.factory()).createPair(
            router.WETH(),
            address(this)
        );

        liquidityFeeReceiver = liquidityFeeReceiver_;
        growthFundFeeReceiver = growthFundFeeReceiver_;
        treasury = treasury_;

        _allowedFragments[address(this)][address(router)] = ~uint256(0);

        pairContract = IUniswapV2Pair(pair);

        _totalSupply = INITIAL_FRAGMENTS_SUPPLY;
        _gonBalances[treasury] = TOTAL_GONS;
        _gonsPerFragment = TOTAL_GONS.div(_totalSupply);
        _autoRebase = false;
        _autoAddLiquidity = true;
        inAddLiquidity = false;

        isDividendExempt[pair] = true;
        isDividendExempt[treasury] = true;
        isDividendExempt[liquidityFeeReceiver] = true;
        isDividendExempt[growthFundFeeReceiver] = true;
        isDividendExempt[address(this)] = true;
        isDividendExempt[address(0)] = true;

        liquidityFee = 40;
        growthFundFee = 30;
        reflectionFee = 30;
        totalFee = liquidityFee.add(growthFundFee).add(reflectionFee);
        feeDenominator = 1000;

        dividendsPerShareAccuracyFactor = 1e8;

        emit Transfer(address(0x0), treasury, _totalSupply);
    }

    function decimals() public view virtual override returns (uint8) {
        return 8;
    }

    uint256 public liquidityFee;
    uint256 public growthFundFee;
    uint256 public reflectionFee;
    uint256 public totalFee;
    uint256 public feeDenominator;

    address public liquidityFeeReceiver;
    address public growthFundFeeReceiver;
    address public treasury;

    IUniswapV2Router02 public router;
    IUniswapV2Pair public pairContract;
    address public pair;
    bool inAddLiquidity;
    modifier addingLiquidity() {
        inAddLiquidity = true;
        _;
        inAddLiquidity = false;
    }

    modifier validRecipient(address to) {
        require(to != address(0x0));
        _;
    }

    bool public _autoRebase;
    bool public _autoAddLiquidity;
    uint256 public _lastRebasedTime;
    uint256 public _lastAddLiquidityTime;
    uint256 public _totalSupply;
    uint256 private _gonsPerFragment;

    uint256 public totalBurnAmount;
    uint256 public totalReflectionAmount;

    //to calculate APY
    uint256 public lastReflectonAmount;
    uint256 public lastReflectionDuration;
    uint256 public lastReflectionCall;

    mapping(address => uint256) private _gonBalances;
    mapping(address => mapping(address => uint256)) private _allowedFragments;
    mapping(address => bool) public blacklist;
    mapping(address => bool) isDividendExempt;

    //For Reflecition
    struct Share {
        uint256 gonAmount;
        uint256 totalExcluded;
        uint256 totalRealised;
    }

    address[] shareholders;
    mapping(address => uint256) shareholderIndexes;
    mapping(address => uint256) totalRewardsDistributed;
    mapping(address => Share) shares;

    uint256 totalShares;
    uint256 dividendsPerShare;
    uint256 dividendsPerShareAccuracyFactor;

    /**
        Event
     */
    event LogRebase(uint256 indexed epoch, uint256 totalSupply);

    function _rebase() internal {
        if (inAddLiquidity) return;
        uint256 deltaTime = block.timestamp - _lastRebasedTime;
        uint256 times = deltaTime.div(10 minutes);
        uint256 epoch = times.mul(10);
        _totalSupply = _totalSupply.add(
            times.mul(304752).div(100).mul(10**DECIMALS)
        );

        _gonsPerFragment = TOTAL_GONS.div(_totalSupply);
        _lastRebasedTime = _lastRebasedTime.add(times.mul(10 minutes));

        pairContract.sync();

        emit LogRebase(epoch, _totalSupply);
    }

    function transfer(address to, uint256 value)
        public
        override
        validRecipient(to)
        returns (bool)
    {
        _transferFrom(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override validRecipient(to) returns (bool) {
        if (_allowedFragments[from][msg.sender] != ~uint256(0)) {
            _allowedFragments[from][msg.sender] = _allowedFragments[from][
                msg.sender
            ].sub(value, "Insufficient Allowance");
        }
        _transferFrom(from, to, value);
        return true;
    }

    function _basicTransfer(
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
        uint256 gonAmount = amount.mul(_gonsPerFragment);
        _gonBalances[from] = _gonBalances[from].sub(gonAmount);
        _gonBalances[to] = _gonBalances[to].add(gonAmount);

        emit Transfer(from, to, amount);
        return true;
    }

    function _transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) internal returns (bool) {
        require(recipient != address(0), "Invalid address");
        require(!blacklist[sender] && !blacklist[recipient], "in_blacklist");

        if (_shouldRebase()) {
            _rebase();
        }

        if (_shouldAddLiquidity()) {
            _addLiquidity();
        }

        if (inAddLiquidity) {
            return _basicTransfer(sender, recipient, amount);
        }

        if (sender == treasury || recipient == treasury) {
            return _basicTransfer(sender, recipient, amount);
        }

        uint256 gonAmount = amount.mul(_gonsPerFragment);
        _gonBalances[sender] = _gonBalances[sender].sub(gonAmount);
        uint256 gonAmountReceived = _shouldTakeFee(sender, recipient)
            ? _takeFee(sender, gonAmount)
            : gonAmount;
        _gonBalances[recipient] = _gonBalances[recipient].add(gonAmountReceived);

        if (!isDividendExempt[sender])
            _setShare(sender, _gonBalances[sender]);
        if (!isDividendExempt[recipient])
            _setShare(recipient, _gonBalances[recipient]);

        if (recipient == pair) {
            _burn(amount.mul(20).div(100));
            totalBurnAmount = totalBurnAmount.add(amount.mul(20).div(100));
        }

        emit Transfer(
            sender,
            recipient,
            gonAmountReceived.div(_gonsPerFragment)
        );
        return true;
    }

    function _burn(uint256 amount) internal {
        _totalSupply = _totalSupply.sub(amount);
        _gonsPerFragment = TOTAL_GONS.div(_totalSupply);

    }

    function _takeFee(address sender, uint256 gonAmount)
        internal
        returns (uint256)
    {
        uint256 feeAmount = gonAmount.div(feeDenominator).mul(totalFee);

        _gonBalances[liquidityFeeReceiver] = _gonBalances[liquidityFeeReceiver]
            .add(gonAmount.div(feeDenominator).mul(liquidityFee));

        _gonBalances[growthFundFeeReceiver] = _gonBalances[
            growthFundFeeReceiver
        ].add(gonAmount.div(feeDenominator).mul(growthFundFee));

        uint256 _gonAmountForReflction_ = gonAmount.div(feeDenominator).mul(reflectionFee);
        _gonBalances[address(this)] = _gonBalances[address(this)].add(
            _gonAmountForReflction_
        );

        totalReflectionAmount = totalReflectionAmount.add(_gonAmountForReflction_.div(_gonsPerFragment));
        updateDivendensPerShare(_gonAmountForReflction_);

        //Store reflection rewards to calcualte APY
        lastReflectonAmount = _gonAmountForReflction_.div(_gonsPerFragment);
        lastReflectionDuration = block.timestamp - lastReflectionCall;
        lastReflectionCall = block.timestamp;

        emit Transfer(
            sender,
            liquidityFeeReceiver,
            gonAmount.div(feeDenominator).mul(liquidityFee).div(
                _gonsPerFragment
            )
        );
        emit Transfer(
            sender,
            growthFundFeeReceiver,
            gonAmount.div(feeDenominator).mul(growthFundFee).div(
                _gonsPerFragment
            )
        );
        emit Transfer(
            sender,
            address(this),
            gonAmount.div(feeDenominator).mul(reflectionFee).div(
                _gonsPerFragment
            )
        );

        return gonAmount.sub(feeAmount);
    }

    function _addLiquidity() internal addingLiquidity {
        uint256 autoLiquidityAmount = _gonBalances[liquidityFeeReceiver].div(
            _gonsPerFragment
        );
        _gonBalances[address(this)] = _gonBalances[address(this)].add(
            _gonBalances[liquidityFeeReceiver]
        );
        _gonBalances[liquidityFeeReceiver] = 0;

        uint256 amountToLiquify = autoLiquidityAmount.div(2);
        uint256 amountToSwap = autoLiquidityAmount.sub(amountToLiquify);

        if (amountToSwap == 0) {
            return;
        }
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        uint256 balanceBefore = address(this).balance;

        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountToSwap,
            0,
            path,
            address(this),
            block.timestamp + 1
        );

        uint256 amountETHLiquidity = address(this).balance.sub(balanceBefore);

        if (amountToLiquify > 0 && amountETHLiquidity > 0) {
            router.addLiquidityETH{
                value: amountETHLiquidity
            }(
                address(this),
                amountToLiquify,
                0,
                0,
                liquidityFeeReceiver,
                block.timestamp + 1
            );
        }
        _lastAddLiquidityTime = block.timestamp;
    }

    function _shouldTakeFee(address from, address to)
        internal
        view
        returns (bool)
    {
        return ((pair == from || pair == to));
    }

    function _shouldRebase() internal view returns (bool) {
        return
            _autoRebase &&
            (_totalSupply < MAX_SUPPLY) &&
            msg.sender != pair &&
            !inAddLiquidity &&
            block.timestamp >= (_lastRebasedTime + 10 minutes);
    }

    function _shouldAddLiquidity() internal view returns (bool) {
        return
            _autoAddLiquidity &&
            !inAddLiquidity &&
            msg.sender != pair &&
            block.timestamp >= (_lastAddLiquidityTime + 24 hours);
    }

    function setAutoRebase(bool _flag) external onlyOwner {
        if (_flag) {
            _autoRebase = _flag;
            _lastRebasedTime = block.timestamp;
        } else {
            _autoRebase = _flag;
        }
    }

    function setAutoAddLiquidity(bool _flag) external onlyOwner {
        if (_flag) {
            _autoAddLiquidity = _flag;
            _lastAddLiquidityTime = block.timestamp;
        } else {
            _autoAddLiquidity = _flag;
        }
    }

    function allowance(address owner_, address spender)
        public
        view
        override
        returns (uint256)
    {
        return _allowedFragments[owner_][spender];
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        override
        returns (bool)
    {
        uint256 oldValue = _allowedFragments[msg.sender][spender];
        if (subtractedValue >= oldValue) {
            _allowedFragments[msg.sender][spender] = 0;
        } else {
            _allowedFragments[msg.sender][spender] = oldValue.sub(
                subtractedValue
            );
        }
        emit Approval(
            msg.sender,
            spender,
            _allowedFragments[msg.sender][spender]
        );
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        public
        override
        returns (bool)
    {
        _allowedFragments[msg.sender][spender] = _allowedFragments[msg.sender][
            spender
        ].add(addedValue);
        emit Approval(
            msg.sender,
            spender,
            _allowedFragments[msg.sender][spender]
        );
        return true;
    }

    function approve(address spender, uint256 value)
        public
        override
        returns (bool)
    {
        _allowedFragments[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function getCirculatingSupply() public view returns (uint256) {
        return (TOTAL_GONS.sub(_gonBalances[address(0)])).div(_gonsPerFragment);
    }

    function isNotInAddLiquidity() external view returns (bool) {
        return !inAddLiquidity;
    }

    function manualSync() external {
        IUniswapV2Pair(pair).sync();
    }

    function setFeeReceivers(
        address _liquidityFeeReceiver,
        address _growthFundFeeReceiver
    ) external onlyOwner {
        liquidityFeeReceiver = _liquidityFeeReceiver;
        growthFundFeeReceiver = _growthFundFeeReceiver;
    }

    function setPairAddress(address pair_) public onlyOwner {
        pair = pair_;
    }

    function setPairContract(address _address) external onlyOwner {
        pairContract = IUniswapV2Pair(_address);
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address who) public view override returns (uint256) {
        return _gonBalances[who].div(_gonsPerFragment);
    }

    function setBotBlacklist(address _Address, bool _flag) public onlyOwner {
        blacklist[_Address] = _flag;
    }

    function isContract(address addr) public view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    function setIsDividendExempt(address holder, bool exempt)
        external
        onlyOwner
    {
        require(holder != address(this) && holder != pair);
        isDividendExempt[holder] = exempt;
        if (exempt) {
            _setShare(holder, 0);
        } else {
            _setShare(holder, _gonBalances[holder]);
        }
    }

    function getHoldersNum() public view returns (uint256) {
        return shareholders.length;
    }

    /**
        For reflection
     */
    function _setShare(address shareholder, uint256 gonAmount) internal {
        if (shares[shareholder].gonAmount > 0) {
            distributeDividend(shareholder);
        }

        if (gonAmount > 0 && shares[shareholder].gonAmount == 0) {
            addShareholder(shareholder);
        } else if (gonAmount == 0 && shares[shareholder].gonAmount > 0) {
            removeShareholder(shareholder);
        }

        totalShares = totalShares.add(gonAmount).sub(
            shares[shareholder].gonAmount
        );
        shares[shareholder].gonAmount = gonAmount;
        shares[shareholder].totalExcluded = getCumulativeDividends(
            shares[shareholder].gonAmount
        );
    }

    function updateDivendensPerShare(uint256 gonAmount) internal {
        if (totalShares == 0) return;
        dividendsPerShare = dividendsPerShare.add(
            dividendsPerShareAccuracyFactor.mul(gonAmount).div(totalShares)
        );
    }

    function distributeDividend(address shareholder) internal {
        if (shares[shareholder].gonAmount == 0) {
            return;
        }

        uint256 gonAmount = getUnpaidEarnings(shareholder).mul(
            _gonsPerFragment
        );

        if (gonAmount > 0) {
            _gonBalances[address(this)] = _gonBalances[address(this)].sub(
                gonAmount
            );
            _gonBalances[shareholder] = _gonBalances[shareholder].add(
                gonAmount
            );

            shares[shareholder].totalRealised = shares[shareholder]
                .totalRealised
                .add(gonAmount);
            shares[shareholder].totalExcluded = getCumulativeDividends(
                shares[shareholder].gonAmount
            );
        }

        emit Transfer(
            address(this),
            shareholder,
            gonAmount.div(_gonsPerFragment)
        );
    }

    function claimDividend() external {
        distributeDividend(msg.sender);
    }

    /**
        @dev this funtion returns token amount - not gons amount!
     */
    function getUnpaidEarnings(address shareholder)
        public
        view
        returns (uint256)
    {
        if (shares[shareholder].gonAmount == 0) {
            return 0;
        }

        uint256 shareholderTotalDividends = getCumulativeDividends(
            shares[shareholder].gonAmount
        );
        uint256 shareholderTotalExcluded = shares[shareholder].totalExcluded;

        if (shareholderTotalDividends <= shareholderTotalExcluded) {
            return 0;
        }

        return
            (shareholderTotalDividends.sub(shareholderTotalExcluded)).div(
                _gonsPerFragment
            );
    }

    function getCumulativeDividends(uint256 share)
        internal
        view
        returns (uint256)
    {
        return
            share.mul(dividendsPerShare).div(dividendsPerShareAccuracyFactor);
    }

    function addShareholder(address shareholder) internal {
        shareholderIndexes[shareholder] = shareholders.length;
        shareholders.push(shareholder);
    }

    function removeShareholder(address shareholder) internal {
        shareholders[shareholderIndexes[shareholder]] = shareholders[
            shareholders.length - 1
        ];
        shareholderIndexes[
            shareholders[shareholders.length - 1]
        ] = shareholderIndexes[shareholder];
        shareholders.pop();
    }

    function withdraw() external onlyOwner {
        _gonBalances[msg.sender] = _gonBalances[msg.sender].add(
            _gonBalances[address(this)]
        );
        _gonBalances[address(this)] = 0;

        emit Transfer(
            address(this),
            msg.sender,
            _gonBalances[address(this)].div(_gonsPerFragment)
        );
    }
}
