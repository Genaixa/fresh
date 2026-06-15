-- Portal ordering: let a logged-in wholesale customer read their own account
-- and place their own orders. Owner/cashier policies already cover David's side.
--
-- Note: this also unblocks the existing portal invoice view — the portal_own_*
-- policies on invoices/orders subquery wholesale_customers, which had no portal
-- SELECT policy, so they returned nothing for a real customer login until now.

-- Customers can see their own customer record
CREATE POLICY portal_own_customer ON wholesale_customers
  FOR SELECT USING (portal_user_id = auth.uid());

-- Customers can create their own orders (never another customer's)
CREATE POLICY portal_insert_orders ON wholesale_orders
  FOR INSERT WITH CHECK (
    customer_id IN (
      SELECT id FROM wholesale_customers WHERE portal_user_id = auth.uid()
    )
  );

-- Customers can read and add line items on their own orders
CREATE POLICY portal_own_order_items ON wholesale_order_items
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM wholesale_orders o
      JOIN wholesale_customers c ON c.id = o.customer_id
      WHERE c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY portal_insert_order_items ON wholesale_order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT o.id FROM wholesale_orders o
      JOIN wholesale_customers c ON c.id = o.customer_id
      WHERE c.portal_user_id = auth.uid()
    )
  );
