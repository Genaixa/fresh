-- Defence-in-depth: pay_wholesale_invoice_full is only ever called via the
-- service client (server-side portal pay route). It's not SECURITY DEFINER, so
-- RLS already prevents a customer calling it directly from mutating anything —
-- but there's no reason for anon/authenticated to hold EXECUTE at all. Restrict
-- it to service_role so the only path in is the intended server one.
--
-- NB: record_wholesale_payment is deliberately left untouched — David's staff
-- payment route calls it through his own authenticated session.

revoke execute on function pay_wholesale_invoice_full(uuid, uuid, uuid, text) from public, anon, authenticated;
grant  execute on function pay_wholesale_invoice_full(uuid, uuid, uuid, text) to service_role;
