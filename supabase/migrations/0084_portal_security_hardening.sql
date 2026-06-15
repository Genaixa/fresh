-- Portal security hardening (audit findings before go-live).
--
-- Context: the Supabase REST gateway is reachable with the public anon key, so
-- RLS — not the Next.js middleware — is the real security boundary for any
-- logged-in user. A wholesale portal customer must therefore be the least
-- privileged role and see only their own data, never staff data or costs.

-- ── C1: portal customers must NOT be staff ───────────────────────────────────
-- The signup trigger defaulted every new auth user (no role metadata) to
-- 'cashier', which passes every owner_all_* policy. Portal customers got
-- cashier and could read/write the entire wholesale dataset. Re-scope them and
-- make the default least-privileged; staff are always created with an explicit
-- role, so defaulting to wholesale_customer is fail-safe (deny), not fail-open.
update user_profiles set role = 'wholesale_customer'
where id in (select portal_user_id from wholesale_customers where portal_user_id is not null)
  and role <> 'wholesale_customer';

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'wholesale_customer')
  );
  return new;
end;
$$;

-- ── C3: cost views must respect RLS ──────────────────────────────────────────
-- These views aggregate supplier costs from purchase_invoices/items (owner-only
-- RLS) but ran SECURITY DEFINER, so any authenticated user could read them
-- directly via PostgREST. security_invoker makes the caller's RLS apply: owners
-- (staff) still read them; customers get nothing. service_role bypasses RLS, so
-- server-side pricing (which reads these via the service client) is unaffected.
alter view product_supplier_last_price set (security_invoker = on);
alter view product_weighted_costs    set (security_invoker = on);
alter view product_last_invoice      set (security_invoker = on);

-- Views are read-only; strip the nonsensical write grants and remove all
-- logged-out (anon) access to cost data.
revoke insert, update, delete, truncate, references, trigger
  on product_supplier_last_price, product_weighted_costs, product_last_invoice
  from anon, authenticated;
revoke select
  on product_supplier_last_price, product_weighted_costs, product_last_invoice
  from anon;
