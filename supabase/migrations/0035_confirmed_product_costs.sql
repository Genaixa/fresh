-- Migration 0035: Confirmed product costs from manual invoice review
-- Date: 04 Jun 2026
-- Source: Dole + JR Holland delivery notes, manually reviewed Apr–Jun 2026
-- All values in pence per retail unit (per piece, per kg, or per bag as per each product's unit field)
-- DO NOT overwrite these with automated parser output — see feedback_invoice_workflow

-- BANANA: £19.00/18kg box = £1.056/kg (Dole #11217003, 04 Jun 26 — up from £18.50)
UPDATE products SET purchase_cost = 106, updated_at = now() WHERE name = 'Banana';

-- WATERMELON: Spain 4×16kg Poupart £21/box = £5.25/melon (Dole #11217003, 04 Jun 26)
-- CRITICAL: EPOS 4s at £5.50 = only 5% margin. EPOS 6s at £4.00 = -31% LOSS.
UPDATE products SET purchase_cost = 525, updated_at = now() WHERE name = 'Watermelon';

-- KIWI: £13.00/27-count Chile = 48p each (Dole 02 Jun 26 — SELLING AT LOSS at 45p EPOS)
UPDATE products SET purchase_cost = 48, updated_at = now() WHERE name = 'Kiwi Loose';

-- NECTARINE: Spain 10×500g £7.00/box = 70p per 500g punnet (Dole #11217003, 04 Jun 26)
-- Massive seasonal drop from £14–18 in May. Full season now.
UPDATE products SET purchase_cost = 70, updated_at = now() WHERE name = 'Nectarine';

-- GRAPEFRUIT: SA 35×15kg £20/box = 57p each (Dole May 26)
UPDATE products SET purchase_cost = 57, updated_at = now() WHERE name = 'Grapefruit';

-- AUBERGINE: Holland Dutch Lge £5.50/box ~5kg = £1.10/kg (Holland #2742030, 04 Jun 26)
UPDATE products SET purchase_cost = 110, updated_at = now() WHERE name = 'Aubergine';

-- CUCUMBER: Holland X14 Dutch £7.00/box = 50p each (Holland #2742030, 04 Jun 26)
UPDATE products SET purchase_cost = 50, updated_at = now() WHERE name = 'Cucumber';

-- GRAPES: Standard variety 10×500g £16/box = £1.60/500g bag (confirmed Apr–Jun 26)
UPDATE products SET purchase_cost = 160, updated_at = now() WHERE name = 'Grapes';

-- LEMON: Spain 30-count avg = 25p each (Mar–Jun 26 range 17–40p depending on box size)
UPDATE products SET purchase_cost = 25, updated_at = now() WHERE name = 'Lemon';

-- LIME: Brazil 42×4kg £7/box = 17p each (Dole May 26)
UPDATE products SET purchase_cost = 17, updated_at = now() WHERE name = 'Lime';

-- MANGO: Brazil 8×4kg Pacific £5/box = 62.5p each (Dole #11217003, 04 Jun 26)
UPDATE products SET purchase_cost = 63, updated_at = now() WHERE name = 'Mango';

-- POMEGRANATE: Egypt 8×5kg £7.00/box = 87p each (Dole 02 Jun 26)
UPDATE products SET purchase_cost = 87, updated_at = now() WHERE name = 'Pomegranate';

-- PEPPER RED: Holland Dutch Lge £9.00/box ~5kg = £1.80/kg (Holland #2742030, 04 Jun 26)
UPDATE products SET purchase_cost = 180, updated_at = now() WHERE name = 'Pepper (Red)';

-- PEPPER YELLOW: Holland Dutch Lge £7.00/box ~5kg = £1.40/kg (Holland #2742030, 04 Jun 26)
UPDATE products SET purchase_cost = 140, updated_at = now() WHERE name = 'Pepper (Yellow)';

-- MELON HONEYDEW: Spain 8×10kg £12.00/box = £1.50 each (Dole #11217003, 04 Jun 26)
UPDATE products SET purchase_cost = 150, updated_at = now() WHERE name = 'Melon Honeydew';

-- POTATO (BAG 2KG): £7.50/10×2kg box = 75p per bag (Dole May–Jun 26)
UPDATE products SET purchase_cost = 75, updated_at = now() WHERE name = 'Potato (Bag 2kg)';

-- POTATO WASHED: UK 25kg £7.00/box = 28p/kg (Dole Apr–Jun 26 — consistent)
UPDATE products SET purchase_cost = 28, updated_at = now() WHERE name = 'Potato Washed';

-- POTATO MIDS: Washed ES 10kg £7.50 = 75p/kg (Dole May–Jun 26 — consistent)
UPDATE products SET purchase_cost = 75, updated_at = now() WHERE name = 'Potato Mids';

-- MUSHROOM REGULAR: Poland Closed Cup 2.27kg £5.20 = £2.29/kg (Dole — consistent since Mar 26)
UPDATE products SET purchase_cost = 229, updated_at = now() WHERE name = 'Mushroom Regular';

-- STRAWBERRY (Belgium): Hoogstraten 8×500g £18.00 = £2.25/500g punnet (Dole 02 Jun 26)
-- At current EPOS £4.99 = 55% margin. DO NOT lower retail price.
UPDATE products SET purchase_cost = 225, updated_at = now() WHERE name = 'Strawberry';

-- PINEAPPLE: CR 8×10kg £14.00 = £1.75 each (Dole May 26 — 8-count box)
UPDATE products SET purchase_cost = 175, updated_at = now() WHERE name = 'Pineapple';

-- AVOCADO: SA Hass 10kg jumble £6.50 = ~36p each (Dole May 26)
UPDATE products SET purchase_cost = 36, updated_at = now() WHERE name = 'Avocado';

-- CARROT PREPACK: UK 15×1kg £12.00 = 80p/bag (Dole May–Jun 26)
UPDATE products SET purchase_cost = 80, updated_at = now() WHERE name = 'Carrot Prepack';
