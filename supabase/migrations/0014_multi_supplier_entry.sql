-- Allow multiple entries per product per session (split buys from different suppliers)
ALTER TABLE market_session_items
  ADD COLUMN entry_index integer NOT NULL DEFAULT 0;

-- Unique constraint: same product can be bought from multiple suppliers in one session
ALTER TABLE market_session_items
  ADD CONSTRAINT market_session_items_session_product_entry_unique
  UNIQUE (session_id, product_id, entry_index);
