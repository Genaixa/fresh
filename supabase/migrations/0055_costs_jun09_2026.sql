-- Cost updates from 9 Jun 2026 invoices
--
-- Sources:
--   Holland tickets 2743484 + 2743486 (Devorah Grynavs, 09/06/26)
--   Dole delivery note 11226129 (Mark Smith, 09/06/26)
--   Dole delivery note 11226133 (Ian Frazer, 09/06/26)
--   Thomas Baty DN258020 (09/06/26) — NEW SUPPLIER, Units 7-8 NE Fruit & Veg Market, Team Valley
--   Thomas Baty DN258022 (10/06/26) — tomorrow's delivery, dispatched today
--   Dole #11219925 (05/06/26) — Potato UK 10×2KG Prepacked £8.50/case, retroactively applied
--
-- === IMPORTANT FLAGS ===
-- Watermelon + Watermelon Large: massive cost corrections.
--   Previous values (125p, 131p) were per-kg figures stored as per-unit — now fixed.
--   Size 6 box (6 melons/16kg @ £21): 350p each  → "Watermelon"       retail 450p = 22% margin
--   Size 4 box (4 melons/16kg @ £21): 525p each  → "Watermelon Large" retail 600p = 12.5% margin
--
-- Mushroom Button: was 163p (probably entered as per-kg). Now 46p per 250g punnet
--   (Dole 2.27kg tray / 12 punnets @ £5.50 = 45.8p each).
--
-- "CHILEAN - SIZE 1" (Holland 2743486, £8.00/box × 2): almost certainly Hass Avocado.
--   Size 1 = 12 avocados per 4kg box. £8.00/12 = 67p each. Confirm with David.
--
-- NOT updated (unit mismatch pending David):
--   Potato Mids: confirmed 75p/kg (Dole #11226133 + Thomas Baty DN258022) but bag size unknown.
--     Current DB unit=each cost=278p. At 2.5kg/bag: should be 188p. Awaiting confirmation.
--   Satsuma: invoice 23p/each but DB 90p — likely sold per bag not per fruit.
--   Pepper (Orange): DB cost=300p > retail=50p — obvious error, cannot correct without knowing unit.
--
-- New product needed: Purple Potato 2kg bag.
--   Holland 2743486: 9 cases × £6.80 = case of 5×2kg bags → 136p/bag cost.
--   Retail price not yet confirmed by David. Will add product in separate migration once confirmed.

-- === Holland 2743484 ===
UPDATE products SET purchase_cost =  33 WHERE name = 'Cucumber';
-- x16 Dutch @ £5.20/box. Was 41p (05 Jun had x14 @ £5.50 = 39p; now x16 @ £5.20 = 32.5p). Rounded up.

UPDATE products SET purchase_cost = 120 WHERE name = 'Courgette';
-- Zeus 5kg box @ £6.00. £6.00/5kg = 120p/kg. Was 126p.

UPDATE products SET purchase_cost =  63 WHERE name = 'Tomato';
-- Dutch 6kg black box @ £3.80. £3.80/6kg = 63p/kg. Was 91p — significant drop.

UPDATE products SET purchase_cost =  88 WHERE name = 'Chinese Leaves';
-- 10 per box Dutch @ £8.80. £8.80/10 = 88p each. Was 0p (unpriced).

-- === Holland 2743486 ===
UPDATE products SET purchase_cost =  40 WHERE name = 'Leek';
-- Wood box ~18 leeks @ £7.20. £7.20/18 = 40p each. Was 29p.

UPDATE products SET purchase_cost =  80 WHERE name = 'Swede';
-- Stewarts Extra Large, case ~10 @ £8.00. £8.00/10 = 80p each. Was 0p (unpriced).

UPDATE products SET purchase_cost =  67 WHERE name = 'Avocado';
-- "CHILEAN - SIZE 1", box of 12 @ £8.00. £8.00/12 = 66.7p → 67p. Was 63p. Confirm with David.

-- === Dole 11226129 ===
UPDATE products SET purchase_cost =  46 WHERE name = 'Mushroom Button';
-- 2.27kg tray / 12 punnets @ £5.50. £5.50/12 = 45.8p → 46p per 250g punnet. Was 163p (entered as per-kg).

-- === Dole 11226133 ===
UPDATE products SET purchase_cost =  50 WHERE name = 'Nectarine';
-- 20 nectarines per 3kg box @ £10.00. £10.00/20 = 50p each. Was 66p.

UPDATE products SET purchase_cost = 170 WHERE name = 'Pear Forelle';
-- 10×1kg prepacked packs @ £17.00. £17.00/10 = 170p per 1kg pack. Was 0p.

UPDATE products SET purchase_cost = 350 WHERE name = 'Watermelon';
-- Spain size 6 (6 melons per 16kg box) @ £21.00. £21.00/6 = 350p each. Was 125p.

UPDATE products SET purchase_cost = 525 WHERE name = 'Watermelon Large';
-- Spain size 4 (4 melons per 16kg box) @ £21.00. £21.00/4 = 525p each. Was 131p.

UPDATE products SET purchase_cost =  90 WHERE name = 'Mango';
-- Brazil 10 per box @ £9.00. £9.00/10 = 90p each. Was 63p.

UPDATE products SET purchase_cost =  26 WHERE name = 'Apple Red Delicious';
-- Italy 74 apples/12kg box @ £19.00. £19.00/74 = 25.7p → 26p each. Was 0p.

UPDATE products SET purchase_cost = 188 WHERE name = 'Apple Pink Lady';
-- FR 4kg box @ £7.50. £7.50/4kg = 187.5p/kg → 188p. Was 175p. Consistent price since Apr 2026.

UPDATE products SET purchase_cost = 140 WHERE name = 'Apricot Punnet';
-- Spain 10×500g packs @ £14.00. £14.00/10 = 140p per 500g punnet. Was 0p.

UPDATE products SET purchase_cost = 100 WHERE name = 'Banana';
-- Costa Rica 13kg @ £18.50. £18.50/13kg = 142p/kg. At ~700g/bunch = 99.5p → 100p each. Was 104p.

-- === Thomas Baty DN258020 (new supplier) ===
UPDATE products SET purchase_cost =  53 WHERE name = 'Potato (Soraya)';
-- Washed Potato Soraya 25kg sack @ £6.60. £6.60/25kg = 26.4p/kg. 2kg bag = 52.8p → 53p. Was 68p.

-- === Dole #11219925 (05 Jun 2026, retroactive) ===
UPDATE products SET purchase_cost =  85 WHERE name = 'Potato (Bag 2kg)';
-- Potato UK 10×2KG Prepacked @ £8.50/case of 10 = 85p/bag. Was 65p (stale). Confirms Potato (Bag 2kg) retail=140p → 40% margin.
