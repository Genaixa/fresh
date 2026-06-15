-- Seed a sensible first-time unit for the wholesale portal's Box/loose toggle.
--
-- Layered default for a portal line is: (1) how THIS customer last bought the
-- product [computed in portal/order/page.tsx from order history], (2) failing
-- that, how the product is most commonly bought across ALL customers [this
-- column], (3) failing that, loose/each [app fallback].
--
-- Layer 2 lives here, not in the app, because the portal session is RLS-scoped
-- to one customer and cannot read the whole order book to compute the mode.
-- products is globally readable, so the portal can read this column directly.

alter table products
  add column if not exists default_unit_type text
  check (default_unit_type in ('box', 'retail_unit'));

comment on column products.default_unit_type is
  'Most-common wholesale_order_items.unit_type for this product across all '
  'customers; seeds the portal line-default for customers with no own history. '
  'Maintained by trg_product_default_unit.';

-- Mode of unit_type per product; ties resolve to box (the dominant wholesale
-- unit and the safer over-supply-vs-under-supply default).
update products p
set default_unit_type = m.unit_type
from (
  select product_id, unit_type
  from (
    select product_id, unit_type,
           row_number() over (
             partition by product_id
             order by count(*) desc, (unit_type = 'box') desc
           ) rn
    from wholesale_order_items
    group by product_id, unit_type
  ) ranked
  where rn = 1
) m
where m.product_id = p.id;

-- Keep it current as new orders land, so the seed "remembers" how products are
-- bought without a manual backfill.
create or replace function recompute_product_default_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update products p
  set default_unit_type = m.unit_type
  from (
    select unit_type
    from wholesale_order_items
    where product_id = new.product_id
    group by unit_type
    order by count(*) desc, (unit_type = 'box') desc
    limit 1
  ) m
  where p.id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_product_default_unit on wholesale_order_items;
create trigger trg_product_default_unit
after insert on wholesale_order_items
for each row
execute function recompute_product_default_unit();
