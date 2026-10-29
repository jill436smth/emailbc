import { buildReceiptHtml } from "./receiptTemplate.js";

// Mail goes out through Resend's HTTPS API (the sending domain must be
// verified at resend.com/domains). SMTP is not used — Render's free tier
// blocks the SMTP ports.
const {
  RESEND_API_KEY,
  MAIL_FROM,
  MAIL_FROM_NAME = process.env.BRAND_NAME || "QuickPay Portal",
} = process.env;

// Never throws: a mail problem must not affect the already-captured payment.
export async function sendReceiptEmail(tx) {
  if (!RESEND_API_KEY || !MAIL_FROM) {
    console.warn("[mail] RESEND_API_KEY / MAIL_FROM not set — skipping receipt email");
    return false;
  }
  if (!tx.email) {
    console.warn("[mail] no recipient email — skipping receipt email");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${MAIL_FROM_NAME} <${MAIL_FROM}>`,
        to: [tx.email],
        subject: `Payment Receipt — $${Number(tx.amount).toFixed(2)}`,
        html: buildReceiptHtml(tx),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);

    console.log(`[mail] receipt sent to ${tx.email}`);
    return true;
  } catch (err) {
    console.error("[mail] failed to send receipt:", err.message);
    return false;
  }
}
