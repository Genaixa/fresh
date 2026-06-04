-- New products and supplier mappings confirmed from David (4 Jun 2026)

-- Potato (Red Skin): Holland Rooster 25kg sack at £15 = 60p/kg cost
-- Sold loose same as Potato Loose at £1.20/kg
INSERT INTO products (name, purchase_cost, retail_price, is_active, case_size)
VALUES ('Potato (Red Skin)', 60, 120, true, 1)
ON CONFLICT DO NOTHING;

-- Potato Baby: Holland SLAD POT, box of 10 x 2.5kg bags at £25 = £2.50/bag cost
-- David sells to Baer at £4.99/bag
UPDATE products SET purchase_cost = 250, retail_price = 499 WHERE name = 'Potato Baby';

-- Soraya cost: Dole Greenvale Washed 25kg at £7.00/sack = 28p/kg
UPDATE products SET purchase_cost = 28 WHERE name = 'Potato (Soraya)';

-- Holland supplier mappings
INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type, box_weight_kg, units_per_case)
SELECT 'jr holland', 'RED SKIN - ROOSTER', id, 'confirmed', 'weight', 25, null FROM products WHERE name = 'Potato (Red Skin)'
ON CONFLICT (supplier_name, raw_description) DO NOTHING;

INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type, box_weight_kg, units_per_case)
SELECT 'jr holland', 'POTATO RED UK 10X2KG 20KG PREPACKED', id, 'confirmed', 'count', 20, 10 FROM products WHERE name = 'Potato (Red Skin)'
ON CONFLICT (supplier_name, raw_description) DO NOTHING;

INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type, box_weight_kg, units_per_case)
SELECT 'jr holland', 'SLAD POT', id, 'confirmed', 'count', null, 10 FROM products WHERE name = 'Potato Baby'
ON CONFLICT (supplier_name, raw_description) DO NOTHING;

-- Dole mappings for Soraya
INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type, box_weight_kg, units_per_case)
SELECT 'dole wholesale gateshead', 'POTATO GREENVALE WASHED 25KG', id, 'confirmed', 'weight', 25, null FROM products WHERE name = 'Potato (Soraya)'
ON CONFLICT (supplier_name, raw_description) DO NOTHING;

INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type, box_weight_kg, units_per_case)
SELECT 'dole wholesale gateshead', 'GREENVALE WASHED 25KG', id, 'confirmed', 'weight', 25, null FROM products WHERE name = 'Potato (Soraya)'
ON CONFLICT (supplier_name, raw_description) DO NOTHING;

-- Dole: Chilean Size 1 = Spanish onion grown in Chile → Onion Regular
INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type)
SELECT 'dole wholesale gateshead', 'CHILEAN SIZE 1', id, 'confirmed', 'count' FROM products WHERE name = 'Onion Regular'
ON CONFLICT (supplier_name, raw_description) DO NOTHING;
