-- Multiple orderers for one customer WITHOUT multi-login: the customer keeps a
-- single shared portal login, and the order screen shows an "Ordering as" name
-- dropdown when the customer has more than one contact. Orders from all of them
-- sit under the one customer and amalgamate as usual (e.g. Yeshiva Gedola's two
-- cooks → one combined order). The name is just a label.
alter table wholesale_customers add column if not exists order_contacts text[];
alter table wholesale_orders    add column if not exists placed_by_name text;

-- Yeshiva Gedola has two cooks ordering on one login (placeholder names — replace
-- with the real ones). Everyone else stays null = single orderer, no dropdown.
update wholesale_customers
set order_contacts = array['Cook 1', 'Cook 2']
where name = 'Yeshiva Gedola' and order_contacts is null;
