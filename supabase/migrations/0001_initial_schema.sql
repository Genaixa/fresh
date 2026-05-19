-- ============================================================
-- Fresh & Fruity — Stage 1 Initial Schema
-- All monetary values stored as integers (pence)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────
create type product_category as enum ('fruit', 'veg', 'other');
create type product_unit     as enum ('each', 'kg', 'box', 'punnet', 'bunch', 'bag');
create type invoice_status   as enum ('uploaded', 'processing', 'processed', 'error');
create type price_type       as enum ('retail', 'wholesale', 'purchase');
create type suggestion_status as enum ('pending', 'approved', 'rejected', 'auto_applied');
create type pricing_rule     as enum ('multiplier', 'ceiling', 'floor');
create type waste_reason     as enum ('spoiled', 'damaged', 'markdown', 'other');
create type user_role        as enum ('owner', 'cashier', 'wholesale_customer');

-- ────────────────────────────────────────────────────────────
-- USER PROFILES
-- Extends Supabase auth.users with role + display name
-- ────────────────────────────────────────────────────────────
create table user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'cashier',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- SUPPLIERS
-- ────────────────────────────────────────────────────────────
create table suppliers (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  market_order integer,           -- walking sequence at market
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- PRODUCTS
-- ────────────────────────────────────────────────────────────
create table products (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  category            product_category not null default 'other',
  unit                product_unit not null default 'each',

  -- Prices in pence (integers)
  retail_price        integer not null default 0,   -- current live retail price
  wholesale_price     integer not null default 0,   -- current live wholesale price
  purchase_cost       integer not null default 0,   -- last known purchase cost

  -- Pricing engine parameters
  price_multiplier    numeric(5,2) not null default 2.00,
  market_ceiling      integer,                       -- max retail price (pence), null = no ceiling
  margin_floor        numeric(5,2) not null default 0.20, -- minimum acceptable margin (0.20 = 20%)

  -- EPOS Now
  epos_now_id         text,

  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- PRODUCT ↔ SUPPLIER (many-to-many)
-- ────────────────────────────────────────────────────────────
create table product_suppliers (
  product_id    uuid not null references products(id) on delete cascade,
  supplier_id   uuid not null references suppliers(id) on delete cascade,
  is_preferred  boolean not null default false,
  is_blocked    boolean not null default false,
  primary key (product_id, supplier_id)
);

-- ────────────────────────────────────────────────────────────
-- PURCHASE INVOICES
-- ────────────────────────────────────────────────────────────
create table purchase_invoices (
  id             uuid primary key default uuid_generate_v4(),
  supplier_id    uuid references suppliers(id),
  supplier_name  text not null,    -- raw name from PDF, may not match suppliers table yet
  invoice_date   date not null,
  pdf_url        text,             -- Supabase Storage path
  total_amount   integer,          -- pence, parsed from PDF
  status         invoice_status not null default 'uploaded',
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- PURCHASE INVOICE LINE ITEMS
-- ────────────────────────────────────────────────────────────
create table purchase_invoice_items (
  id                      uuid primary key default uuid_generate_v4(),
  invoice_id              uuid not null references purchase_invoices(id) on delete cascade,
  product_id              uuid references products(id),  -- null until manually mapped
  product_name_raw        text not null,                 -- exactly as scanned from PDF
  quantity                numeric(10,3) not null default 1,
  unit_cost               integer not null default 0,    -- pence per unit
  total_cost              integer not null default 0,    -- pence

  -- Discount attribution (business rule: discount stays in margin)
  original_quoted_price   integer,   -- supplier's standard price (pence per unit)
  negotiated_price        integer,   -- what was actually paid (pence per unit)
  discount_amount         integer generated always as (
                            coalesce(original_quoted_price, 0) - coalesce(negotiated_price, 0)
                          ) stored,  -- pure business profit per unit

  is_matched              boolean not null default false,
  created_at              timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- PRICE SUGGESTIONS
-- Generated by the pricing engine after each invoice
-- ────────────────────────────────────────────────────────────
create table price_suggestions (
  id                    uuid primary key default uuid_generate_v4(),
  product_id            uuid not null references products(id) on delete cascade,
  invoice_id            uuid references purchase_invoices(id),
  current_retail_price  integer not null,    -- pence
  suggested_retail_price integer not null,  -- pence
  rule_applied          pricing_rule not null,
  margin_percentage     numeric(5,4),        -- e.g. 0.2143 = 21.43%
  margin_warning        boolean not null default false,  -- true if ceiling prevents margin_floor
  status                suggestion_status not null default 'pending',
  applied_at            timestamptz,
  applied_by            uuid references auth.users(id),
  created_at            timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- PRICE HISTORY
-- Immutable log — one row per price change event
-- ────────────────────────────────────────────────────────────
create table price_history (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id) on delete cascade,
  price_type  price_type not null,
  old_price   integer not null,   -- pence
  new_price   integer not null,   -- pence
  reason      text,
  changed_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- WASTE LOG
-- ────────────────────────────────────────────────────────────
create table waste_log (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id),
  quantity    numeric(10,3) not null,
  unit_cost   integer not null,   -- pence — purchase cost at time of waste
  total_cost  integer generated always as (
                cast(quantity * unit_cost as integer)
              ) stored,
  reason      waste_reason not null default 'spoiled',
  notes       text,
  logged_by   uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- SALES DATA
-- Imported from EPOS Now CSV
-- ────────────────────────────────────────────────────────────
create table sales_data (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid references products(id),
  product_name_raw text,           -- raw name from CSV if not yet matched
  quantity_sold numeric(10,3) not null,
  revenue       integer not null,  -- pence
  sale_date     date not null,
  source        text not null default 'epos_csv_import',
  imported_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
create index idx_products_name       on products(name);
create index idx_products_category   on products(category);
create index idx_products_active     on products(is_active);
create index idx_inv_items_invoice   on purchase_invoice_items(invoice_id);
create index idx_inv_items_product   on purchase_invoice_items(product_id);
create index idx_suggestions_product on price_suggestions(product_id);
create index idx_suggestions_status  on price_suggestions(status);
create index idx_price_history_prod  on price_history(product_id, created_at desc);
create index idx_waste_product       on waste_log(product_id);
create index idx_waste_date          on waste_log(created_at desc);
create index idx_sales_product       on sales_data(product_id);
create index idx_sales_date          on sales_data(sale_date desc);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRICE HISTORY TRIGGER
-- Automatically records a price_history row whenever
-- retail_price, wholesale_price, or purchase_cost changes
-- ────────────────────────────────────────────────────────────
create or replace function record_price_change()
returns trigger language plpgsql as $$
begin
  if new.retail_price <> old.retail_price then
    insert into price_history(product_id, price_type, old_price, new_price, reason)
    values (new.id, 'retail', old.retail_price, new.retail_price, 'auto');
  end if;

  if new.wholesale_price <> old.wholesale_price then
    insert into price_history(product_id, price_type, old_price, new_price, reason)
    values (new.id, 'wholesale', old.wholesale_price, new.wholesale_price, 'auto');
  end if;

  if new.purchase_cost <> old.purchase_cost then
    insert into price_history(product_id, price_type, old_price, new_price, reason)
    values (new.id, 'purchase', old.purchase_cost, new.purchase_cost, 'auto');
  end if;

  return new;
end;
$$;

create trigger trg_products_price_history
  after update on products
  for each row
  when (
    new.retail_price    is distinct from old.retail_price    or
    new.wholesale_price is distinct from old.wholesale_price or
    new.purchase_cost   is distinct from old.purchase_cost
  )
  execute function record_price_change();

-- ────────────────────────────────────────────────────────────
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into user_profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cashier')
  );
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
