-- 0123: enrich product_supplier_price_moves with the latest box's pack spec, so the
-- market-run page can compute a SOUND cross-supplier per-unit comparison
-- (box price ÷ CONFIRMED spec). The per-unit number is derived in code, gated on
-- both suppliers sharing the same unit basis — NOT the old guess-based per-unit engine.
create or replace view product_supplier_price_moves as
with buys as (
  select pii.product_id,
    case when lower(pi.supplier_name) in ('dole wholesale gateshead','total produce') then 'dole'
         when lower(pi.supplier_name) = 'jr holland' then 'holland'
         else lower(pi.supplier_name) end as supplier_key,
    pi.invoice_date, pii.unit_cost,
    pii.unit_type, pii.units_per_case, pii.box_weight_kg,
    row_number() over (
      partition by pii.product_id,
        case when lower(pi.supplier_name) in ('dole wholesale gateshead','total produce') then 'dole'
             when lower(pi.supplier_name) = 'jr holland' then 'holland'
             else lower(pi.supplier_name) end
      order by pi.invoice_date desc, pii.created_at desc) as rn
  from purchase_invoice_items pii
  join purchase_invoices pi on pi.id = pii.invoice_id
  where pii.is_matched and coalesce(pii.unit_cost,0) > 0
)
-- NOTE: existing columns keep their order (create-or-replace can't reorder);
-- the three spec columns are appended at the end.
select b1.product_id, b1.supplier_key,
       b1.invoice_date as last_date, b1.unit_cost as last_p,
       b2.invoice_date as prev_date, b2.unit_cost as prev_p,
       b1.unit_type      as last_unit_type,
       b1.units_per_case as last_units_per_case,
       b1.box_weight_kg  as last_box_weight_kg
from buys b1
left join buys b2 on b1.product_id = b2.product_id and b1.supplier_key = b2.supplier_key and b2.rn = 2
where b1.rn = 1;
