import { Router } from "express";
import { sendReceiptEmail } from "../mailer.js";

const router = Router();

/**
 * POST /api/email/send-bill
 * body: { email, name, accountId, amount }
 * Sends the "Confirm details and Pay Bill" email (status PENDING). The Pay
 * Bill button links to PAY_BILL_URL with the account id and amount attached.
 */
router.post("/send-bill", async (req, res) => {
  const { email, name, accountId, amount } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: "A valid amount is required." });
  }

  const base = process.env.PAY_BILL_URL;
  let payUrl = base;
  if (base) {
    try {
      const url = new URL(base);
      if (accountId) url.searchParams.set("accountId", accountId);
      url.searchParams.set("amount", numericAmount.toFixed(2));
      payUrl = url.toString();
    } catch {
      payUrl = base;
    }
  }

  const sent = await sendReceiptEmail({
    email,
    name: name || null,
    account_id: accountId || null,
    amount: numericAmount,
    currency: "USD",
    status: "pending",
    created_at: new Date().toISOString(),
    pay_url: payUrl,
  });

  if (!sent) return res.status(500).json({ error: "Failed to send email." });
  res.json({ success: true });
});

export default router;
