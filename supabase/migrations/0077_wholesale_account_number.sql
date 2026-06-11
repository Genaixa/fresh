-- Account numbers for wholesale customers (shown on dispatch screen + invoices).
ALTER TABLE wholesale_customers ADD COLUMN IF NOT EXISTS account_number text;

-- Assign sequential numbers (1001+) to any customer without one yet.
WITH numbered AS (
  SELECT id, (1000 + row_number() OVER (ORDER BY is_internal, created_at, name))::text AS n
  FROM wholesale_customers
  WHERE account_number IS NULL
)
UPDATE wholesale_customers c
SET account_number = numbered.n
FROM numbered
WHERE c.id = numbered.id;
