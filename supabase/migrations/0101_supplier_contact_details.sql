-- Supplier contact details for the /suppliers page.
-- The page was name-only; add the fields David needs to actually phone/email/pay a supplier.
alter table suppliers add column if not exists phone       text;
alter table suppliers add column if not exists email       text;
alter table suppliers add column if not exists address     text;
alter table suppliers add column if not exists account_ref text;   -- bank / payment reference
alter table suppliers add column if not exists notes       text;

-- Seed what we know. Unknown fields left null for David to complete in the UI
-- (we don't fabricate phone/email/address we haven't seen on a document).
update suppliers set
  phone='020 7183 0191',
  email='info@themilkcompany.co.uk',
  address='36-38 Waterloo Road, London NW2 7UH',
  account_ref='Barclays · sort 20-95-61 · acc 43047040 · A/C 545',
  notes='Weekly invoice: Whole + Semi milk @ £1.29/unit, zero-rated. Invoice no. 20xxx. Fax 020 7183 6591.'
where name='The Milk Company';

update suppliers set
  notes=coalesce(notes,'Potato specialist · Team Valley Market, Gateshead · no VAT invoices · invoice nos DN/WI…')
where name='Thomas Baty';

update suppliers set
  notes=coalesce(notes,'Produce · ticket nos 27xxxxx · invoices frequently omit pack size / box weight.')
where name='JR Holland';

update suppliers set
  notes=coalesce(notes,'Formerly Dole · delivery-note nos 112xxxxxx.')
where name='Total Produce';
