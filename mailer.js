import nodemailer from "nodemailer";
import { buildReceiptHtml } from "./receiptTemplate.js";

// Hostinger webmail SMTP — create the mailbox in hPanel > Emails first.
// SSL on 465 (default) or STARTTLS on 587.
const {
  SMTP_HOST = "smtp.hostinger.com",
  SMTP_PORT = "465",
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM_NAME = process.env.BRAND_NAME || "QuickPay Portal",
} = process.env;

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
  if (!transporter) {
    console.warn("[mail] SMTP_USER/SMTP_PASS not set — skipping receipt email");
    return false;
  }
  if (!tx.email) {
    console.warn("[mail] no recipient email — skipping receipt email");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${MAIL_FROM_NAME}" <${SMTP_USER}>`,
      to: tx.email,
      subject: `Payment Receipt — $${Number(tx.amount).toFixed(2)}`,
      html: buildReceiptHtml(tx),
    });
    console.log(`[mail] receipt sent to ${tx.email}`);
    return true;
  } catch (err) {
    console.error("[mail] failed to send receipt:", err.message);
    return false;
  }
}
