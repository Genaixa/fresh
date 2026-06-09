-- Extends weekly_units averages with 2020–2023 full-year Epos data
-- Period added: 2020 (52 wk), 2021 (52 wk), 2022 (52 wk), 2023 (52 wk) = 208 wk
-- Previous baseline (0051): 74.71 wk (2025 full year + Jan–Mar 2026 + Mar–Jun 2026)
-- New total: 282.71 wk
-- Formula: new = ROUND((old × 74.71 + sum_2020_2023_qty) / 282.71)
--
-- Products excluded from historical blend (method/product changed significantly):
--   Mushroom Punnet: nearly all mushrooms sold loose before 2022; recent punnet rate kept
--   Lychee / Sharon Fruit / Strawberry: seasonal peaks kept, not annual averages
--   Watermelon (small): product not consistently in Epos until 2023; kept at recent rate

-- Core high-volume veg
UPDATE products SET weekly_units = 240 WHERE name = 'Cucumber';
-- (342×74.71 + 42369) / 282.71 = 240  [2020:12749 2021:8591 2022:8831 2023:12198]

UPDATE products SET weekly_units = 86  WHERE name = 'Carrot Loose';
-- (76×74.71 + 18591) / 282.71 = 86  [2020:5358 2021:4301 2022:4147 2023:4785]

UPDATE products SET weekly_units = 88  WHERE name = 'Onion Regular';
-- (85×74.71 + 18501) / 282.71 = 88  [2020:5452 2021:4505 2022:4391 2023:4153]

UPDATE products SET weekly_units = 92  WHERE name = 'Avocado';
-- (132×74.71 + 16249) / 282.71 = 92  [2020:4446 2021:3249 2022:3921 2023:4633]

UPDATE products SET weekly_units = 94  WHERE name = 'Oranges Small';
-- (70×74.71 + 21326) / 282.71 = 94  [2020:7734 2021:5416 2022:4638 2023:3538] — shop sold far more in 2020/21

UPDATE products SET weekly_units = 52  WHERE name = 'Oranges Large';
-- (49×74.71 + 10967) / 282.71 = 52  [2020:3830 2021:3164 2022:2121 2023:1852]

UPDATE products SET weekly_units = 53  WHERE name = 'Grapes';
-- (68×74.71 + 9765) / 282.71 = 53  [2020:2672 2021:2540 2022:2182 2023:2371]

UPDATE products SET weekly_units = 60  WHERE name = 'Kiwi Loose';
-- (65×74.71 + 12152) / 282.71 = 60  [2020:3462 2021:2693 2022:3244 2023:2753]

UPDATE products SET weekly_units = 60  WHERE name = 'Tomato Cherry';
-- (65×74.71 + 12071) / 282.71 = 60  [2020:3787 2021:2742 2022:2942 2023:2600]

UPDATE products SET weekly_units = 48  WHERE name = 'Pepper (Red)';
-- (64×74.71 + 8910) / 282.71 = 48  [2020:2770 2021:2084 2022:1871 2023:2185]

UPDATE products SET weekly_units = 48  WHERE name = 'Courgette';
-- (54×74.71 + 9634) / 282.71 = 48  [2020:2684 2021:2125 2022:2157 2023:2668]

UPDATE products SET weekly_units = 46  WHERE name = 'Lemon';
-- (56×74.71 + 8744) / 282.71 = 46  [2020:2978 2021:1906 2022:1759 2023:2101]

UPDATE products SET weekly_units = 53  WHERE name = 'Passion Fruit';
-- (48×74.71 + 11260) / 282.71 = 53  [2020:3239 2021:2690 2022:2912 2023:2419]

UPDATE products SET weekly_units = 43  WHERE name = 'Sweet Potato';
-- (48×74.71 + 8543) / 282.71 = 43  [2020:2510 2021:1986 2022:1919 2023:2128]

UPDATE products SET weekly_units = 35  WHERE name = 'Mango';
-- (37×74.71 + 7109) / 282.71 = 35  [2020:2421 2021:1692 2022:1711 2023:1285]

UPDATE products SET weekly_units = 53  WHERE name = 'Passion Fruit';
-- already set above

UPDATE products SET weekly_units = 23  WHERE name = 'Tangerine';
-- (33×74.71 + 4043) / 282.71 = 23  [2020:1060 2021:951 2022:816 2023:1216]

UPDATE products SET weekly_units = 32  WHERE name = 'Grapefruit';
-- (26×74.71 + 7090) / 282.71 = 32  [2020:2152 2021:1896 2022:1435 2023:1607]

UPDATE products SET weekly_units = 28  WHERE name = 'Potato Baby';
-- (24×74.71 + 6106) / 282.71 = 28  [2020:1745 2021:1549 2022:1367 2023:1445]

UPDATE products SET weekly_units = 20  WHERE name = 'Plums Loose';
-- (23×74.71 + 4052) / 282.71 = 20  [2020:960 2021:1194 2022:920 2023:978]

UPDATE products SET weekly_units = 26  WHERE name = 'Garlic Loose';
-- (14×74.71 + 6214) / 282.71 = 26  [2020:1836 2021:1425 2022:1463 2023:1490]

UPDATE products SET weekly_units = 17  WHERE name = 'Celery';
-- (20×74.71 + 3358) / 282.71 = 17  [2020:972 2021:834 2022:769 2023:783]

UPDATE products SET weekly_units = 19  WHERE name = 'Parsnip';
-- (21×74.71 + 3905) / 282.71 = 19  [2020:1187 2021:940 2022:926 2023:852]

UPDATE products SET weekly_units = 13  WHERE name = 'Pineapple';
-- (16×74.71 + 2534) / 282.71 = 13  [2020:824 2021:570 2022:488 2023:652]

UPDATE products SET weekly_units = 18  WHERE name = 'Aubergine';
-- (23×74.71 + 3346) / 282.71 = 18  [2020:930 2021:720 2022:735 2023:961]

UPDATE products SET weekly_units = 17  WHERE name = 'Butternut Squash';
-- (14×74.71 + 3640) / 282.71 = 17  [2020:1217 2021:844 2022:768 2023:811]

UPDATE products SET weekly_units = 14  WHERE name = 'Cabbage White';
-- (11×74.71 + 3104) / 282.71 = 14  [2020:984 2021:720 2022:670 2023:730]

UPDATE products SET weekly_units = 17  WHERE name = 'Nectarine';
-- (26×74.71 + 2739) / 282.71 = 17  [2020:624 2021:634 2022:551 2023:930 — loose only]

UPDATE products SET weekly_units = 14  WHERE name = 'Pomelo';
-- (16×74.71 + 2713) / 282.71 = 14  [2020:1138 2021:388 2022:620 2023:567]

UPDATE products SET weekly_units = 8   WHERE name = 'Watermelon Large';
-- (1×74.71 + 2257) / 282.71 = 8  [2020:650 2021:565 2022:582 2023:460 — combined IDs]

-- Fruit & veg — moderate changes
UPDATE products SET weekly_units = 9   WHERE name = 'Lettuce Cos';
-- (22×74.71 + 943) / 282.71 = 9  [2020:335 2021:131 2022:78 2023:399 — Romaine/Kos]

UPDATE products SET weekly_units = 16  WHERE name = 'Lettuce Iceberg';
-- (13×74.71 + 3436) / 282.71 = 16  [2020:1119 2021:768 2022:811 2023:738]

UPDATE products SET weekly_units = 15  WHERE name = 'Apple Braeburn';
-- (22×74.71 + 2497) / 282.71 = 15  [2020:793 2021:695 2022:510 2023:499]

UPDATE products SET weekly_units = 13  WHERE name = 'Apple Royal Gala';
-- (15×74.71 + 2575) / 282.71 = 13  [2020:687 2021:636 2022:489 2023:763]

UPDATE products SET weekly_units = 11  WHERE name = 'Apple Golden Delicious';
-- (9×74.71 + 2401) / 282.71 = 11  [2020:705 2021:572 2022:535 2023:589]

UPDATE products SET weekly_units = 12  WHERE name = 'Apple Granny Smith';
-- (10×74.71 + 2574) / 282.71 = 12  [2020:797 2021:600 2022:559 2023:618]

UPDATE products SET weekly_units = 13  WHERE name = 'Apple Pink Lady';
-- (13×74.71 + 2581) / 282.71 = 13  [2020:803 2021:678 2022:544 2023:556 — no change]

UPDATE products SET weekly_units = 22  WHERE name = 'Salad Cress';
-- (12×74.71 + 5214) / 282.71 = 22  [2020:1117 2021:1102 2022:1890 2023:1105]

UPDATE products SET weekly_units = 8   WHERE name = 'Melon Cantaloupe';
-- (6×74.71 + 1775) / 282.71 = 8  [2020:681 2021:390 2022:354 2023:350]

UPDATE products SET weekly_units = 13  WHERE name = 'Kohlrabi';
-- (16×74.71 + 2468) / 282.71 = 13  [2020:609 2021:572 2022:571 2023:716]

UPDATE products SET weekly_units = 5   WHERE name = 'Pea';
-- (9×74.71 + 701) / 282.71 = 5  [2020:67 2021:228 2022:188 2023:218]

UPDATE products SET weekly_units = 7   WHERE name = 'Pepper (Mixed)';
-- (10×74.71 + 171) / 126.71 = 7  [2023:171 only — older years no matching product]

UPDATE products SET weekly_units = 3   WHERE name = 'Physalis';
-- (5×74.71 + 526) / 282.71 = 3  [2020:87 2021:129 2022:116 2023:194]

UPDATE products SET weekly_units = 3   WHERE name = 'Beetroot';
-- (7×74.71 + 431) / 282.71 = 3  [2020:107 2021:44 2022:74 2023:205]

UPDATE products SET weekly_units = 14  WHERE name = 'Medjool Date';
-- (13×74.71 + 2854) / 282.71 = 14  [2020:582 2021:504 2022:686 2023:1082]

-- NOTE: 'Potato 2kg Bag' = 33095 units in 2020-2023 (9666+7517+7845+8067) + ~11388 recent
--       Full 282.71-wk average ≈ 157/wk — still not in products table
