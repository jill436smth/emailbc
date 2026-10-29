const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const BRAND = process.env.BRAND_NAME || "QuickPay Portal";
const PAY_BILL_URL =
  process.env.PAY_BILL_URL ||
  (process.env.FRONTEND_ORIGIN || "").split(",")[0].trim() ||
  "#";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@quickpayportal.com";

/**
 * Builds the receipt / confirmation HTML (email-safe: tables + inline styles).
 * Only the values that actually exist on the transaction are rendered.
 */
export function buildReceiptHtml(tx) {
  const status = String(tx.status || "pending").toLowerCase();
  const failed = status === "failed";
  const pending = status === "pending";
  const color = failed ? "#ef4444" : pending ? "#f59e0b" : "#10b981";
  const icon = failed ? "✕" : pending ? "!" : "✓";
  const title = failed ? "Payment Failed" : "Confirm details and Pay Bill";
  const amount = `$${Number(tx.amount || 0).toFixed(2)} ${esc(tx.currency || "USD")}`;
  const address = [tx.address, tx.city, tx.state, tx.zip]
    .filter(Boolean)
    .join(", ");

  const rows = [
    ["Account ID", tx.account_id],
    ["Name", tx.name],
    ["Email", tx.email],
    ["Address", address],
    ["Amount", amount, true],
    ["Status", status.toUpperCase()],
    ["Date", tx.created_at ? new Date(tx.created_at).toLocaleString() : ""],
    ["Transaction ID", tx.paypal_capture_id || tx.paypal_order_id],
  ].filter(([, value]) => value);

  const rowsHtml = rows
    .map(
      ([label, value, strong]) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eef0f4;color:#6b7280;font-size:14px;">${esc(label)}</td>
          <td style="padding:14px 0;border-bottom:1px solid #eef0f4;text-align:right;color:#111827;font-size:${strong ? 18 : 14}px;font-weight:${strong ? 700 : 500};">${
            label === "Amount" ? value : esc(value)
          }</td>
        </tr>`,
    )
    .join("");

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(BRAND)} — Payment Receipt</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f8;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(17,24,39,.08);">

        <!-- Logo -->
        <tr><td align="center" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-left:12px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.3px;">${esc(BRAND)}</td>
          </tr></table>
        </td></tr>

        <!-- Status -->
        <tr><td align="center" style="padding:28px 24px 8px;">
          <div style="width:52px;height:52px;line-height:52px;border-radius:50%;margin:0 auto 12px;font-size:26px;color:#ffffff;background:${color};">${icon}</div>
          <div style="font-size:20px;font-weight:700;color:#111827;">${title}</div>
        </td></tr>

        <!-- Values -->
        <tr><td style="padding:8px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
          </table>
        </td></tr>

        <!-- Pay Bill -->
        <tr><td align="center" style="padding:0 32px 28px;">
          <a href="${esc(tx.pay_url || PAY_BILL_URL)}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);background-color:#4f46e5;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 40px;border-radius:10px;">Pay Bill</a>
        </td></tr>

        <!-- Thank you + support -->
        <tr><td align="center" style="padding:0 32px 28px;">
          <div style="font-size:16px;font-weight:600;color:#111827;">Thank you for your payment!</div>
          <div style="margin-top:8px;font-size:13px;color:#6b7280;line-height:1.6;">
            Need help? Contact our support team at
            <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:#4f46e5;text-decoration:none;font-weight:600;">${esc(SUPPORT_EMAIL)}</a>
          </div>
        </td></tr>

        <!-- Copyright -->
        <tr><td align="center" style="background:#f9fafb;padding:18px 24px;border-top:1px solid #eef0f4;font-size:12px;color:#9ca3af;">
          &copy; ${year} ${esc(BRAND)}. All rights reserved.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
