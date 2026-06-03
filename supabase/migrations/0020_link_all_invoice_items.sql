-- Bulk-link all historical purchase_invoice_items to products by name pattern.
-- More specific patterns run first to avoid wrong matches.
-- Safe to re-run — only touches rows where product_id IS NULL.

UPDATE purchase_invoice_items ii SET product_id = p.id
FROM products p WHERE ii.product_id IS NULL AND (

  -- ── Apples ────────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%apple%braeburn%'                          AND p.name = 'Apple Braeburn') OR
  (ii.product_name_raw ILIKE '%apple%bramley%'                           AND p.name = 'Apple Bramley') OR
  (ii.product_name_raw ILIKE '%apple%cox%'                               AND p.name = 'Apple Cox') OR
  (ii.product_name_raw ILIKE '%apple%cripps%'                            AND p.name = 'Apple Cripps Pink') OR
  (ii.product_name_raw ILIKE '%apple%golden%'                            AND p.name = 'Apple Golden Delicious') OR
  (ii.product_name_raw ILIKE '%apple%granny%'                            AND p.name = 'Apple Granny Smith') OR
  (ii.product_name_raw ILIKE '%apple%pink lady%'                         AND p.name = 'Apple Pink Lady') OR
  (ii.product_name_raw ILIKE '%apple%gala%'                              AND p.name = 'Apple Royal Gala') OR
  (ii.product_name_raw ILIKE '%apple%red delicious%'                     AND p.name = 'Apple Red Delicious') OR

  -- ── Pears ─────────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%pears forelle%'                           AND p.name = 'Pear Forelle') OR
  (ii.product_name_raw ILIKE '%pear forelle%'                            AND p.name = 'Pear Forelle') OR
  (ii.product_name_raw ILIKE '%pear%williams%'                           AND p.name = 'Pear Conference') OR
  (ii.product_name_raw ILIKE '%pears%conference%'                        AND p.name = 'Pear Conference') OR
  (ii.product_name_raw ILIKE '%pear%conference%'                         AND p.name = 'Pear Conference') OR

  -- ── Stone fruit ───────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%nectarine%'                               AND p.name = 'Nectarine') OR
  (ii.product_name_raw ILIKE '%peach%donut%'                             AND p.name = 'Peach') OR
  (ii.product_name_raw ILIKE '%peach%doughnut%'                          AND p.name = 'Peach') OR
  (ii.product_name_raw ILIKE '%peach%' AND ii.product_name_raw NOT ILIKE '%donut%' AND ii.product_name_raw NOT ILIKE '%doughnut%' AND p.name = 'Peach') OR
  (ii.product_name_raw ILIKE '%plum%'                                    AND p.name = 'Plums Loose') OR
  (ii.product_name_raw ILIKE '%apricot%'                                 AND p.name = 'Apricot') OR
  (ii.product_name_raw ILIKE '%cherry%' AND ii.product_name_raw NOT ILIKE '%tomato%' AND p.name = 'Cherry') OR

  -- ── Citrus ────────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%lemon%'                                   AND p.name = 'Lemon') OR
  (ii.product_name_raw ILIKE '%lime%'                                    AND p.name = 'Lime') OR
  (ii.product_name_raw ILIKE '%grapefruit%'                              AND p.name = 'Grapefruit') OR
  (ii.product_name_raw ILIKE '%orange%navel%'                            AND p.name = 'Oranges Large') OR
  (ii.product_name_raw ILIKE '%orange%large%'                            AND p.name = 'Oranges Large') OR
  (ii.product_name_raw ILIKE '%orange%small%'                            AND p.name = 'Oranges Small') OR
  (ii.product_name_raw ILIKE '%satsuma%'                                 AND p.name = 'Satsuma') OR
  (ii.product_name_raw ILIKE '%tangerine%'                               AND p.name = 'Tangerine') OR
  (ii.product_name_raw ILIKE '%clementine%'                              AND p.name = 'Tangerine') OR
  (ii.product_name_raw ILIKE '%pomelo%'                                  AND p.name = 'Pomelo') OR

  -- ── Tropical / exotic fruit ───────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%banana%'                                  AND p.name = 'Banana') OR
  (ii.product_name_raw ILIKE '%mango%'                                   AND p.name = 'Mango') OR
  (ii.product_name_raw ILIKE '%papaya%'                                  AND p.name = 'Papaya') OR
  (ii.product_name_raw ILIKE '%pineapple%'                               AND p.name = 'Pineapple') OR
  (ii.product_name_raw ILIKE '%avocado%'                                 AND p.name = 'Avocado') OR
  (ii.product_name_raw ILIKE '%chilean%' AND ii.product_name_raw NOT ILIKE '%apple%' AND p.name = 'Avocado') OR
  (ii.product_name_raw ILIKE '%kiwi%'                                    AND p.name = 'Kiwi Loose') OR
  (ii.product_name_raw ILIKE '%passion fruit%'                           AND p.name = 'Passion Fruit') OR
  (ii.product_name_raw ILIKE '%passion%fruit%'                           AND p.name = 'Passion Fruit') OR
  (ii.product_name_raw ILIKE '%lychee%'                                  AND p.name = 'Lychee') OR
  (ii.product_name_raw ILIKE '%litchi%'                                  AND p.name = 'Lychee') OR
  (ii.product_name_raw ILIKE '%coconut%'                                 AND p.name = 'Coconut') OR
  (ii.product_name_raw ILIKE '%dragon fruit%'                            AND p.name = 'Dragon Fruit') OR
  (ii.product_name_raw ILIKE '%dragonfruit%'                             AND p.name = 'Dragon Fruit') OR
  (ii.product_name_raw ILIKE '%fig%'                                     AND p.name = 'Fig') OR
  (ii.product_name_raw ILIKE '%pomegranate%'                             AND p.name = 'Pomegranate') OR
  (ii.product_name_raw ILIKE '%granadilla%'                              AND p.name = 'Granadilla') OR
  (ii.product_name_raw ILIKE '%starfruit%'                               AND p.name = 'Starfruit') OR
  (ii.product_name_raw ILIKE '%star fruit%'                              AND p.name = 'Starfruit') OR
  (ii.product_name_raw ILIKE '%sharon fruit%'                            AND p.name = 'Sharon Fruit Loose') OR
  (ii.product_name_raw ILIKE '%medjool%'                                 AND p.name = 'Medjool Date') OR
  (ii.product_name_raw ILIKE '%date%medjool%'                            AND p.name = 'Medjool Date') OR
  (ii.product_name_raw ILIKE '%rhubarb%'                                 AND p.name = 'Rhubarb') OR

  -- ── Berries ───────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%strawberry%'                              AND p.name = 'Strawberry') OR
  (ii.product_name_raw ILIKE '%blueberry%'                               AND p.name = 'Blueberry') OR
  (ii.product_name_raw ILIKE '%redcurrant%'                              AND p.name = 'Redcurrant') OR
  (ii.product_name_raw ILIKE '%red currant%'                             AND p.name = 'Redcurrant') OR

  -- ── Grapes ────────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%grape%'                                   AND p.name = 'Grapes') OR

  -- ── Melons ────────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%melon%water%'                             AND p.name = 'Watermelon') OR
  (ii.product_name_raw ILIKE '%watermelon%'                              AND p.name = 'Watermelon') OR
  (ii.product_name_raw ILIKE '%melon%honey%'                             AND p.name = 'Melon Honeydew') OR
  (ii.product_name_raw ILIKE '%honeydew%'                                AND p.name = 'Melon Honeydew') OR
  (ii.product_name_raw ILIKE '%melon%galia%'                             AND p.name = 'Melon Galia') OR
  (ii.product_name_raw ILIKE '%melon%cantaloupe%'                        AND p.name = 'Melon Cantaloupe') OR
  (ii.product_name_raw ILIKE '%melon%piel%'                              AND p.name = 'Melon Piel de Sapo') OR
  (ii.product_name_raw ILIKE '%melon%dino%'                              AND p.name = 'Melon Dino') OR

  -- ── Mushrooms ─────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%mushroom%flat%'                           AND p.name = 'Mushroom Flat') OR
  (ii.product_name_raw ILIKE '%mushroom%'  AND ii.product_name_raw NOT ILIKE '%flat%' AND p.name = 'Mushroom Regular') OR

  -- ── Tomatoes ──────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%tomato%cherry%vine%'                      AND p.name = 'Tomato Cherry Vine') OR
  (ii.product_name_raw ILIKE '%tomato%cherry%'                           AND p.name = 'Tomato Cherry') OR
  (ii.product_name_raw ILIKE '%tomato%plum%'                             AND p.name = 'Tomato Plum') OR
  (ii.product_name_raw ILIKE '%tomato%' AND ii.product_name_raw NOT ILIKE '%cherry%' AND ii.product_name_raw NOT ILIKE '%plum%' AND p.name = 'Tomato') OR

  -- ── Brassicas / leaves ────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%cabbage%white%'                           AND p.name = 'Cabbage White') OR
  (ii.product_name_raw ILIKE '%cabbage%red%'                             AND p.name = 'Red Cabbage') OR
  (ii.product_name_raw ILIKE '%hispi%'                                   AND p.name = 'Hispi Cabbage') OR
  (ii.product_name_raw ILIKE '%cabbage%' AND ii.product_name_raw NOT ILIKE '%white%' AND ii.product_name_raw NOT ILIKE '%red%' AND ii.product_name_raw NOT ILIKE '%hispi%' AND p.name = 'Cabbage White') OR
  (ii.product_name_raw ILIKE '%broccoli%'                                AND p.name = 'Broccoli') OR
  (ii.product_name_raw ILIKE '%cauliflower%'                             AND p.name = 'Cauliflower') OR
  (ii.product_name_raw ILIKE '%spinach%'                                 AND p.name = 'Spinach') OR
  (ii.product_name_raw ILIKE '%chinese leaves%'                          AND p.name = 'Chinese Leaves') OR
  (ii.product_name_raw ILIKE '%chinese leaf%'                            AND p.name = 'Chinese Leaves') OR
  (ii.product_name_raw ILIKE '%lettuce%iceberg%'                         AND p.name = 'Lettuce Iceberg') OR
  (ii.product_name_raw ILIKE '%lettuce%cos%'                             AND p.name = 'Lettuce Cos') OR
  (ii.product_name_raw ILIKE '%lettuce%romaine%'                         AND p.name = 'Lettuce Cos') OR
  (ii.product_name_raw ILIKE '%chicory%'                                 AND p.name = 'Chicory') OR

  -- ── Peppers ───────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%pepper%red%'                              AND p.name = 'Pepper (Red)') OR
  (ii.product_name_raw ILIKE '%pepper%yellow%'                           AND p.name = 'Pepper (Yellow)') OR
  (ii.product_name_raw ILIKE '%pepper%orange%'                           AND p.name = 'Pepper (Orange)') OR
  (ii.product_name_raw ILIKE '%pepper%mixed%'                            AND p.name = 'Pepper (Mixed)') OR

  -- ── Cucurbits ─────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%courgette%'                               AND p.name = 'Courgette') OR
  (ii.product_name_raw ILIKE '%zucchini%'                                AND p.name = 'Courgette') OR
  (ii.product_name_raw ILIKE '%cucumber%'                                AND p.name = 'Cucumber') OR
  (ii.product_name_raw ILIKE '%butternut%'                               AND p.name = 'Butternut Squash') OR
  (ii.product_name_raw ILIKE '%marrow%'                                  AND p.name = 'Marrow') OR
  (ii.product_name_raw ILIKE '%aubergine%'                               AND p.name = 'Aubergine') OR

  -- ── Roots & alliums ───────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%carrot%'                                  AND p.name = 'Carrot Loose') OR
  (ii.product_name_raw ILIKE '%leek%'                                    AND p.name = 'Leek') OR
  (ii.product_name_raw ILIKE '%celery%'                                  AND p.name = 'Celery') OR
  (ii.product_name_raw ILIKE '%celeriac%'                                AND p.name = 'Celeriac') OR
  (ii.product_name_raw ILIKE '%parsnip%'                                 AND p.name = 'Parsnip') OR
  (ii.product_name_raw ILIKE '%beetroot%'                                AND p.name = 'Beetroot') OR
  (ii.product_name_raw ILIKE '%turnip%'                                  AND p.name = 'Turnip') OR
  (ii.product_name_raw ILIKE '%swede%'                                   AND p.name = 'Swede') OR
  (ii.product_name_raw ILIKE '%radish%'                                  AND p.name = 'Radish') OR
  (ii.product_name_raw ILIKE '%ginger%'                                  AND p.name = 'Ginger') OR
  (ii.product_name_raw ILIKE '%garlic%peeled%'                           AND p.name = 'Garlic Peeled Pack') OR
  (ii.product_name_raw ILIKE '%garlic%' AND ii.product_name_raw NOT ILIKE '%peeled%' AND p.name = 'Garlic Loose') OR
  (ii.product_name_raw ILIKE '%chilli%'                                  AND p.name = 'Chilli (Red)') OR
  (ii.product_name_raw ILIKE '%chili%'                                   AND p.name = 'Chilli (Red)') OR
  (ii.product_name_raw ILIKE '%spring onion%'                            AND p.name = 'Spring Onion') OR
  (ii.product_name_raw ILIKE '%red onion%'                               AND p.name = 'Onion Red') OR
  (ii.product_name_raw ILIKE '%onion%red%'                               AND p.name = 'Onion Red') OR
  (ii.product_name_raw ILIKE '%shallot%'                                 AND p.name = 'Shallot') OR
  (ii.product_name_raw ILIKE '%onion%' AND ii.product_name_raw NOT ILIKE '%red%' AND ii.product_name_raw NOT ILIKE '%spring%' AND ii.product_name_raw NOT ILIKE '%shallot%' AND p.name = 'Onion Regular') OR

  -- ── Potatoes ──────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%potato%baby%'                             AND p.name = 'Potato Baby') OR
  (ii.product_name_raw ILIKE '%potato%mids%'                             AND p.name = 'Potato Mids') OR
  (ii.product_name_raw ILIKE '%mids%'  AND ii.product_name_raw NOT ILIKE '%potato%' AND p.name = 'Potato Mids') OR
  (ii.product_name_raw ILIKE '%potato%2kg%'                              AND p.name = 'Potato (Bag 2kg)') OR
  (ii.product_name_raw ILIKE '%potato%purple%'                           AND p.name = 'Potato (Bag 2kg)') OR
  (ii.product_name_raw ILIKE '%rooster%'                                 AND p.name = 'Potato') OR
  (ii.product_name_raw ILIKE '%sweet potato%'                            AND p.name = 'Sweet Potato') OR
  (ii.product_name_raw ILIKE '%potato%washed%'                           AND p.name = 'Potato') OR
  (ii.product_name_raw ILIKE '%potato%' AND ii.product_name_raw NOT ILIKE '%baby%' AND ii.product_name_raw NOT ILIKE '%sweet%' AND ii.product_name_raw NOT ILIKE '%mids%' AND ii.product_name_raw NOT ILIKE '%2kg%' AND ii.product_name_raw NOT ILIKE '%purple%' AND ii.product_name_raw NOT ILIKE '%rooster%' AND p.name = 'Potato') OR

  -- ── Peas & beans ──────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%sugarsnap%'                               AND p.name = 'Sugarsnap') OR
  (ii.product_name_raw ILIKE '%sugar snap%'                              AND p.name = 'Sugarsnap') OR
  (ii.product_name_raw ILIKE '%fine bean%'                               AND p.name = 'Bean Fine') OR
  (ii.product_name_raw ILIKE '%beans fine%'                              AND p.name = 'Bean Fine') OR
  (ii.product_name_raw ILIKE '%bean sprout%'                             AND p.name = 'Bean Sprout') OR
  (ii.product_name_raw ILIKE '%pea%' AND ii.product_name_raw NOT ILIKE '%peach%' AND ii.product_name_raw NOT ILIKE '%pear%' AND p.name = 'Pea') OR

  -- ── Other ─────────────────────────────────────────────────────────────────
  (ii.product_name_raw ILIKE '%water still%'                             AND p.name = 'Water Still 500ml') OR
  (ii.product_name_raw ILIKE '%water%500ml%'                             AND p.name = 'Water Still 500ml') OR
  (ii.product_name_raw ILIKE '%kohlrabi%'                                AND p.name = 'Kohlrabi')
);
