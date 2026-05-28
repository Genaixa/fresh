-- ============================================================
-- Stage 1 fix: supplier_product_mappings + weighted avg cost
-- ============================================================

-- Maps raw invoice descriptions to clean products.
-- Auto-populated by fuzzy matching; human-confirmed by manual review.
create table supplier_product_mappings (
  id              uuid primary key default uuid_generate_v4(),
  supplier_name   text not null,      -- normalised (lowercase, trimmed)
  raw_description text not null,      -- exactly as it appears on the invoice
  product_id      uuid not null references products(id) on delete cascade,
  confirmed_by    uuid references auth.users(id),  -- null = auto, set = human
  match_count     integer not null default 1,       -- usage counter
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (supplier_name, raw_description)
);

create index idx_spm_supplier on supplier_product_mappings(supplier_name);
create index idx_spm_product  on supplier_product_mappings(product_id);

create trigger trg_spm_updated_at
  before update on supplier_product_mappings
  for each row execute function set_updated_at();

alter table supplier_product_mappings enable row level security;

create policy "owner_all_mappings" on supplier_product_mappings for all using (
  exists (select 1 from user_profiles where id = auth.uid() and role in ('owner','cashier'))
);

-- ────────────────────────────────────────────────────────────
-- Weighted average cost view
-- Per-product, per-retail-unit, rolling 7-day window.
-- Formula: total spend / total retail units purchased
-- ────────────────────────────────────────────────────────────
create or replace view product_weighted_costs as
select
  pii.product_id,
  round(
    sum(pii.quantity * pii.unit_cost)
    / nullif(sum(pii.quantity * coalesce(pii.units_per_case, 1)), 0)
  )::integer as weighted_unit_cost_pence,
  sum(pii.quantity) as total_boxes,
  max(pi.invoice_date) as last_purchase_date
from purchase_invoice_items pii
join purchase_invoices pi on pi.id = pii.invoice_id
where pii.is_matched = true
  and pii.product_id is not null
  and pi.invoice_date >= current_date - interval '7 days'
group by pii.product_id;
