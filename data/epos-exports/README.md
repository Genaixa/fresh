# Epos Now — Raw Sales Export Archive

Full-year product sales reports exported from Epos Now back office
(Reports → Sales by Product → full date range → export).

## Files present

| File | Period | Weeks | Source |
|------|--------|-------|--------|
| `2020_full_year.tsv` | Full year 2020 | 52 | Pasted 9 Jun 2026 |
| `2021_full_year.tsv` | Full year 2021 | 52 | Pasted 9 Jun 2026 |
| `2022_full_year.tsv` | Full year 2022 | 52 | Pasted 9 Jun 2026 |
| `2023_full_year.tsv` | Full year 2023 | 52 | Pasted 9 Jun 2026 |
| `2024_full_year.tsv` | Full year 2024 | 52 | Pasted 9 Jun 2026 (parsed from chat render — proper TSV) |
| `2025_full_year.tsv` | Full year 2025 | 52 | Pasted 9 Jun 2026 |
| `2026_ytd.tsv` | 01 Jan – 09 Jun 2026 | 22.71 | Pasted 9 Jun 2026 |

## Files NOT saved (re-export from Epos Now if needed)

None — all years 2020–2026 now saved.

## How these were used

All 8 periods (282.71 weeks total) were blended into the `weekly_units` column
on the `products` table via:
- `supabase/migrations/0051_weekly_units.sql` — initial load (2025 + 2026 periods)
- `supabase/migrations/0052_weekly_units_historical.sql` — extended with 2020–2023

Formula: `new_wk = (old_wk × 74.71 + sum_qty_2020_2023) / 282.71`

## Format

Tab-separated. Columns:
`ProductID | Name | Description | Barcode | OrderCode | Brand | Size | Qty | MeasuredQty | Value | Discount | ValueIncVAT | ValueExcVAT | TotCost | Margin | MarginPerc`

- `Qty` = units sold (individual items, or transactions for loose-weight products)
- `MeasuredQty` = kg sold (only populated for loose-weight products, e.g. "593.55700kg")
- ProductID `-39108` = misc/cash sales with no proper product code — ignore for analysis
- Margin/MarginPerc figures in older years are unreliable (cost data incomplete)
