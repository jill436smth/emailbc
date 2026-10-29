import { Router } from "express";
import { supabase } from "../supabaseClient.js";

const router = Router();

/**
 * GET /api/transactions
 * Lists logged payment transactions (success + failed), newest first.
 * This is the read endpoint the SEPARATE "transactions dashboard" project
 * (mentioned by the client) will consume — it only ever sees transaction
 * metadata, never card data, because card data was never stored here.
 */
router.get("/", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase is not configured on this server." });
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ transactions: data });
});

export default router;
