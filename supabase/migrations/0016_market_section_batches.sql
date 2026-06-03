-- Convert section done booleans to batch counts
-- so each section can be re-opened for urgent additions
alter table market_sessions
  add column roots_batches int not null default 0,
  add column veg_batches   int not null default 0,
  add column fruit_batches int not null default 0;

update market_sessions set
  roots_batches = case when roots_done then 1 else 0 end,
  veg_batches   = case when veg_done   then 1 else 0 end,
  fruit_batches = case when fruit_done then 1 else 0 end;

alter table market_sessions
  drop column roots_done,
  drop column veg_done,
  drop column fruit_done;
