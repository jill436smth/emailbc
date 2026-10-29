import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// If env vars are missing we don't crash the whole server — payments can
// still be attempted, but logging to Supabase will no-op with a warning.
export const supabase = url && key ? createClient(url, key) : null;

// Saved the moment checkout starts (before the PayPal order is created), so
// name/email/amount are kept even if the payment fails or is abandoned.
// Never throws: a logging problem must not block the customer from paying.
export async function logCheckoutAttempt(record) {
  if (!supabase) {
    console.warn("[supabase] not configured — skipping checkout attempt", record);
    return null;
  }

  const { data, error } = await supabase
    .from("checkout_attempts")
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error("[supabase] failed to log checkout attempt:", error.message);
    return null;
  }

  return data;
}

export async function attachOrderToAttempt(attemptId, paypalOrderId) {
  if (!supabase || !attemptId) return;

  const { error } = await supabase
    .from("checkout_attempts")
    .update({ paypal_order_id: paypalOrderId })
    .eq("id", attemptId);

  if (error) {
    console.error("[supabase] failed to attach order to attempt:", error.message);
  }
}

export async function logTransaction(record) {
  if (!supabase) {
    console.warn("[supabase] not configured — skipping transaction log", record);
    return { skipped: true };
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error("[supabase] failed to log transaction:", error.message);
    throw error;
  }

  return data;
}
