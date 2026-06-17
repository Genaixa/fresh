-- Internal "Shop Floor" pseudo-customer. David's own shop order (/shop-order)
-- is recorded as a wholesale_order against this account so it feeds /market-run's
-- demand exactly like a real wholesale customer's order. is_internal=true marks
-- it as not a real billing customer; payment_terms 0 (never invoiced).
insert into wholesale_customers (name, is_internal, is_active, payment_terms)
select 'Fresh & Fruity – Shop Floor', true, true, 0
where not exists (select 1 from wholesale_customers where name = 'Fresh & Fruity – Shop Floor');
