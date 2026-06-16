-- Atomic "mark as paid" for the customer portal.
--
-- The portal pay route bypasses RLS (service client), so correctness must live
-- in the DB. record_wholesale_payment is unconditional, which let two rapid
-- taps both pass a route-level "is it paid?" read and double-record the balance
-- (over-paying). This function does the check + insert + update inside one
-- transaction with a row lock (FOR UPDATE), so concurrent callers serialize:
-- the first pays in full, the second sees 'paid' and raises. It also re-verifies
-- the invoice belongs to the given customer (defence in depth behind the route).
--
-- Returns the amount paid (pence). Raises on already-paid / not-owned / nothing-due.

create or replace function pay_wholesale_invoice_full(
  p_invoice_id  uuid,
  p_customer_id uuid,
  p_user_id     uuid,
  p_notes       text default null
) returns integer language plpgsql as $$
declare
  v_customer_id uuid;
  v_total       integer;
  v_paid        integer;
  v_status      invoice_payment_status;
  v_balance     integer;
begin
  select customer_id, total_amount, amount_paid, payment_status
    into v_customer_id, v_total, v_paid, v_status
  from   wholesale_invoices
  where  id = p_invoice_id
  for update;                       -- serialize concurrent callers

  if not found or v_customer_id is distinct from p_customer_id then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;

  if v_status = 'paid' then
    raise exception 'invoice already paid' using errcode = 'P0001';
  end if;

  v_balance := v_total - coalesce(v_paid, 0);
  if v_balance <= 0 then
    raise exception 'nothing to pay' using errcode = 'P0003';
  end if;

  insert into wholesale_payments(invoice_id, customer_id, amount, payment_date, method, reference, notes, recorded_by)
  values (p_invoice_id, v_customer_id, v_balance, current_date, 'other', null, p_notes, p_user_id);

  update wholesale_invoices
  set    amount_paid = coalesce(v_paid, 0) + v_balance,
         payment_status = 'paid'
  where  id = p_invoice_id;

  return v_balance;
end;
$$;
