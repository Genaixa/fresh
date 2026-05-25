"""
Fresh n Fruity – Invoice Indexer
=================================
Scans /var/app/invoices, parses every filename, and writes metadata
into a SQLite database at /var/app/invoices.db.

Run manually:   python3 index_invoices.py
Or called automatically by upload_to_server.ps1 after each upload.

Re-running is safe — existing records are updated, not duplicated.
"""

import os
import re
import sqlite3
from pathlib import Path
from datetime import datetime

INVOICES_DIR = Path("/root/fresh/invoices")
DB_PATH      = Path("/root/fresh/invoices.db")

# ── Filename patterns ──────────────────────────────────────────────────────────
# Total Produce invoice with date:   22-05-2025_F0003T_N381088_38.pdf
# Total Produce invoice no date:     F0003T_N384986_16.pdf
# Total Produce statement with date: 01-09-2023_Statement_F0003T.PDF
# Total Produce statement no date:   Statement_F0003T_48.pdf

TP_INVOICE_DATED   = re.compile(r'^(\d{2})-(\d{2})-(\d{4})_F0003T_N(\d+)', re.I)
TP_INVOICE_NODATED = re.compile(r'^F0003T_N(\d+)',                           re.I)
TP_STATEMENT_DATED = re.compile(r'^(\d{2})-(\d{2})-(\d{4})_Statement_F0003T', re.I)
TP_STATEMENT_NODATED = re.compile(r'^Statement_F0003T',                      re.I)

# JR Holland patterns (all have DD-MM-YYYY_ prefix)
# 02-07-2023_Invoice - Order Despatch Other (JR Hollands).pdf  → invoice
# 17-04-2024_Invoice - Manual (JR Holland).pdf                 → invoice
# 02-04-2024_Produce Ticket.pdf                                → produce-ticket
# 01-11-2023_Sales Ledger Statements (JR Hollands).pdf         → statement
JRH_DATE       = re.compile(r'^(\d{2})-(\d{2})-(\d{4})_(.+)\.pdf$', re.I)
JRH_INVOICE    = re.compile(r'invoice', re.I)
JRH_STATEMENT  = re.compile(r'statement', re.I)
JRH_TICKET     = re.compile(r'produce ticket', re.I)


def parse_filename(filename: str, filepath: Path) -> dict | None:
    """Return a metadata dict for a recognised filename, or None."""
    name = filename

    # ── Total Produce invoice (dated) ──────────────────────────────────────────
    m = TP_INVOICE_DATED.match(name)
    if m:
        day, month, year, inv_num = m.groups()
        return {
            "supplier":       "Total Produce",
            "doc_type":       "invoice",
            "date":           f"{year}-{month}-{day}",
            "year":           int(year),
            "invoice_number": f"F0003T-N{inv_num}",
            "reference":      inv_num,
            "filename":       filename,
            "filepath":       str(filepath),
            "file_size":      filepath.stat().st_size,
        }

    # ── Total Produce invoice (no date — year inferred from path) ──────────────
    m = TP_INVOICE_NODATED.match(name)
    if m:
        inv_num = m.group(1)
        # Year is encoded in the folder path: .../invoices/2025/...
        year = _year_from_path(filepath)
        return {
            "supplier":       "Total Produce",
            "doc_type":       "invoice",
            "date":           None,
            "year":           year,
            "invoice_number": f"F0003T-N{inv_num}",
            "reference":      inv_num,
            "filename":       filename,
            "filepath":       str(filepath),
            "file_size":      filepath.stat().st_size,
        }

    # ── Total Produce statement (dated) ────────────────────────────────────────
    m = TP_STATEMENT_DATED.match(name)
    if m:
        day, month, year = m.groups()
        return {
            "supplier":       "Total Produce",
            "doc_type":       "statement",
            "date":           f"{year}-{month}-{day}",
            "year":           int(year),
            "invoice_number": None,
            "reference":      None,
            "filename":       filename,
            "filepath":       str(filepath),
            "file_size":      filepath.stat().st_size,
        }

    # ── Total Produce statement (no date) ──────────────────────────────────────
    m = TP_STATEMENT_NODATED.match(name)
    if m:
        year = _year_from_path(filepath)
        return {
            "supplier":       "Total Produce",
            "doc_type":       "statement",
            "date":           None,
            "year":           year,
            "invoice_number": None,
            "reference":      None,
            "filename":       filename,
            "filepath":       str(filepath),
            "file_size":      filepath.stat().st_size,
        }

    # ── JR Holland (all doc types share the same DD-MM-YYYY_ prefix pattern) ──────
    m = JRH_DATE.match(name)
    if m and 'jr-holland' in str(filepath):
        day, month, year, desc = m.groups()
        if JRH_TICKET.search(desc):
            doc_type = "produce-ticket"
        elif JRH_STATEMENT.search(desc):
            doc_type = "statement"
        elif JRH_INVOICE.search(desc):
            doc_type = "invoice"
        else:
            doc_type = "other"
        return {
            "supplier":       "JR Holland",
            "doc_type":       doc_type,
            "date":           f"{year}-{month}-{day}",
            "year":           int(year),
            "invoice_number": None,
            "reference":      desc.strip(),
            "filename":       filename,
            "filepath":       str(filepath),
            "file_size":      filepath.stat().st_size,
        }

    return None   # unrecognised filename


def _year_from_path(p: Path) -> int | None:
    """Extract a 4-digit year from any part of the file path."""
    for part in p.parts:
        if re.fullmatch(r'\d{4}', part):
            return int(part)
    return None


# ── Database setup ─────────────────────────────────────────────────────────────

def init_db(conn: sqlite3.Connection):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier       TEXT    NOT NULL,
            doc_type       TEXT    NOT NULL,   -- 'invoice' | 'statement'
            date           TEXT,               -- ISO YYYY-MM-DD or NULL
            year           INTEGER,
            invoice_number TEXT,
            reference      TEXT,
            filename       TEXT    NOT NULL,
            filepath       TEXT    NOT NULL UNIQUE,
            file_size      INTEGER,
            indexed_at     TEXT    NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_supplier  ON invoices(supplier)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_doc_type  ON invoices(doc_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_year      ON invoices(year)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_inv_num   ON invoices(invoice_number)")
    conn.commit()


def upsert(conn: sqlite3.Connection, record: dict):
    record["indexed_at"] = datetime.utcnow().isoformat()
    conn.execute("""
        INSERT INTO invoices
            (supplier, doc_type, date, year, invoice_number, reference,
             filename, filepath, file_size, indexed_at)
        VALUES
            (:supplier, :doc_type, :date, :year, :invoice_number, :reference,
             :filename, :filepath, :file_size, :indexed_at)
        ON CONFLICT(filepath) DO UPDATE SET
            supplier       = excluded.supplier,
            doc_type       = excluded.doc_type,
            date           = excluded.date,
            year           = excluded.year,
            invoice_number = excluded.invoice_number,
            reference      = excluded.reference,
            filename       = excluded.filename,
            file_size      = excluded.file_size,
            indexed_at     = excluded.indexed_at
    """, record)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Fresh n Fruity – Invoice Indexer")
    print("=" * 60)
    print(f"\n📁  Scanning: {INVOICES_DIR}")
    print(f"🗄️   Database: {DB_PATH}\n")

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    indexed  = 0
    skipped  = 0

    for pdf in sorted(INVOICES_DIR.rglob("*.pdf")) + sorted(INVOICES_DIR.rglob("*.PDF")):
        record = parse_filename(pdf.name, pdf)
        if record:
            upsert(conn, record)
            indexed += 1
            if indexed % 50 == 0:
                print(f"  …indexed {indexed} files so far")
        else:
            print(f"  ⚠️  Unrecognised: {pdf.name}")
            skipped += 1

    conn.commit()
    conn.close()

    total = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0] if False else indexed
    print(f"\n✅  Indexed : {indexed} files")
    print(f"⚠️   Skipped : {skipped} unrecognised filenames")
    print(f"\nDatabase ready at {DB_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
