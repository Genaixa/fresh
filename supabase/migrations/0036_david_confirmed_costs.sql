-- Costs confirmed directly by David (4 Jun 2026)

-- Leek: £7.20 for 4kg box ≈ 29p per leek (~160g each) — already correct, leaving as-is

-- Potato (2kg bag): David pays 68p per bag (was 75p — outlier data)
UPDATE products SET purchase_cost = 68 WHERE name = 'Potato (Bag 2kg)';

-- Potato Loose: £8.50 for 15kg (40s baker box opened and sold loose) = 57p/kg
-- retail_price is per kg, so purchase_cost is per kg
UPDATE products SET purchase_cost = 57 WHERE name = 'Potato Loose';

-- Potato Mids (washed, 10kg box from Dole): confirmed £7.50 on 04 Jun invoice
UPDATE products SET purchase_cost = 75 WHERE name = 'Potato Mids';

-- Apples: David confirmed sold per kg at £2.99/kg. Box is 12kg.
-- Cost per kg = £18.00 box / 12kg = 150p/kg
-- Previous costs were per-individual-apple (wrong), causing false 93% margin.
UPDATE products SET purchase_cost = 150 WHERE name = 'Apple Braeburn';
UPDATE products SET purchase_cost = 150 WHERE name = 'Apple Cripps Pink';

-- Potato (Soraya): Dole charges £7.00 for 25kg Greenvale Washed sack = 28p/kg
-- David sells to Ness at £12/sack (48p/kg) = 42% margin
UPDATE products SET purchase_cost = 28 WHERE name = 'Potato (Soraya)';

-- Potato (Ready Peeled): Ready Fresh supplier charges £1.40/kg
-- David sells to BCR Sem at £1.91/kg = 27% margin
UPDATE products SET purchase_cost = 140 WHERE name = 'Potato (Ready Peeled)';
