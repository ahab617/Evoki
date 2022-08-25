const { ethers } = require("hardhat");


/** 
 * set delay for delay times
 * @param {Number} delayTimes - timePeriod for delay
 */

function delay(delayTimes) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(2);
        }, delayTimes);
    });
}

/**
 * change the data type from Number to BigNum
 * @param {Number} value - data that need to be chage
 * @param {Number} d - decimals
 */

function toBigNum(value, d) {
    return ethers.utils.parseUnits(value,d);
}
/**
 * change data type from BigNum to Number
 * @param {Number} value - data that need to be change
 * @param {Number} d - decimals
 */

function fromBigNum(value,d = 18) {
    return ethers.utils.formatUnits(value,d);
}

module.exports = {delay, toBigNum, fromBigNum};