"""
Fresh n Fruity – Invoice REST API
===================================
FastAPI app serving invoice metadata from SQLite.
Files are served directly from disk.

Start manually:
    cd /var/app
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Or via systemd (set up by server_setup.sh):
    systemctl start invoice-api

Endpoints:
    GET  /                          Health check
    GET  /invoices                  List/search invoices
    GET  /invoices/{id}             Single invoice metadata
    GET  /invoices/{id}/download    Download the PDF
    GET  /stats                     Summary counts by supplier/year/type
"""

from pathlib import Path
from typing import Optional

import sqlite3
import aiofiles

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse

DB_PATH = Path("/root/fresh/invoices.db")

app = FastAPI(
    title="Fresh n Fruity – Invoice API",
    description="Search and download supplier invoices",
    version="1.0.0",
)


# ── DB helper ──────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "Fresh n Fruity Invoice API"}


@app.get("/invoices")
def list_invoices(
    supplier:  Optional[str] = Query(None, description="e.g. 'Total Produce'"),
    doc_type:  Optional[str] = Query(None, description="'invoice' or 'statement'"),
    year:      Optional[int] = Query(None, description="e.g. 2024"),
    reference: Optional[str] = Query(None, description="Partial invoice number search"),
    limit:     int           = Query(100, le=2000),
    offset:    int           = Query(0),
):
    """
    List invoices with optional filters.
    Example: /invoices?supplier=Total+Produce&year=2024&doc_type=invoice
    """
    where_clauses = []
    params = []

    if supplier:
        where_clauses.append("supplier LIKE ?")
        params.append(f"%{supplier}%")
    if doc_type:
        where_clauses.append("doc_type = ?")
        params.append(doc_type)
    if year:
        where_clauses.append("year = ?")
        params.append(year)
    if reference:
        where_clauses.append("(invoice_number LIKE ? OR reference LIKE ?)")
        params.extend([f"%{reference}%", f"%{reference}%"])

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    params.extend([limit, offset])

    with get_db() as conn:
        rows = conn.execute(
            f"""
            SELECT * FROM invoices
            {where_sql}
            ORDER BY date DESC, invoice_number DESC
            LIMIT ? OFFSET ?
            """,
            params,
        ).fetchall()

        total = conn.execute(
            f"SELECT COUNT(*) FROM invoices {where_sql}",
            params[:-2],
        ).fetchone()[0]

    return {
        "total":   total,
        "limit":   limit,
        "offset":  offset,
        "results": [dict(r) for r in rows],
    }


@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int):
    """Get a single invoice's metadata by its database ID."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM invoices WHERE id = ?", (invoice_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return dict(row)


@app.get("/invoices/{invoice_id}/items")
def get_invoice_items(invoice_id: int):
    """All extracted line items for a single invoice."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, invoice_id, product_name, product_code,
                   quantity, unit, unit_price_p, total_price_p,
                   delivery_date, ticket_number
            FROM invoice_items
            WHERE invoice_id = ?
            ORDER BY product_name
            """,
            (invoice_id,),
        ).fetchall()
    return {"invoice_id": invoice_id, "items": [dict(r) for r in rows]}


@app.get("/invoices/{invoice_id}/deliveries")
def get_invoice_deliveries(invoice_id: int):
    """Delivery tickets grouped within a single invoice."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
                COALESCE(ticket_number, 'all') AS ticket_key,
                ticket_number,
                delivery_date,
                COUNT(*) AS item_count
            FROM invoice_items
            WHERE invoice_id = ?
            GROUP BY ticket_number, delivery_date
            ORDER BY delivery_date DESC, ticket_number DESC
            """,
            (invoice_id,),
        ).fetchall()
    return {"invoice_id": invoice_id, "deliveries": [dict(r) for r in rows]}


@app.get("/invoices/{invoice_id}/deliveries/{ticket_key}/items")
def get_delivery_items(invoice_id: int, ticket_key: str):
    """Line items for a specific delivery ticket within an invoice."""
    with get_db() as conn:
        if ticket_key == 'all':
            rows = conn.execute(
                """
                SELECT id, invoice_id, product_name, product_code,
                       quantity, unit, unit_price_p, total_price_p,
                       delivery_date, ticket_number
                FROM invoice_items
                WHERE invoice_id = ? AND ticket_number IS NULL
                ORDER BY product_name
                """,
                (invoice_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, invoice_id, product_name, product_code,
                       quantity, unit, unit_price_p, total_price_p,
                       delivery_date, ticket_number
                FROM invoice_items
                WHERE invoice_id = ? AND ticket_number = ?
                ORDER BY product_name
                """,
                (invoice_id, ticket_key),
            ).fetchall()
    return {"invoice_id": invoice_id, "ticket_key": ticket_key, "items": [dict(r) for r in rows]}


@app.get("/invoices/{invoice_id}/download")
def download_invoice(invoice_id: int):
    """Download the PDF file for an invoice."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT filename, filepath FROM invoices WHERE id = ?", (invoice_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")

    filepath = Path(row["filepath"])
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(filepath),
        filename=row["filename"],
        media_type="application/pdf",
    )


@app.get("/prices")
def list_prices(
    product:  Optional[str] = Query(None, description="Partial product name search"),
    supplier: Optional[str] = Query(None, description="e.g. 'Total Produce'"),
    limit:    int            = Query(100, le=500),
    offset:   int            = Query(0),
):
    """
    Latest unit price per product (most recent invoice wins).
    Example: /prices?product=banana&supplier=Total+Produce
    """
    where = ["ii.product_name != ''"]
    params: list = []

    if product:
        where.append("ii.product_name LIKE ?")
        params.append(f"%{product}%")
    if supplier:
        where.append("i.supplier LIKE ?")
        params.append(f"%{supplier}%")

    where_sql = "WHERE " + " AND ".join(where)
    params_count = list(params)
    params.extend([limit, offset])

    with get_db() as conn:
        rows = conn.execute(
            f"""
            SELECT
                ii.product_name,
                ii.product_code,
                ii.unit,
                ii.unit_price_p,
                ii.total_price_p,
                ii.quantity,
                i.supplier,
                i.date        AS latest_date,
                i.id          AS invoice_id
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            {where_sql}
              AND i.date = (
                SELECT MAX(i2.date)
                FROM invoice_items ii2
                JOIN invoices i2 ON i2.id = ii2.invoice_id
                WHERE ii2.product_name = ii.product_name
                  AND i2.supplier = i.supplier
              )
            GROUP BY ii.product_name, i.supplier
            ORDER BY ii.product_name, i.supplier
            LIMIT ? OFFSET ?
            """,
            params,
        ).fetchall()

        total = conn.execute(
            f"""
            SELECT COUNT(DISTINCT ii.product_name || '|' || i.supplier)
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            {where_sql}
            """,
            params_count,
        ).fetchone()[0]

    return {
        "total":   total,
        "limit":   limit,
        "offset":  offset,
        "results": [dict(r) for r in rows],
    }


@app.get("/prices/history")
def price_history(
    product:  str            = Query(..., description="Product name (partial match)"),
    supplier: Optional[str]  = Query(None, description="e.g. 'JR Holland'"),
    limit:    int             = Query(200, le=1000),
):
    """
    Price history for a product over time, oldest-first.
    Example: /prices/history?product=banana&supplier=JR+Holland
    """
    where = ["ii.product_name LIKE ?"]
    params: list = [f"%{product}%"]

    if supplier:
        where.append("i.supplier LIKE ?")
        params.append(f"%{supplier}%")

    where_sql = "WHERE " + " AND ".join(where)
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(
            f"""
            SELECT
                i.date,
                i.supplier,
                i.doc_type,
                i.invoice_number,
                ii.product_name,
                ii.product_code,
                ii.quantity,
                ii.unit,
                ii.unit_price_p,
                ii.total_price_p,
                i.id AS invoice_id
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            {where_sql}
            ORDER BY i.date ASC
            LIMIT ?
            """,
            params,
        ).fetchall()

    return {
        "product_query": product,
        "supplier":      supplier,
        "count":         len(rows),
        "history":       [dict(r) for r in rows],
    }


@app.get("/prices/products")
def list_products(
    supplier: Optional[str] = Query(None),
    search:   Optional[str] = Query(None),
    limit:    int            = Query(200, le=1000),
):
    """All distinct product names known to the system."""
    where = []
    params: list = []

    if supplier:
        where.append("i.supplier LIKE ?")
        params.append(f"%{supplier}%")
    if search:
        where.append("ii.product_name LIKE ?")
        params.append(f"%{search}%")

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT ii.product_name, i.supplier,
                   MAX(i.date) AS last_seen,
                   COUNT(*)    AS occurrences
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            {where_sql}
            GROUP BY ii.product_name, i.supplier
            ORDER BY ii.product_name, i.supplier
            LIMIT ?
            """,
            params,
        ).fetchall()

    return {"count": len(rows), "products": [dict(r) for r in rows]}


@app.get("/extraction/status")
def extraction_status():
    """Shows how many invoices have been processed for price extraction."""
    with get_db() as conn:
        summary = conn.execute("""
            SELECT status, COUNT(*) AS n, SUM(items_found) AS items
            FROM extraction_log GROUP BY status
        """).fetchall()

        pending = conn.execute("""
            SELECT COUNT(*) FROM invoices i
            LEFT JOIN extraction_log el ON el.invoice_id = i.id
            WHERE i.doc_type IN ('invoice','produce-ticket')
              AND el.invoice_id IS NULL
        """).fetchone()[0]

        total_items = conn.execute(
            "SELECT COUNT(*) FROM invoice_items"
        ).fetchone()[0]

    return {
        "pending":     pending,
        "total_items": total_items,
        "by_status":   [dict(r) for r in summary],
    }


@app.get("/stats")
def stats():
    """Summary counts — useful dashboard data."""
    with get_db() as conn:
        by_supplier = conn.execute("""
            SELECT supplier, COUNT(*) AS count
            FROM invoices GROUP BY supplier ORDER BY count DESC
        """).fetchall()

        by_year = conn.execute("""
            SELECT year, doc_type, COUNT(*) AS count
            FROM invoices GROUP BY year, doc_type ORDER BY year DESC, doc_type
        """).fetchall()

        total = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]

    return {
        "total_files":   total,
        "by_supplier":   [dict(r) for r in by_supplier],
        "by_year_type":  [dict(r) for r in by_year],
    }
