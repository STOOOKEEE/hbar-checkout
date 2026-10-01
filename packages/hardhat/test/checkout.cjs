const assert = require("node:assert/strict");
const { ethers, network } = require("hardhat");

describe("HbarCheckout payment boundary", function () {
  let merchant, payer, stranger, token, router, checkout, id, expires, deadline;
  beforeEach(async () => {
    [merchant, payer, stranger] = await ethers.getSigners();
    token = await (await ethers.getContractFactory("MockToken")).deploy();
    router = await (
      await ethers.getContractFactory("MockRouter")
    ).deploy(await token.getAddress());
    checkout = await (
      await ethers.getContractFactory("HbarCheckout")
    ).deploy(
      await router.getAddress(),
      stranger.address,
      await token.getAddress(),
    );
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    expires = now + 3600;
    deadline = now + 300;
    const reference = ethers.id("purchase-1");
    id = await checkout.invoiceId(merchant.address, reference);
    await checkout.createInvoice(reference, 1000000n, expires);
  });

  it("delivers exact tokens, records the invoice and returns every surplus unit", async () => {
    const before = await ethers.provider.getBalance(payer.address);
    const receipt = await (
      await checkout.connect(payer).payInvoice(id, deadline, { value: 100n })
    ).wait();
    assert.equal(await token.balanceOf(merchant.address), 1000000n);
    assert.equal((await checkout.invoices(id)).status, 2n);
    assert.equal(
      await ethers.provider.getBalance(await checkout.getAddress()),
      0n,
    );
    assert.equal(
      before - (await ethers.provider.getBalance(payer.address)) - receipt.fee,
      80n,
    );
    const paid = receipt.logs
      .map((log) => {
        try {
          return checkout.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "InvoicePaid");
    assert.equal(paid.args.spentTinybar, 80n);
    assert.equal(paid.args.refundedTinybar, 20n);
  });

  it("prevents double settlement and duplicate merchant references", async () => {
    await checkout.connect(payer).payInvoice(id, deadline, { value: 100n });
    await assert.rejects(
      checkout.connect(payer).payInvoice(id, deadline, { value: 100n }),
      /NotOpen/,
    );
    await assert.rejects(
      checkout.createInvoice(ethers.id("purchase-1"), 7n, expires),
      /InvoiceExists/,
    );
  });

  it("namespaces references by merchant", async () => {
    await checkout
      .connect(stranger)
      .createInvoice(ethers.id("purchase-1"), 2n, expires);
    const otherId = await checkout.invoiceId(
      stranger.address,
      ethers.id("purchase-1"),
    );
    assert.notEqual(id, otherId);
    assert.equal((await checkout.invoices(otherId)).merchant, stranger.address);
  });

  it("only lets the merchant cancel and forbids paying cancelled invoices", async () => {
    await assert.rejects(
      checkout.connect(stranger).cancelInvoice(id),
      /NotMerchant/,
    );
    await checkout.cancelInvoice(id);
    await assert.rejects(
      checkout.connect(payer).payInvoice(id, deadline, { value: 100n }),
      /NotOpen/,
    );
  });

  it("rejects expiry and a payment deadline extending beyond the invoice", async () => {
    await assert.rejects(
      checkout.connect(payer).payInvoice(id, expires + 1, { value: 100n }),
      /InvalidDeadline/,
    );
    await network.provider.send("evm_setNextBlockTimestamp", [expires]);
    await assert.rejects(
      checkout.connect(payer).payInvoice(id, expires, { value: 100n }),
      /Expired/,
    );
  });

  it("rolls back invoice and tokens if price exceeds the payer budget", async () => {
    await assert.rejects(
      checkout.connect(payer).payInvoice(id, deadline, { value: 50n }),
      /maximum spend exceeded/,
    );
    assert.equal((await checkout.invoices(id)).status, 1n);
    assert.equal(await token.balanceOf(merchant.address), 0n);
  });

  it("rolls back incorrect token delivery", async () => {
    await router.configure(80, true, false);
    await assert.rejects(
      checkout.connect(payer).payInvoice(id, deadline, { value: 100n }),
      /IncorrectDelivery/,
    );
    assert.equal((await checkout.invoices(id)).status, 1n);
    assert.equal(await token.balanceOf(merchant.address), 0n);
  });

  it("rejects a router withholding surplus instead of using other balances", async () => {
    await router.configure(80, false, true);
    await assert.rejects(
      checkout.connect(payer).payInvoice(id, deadline, { value: 100n }),
      /InvalidRouterResult/,
    );
    assert.equal((await checkout.invoices(id)).status, 1n);
  });

  it("reverts the entire settlement when the payer cannot receive a refund", async () => {
    const rejecting = await (
      await ethers.getContractFactory("RejectingPayer")
    ).deploy();
    await assert.rejects(
      rejecting.pay(await checkout.getAddress(), id, deadline, { value: 100n }),
      /RefundFailed/,
    );
    assert.equal((await checkout.invoices(id)).status, 1n);
    assert.equal(await token.balanceOf(merchant.address), 0n);
  });

  it("blocks reentrant settlement while allowing the intended router refund", async () => {
    await router.setCallback(
      await checkout.getAddress(),
      checkout.interface.encodeFunctionData("payInvoice", [id, deadline]),
    );
    await checkout.connect(payer).payInvoice(id, deadline, { value: 100n });
    assert.equal(await router.callbackSucceeded(), false);
    assert.equal(await token.balanceOf(merchant.address), 1000000n);
  });

  it("rejects untracked deposits and invalid invoices", async () => {
    await assert.rejects(
      payer.sendTransaction({ to: await checkout.getAddress(), value: 1n }),
      /UnexpectedTransfer/,
    );
    await assert.rejects(
      checkout.createInvoice(ethers.id("zero"), 0, expires),
      /InvalidInvoice/,
    );
  });
});
