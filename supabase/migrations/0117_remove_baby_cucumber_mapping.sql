-- 0117_remove_baby_cucumber_mapping.sql
-- "CUCUMBERS - BABY X28" (JR Holland) was learned as a supplier mapping pointing at
-- the regular Cucumber product, contributing a bogus 28-per-box size to Cucumber's
-- box-size dropdown. Baby cucumbers are a different product (David sells "Cucumber
-- mini" separately at £3.49). Remove the mis-mapping so a future baby-cucumber
-- delivery is flagged for correct mapping rather than auto-filed as regular Cucumber.
-- (Cucumber's COST is unaffected — it's driven by the "X16 DUTCH" lines.)
-- Left in place: "CUCUMBER SPAIN 26 50/60 X38" — branded a regular cucumber (small
-- calibre), so its supplier identity is ambiguous; flagged to David instead.
DELETE FROM supplier_product_mappings
WHERE supplier_name = 'jr holland'
  AND normalised_description = 'CUCUMBERS - BABY X28';
