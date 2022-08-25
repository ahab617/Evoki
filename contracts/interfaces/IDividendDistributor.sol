// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IDividendDistributor {
    function setShare(address shareholder, uint256 amount) external;
    function deposit(uint256 amount) external;
}