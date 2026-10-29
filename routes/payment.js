import { Router } from "express";
import paypal, { paypalClient } from "../paypalClient.js";
import {
  logTransaction,
  logCheckoutAttempt,
  attachOrderToAttempt,
} from "../supabaseClient.js";
import { sendReceiptEmail } from "../mailer.js";

const router = Router();

// In-memory store so /capture-order can attach the payer's billing info
// (name, email, account id) that was collected on checkout to the
// Supabase row, without ever touching card data.
const pendingOrders = new Map();

/**
 * POST /api/payment/create-order
 * body: { amount: "125.00", accountId, name, email }
 * Creates a PayPal order and returns its id to the frontend, which then
 * renders PayPal's own hosted buttons/approval flow.
 */
router.post("/create-order", async (req, res) => {
  try {
    const { amount, accountId, name, email, address, city, state, zip } = req.body;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: "A valid amount is required." });
    }

    // Save name/email/amount before touching PayPal.
    const attempt = await logCheckoutAttempt({
      account_id: accountId || null,
      name: name || null,
      email: email || null,
      amount: numericAmount,
      address: address || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
    });

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: accountId || "N/A",
          description: `QuickPay Portal payment for account ${accountId || "N/A"}`,
          amount: {
            currency_code: "USD",
            value: numericAmount.toFixed(2),
          },
        },
      ],
    });

    const client = paypalClient();
    const order = await client.execute(request);

    await attachOrderToAttempt(attempt?.id, order.result.id);

    pendingOrders.set(order.result.id, {
      accountId: accountId || null,
      name: name || null,
      email: email || null,
      address: address || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      amount: numericAmount,
    });

    res.json({
      success: true,
      id: order.result.id,
      address: address || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
    });
  } catch (err) {
    console.error("[create-order]", err);
    res.status(500).json({ error: "Failed to create PayPal order." });
  }
});

/**
 * POST /api/payment/capture-order
 * body: { orderID }
 * Called after the buyer approves payment in the PayPal widget. Captures
 * the funds server-side and logs ONLY the transaction result to Supabase
 * (status, amount, PayPal ids, billing contact) — never card details,
 * because PayPal's own hosted flow is what handles the card.
 */
router.post("/capture-order", async (req, res) => {
  const { orderID } = req.body;
  if (!orderID) {
    return res.status(400).json({ error: "orderID is required." });
  }

  const meta = pendingOrders.get(orderID) || {};
  let status = "failed";
  let captureId = null;
  let payerEmail = meta.email || null;

  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const client = paypalClient();
    const capture = await client.execute(request);

    status = capture.result.status === "COMPLETED" ? "success" : "failed";
    captureId =
      capture.result?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
    payerEmail = capture.result?.payer?.email_address || payerEmail;

    const transaction = await logTransaction({
      account_id: meta.accountId,
      name: meta.name,
      email: payerEmail,
      address: meta.address,
      city: meta.city,
      state: meta.state,
      zip: meta.zip,
      amount: meta.amount,
      currency: "USD",
      status,
      paypal_order_id: orderID,
      paypal_capture_id: captureId,
    });

    pendingOrders.delete(orderID);

    if (status === "success") {
      await sendReceiptEmail({
        created_at: new Date().toISOString(),
        account_id: meta.accountId,
        name: meta.name,
        address: meta.address,
        city: meta.city,
        state: meta.state,
        zip: meta.zip,
        amount: meta.amount,
        currency: "USD",
        status,
        paypal_order_id: orderID,
        paypal_capture_id: captureId,
        ...(transaction?.skipped ? {} : transaction),
        email: payerEmail,
      });
    }

    res.json({
      status,
      captureId,
      transactionId: transaction?.id || null,
      address: meta.address || null,
      city: meta.city || null,
      state: meta.state || null,
      zip: meta.zip || null,
    });
  } catch (err) {
    console.error("[capture-order]", err);

    try {
      await logTransaction({
        account_id: meta.accountId,
        name: meta.name,
        email: payerEmail,
        address: meta.address,
        city: meta.city,
        state: meta.state,
        zip: meta.zip,
        amount: meta.amount,
        currency: "USD",
        status: "failed",
        paypal_order_id: orderID,
        paypal_capture_id: null,
      });
    } catch (logErr) {
      console.error("[capture-order] also failed to log failure:", logErr);
    }

    res.status(500).json({ status: "failed", error: "Capture failed." });
  }
});

export default router;
