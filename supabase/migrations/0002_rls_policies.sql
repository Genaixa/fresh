-- ============================================================
-- Fresh & Fruity — Row Level Security Policies
-- ============================================================

-- Helper: returns the current user's role from user_profiles
create or replace function current_user_role()
returns user_role
language sql stable security definer as $$
  select role from user_profiles where id = auth.uid();
$$;

-- ────────────────────────────────────────────────────────────
-- user_profiles
-- ────────────────────────────────────────────────────────────
alter table user_profiles enable row level security;

create policy "users read own profile"
  on user_profiles for select
  using (id = auth.uid());

create policy "owner reads all profiles"
  on user_profiles for select
  using (current_user_role() = 'owner');

create policy "owner updates any profile"
  on user_profiles for update
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- products — owners full access, cashier/wholesale read-only
-- ────────────────────────────────────────────────────────────
alter table products enable row level security;

create policy "authenticated reads products"
  on products for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "owner manages products"
  on products for all
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- suppliers
-- ────────────────────────────────────────────────────────────
alter table suppliers enable row level security;

create policy "authenticated reads suppliers"
  on suppliers for select
  using (auth.role() = 'authenticated');

create policy "owner manages suppliers"
  on suppliers for all
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- product_suppliers
-- ────────────────────────────────────────────────────────────
alter table product_suppliers enable row level security;

create policy "authenticated reads product_suppliers"
  on product_suppliers for select
  using (auth.role() = 'authenticated');

create policy "owner manages product_suppliers"
  on product_suppliers for all
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- purchase_invoices — owner only
-- ────────────────────────────────────────────────────────────
alter table purchase_invoices enable row level security;

create policy "owner manages invoices"
  on purchase_invoices for all
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- purchase_invoice_items — owner only
-- ────────────────────────────────────────────────────────────
alter table purchase_invoice_items enable row level security;

create policy "owner manages invoice items"
  on purchase_invoice_items for all
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- price_suggestions — owner only
-- ────────────────────────────────────────────────────────────
alter table price_suggestions enable row level security;

create policy "owner manages price suggestions"
  on price_suggestions for all
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- price_history — read: owner + cashier; write: system only
-- ────────────────────────────────────────────────────────────
alter table price_history enable row level security;

create policy "owner and cashier reads price history"
  on price_history for select
  using (current_user_role() in ('owner', 'cashier'));

create policy "owner inserts price history"
  on price_history for insert
  with check (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- waste_log — owner only
-- ────────────────────────────────────────────────────────────
alter table waste_log enable row level security;

create policy "owner manages waste log"
  on waste_log for all
  using (current_user_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- sales_data — owner only
-- ────────────────────────────────────────────────────────────
alter table sales_data enable row level security;

create policy "owner manages sales data"
  on sales_data for all
  using (current_user_role() = 'owner');
