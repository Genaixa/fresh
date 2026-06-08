-- Custom till: transactions and line items
-- Replaces Epos Now for retail sales recording

create table till_transactions (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  total_pence         integer not null,
  payment_method      text not null check (payment_method in ('cash', 'card', 'mixed')),
  cash_tendered_pence integer,
  change_pence        integer,
  status              text not null default 'completed' check (status in ('completed', 'voided'))
);

create table till_transaction_items (
  id               uuid primary key default uuid_generate_v4(),
  transaction_id   uuid not null references till_transactions(id) on delete cascade,
  product_id       uuid references products(id),
  product_name     text not null,
  quantity         numeric(10,4) not null,
  unit             text not null,
  unit_price_pence integer not null,
  line_total_pence integer not null
);

create index idx_till_tx_created  on till_transactions(created_at desc);
create index idx_till_items_tx    on till_transaction_items(transaction_id);
create index idx_till_items_prod  on till_transaction_items(product_id);

-- RLS
alter table till_transactions      enable row level security;
alter table till_transaction_items enable row level security;

create policy "Authenticated users can manage till_transactions"
  on till_transactions for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage till_transaction_items"
  on till_transaction_items for all to authenticated using (true) with check (true);
