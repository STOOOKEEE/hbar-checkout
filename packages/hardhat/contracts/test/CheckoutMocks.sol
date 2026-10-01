// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '../HbarCheckout.sol';

contract MockToken {
    mapping(address => uint256) public balanceOf;
    function mint(address recipient, uint256 amount) external { balanceOf[recipient] += amount; }
}

/// @dev Models numeric tinybar values, NOT Hedera precompiles or actual pool liquidity.
contract MockRouter {
    MockToken public immutable token;
    uint256 public cost = 80;
    bool public underdeliver;
    bool public omitRefund;
    bytes public callback;
    address public callbackTarget;
    bool public callbackSucceeded;

    constructor(address tokenAddress) { token = MockToken(tokenAddress); }
    function configure(uint256 price, bool shortDelivery, bool noRefund) external {
        cost = price; underdeliver = shortDelivery; omitRefund = noRefund;
    }
    function setCallback(address target, bytes calldata data) external { callbackTarget = target; callback = data; }
    function swapETHForExactTokens(uint256 amountOut, address[] calldata path, address to, uint256 deadline)
        external payable returns (uint256[] memory amounts) {
        require(deadline > block.timestamp, 'expired');
        require(path.length == 2 && path[1] == address(token), 'path');
        require(msg.value >= cost, 'maximum spend exceeded');
        if (callbackTarget != address(0)) (callbackSucceeded,) = callbackTarget.call(callback);
        token.mint(to, underdeliver ? amountOut - 1 : amountOut);
        if (!omitRefund && msg.value > cost) {
            (bool ok,) = msg.sender.call{value: msg.value - cost}("");
            require(ok, 'router refund failed');
        }
        amounts = new uint256[](2);
        amounts[0] = cost; amounts[1] = amountOut;
    }
}

contract RejectingPayer {
    function pay(HbarCheckout checkout, bytes32 id, uint256 deadline) external payable {
        checkout.payInvoice{value: msg.value}(id, deadline);
    }
    receive() external payable { revert('no refunds'); }
}
