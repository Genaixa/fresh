-- EPOS Now is the source of truth for RETAIL price (David, 25 Jun 2026).
-- This table records every decision of an "import prices from EPOS" run so the
-- result (applied / skipped-for-review / unmatched) is auditable and the results
-- page can read back the latest run without re-holding the uploaded file.

create table if not exists public.epos_price_sync_log (
  id           uuid primary key default uuid_generate_v4(),
  run_id       uuid not null,                 -- groups one upload's rows
  product_id   uuid references public.products(id) on delete set null,
  epos_name    text not null,                 -- button name from the EPOS export
  matched_name text,                          -- catalogue product name matched (null = unmatched)
  old_retail   integer,                       -- pence, null when unmatched
  new_retail   integer not null,              -- pence, the EPOS sale price
  status       text not null,                 -- 'applied' | 'review' | 'nochange' | 'unmatched'
  reason       text,                          -- why it was held for review, etc.
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_epos_price_sync_run on public.epos_price_sync_log (run_id, created_at);
create index if not exists idx_epos_price_sync_created on public.epos_price_sync_log (created_at desc);

alter table public.epos_price_sync_log enable row level security;

create policy "owner manages epos price sync log"
  on public.epos_price_sync_log
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');
