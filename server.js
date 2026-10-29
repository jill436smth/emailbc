import "dotenv/config";
import express from "express";
import cors from "cors";

import paymentRoutes from "./routes/payment.js";
import receiptRoutes from "./routes/receipt.js";
import emailRoutes from "./routes/email.js";
import transactionRoutes from "./routes/transactions.js";

const app = express();

// Accept a comma-separated list in FRONTEND_ORIGIN, plus a few common local
// dev ports by default — Vite auto-bumps the port (5173 -> 5174 -> ...)
// whenever one is already taken, which otherwise breaks CORS silently.
const allowedOrigins = new Set([
  ...(process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/payment", paymentRoutes);
app.use("/api/receipt", receiptRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/transactions", transactionRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`QuickPay Portal backend listening on http://localhost:${PORT}`);
});
