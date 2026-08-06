from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
import openpyxl

from app.core.deps import get_admin_user, get_current_user, get_current_branch
from app.database import get_db
from app.models import Order, OrderItem, Payment, Product, User, Branch, Role

router = APIRouter(prefix="/reports", tags=["reports"])


# Helper to apply date and branch filters consistently
def apply_filters(query, date_from: Optional[str], date_to: Optional[str], date_field, branch_id: Optional[int], branch_field):
    if date_from:
        query = query.filter(date_field >= date_from)
    if date_to:
        query = query.filter(date_field <= date_to + " 23:59:59")
    if branch_id:
        query = query.filter(branch_field == branch_id)
    return query


@router.get("/summary")
def summary_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = now.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d")
    if not date_to:
        date_to = now.strftime("%Y-%m-%d")

    branch_id = None
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        branch_id = current_branch.id
    elif current_branch:
        branch_id = current_branch.id

    q = db.query(Order).filter(Order.status == "paid")
    paid = apply_filters(q, date_from, date_to, Order.paid_at, branch_id, Order.branch_id).all()

    total_revenue = sum(o.total for o in paid)
    total_orders = len(paid)
    total_items = sum(sum(i.qty for i in o.items) for o in paid)
    avg_order = total_revenue / total_orders if total_orders else 0

    by_payment = {}
    for o in paid:
        method = o.payment_method or "unknown"
        by_payment[method] = by_payment.get(method, 0) + o.total

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "total_items": total_items,
        "avg_order": round(avg_order),
        "by_payment_method": by_payment,
    }


@router.get("/products/top")
def top_products(
    limit: int = Query(10, ge=1, le=50),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = now.strftime("%Y-%m-%d")

    branch_id = None
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        branch_id = current_branch.id
    elif current_branch:
        branch_id = current_branch.id

    q = db.query(
        OrderItem.product_id,
        OrderItem.product_name,
        func.sum(OrderItem.qty).label("qty"),
        func.sum(OrderItem.subtotal).label("revenue"),
    ).join(Order).filter(Order.status == "paid")
    
    items = apply_filters(q, date_from, date_to, Order.paid_at, branch_id, Order.branch_id) \
        .group_by(OrderItem.product_id, OrderItem.product_name) \
        .order_by(func.sum(OrderItem.qty).desc()) \
        .limit(limit) \
        .all()

    return [
        {
            "product_id": i.product_id,
            "name": i.product_name,
            "qty_sold": int(i.qty),
            "revenue": float(i.revenue),
        }
        for i in items
    ]


@router.get("/products/low-stock")
def low_stock_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Product).filter(Product.is_active == True)
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Product.branch_id == current_branch.id)
    elif current_branch:
        q = q.filter(Product.branch_id == current_branch.id)
        
    return q.order_by(Product.stock.asc()).all()


@router.get("/daily")
def daily_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = now.strftime("%Y-%m-%d")
        
    branch_id = None
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        branch_id = current_branch.id
    elif current_branch:
        branch_id = current_branch.id

    start_date = datetime.strptime(date_from, "%Y-%m-%d")
    end_date = datetime.strptime(date_to, "%Y-%m-%d")
    
    result = []
    current = start_date
    while current <= end_date:
        day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        q = db.query(Order).filter(Order.status == "paid", Order.paid_at >= day_start, Order.paid_at < day_end)
        if branch_id:
            q = q.filter(Order.branch_id == branch_id)
            
        paid_orders = q.all()
        result.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "revenue": sum(o.total for o in paid_orders),
            "orders": len(paid_orders),
            "items": sum(sum(i.qty for i in o.items) for o in paid_orders),
        })
        current += timedelta(days=1)
    return result


def _create_excel_response(workbook, filename: str):
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"},
    )

@router.get("/excel/daily")
def daily_excel_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch),
):
    report_data = daily_report(date_from, date_to, db, current_user, current_branch)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Laporan Harian"
    ws.append(["Tanggal", "Pendapatan", "Jumlah Order", "Jumlah Item"])
    for row in report_data:
        ws.append([row["date"], row["revenue"], row["orders"], row["items"]])

    return _create_excel_response(wb, f"laporan_harian_{date_from}_sd_{date_to}")


@router.get("/excel/monthly")
def monthly_excel_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch),
):
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = now.strftime("%Y-%m-%d")

    branch_id = None
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        branch_id = current_branch.id
    elif current_branch:
        branch_id = current_branch.id

    monthly_data = {}
    q = db.query(Order).filter(Order.status == "paid")
    if branch_id:
        q = q.filter(Order.branch_id == branch_id)
        
    paid_orders = apply_filters(q, date_from, date_to, Order.paid_at, None, None).all()

    for order in paid_orders:
        month_key = order.paid_at.strftime("%Y-%m")
        if month_key not in monthly_data:
            monthly_data[month_key] = {"revenue": 0, "orders": 0, "items": 0}
        monthly_data[month_key]["revenue"] += order.total
        monthly_data[month_key]["orders"] += 1
        monthly_data[month_key]["items"] += sum(i.qty for i in order.items)
    
    report_data = []
    for month_key in sorted(monthly_data.keys()):
        report_data.append({
            "month": month_key,
            "revenue": monthly_data[month_key]["revenue"],
            "orders": monthly_data[month_key]["orders"],
            "items": monthly_data[month_key]["items"],
        })

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Laporan Bulanan"
    ws.append(["Bulan", "Pendapatan", "Jumlah Order", "Jumlah Item"])
    for row in report_data:
        ws.append([row["month"], row["revenue"], row["orders"], row["items"]])

    return _create_excel_response(wb, f"laporan_bulanan_{date_from}_sd_{date_to}")


@router.get("/excel/cashier")
def cashier_excel_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    cashier_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch),
):
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = now.strftime("%Y-%m-%d")
    if not date_to:
        date_to = now.strftime("%Y-%m-%d")

    branch_id = None
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        branch_id = current_branch.id
    elif current_branch:
        branch_id = current_branch.id

    q = db.query(Order).filter(Order.status == "paid")
    if branch_id:
        q = q.filter(Order.branch_id == branch_id)
    if cashier_id:
        q = q.filter(Order.cashier_id == cashier_id)
    
    paid_orders = apply_filters(q, date_from, date_to, Order.paid_at, None, None).all()

    cashier_data = {}
    for order in paid_orders:
        cashier_name = order.cashier.full_name or order.cashier.username if order.cashier else "Unknown"
        if cashier_name not in cashier_data:
            cashier_data[cashier_name] = {"revenue": 0, "orders": 0, "items": 0}
        
        cashier_data[cashier_name]["revenue"] += order.total
        cashier_data[cashier_name]["orders"] += 1
        cashier_data[cashier_name]["items"] += sum(i.qty for i in order.items)
    
    report_data = []
    for name, data in cashier_data.items():
        report_data.append({
            "cashier": name,
            "revenue": data["revenue"],
            "orders": data["orders"],
            "items": data["items"],
        })
    report_data.sort(key=lambda x: x["cashier"])

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Laporan Kasir"
    ws.append(["Kasir", "Pendapatan", "Jumlah Order", "Jumlah Item"])
    for row in report_data:
        ws.append([row["cashier"], row["revenue"], row["orders"], row["items"]])

    return _create_excel_response(wb, f"laporan_kasir_{date_from}_sd_{date_to}")
