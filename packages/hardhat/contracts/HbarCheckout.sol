// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISaucerRouter {
    function swapETHForExactTokens(uint256 amountOut, address[] calldata path, address to, uint256 deadline)
        external payable returns (uint256[] memory amounts);
}

interface ITokenBalance {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Exact-amount checkout using an immutable SaucerSwap V1 router and settlement token.
/// @dev On Hedera, msg.value, amounts[0] and refunds are tinybar, not RPC wei.
contract HbarCheckout {
    enum Status { Missing, Open, Paid, Cancelled }
    struct Invoice {
        address merchant;
        uint256 amount;
        uint64 expiresAt;
        Status status;
    }

    ISaucerRouter public immutable router;
    address public immutable whbar;
    ITokenBalance public immutable token;
    mapping(bytes32 => Invoice) public invoices;
    uint256 private entered;

    error InvalidConfiguration();
    error InvalidInvoice();
    error InvoiceExists();
    error NotOpen();
    error Expired();
    error NotMerchant();
    error InvalidDeadline();
    error IncorrectDelivery();
    error InvalidRouterResult();
    error RefundFailed();
    error UnexpectedTransfer();
    error Reentrancy();

    event InvoiceCreated(bytes32 indexed id, address indexed merchant, bytes32 invoiceReference, uint256 amount, uint64 expiresAt);
    event InvoiceCancelled(bytes32 indexed id);
    event InvoicePaid(bytes32 indexed id, address indexed payer, address indexed merchant, uint256 amountOut, uint256 spentTinybar, uint256 refundedTinybar);

    constructor(address routerAddress, address whbarAddress, address tokenAddress) {
        if (routerAddress.code.length == 0 || whbarAddress == address(0) || tokenAddress.code.length == 0 || tokenAddress == whbarAddress) revert InvalidConfiguration();
        router = ISaucerRouter(routerAddress);
        whbar = whbarAddress;
        token = ITokenBalance(tokenAddress);
    }

    modifier nonReentrant() {
        if (entered != 0) revert Reentrancy();
        entered = 1;
        _;
        entered = 0;
    }

    function invoiceId(address merchant, bytes32 invoiceReference) public pure returns (bytes32) {
        return keccak256(abi.encode(merchant, invoiceReference));
    }

    function createInvoice(bytes32 invoiceReference, uint256 amount, uint64 expiresAt) external nonReentrant returns (bytes32 id) {
        if (invoiceReference == bytes32(0) || amount == 0 || expiresAt <= block.timestamp) revert InvalidInvoice();
        id = invoiceId(msg.sender, invoiceReference);
        if (invoices[id].status != Status.Missing) revert InvoiceExists();
        invoices[id] = Invoice(msg.sender, amount, expiresAt, Status.Open);
        emit InvoiceCreated(id, msg.sender, invoiceReference, amount, expiresAt);
    }

    function cancelInvoice(bytes32 id) external nonReentrant {
        Invoice storage invoice = invoices[id];
        if (invoice.merchant != msg.sender) revert NotMerchant();
        if (invoice.status != Status.Open) revert NotOpen();
        invoice.status = Status.Cancelled;
        emit InvoiceCancelled(id);
    }

    /// @param deadline Short-lived payer deadline, no later than the invoice expiry.
    function payInvoice(bytes32 id, uint256 deadline) external payable nonReentrant {
        Invoice storage invoice = invoices[id];
        if (invoice.status != Status.Open) revert NotOpen();
        if (block.timestamp >= invoice.expiresAt) revert Expired();
        if (deadline <= block.timestamp || deadline > invoice.expiresAt) revert InvalidDeadline();
        if (msg.value == 0) revert InvalidInvoice();

        uint256 originalBalance = address(this).balance - msg.value;
        uint256 beforeTokens = token.balanceOf(invoice.merchant);
        invoice.status = Status.Paid;
        address[] memory path = new address[](2);
        path[0] = whbar;
        path[1] = address(token);
        uint256[] memory amounts = router.swapETHForExactTokens{value: msg.value}(invoice.amount, path, invoice.merchant, deadline);

        uint256 afterTokens = token.balanceOf(invoice.merchant);
        if (afterTokens < beforeTokens || afterTokens - beforeTokens != invoice.amount) revert IncorrectDelivery();
        if (amounts.length != 2 || amounts[0] > msg.value || amounts[1] != invoice.amount) revert InvalidRouterResult();
        uint256 refund = msg.value - amounts[0];
        if (address(this).balance < originalBalance + refund) revert InvalidRouterResult();
        if (refund != 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            if (!ok) revert RefundFailed();
        }
        emit InvoicePaid(id, msg.sender, invoice.merchant, invoice.amount, amounts[0], refund);
    }

    // The router sends surplus HBAR back during a payment; arbitrary deposits are rejected.
    receive() external payable {
        if (msg.sender != address(router) || entered != 1) revert UnexpectedTransfer();
    }
}
