import { Router } from "express";
import { supabase } from "../supabaseClient.js";
import { buildReceiptHtml } from "../receiptTemplate.js";

const router = Router();

/**
 * GET /api/receipt/:transactionId
 * Returns an HTML receipt (email-ready) for a completed transaction.
 * This is the "demo receipt" step — it only reads back the non-sensitive
 * transaction row (amount, status, ids) that was already logged to Supabase.
 */
router.get("/:transactionId", async (req, res) => {
  const { transactionId } = req.params;

  let tx = null;
  if (supabase) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();
    if (!error) tx = data;
  }

  // Fall back to query params so the receipt still works without Supabase
  // configured (e.g. first local run before the table/env is set up).
  if (!tx) {
    const { amount, name, email, status, orderId } = req.query;
    tx = {
      id: transactionId,
      amount: amount || "0.00",
      name: name || "N/A",
      email: email || "N/A",
      status: status || "pending",
      paypal_order_id: orderId || "N/A",
      created_at: new Date().toISOString(),
    };
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildReceiptHtml(tx));
});

export default router;
