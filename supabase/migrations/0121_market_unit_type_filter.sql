-- 0121: kill mis-typed per-unit data at the root.
-- The invoice parser guesses a line's unit (weight vs count) from free-text
-- supplier descriptions and sometimes gets it wrong (a 10kg satsuma box tagged
-- 'weight' yields £1.80/kg when satsumas are sold per-each at 25p). Such a line
-- computes a per-unit price in the WRONG UNIT — pure rubbish. Rule: a supplier
-- line only counts toward a product's per-unit price/avg if its unit_type
-- matches the product's real unit. Mismatches are excluded automatically, for
-- every past and future invoice. market_unit_type is the canonical unit from
-- the market config (the single source of truth for how each item is sold).

alter table products add column if not exists market_unit_type text;

update products set market_unit_type = 'count'  where name in ('Celeriac', 'Celery', 'Chinese Leaves', 'Cucumber', 'Garlic Loose', 'Lettuce Cos', 'Lettuce Iceberg', 'Mushroom Button', 'Mushroom Punnet', 'Radish', 'Salad Cress', 'Shallot', 'Spring Onion', 'Swede', 'Tomato Cherry', 'Tomato Cherry Vine', 'Bean Fine', 'Cauliflower', 'Kohlrabi', 'Spinach', 'Sugarsnap', 'Apricot', 'Avocado', 'Blueberry', 'Grapes', 'Grapefruit', 'Lime', 'Mango', 'Melon Cantaloupe', 'Melon Galia', 'Melon Honeydew', 'Melon Piel de Sapo', 'Watermelon', 'Nectarine', 'Oranges Large', 'Papaya', 'Peach', 'Pineapple', 'Pomegranate', 'Tangerine', 'Starfruit', 'Strawberry', 'Strawberry Punnet', 'Apricot Punnet', 'Nectarine Punnet', 'Plums Punnet', 'Physalis', 'Watermelon Large', 'Watermelon Small');
update products set market_unit_type = 'weight' where name in ('Aubergine', 'Butternut Squash', 'Cabbage White', 'Carrot Loose', 'Courgette', 'Leek', 'Mushroom Regular', 'Onion Regular', 'Parsnip', 'Pea', 'Pepper (Red)', 'Pepper (Yellow)', 'Potato', 'Potato Loose', 'Sweet Potato', 'Tomato', 'Tomato Plum', 'Beetroot', 'Broccoli', 'Onion Red', 'Onion Spanish', 'Pepper (Mixed)', 'Red Cabbage', 'Apple Braeburn', 'Apple Golden Delicious', 'Apple Granny Smith', 'Apple Pink Lady', 'Apple Royal Gala', 'Banana', 'Cherry', 'Medjool Date', 'Kiwi Loose', 'Lemon', 'Passion Fruit', 'Pear Conference', 'Pear Forelle', 'Plums Loose', 'Apple Bramley', 'Apple Cripps Pink', 'Apple Red Delicious');

-- Last per-supplier per-unit price — now only from lines whose unit matches.
create or replace view product_supplier_last_unit_price as
  select distinct on (pii.product_id, pi.supplier_name)
    pii.product_id,
    pi.supplier_name,
    pi.invoice_date as last_date,
    pii.unit_cost   as box_price_p,
    case
      when pii.unit_type = 'weight' and coalesce(pii.box_weight_kg,0) > 0 then round(pii.unit_cost::numeric / pii.box_weight_kg)
      when pii.unit_type = 'count'  and coalesce(pii.units_per_case,0) > 0 then round(pii.unit_cost::numeric / pii.units_per_case::numeric)
      else pii.unit_cost::numeric
    end as unit_price_p
  from purchase_invoice_items pii
  join purchase_invoices pi on pi.id = pii.invoice_id
  join products p on p.id = pii.product_id
  where pii.is_matched and pii.product_id is not null
    and (p.market_unit_type is null or pii.unit_type = p.market_unit_type)   -- drop mis-typed lines
  order by pii.product_id, pi.supplier_name, pi.invoice_date desc, pii.created_at desc;

-- Live weighted per-unit cost — same filter so the average isn't polluted.
create or replace view product_weighted_costs as
  select pii.product_id,
    round(sum(pii.quantity * pii.unit_cost::numeric) / nullif(sum(pii.quantity *
      case
        when pii.unit_type = 'weight' and pii.box_weight_kg is not null then pii.box_weight_kg
        else coalesce(pii.units_per_case, p.case_size, 1)::numeric
      end), 0::numeric))::integer as weighted_unit_cost_pence,
    sum(pii.quantity) as total_boxes,
    max(pi.invoice_date) as last_purchase_date
  from purchase_invoice_items pii
  join purchase_invoices pi on pi.id = pii.invoice_id
  join products p on p.id = pii.product_id
  where pii.is_matched = true and pii.product_id is not null
    and pi.invoice_date >= (current_date - '7 days'::interval)
    and (p.market_unit_type is null or pii.unit_type = p.market_unit_type)   -- drop mis-typed lines
  group by pii.product_id;
