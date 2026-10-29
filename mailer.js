import nodemailer from "nodemailer";
import { buildReceiptHtml } from "./receiptTemplate.js";

// Mail goes out through Resend (HTTPS API) when RESEND_API_KEY is set;
// otherwise falls back to Hostinger SMTP (465 SSL / 587 STARTTLS).
const {
  SMTP_HOST = "smtp.hostinger.com",
  SMTP_PORT = "465",
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM_NAME = process.env.BRAND_NAME || "QuickPay Portal",
} = process.env;

const { RESEND_API_KEY, MAIL_FROM = SMTP_USER } = process.env;

// SMTP is only a local fallback — Render's free tier blocks SMTP ports.
const transporter =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

// Never throws: a mail problem must not affect the already-captured payment.
export async function sendReceiptEmail(tx) {
  if (!RESEND_API_KEY && !transporter) {
    console.warn("[mail] RESEND_API_KEY / SMTP not set — skipping receipt email");
    return false;
  }
  if (!tx.email) {
    console.warn("[mail] no recipient email — skipping receipt email");
    return false;
  }

  const message = {
    from: `${MAIL_FROM_NAME} <${MAIL_FROM}>`,
    to: tx.email,
    subject: `Payment Receipt — $${Number(tx.amount).toFixed(2)}`,
    html: buildReceiptHtml(tx),
  };

  try {
    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...message, to: [message.to] }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    } else {
      await transporter.sendMail(message);
    }
    console.log(`[mail] receipt sent to ${tx.email}`);
    return true;
  } catch (err) {
    console.error("[mail] failed to send receipt:", err.message);
    return false;
  }
}
