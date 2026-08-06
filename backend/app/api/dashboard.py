from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_branch
from app.database import get_db
from app.models import Order, OrderItem, Product, User, Branch, Role
from app.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    branch_id = None
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        branch_id = current_branch.id
    elif current_branch:
        branch_id = current_branch.id

    # Base query for orders
    order_base_q = db.query(Order).filter(Order.status == "paid")
    if branch_id:
        order_base_q = order_base_q.filter(Order.branch_id == branch_id)

    # Paid orders today
    paid_orders_today = order_base_q.filter(
        Order.paid_at >= today_start,
        Order.paid_at < today_end,
    ).all()

    today_revenue = sum(o.total for o in paid_orders_today)
    today_orders_count = len(paid_orders_today)

    # Items sold today
    items_today_q = db.query(func.coalesce(func.sum(OrderItem.qty), 0)).join(Order)
    if branch_id:
        items_today_q = items_today_q.filter(Order.branch_id == branch_id)
        
    items_today = items_today_q.filter(
        Order.status == "paid",
        Order.paid_at >= today_start,
        Order.paid_at < today_end,
    ).scalar()

    # Open orders
    open_orders_q = db.query(func.count(Order.id)).filter(Order.status == "open")
    if branch_id:
        open_orders_q = open_orders_q.filter(Order.branch_id == branch_id)
    open_orders = open_orders_q.scalar()

    # Low stock products
    low_stock_q = db.query(func.count(Product.id)).filter(
        Product.stock < 10, Product.is_active == True
    )
    if branch_id:
        low_stock_q = low_stock_q.filter(Product.branch_id == branch_id)
    low_stock = low_stock_q.scalar()

    # Revenue 7 days
    revenue_7d = []
    for i in range(7, 0, -1):
        day_start = now - timedelta(days=i)
        day_start = day_start.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        rev_q = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
            Order.status == "paid", Order.paid_at >= day_start, Order.paid_at < day_end
        )
        if branch_id:
            rev_q = rev_q.filter(Order.branch_id == branch_id)
        rev = rev_q.scalar()

        order_count_q = db.query(func.count(Order.id)).filter(
            Order.status == "paid", Order.paid_at >= day_start, Order.paid_at < day_end
        )
        if branch_id:
            order_count_q = order_count_q.filter(Order.branch_id == branch_id)
        order_count = order_count_q.scalar()
        
        revenue_7d.append(
            {"date": day_start.strftime("%Y-%m-%d"), "revenue": float(rev), "orders": order_count}
        )

    return DashboardStats(
        today_revenue=float(today_revenue),
        today_orders=today_orders_count,
        today_items=int(items_today or 0),
        today_customers=0, # This requires counting customers by branch, kept as 0 for now
        open_orders=int(open_orders or 0),
        low_stock=int(low_stock or 0),
        revenue_7d=revenue_7d,
    )