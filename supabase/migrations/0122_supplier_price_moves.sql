-- 0122: box-price-vs-last-buy model (replaces per-unit deal engine for market-run).
-- Pure invoice box price (unit_cost) — no weight/count division, so the parser's
-- unit guesses can't produce rubbish. Per product+supplier: latest box price and
-- the one before it. supplier_key folds Total Produce + Dole into 'dole'.
create or replace view product_supplier_price_moves as
with buys as (
  select pii.product_id,
    case when lower(pi.supplier_name) in ('dole wholesale gateshead','total produce') then 'dole'
         when lower(pi.supplier_name) = 'jr holland' then 'holland'
         else lower(pi.supplier_name) end as supplier_key,
    pi.invoice_date, pii.unit_cost,
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
select b1.product_id, b1.supplier_key,
       b1.invoice_date as last_date, b1.unit_cost as last_p,
       b2.invoice_date as prev_date, b2.unit_cost as prev_p
from buys b1
left join buys b2 on b1.product_id = b2.product_id and b1.supplier_key = b2.supplier_key and b2.rn = 2
where b1.rn = 1;
