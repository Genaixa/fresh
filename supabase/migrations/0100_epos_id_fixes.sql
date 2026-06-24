-- 0100: Reliable EPOS-ID fixes, verified against the 18–24 Jun EPOS sales export
-- (ProductID is the authoritative key, not names).
--
--  1. Resolve the two duplicated epos_now_id values — the export says what each
--     ID really is, so the wrong side is cleared (it needs its own ID later):
--       4590143  = "Potatoes Baby Roast"  -> Potato Mids was wrong
--       47064979 = "Carrot Bag 1KG"       -> Carrot Prepack was wrong
--  2. Fill 4 gaps that have an exact, unused EPOS product ID.
--  3. Add a partial-unique index so two products can never share an ID again.

BEGIN;

-- 1. de-duplicate
UPDATE products SET epos_now_id = NULL WHERE epos_now_id = '4590143'  AND name = 'Potato Mids';
UPDATE products SET epos_now_id = NULL WHERE epos_now_id = '47064979' AND name = 'Carrot Prepack';

-- 2. fill confirmed gaps (100% name match, ID currently unused)
UPDATE products SET epos_now_id = '4580427'  WHERE name = 'Chestnuts'        AND epos_now_id IS NULL;
UPDATE products SET epos_now_id = '52258129' WHERE name = 'Gooseberry'       AND epos_now_id IS NULL;
UPDATE products SET epos_now_id = '46578422' WHERE name = 'Mushroom Punnet'  AND epos_now_id IS NULL;
UPDATE products SET epos_now_id = '52207693' WHERE name = 'Watermelon Small' AND epos_now_id IS NULL;

-- Mushroom Button was wrongly holding the Punnet's ID (46578422). The export
-- says 46578422 = "Mushroom Punnet"; Button's real product is "button mushroom
-- tub" (52184056). Reassign so both are correct.
UPDATE products SET epos_now_id = '52184056' WHERE name = 'Mushroom Button' AND epos_now_id = '46578422';

COMMIT;

-- 3. integrity guard: epos_now_id must be unique where set
CREATE UNIQUE INDEX IF NOT EXISTS products_epos_now_id_uniq
  ON products (epos_now_id) WHERE epos_now_id IS NOT NULL;
