-- ═══════════════════════════════════════════════════════════════════════════════
-- 0095 — Fix orphan invoice lines (is_matched=true but product_id IS NULL)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 300 lines were in an invalid state: flagged matched but with no product, so they
-- were silently excluded from costing AND hidden from the "needs mapping" nag.
-- Investigation: ALL were imported on 2026-06-01 (a one-off backfill), and the live
-- code never creates this state (every is_matched=true write also sets product_id).
--
-- Fix: flip them to is_matched=false so the state is valid and the mapping-suggester
-- golem can map the legitimate ones on its normal runs. Non-destructive — no rows
-- deleted, no cost impact (their invoice dates are outside the 7-day cost window).

UPDATE purchase_invoice_items
SET is_matched = false
WHERE is_matched = true AND product_id IS NULL;
