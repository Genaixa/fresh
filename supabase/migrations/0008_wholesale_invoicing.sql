-- ============================================================
-- Fresh & Fruity — Stage 2: Wholesale Invoicing Schema
-- All monetary values stored as integers (pence)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────
create type order_status           as enum ('draft', 'confirmed', 'dispatched', 'cancelled');
create type invoice_payment_status as enum ('unpaid', 'partial', 'paid', 'overdue');
create type payment_method         as enum ('bank_transfer', 'cash', 'card', 'other');

-- ────────────────────────────────────────────────────────────
-- INVOICE NUMBER SEQUENCE
-- e.g. INV-2026-001
-- ────────────────────────────────────────────────────────────
create sequence wholesale_invoice_seq start 1;

-- ────────────────────────────────────────────────────────────
-- WHOLESALE CUSTOMERS
-- ────────────────────────────────────────────────────────────
create table wholesale_customers (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  contact_name     text,
  email            text,
  phone            text,
  address          text,
  payment_terms    integer not null default 30,  -- days until due
  is_active        boolean not null default true,
  portal_user_id   uuid references auth.users(id),  -- self-service portal login
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- WHOLESALE ORDERS
-- Stage 2: manual entry only. Stage 3 adds portal ordering.
-- ────────────────────────────────────────────────────────────
create table wholesale_orders (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid not null references wholesale_customers(id),
  order_date    date not null default current_date,
  delivery_date date,
  status        order_status not null default 'draft',
  notes         text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- WHOLESALE ORDER ITEMS
-- unit_price = wholesale_price at time of order (not negotiated market price)
-- ────────────────────────────────────────────────────────────
create table wholesale_order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references wholesale_orders(id) on delete cascade,
  product_id  uuid not null references products(id),
  quantity    numeric(10,3) not null,
  unit_price  integer not null,  -- pence (locked at time of order)
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- WHOLESALE INVOICES
-- Auto-generated when order status moves to 'dispatched'
-- ────────────────────────────────────────────────────────────
create table wholesale_invoices (
  id               uuid primary key default uuid_generate_v4(),
  customer_id      uuid not null references wholesale_customers(id),
  order_id         uuid references wholesale_orders(id),
  invoice_number   text not null unique,   -- e.g. INV-2026-001
  invoice_date     date not null default current_date,
  due_date         date not null,
  subtotal         integer not null default 0,  -- pence (before any adjustments)
  total_amount     integer not null default 0,  -- pence
  amount_paid      integer not null default 0,  -- pence
  payment_status   invoice_payment_status not null default 'unpaid',
  pdf_path         text,                        -- Supabase Storage path
  xero_invoice_id  text,                        -- future Xero sync
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- WHOLESALE INVOICE ITEMS
-- Snapshot of what was invoiced (immutable after creation)
-- ────────────────────────────────────────────────────────────
create table wholesale_invoice_items (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references wholesale_invoices(id) on delete cascade,
  product_id   uuid references products(id),
  description  text not null,   -- product name at time of invoice
  quantity     numeric(10,3) not null,
  unit_price   integer not null,   -- pence
  total_price  integer not null,   -- pence
  created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- WHOLESALE PAYMENTS
-- ────────────────────────────────────────────────────────────
create table wholesale_payments (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references wholesale_invoices(id),
  customer_id  uuid not null references wholesale_customers(id),
  amount       integer not null,   -- pence
  payment_date date not null default current_date,
  method       payment_method not null default 'bank_transfer',
  reference    text,
  notes        text,
  recorded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
create index idx_wholesale_orders_customer    on wholesale_orders(customer_id);
create index idx_wholesale_orders_status      on wholesale_orders(status);
create index idx_wholesale_order_items_order  on wholesale_order_items(order_id);
create index idx_wholesale_invoices_customer  on wholesale_invoices(customer_id);
create index idx_wholesale_invoices_status    on wholesale_invoices(payment_status);
create index idx_wholesale_invoices_due       on wholesale_invoices(due_date);
create index idx_wholesale_payments_invoice   on wholesale_payments(invoice_id);
create index idx_wholesale_payments_customer  on wholesale_payments(customer_id);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────
create trigger trg_wholesale_customers_updated_at
  before update on wholesale_customers
  for each row execute function set_updated_at();

create trigger trg_wholesale_orders_updated_at
  before update on wholesale_orders
  for each row execute function set_updated_at();

create trigger trg_wholesale_invoices_updated_at
  before update on wholesale_invoices
  for each row execute function set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PAYMENT RECORDING FUNCTION
-- Updates invoice amount_paid and payment_status atomically
-- ────────────────────────────────────────────────────────────
create or replace function record_wholesale_payment(
  p_invoice_id  uuid,
  p_amount      integer,
  p_date        date,
  p_method      payment_method,
  p_reference   text,
  p_notes       text,
  p_user_id     uuid
) returns void language plpgsql as $$
declare
  v_customer_id uuid;
  v_total       integer;
  v_paid        integer;
  v_new_paid    integer;
  v_status      invoice_payment_status;
begin
  select customer_id, total_amount, amount_paid
  into   v_customer_id, v_total, v_paid
  from   wholesale_invoices
  where  id = p_invoice_id
  for update;

  v_new_paid := v_paid + p_amount;

  if v_new_paid >= v_total then
    v_status := 'paid';
  elsif v_new_paid > 0 then
    v_status := 'partial';
  else
    v_status := 'unpaid';
  end if;

  insert into wholesale_payments(invoice_id, customer_id, amount, payment_date, method, reference, notes, recorded_by)
  values (p_invoice_id, v_customer_id, p_amount, p_date, p_method, p_reference, p_notes, p_user_id);

  update wholesale_invoices
  set    amount_paid = v_new_paid, payment_status = v_status
  where  id = p_invoice_id;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- OVERDUE UPDATE FUNCTION
-- Call periodically (or on page load) to mark overdue invoices
-- ────────────────────────────────────────────────────────────
create or replace function mark_overdue_invoices() returns void language plpgsql as $$
begin
  update wholesale_invoices
  set    payment_status = 'overdue'
  where  payment_status in ('unpaid', 'partial')
  and    due_date < current_date;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ────────────────────────────────────────────────────────────
alter table wholesale_customers    enable row level security;
alter table wholesale_orders       enable row level security;
alter table wholesale_order_items  enable row level security;
alter table wholesale_invoices     enable row level security;
alter table wholesale_invoice_items enable row level security;
alter table wholesale_payments     enable row level security;

-- Owner/cashier: full access to everything
create policy "owner_all_customers"     on wholesale_customers    for all using (
  exists (select 1 from user_profiles where id = auth.uid() and role in ('owner','cashier'))
);
create policy "owner_all_orders"        on wholesale_orders       for all using (
  exists (select 1 from user_profiles where id = auth.uid() and role in ('owner','cashier'))
);
create policy "owner_all_order_items"   on wholesale_order_items  for all using (
  exists (select 1 from user_profiles where id = auth.uid() and role in ('owner','cashier'))
);
create policy "owner_all_invoices"      on wholesale_invoices     for all using (
  exists (select 1 from user_profiles where id = auth.uid() and role in ('owner','cashier'))
);
create policy "owner_all_invoice_items" on wholesale_invoice_items for all using (
  exists (select 1 from user_profiles where id = auth.uid() and role in ('owner','cashier'))
);
create policy "owner_all_payments"      on wholesale_payments     for all using (
  exists (select 1 from user_profiles where id = auth.uid() and role in ('owner','cashier'))
);

-- Wholesale customer portal: see only their own data
create policy "portal_own_invoices" on wholesale_invoices for select using (
  customer_id in (
    select id from wholesale_customers where portal_user_id = auth.uid()
  )
);
create policy "portal_own_invoice_items" on wholesale_invoice_items for select using (
  invoice_id in (
    select id from wholesale_invoices where customer_id in (
      select id from wholesale_customers where portal_user_id = auth.uid()
    )
  )
);
create policy "portal_own_payments" on wholesale_payments for select using (
  customer_id in (
    select id from wholesale_customers where portal_user_id = auth.uid()
  )
);
create policy "portal_own_orders" on wholesale_orders for select using (
  customer_id in (
    select id from wholesale_customers where portal_user_id = auth.uid()
  )
);
