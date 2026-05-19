# Fresh & Fruity — Stage 1 Build Plan

## Database Schema Summary

All monetary values stored as **integers in pence** (e.g. `40` = 40p, `150` = £1.50).

### Tables

| Table | Purpose |
|---|---|
| `user_profiles` | Extends Supabase Auth with `owner / cashier / wholesale_customer` role |
| `suppliers` | Market stalls, with walking order |
| `products` | Catalogue with all pricing engine parameters |
| `product_suppliers` | Many-to-many product ↔ supplier |
| `purchase_invoices` | One row per market invoice PDF upload |
| `purchase_invoice_items` | Line items from invoice; includes original + negotiated price |
| `price_suggestions` | Engine output after each invoice; owner approves/rejects |
| `price_history` | Immutable log auto-populated by DB trigger on every price change |
| `waste_log` | Quick waste entries |
| `sales_data` | EPOS Now CSV imports |

### Key Design Decisions

1. **Discount attribution is first-class.** `purchase_invoice_items` has `original_quoted_price`, `negotiated_price`, and a generated `discount_amount` column. Wholesale prices are calculated from `original_quoted_price`; the discount goes to margin.

2. **Price history is trigger-driven.** Any `UPDATE` to `products.retail_price`, `wholesale_price`, or `purchase_cost` automatically writes a `price_history` row. No application code can skip this.

3. **Pricing engine parameters live on the product.** `price_multiplier`, `market_ceiling`, `margin_floor` — per product, defaulting to 2.0× / no ceiling / 20%.

4. **RLS is role-aware.** Cashier can only read `products` (for wholesale lookup). Owner gets full access. `wholesale_customer` role is set up but unused until Stage 3.

---

## Screen-by-Screen UI Flow

### Design System

- **Primary:** `#2D5F2D` (dark green), `#4A8C4A` (accent), `#F5F5F0` (off-white bg)
- **Dark mode:** `#0F1A0F` bg, `#1E2E1E` cards
- **Traffic lights:** `#22C55E` green / `#F59E0B` amber / `#EF4444` red
- **Font:** Inter — clean, legible at small sizes
- **Min tap target:** 48×48px everywhere

---

### Screen 1 — Login

```
┌────────────────────────────────┐
│         🍋 Fresh & Fruity      │
│                                │
│   [Email field             ]   │
│   [Password field          ]   │
│                                │
│   [    Sign In    ]            │
└────────────────────────────────┘
```

- No registration flow (owner creates accounts via Supabase dashboard)
- After login: owner → `/dashboard`, cashier → `/wholesale-lookup`
- Dark by default (5am use)

---

### Screen 2 — Dashboard (Owner)

The dashboard is a **task hub, not a data dump**. It shows the single most pressing action.

```
┌────────────────────────────────────────┐
│  Good morning, David  •  Mon 19 May    │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  📄  3 prices need approval      │  │  ← PRIMARY CTA (big, green)
│  │      Tap to review →             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Quick Actions                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ 📤 Upload │  │ ⚠️ Waste │           │
│  │ Invoice  │  │  Log     │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │ 📊 Margins│  │ 🔍 Prices│           │
│  │ Today   │  │ History  │           │
│  └──────────┘  └──────────┘           │
│                                        │
│  [More ↓]                              │
└────────────────────────────────────────┘
```

- If no pending suggestions: primary CTA changes to "Upload today's invoice"
- "More" reveals: Products, Sync (EPOS), Simulator, Settings
- No numbers/metrics on the dashboard itself — those live in their own screens

---

### Screen 3 — Invoice Upload

**Step 1: Drop / pick file**
```
┌─────────────────────────────────┐
│  Upload Invoice                 │
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   📄  Tap to choose PDF   │  │
│  │       or drop here        │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Date: [19/05/2026         ▾]   │
│  Supplier: [Select...      ▾]   │
│                                 │
│  [ Upload & Scan ]              │
└─────────────────────────────────┘
```

**Step 2: Processing (AI scanning)**
```
┌─────────────────────────────────┐
│  Scanning invoice...            │
│  ████████████░░░░  75%          │
│  Found 18 items so far          │
└─────────────────────────────────┘
```

**Step 3: Review scanned items**
```
┌──────────────────────────────────────┐
│  Review: 22 items found  ✓18  ?4     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ✓ Lemon        18p → matched  │  │
│  │ ✓ Cucumber     25p → matched  │  │
│  │ ? "TOMATO LRG" 20p → [Map ▾] │  │ ← unmatched, dropdown to link
│  │ ? "PEPPR MIX"  28p → [Map ▾] │  │
│  └────────────────────────────────┘  │
│                                      │
│  Negotiated discounts?               │
│  [ + Add discount ]                  │
│                                      │
│  [ Confirm & Generate Prices ]       │
└──────────────────────────────────────┘
```

- Unmatched items shown with amber indicator
- "Add discount" opens a row-level popover: original price / actual price
- One CTA at bottom — can't miss it

---

### Screen 4 — Price Suggestions (Approve/Reject)

This is the most-used daily screen. Must be fast.

```
┌──────────────────────────────────────────┐
│  Price Suggestions  •  19 May            │
│  [ ✓ Approve All ]   [ ⚙ Auto Mode ]    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  Lemon          40p → 40p  ●     │    │  ← no change, grey dot
│  │  Cucumber       60p → 72p  ▲  ✓ ✗│   │  ← up, green dot
│  │  Tomato         40p → 42p  ▲  ✓ ✗│   │
│  │  ⚠ Mango       150p→148p ▼  ✓ ✗│   │  ← amber: below margin floor
│  └──────────────────────────────────┘    │
│                                          │
│  3 pending  •  1 warning                 │
└──────────────────────────────────────────┘
```

- Each row: product name, old price → new price, direction arrow, traffic light, approve/reject
- Amber warning = margin floor violation (ceiling is preventing target margin)
- "Approve All" button is large and at the top
- "Auto Mode" toggle: all future suggestions auto-apply without review (per-product settable)
- Tapping a row expands it to show: rule applied, margin %, ceiling/floor values

---

### Screen 5 — Product Catalogue

**List view**
```
┌─────────────────────────────────────┐
│  Products  [ + Add ]  [🔍 Search ]  │
│  Filter: [All ▾] [Fruit] [Veg]     │
│                                     │
│  Lemon        40p retail  ●  >      │
│  Cucumber     60p retail  ●  >      │
│  Mango       150p retail  ●  >      │
│  Tomato       40p retail  ⚠ >      │  ← amber: margin warning
│  ...                                │
└─────────────────────────────────────┘
```

**Detail / Edit view** (tapping a row)
```
┌────────────────────────────────────────┐
│  ← Lemon                              │
│                                        │
│  Category    [Fruit ▾]                 │
│  Unit        [Each  ▾]                 │
│                                        │
│  Retail price     [ 40p ]              │
│  Wholesale price  [ 30p ]              │
│  Purchase cost    [ 18p ]              │
│                                        │
│  ── Pricing Engine ──                  │
│  Multiplier       [ 2.0 × ]            │
│  Market ceiling   [ 40p  ]             │  ← this is why margin is squeezed
│  Margin floor     [ 20%  ]             │
│                                        │
│  ⚠ Ceiling (40p) prevents 20% margin  │
│    at current cost (18p). Actual: 14%  │
│                                        │
│  EPOS ID      [ optional ]             │
│                                        │
│  [ Save ]          [ Deactivate ]      │
└────────────────────────────────────────┘
```

- Auto-save on blur (no explicit "Save" tap needed in practice)
- Inline margin warning beneath the ceiling field

---

### Screen 6 — Purchase Price History

```
┌──────────────────────────────────────┐
│  Price History  [🔍 Search product ] │
│                                      │
│  Lemon                               │
│  ┌─────────────────────────────────┐ │
│  │  Today      18p  ●  (normal)   │ │  ← green
│  │  15 May     16p  ●  (good)     │ │  ← green
│  │  08 May     22p  ▲  (high)     │ │  ← red: above recent avg
│  │  01 May     17p  ●             │ │
│  └─────────────────────────────────┘ │
│  Avg (4wk): 18p  •  Min: 16p         │
│                                      │
│  ── Compare another product ──       │
└──────────────────────────────────────┘
```

- Traffic light = today's price vs 4-week rolling average
- Green: ≤ avg. Amber: 5–15% above avg. Red: >15% above avg
- Shows last purchase price prominently at the top of each product

---

### Screen 7 — Waste Log

Designed for one-handed use, minimal taps.

```
┌──────────────────────────────────────┐
│  Log Waste                           │
│                                      │
│  [🔍 Product...              ]       │
│                                      │
│  ← tap a product to log waste →      │
│                                      │
│  Recent:                             │
│  Lemon    ×4   Spoiled   18p  today  │
│  Mango    ×2   Markdown  65p  today  │
└──────────────────────────────────────┘
```

After tapping a product:
```
┌──────────────────────────────────────┐
│  Waste: Lemon                        │
│                                      │
│  Quantity: [ - ]  4  [ + ]          │
│                                      │
│  Reason:                             │
│  [ Spoiled ] [ Damaged ]             │
│  [ Markdown] [ Other   ]             │
│                                      │
│  [ Log Waste ]                       │
└──────────────────────────────────────┘
```

- Two taps + quantity: search → tap product → tap reason → tap Log
- Reason uses big pill buttons (no dropdowns)
- Auto-fills unit cost from `products.purchase_cost`

---

### Screen 8 — Profit Margin Dashboard

```
┌────────────────────────────────────────┐
│  Margins  •  This week                 │
│  [ Week ▾ ]  [ Month ]  [ Custom ]    │
│                                        │
│  Overall margin (waste-adjusted)       │
│  ┌──────────────────────────────────┐  │
│  │         23.4%           ●        │  │  ← big number, green
│  │  Target 20%  •  Waste: -1.2%    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  By product (tap to drill in):         │
│  Lemon        14%  ⚠  ceiling         │
│  Cucumber     50%  ●                  │
│  Tomato       28%  ●                  │
│  Mango        53%  ●                  │
└────────────────────────────────────────┘
```

- Overall number is large and colour-coded
- Waste impact shown as a negative delta
- Per-product list sortable by margin %
- Tapping a product shows: sell price, buy price, waste %, effective margin over time (mini chart)

---

### Screen 9 — Profit Simulator

```
┌──────────────────────────────────────┐
│  Simulator                           │
│                                      │
│  Product:  [ Cucumber         ▾ ]   │
│  Change:   [ +5p to retail    ]     │
│                                      │
│  ── Results ──                       │
│  New retail price:    65p            │
│  New margin:          61%  ●         │
│  Extra revenue/week:  ~£8.40         │ ← based on avg weekly sales
│  Extra revenue/year:  ~£436          │
│                                      │
│  [ Try another ]                     │
└──────────────────────────────────────┘
```

- Purely calculational — no database writes
- Uses average weekly sales from `sales_data` if available, or zero with a note
- Results update live as the user types (no "Calculate" button)

---

### Screen 10 — Wholesale Price Lookup (Cashier)

Deliberately read-only. No editing. No navigation to anything else.

```
┌────────────────────────────────────────┐
│  Wholesale Price Lookup                │
│                                        │
│  [🔍 Search product...           ]    │
│                                        │
│  Cucumber                              │
│  ┌────────────────────────────────┐    │
│  │  Full box (10kg)               │    │
│  │  £18.00                        │    │  ← large, bold
│  └────────────────────────────────┘    │
│                                        │
│  Per kg:  £1.80                        │
│  Last updated:  Today 07:34            │
└────────────────────────────────────────┘
```

- This is the only screen a cashier user sees after login
- Large price, nothing else to click

---

### Screen 11 — EPOS Now Sync

```
┌────────────────────────────────────────┐
│  EPOS Now Sync                         │
│                                        │
│  ── Export prices to EPOS ──           │
│  [ ⬇ Download Price CSV ]             │  ← generates CSV of all active products
│  Last export: Today 07:45              │
│                                        │
│  ── Import sales from EPOS ──          │
│  [ 📤 Upload Sales CSV ]              │
│  Last import: Yesterday 18:30          │
│                                        │
│  Import history:                       │
│  19 May  482 rows  ●                  │
│  18 May  391 rows  ●                  │
└────────────────────────────────────────┘
```

---

### Screen 12 — AI Price Monitoring (v1)

Accessible via "More" — this is a background intelligence screen.

```
┌───────────────────────────────────────────┐
│  Price Intelligence                       │
│                                           │
│  ⚠ Tomato — margin declining             │
│    Was 28%  •  Now 19%  •  Check cost    │
│                                           │
│  ⚠ Cucumber — price drop after last rise │
│    Sales ↓ 18% week after price increase  │
│                                           │
│  ● Lemon — stable                         │
│  ● Mango  — stable                        │
└───────────────────────────────────────────┘
```

- Runs nightly, surfaces anomalies only
- No noise when things are fine

---

## Build Order Confirmation

1. Scaffolding (Next.js + Supabase + Tailwind + Auth)
2. Database migrations (files already written)
3. Auth flow (login, role-based routing)
4. Product catalogue CRUD
5. PDF invoice upload + AI parsing
6. Pricing engine logic
7. Price suggestions screen
8. EPOS CSV export/import
9. Purchase price history
10. Waste logging
11. Profit margin dashboard
12. Profit simulator
13. Wholesale price lookup
14. AI price monitoring (v1)
