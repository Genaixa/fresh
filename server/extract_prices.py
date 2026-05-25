"""
Fresh n Fruity – Invoice Price Extractor (Pattern-Based)
=========================================================
Zero API cost — uses pdfplumber text extraction + regex parsers.

Suppliers handled:
  • Total Produce / Dole Wholesale (same format)
      Column header:  Date  Ticket/Delivery  Description  Qty  Per  Price  Value  Vat
      Date line:      26/02/2024  9469641  APPLEROYALGALA  1  B  12.00  12.00  0.00
      Continuation:   BANANA.  2  B  18.50  37.00  0.00

  • JR Holland Sales Invoices
      Column header:  Ticket No  Cust Ref  Date  Description  Vat %  Qty  Price  Value
      Ticket line:    2413204  .  22-JUN  WATER X6 MABE  0  6  17.00  102.00
      Continuation:   PLUMS PARISIENNE  0  3  12.00  36.00

  • JR Holland Produce Tickets
      Column header:  QTY  PRODUCT DESCRIPTION  VAT  PRICE  VALUE
      Data line:      9  COURGETTES - POUPART  0  £5.50  £49.50

Run:
    source venv/bin/activate
    python3 extract_prices.py          # all unprocessed
    python3 extract_prices.py --force  # re-extract everything
"""

import argparse
import re
import sqlite3
from datetime import datetime
from pathlib import Path

import pdfplumber

DB_PATH      = Path("/root/fresh/invoices.db")
EXTRACT_TYPES = {"invoice", "produce-ticket"}


# ── Total Produce / Dole parsers ───────────────────────────────────────────────

# 26/02/2024  9469641  APPLEROYALGALA  1  B  12.00  12.00  0.00
_TP_DATE_LINE = re.compile(
    r'^(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+?)\s+(\d+)\s+([A-Z])\s+([\d.]+)\s+([\d.]+)\s+[\d.]+$'
)
# BANANA.  2  B  18.50  37.00  0.00
_TP_CONT_LINE = re.compile(
    r'^([A-Z][A-Z0-9\.\-/\' ]+?)\s+(\d+)\s+([A-Z])\s+([\d.]+)\s+([\d.]+)\s+[\d.]+$'
)

def parse_total_produce(text: str) -> list[dict]:
    items = []
    in_data = False
    cur_date   = None
    cur_ticket = None

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        if 'Date' in line and 'Ticket' in line and 'Description' in line:
            in_data = True
            continue

        if not in_data:
            continue

        m = _TP_DATE_LINE.match(line)
        if m:
            date_str, ticket, desc, qty, unit, price, value = m.groups()
            cur_date   = _parse_ddmmyyyy(date_str)
            cur_ticket = ticket
            items.append(_tp_row(desc, qty, unit, price, value, cur_date, cur_ticket))
            continue

        m = _TP_CONT_LINE.match(line)
        if m:
            desc, qty, unit, price, value = m.groups()
            items.append(_tp_row(desc, qty, unit, price, value, cur_date, cur_ticket))

    return items

def _tp_row(desc, qty, unit, price, value, delivery_date=None, ticket_number=None):
    return {
        'product_name':  desc.strip().rstrip('.'),
        'product_code':  None,
        'quantity':      float(qty),
        'unit':          unit,
        'unit_price_p':  _pence(price),
        'total_price_p': _pence(value),
        'delivery_date': delivery_date,
        'ticket_number': ticket_number,
    }

def _parse_ddmmyyyy(s: str):
    try:
        return datetime.strptime(s, '%d/%m/%Y').strftime('%Y-%m-%d')
    except ValueError:
        return None


# ── JR Holland Sales Invoice parsers ──────────────────────────────────────────

# 2413204  .  22-JUN  WATER X6 MABE  0  6  17.00  102.00
_JRH_TICKET_LINE = re.compile(
    r'^(\d{5,8})\s+\S+\s+\d{2}-[A-Z]{3}\s+(.+?)\s+([0-4])\s+(\d+)\s+([\d.]+)\s+([\d.]+)$'
)
# PLUMS PARISIENNE  0  3  12.00  36.00
_JRH_CONT_LINE = re.compile(
    r'^([A-Z][A-Z0-9 \-/\'\.&%\(\)X]+?)\s+([0-4])\s+(\d+)\s+([\d.]+)\s+([\d.]+)$'
)
_JRH_INV_SKIP = re.compile(
    r'^(Ticket Total|Total Packs|Net Value|VAT|INVOICE TOTAL|C/Fwd|Bank Details|'
    r'Sort Code|Tel:|Fax:|www\.|Vat Reg|SALES INVOICE|Invoice No|Invoice To|'
    r'Delivered To|Order Date|Tax Date|POD Ref|Ticket No)',
    re.I
)

def parse_jrh_invoice(text: str) -> list[dict]:
    items = []
    in_data    = False
    cur_ticket = None

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        if 'Ticket No' in line and 'Description' in line:
            in_data = True
            continue

        if not in_data:
            continue

        if _JRH_INV_SKIP.match(line):
            continue

        m = _JRH_TICKET_LINE.match(line)
        if m:
            ticket, desc, _vat, qty, price, value = m.groups()
            cur_ticket = ticket
            items.append(_jrh_row(desc, qty, None, price, value, ticket_number=cur_ticket))
            continue

        m = _JRH_CONT_LINE.match(line)
        if m:
            desc, _vat, qty, price, value = m.groups()
            items.append(_jrh_row(desc, qty, None, price, value, ticket_number=cur_ticket))

    return items


# ── JR Holland Produce Ticket parser ──────────────────────────────────────────

# 9  COURGETTES - POUPART  0  £5.50  £49.50
_JRH_TICKET_ROW = re.compile(
    r'^(\d+)\s+(.+?)\s+[0-4]\s+£([\d.]+)\s+£([\d.]+)$'
)
_JRH_TICKET_SKIP = re.compile(
    r'^(Total Quantity|VAT Rate|Goods Amount|VAT Amount|Ticket Value|'
    r'Acc Code|Ticket Ref|Ticket No|Ticket Date|Tax Date|Taken Time|Salesman|'
    r'Tel:|Fax:|www\.|Vat Reg|Co\. Reg|79-84)',
    re.I
)

def parse_jrh_ticket(text: str) -> list[dict]:
    items = []
    in_data = False

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        if 'QTY' in line and 'DESCRIPTION' in line and 'PRICE' in line:
            in_data = True
            continue

        if not in_data:
            continue

        if _JRH_TICKET_SKIP.match(line):
            continue

        m = _JRH_TICKET_ROW.match(line)
        if m:
            qty, desc, price, value = m.groups()
            items.append(_jrh_row(desc, qty, None, price, value))

    return items


def _jrh_row(desc, qty, unit, price, value, delivery_date=None, ticket_number=None):
    return {
        'product_name':  desc.strip(),
        'product_code':  None,
        'quantity':      float(qty),
        'unit':          unit,
        'unit_price_p':  _pence(price),
        'total_price_p': _pence(value),
        'delivery_date': delivery_date,
        'ticket_number': ticket_number,
    }


# ── Dispatcher ─────────────────────────────────────────────────────────────────

def parse_invoice(filepath: Path, supplier: str, doc_type: str) -> list[dict]:
    with pdfplumber.open(filepath) as pdf:
        pages = [p.extract_text(x_tolerance=3, y_tolerance=3) or '' for p in pdf.pages]
    text = '\n'.join(pages)

    if 'Total Produce' in supplier or 'Dole' in supplier:
        return parse_total_produce(text)
    if 'JR Holland' in supplier or 'jr-holland' in str(filepath):
        if doc_type == 'produce-ticket':
            return parse_jrh_ticket(text)
        return parse_jrh_invoice(text)
    return []


# ── Helpers ────────────────────────────────────────────────────────────────────

def _pence(value: str) -> int:
    return round(float(value) * 100)


# ── DB helpers ─────────────────────────────────────────────────────────────────

def init_db(conn: sqlite3.Connection):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS invoice_items (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id     INTEGER NOT NULL REFERENCES invoices(id),
            product_name   TEXT    NOT NULL,
            product_code   TEXT,
            quantity       REAL,
            unit           TEXT,
            unit_price_p   INTEGER,
            total_price_p  INTEGER,
            delivery_date  TEXT,
            ticket_number  TEXT,
            extracted_at   TEXT    NOT NULL
        )
    """)
    # Migrate existing DBs that don't yet have the delivery columns
    for col in ('delivery_date', 'ticket_number'):
        try:
            conn.execute(f"ALTER TABLE invoice_items ADD COLUMN {col} TEXT")
        except Exception:
            pass
    conn.execute("CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_items_product ON invoice_items(product_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_items_ticket ON invoice_items(invoice_id, ticket_number)")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS extraction_log (
            invoice_id   INTEGER PRIMARY KEY REFERENCES invoices(id),
            status       TEXT NOT NULL,
            items_found  INTEGER DEFAULT 0,
            error_msg    TEXT,
            extracted_at TEXT NOT NULL
        )
    """)
    conn.commit()


def get_queue(conn: sqlite3.Connection, force: bool) -> list[dict]:
    types = ",".join(f"'{t}'" for t in EXTRACT_TYPES)
    if force:
        return [dict(r) for r in conn.execute(
            f"SELECT id, filepath, supplier, doc_type, date FROM invoices "
            f"WHERE doc_type IN ({types}) ORDER BY date"
        ).fetchall()]
    return [dict(r) for r in conn.execute(f"""
        SELECT i.id, i.filepath, i.supplier, i.doc_type, i.date
        FROM invoices i
        LEFT JOIN extraction_log el ON el.invoice_id = i.id
        WHERE i.doc_type IN ({types}) AND el.invoice_id IS NULL
        ORDER BY i.date
    """).fetchall()]


def save_items(conn: sqlite3.Connection, invoice_id: int, items: list[dict]):
    conn.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (invoice_id,))
    now = datetime.utcnow().isoformat()
    for item in items:
        name = (item.get('product_name') or '').strip()
        if not name:
            continue
        conn.execute("""
            INSERT INTO invoice_items
                (invoice_id, product_name, product_code, quantity, unit,
                 unit_price_p, total_price_p, delivery_date, ticket_number, extracted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            invoice_id, name,
            item.get('product_code'),
            item.get('quantity'),
            item.get('unit'),
            item.get('unit_price_p'),
            item.get('total_price_p'),
            item.get('delivery_date'),
            item.get('ticket_number'),
            now,
        ))


def log_result(conn, invoice_id, status, items_found=0, error_msg=None):
    conn.execute("""
        INSERT INTO extraction_log (invoice_id, status, items_found, error_msg, extracted_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(invoice_id) DO UPDATE SET
            status=excluded.status, items_found=excluded.items_found,
            error_msg=excluded.error_msg, extracted_at=excluded.extracted_at
    """, (invoice_id, status, items_found, error_msg, datetime.utcnow().isoformat()))
    conn.commit()


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true',
                        help='Re-extract already-processed invoices')
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    init_db(conn)

    queue = get_queue(conn, force=args.force)
    total = len(queue)

    print('=' * 62)
    print('  Fresh n Fruity – Price Extractor (pattern-based)')
    print('=' * 62)
    print(f'  To process : {total} files')
    print()

    ok = errors = empty = 0
    items_total = 0

    for i, inv in enumerate(queue, 1):
        path  = Path(inv['filepath'])
        label = f"[{i:>3}/{total}] {inv['supplier']:<16} {inv['doc_type']:<16} {inv['date'] or 'no-date'}"

        if not path.exists():
            print(f'  MISSING  {label}')
            log_result(conn, inv['id'], 'error', error_msg='file not found')
            errors += 1
            continue

        try:
            items = parse_invoice(path, inv['supplier'], inv['doc_type'])

            if not items:
                print(f'  EMPTY    {label}')
                log_result(conn, inv['id'], 'empty')
                empty += 1
            else:
                save_items(conn, inv['id'], items)
                log_result(conn, inv['id'], 'ok', items_found=len(items))
                items_total += len(items)
                ok += 1
                print(f'  OK {len(items):>3} items  {label}')

        except Exception as e:
            print(f'  ERROR    {label}  ({e})')
            log_result(conn, inv['id'], 'error', error_msg=str(e)[:300])
            errors += 1

    conn.close()
    print()
    print('=' * 62)
    print(f'  OK: {ok}  Empty: {empty}  Errors: {errors}')
    print(f'  Total line items extracted: {items_total}')
    print('=' * 62)


if __name__ == '__main__':
    main()
