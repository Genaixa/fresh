alter table market_sessions
  add column if not exists roots_done boolean not null default false,
  add column if not exists veg_done   boolean not null default false,
  add column if not exists fruit_done boolean not null default false;
