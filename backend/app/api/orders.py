from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_admin_user, get_current_branch
from app.database import get_db
from app.models import Order, OrderItem, Product, Voucher, User, Branch
from app.schemas import Message, OrderCreate, OrderOut, OrderItemOut

router = APIRouter(prefix="/orders", tags=["orders"])


def generate_order_number(db: Session, branch_id: int) -> str:
    # Ensure order numbers are unique per branch
    last = db.query(Order).filter(Order.branch_id == branch_id).order_by(Order.id.desc()).first()
    num = (last.id + 1) if last else 1
    return f"ORD-{branch_id}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{num:05d}"


@router.get("", response_model=list[OrderOut])
def list_orders(
    status: Optional[str] = None,
    branch_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Order)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Order.branch_id == current_branch.id)
    elif branch_id: # Superadmin can filter by branch_id query param
        q = q.filter(Order.branch_id == branch_id)
    elif current_branch: # Superadmin specified a branch via header
        q = q.filter(Order.branch_id == current_branch.id)

    if status:
        q = q.filter(Order.status == status)
    if date_from:
        q = q.filter(Order.created_at >= date_from)
    if date_to:
        q = q.filter(Order.created_at <= date_to + " 23:59:59")
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return orders


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Order)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Order.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Order.branch_id == current_branch.id)
        
    order = q.filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    return order


@router.post("", response_model=OrderOut)
def create_order(
    body: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Branch = Depends(get_current_branch), # User must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")
    
    order_number = generate_order_number(db, current_branch.id)

    order = Order(
        order_number=order_number,
        customer_id=body.customer_id,
        cashier_id=current_user.id,
        branch_id=current_branch.id, # Assign current branch_id
        status="open",
        notes=body.notes,
    )
    db.add(order)
    db.flush() # Flush to get order.id

    subtotal = 0
    for item in body.items:
        # Product must belong to the current branch
        product = db.query(Product).filter(Product.id == item.product_id, Product.branch_id == current_branch.id).first()
        if not product:
            raise HTTPException(404, f"Produk ID {item.product_id} tidak ditemukan di cabang ini")
        if product.stock < item.qty:
            raise HTTPException(400, f"Stok {product.name} tidak cukup")
        
        item_price = item.price if item.price is not None else product.price
        item_discount = product.discount or 0
        item_subtotal = (item_price - item_discount) * item.qty
        # Strip branch suffix from product name for cleaner receipts
        clean_name = product.name.replace(f" ({current_branch.name})", "").strip()
        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=clean_name,
            sku=product.sku,
            price=item_price,
            hpp=product.hpp,
            discount=item_discount,
            qty=item.qty,
            subtotal=item_subtotal,
        )
        db.add(order_item)
        product.stock -= item.qty
        subtotal += item_subtotal

    order.subtotal = round(subtotal)
    order.total = round(subtotal)
    db.commit()
    db.refresh(order)
    return order


@router.put("/{order_id}/void", response_model=OrderOut)
def void_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    order = db.query(Order).filter(Order.id == order_id, Order.branch_id == current_branch.id).first()
    if not order:
        raise HTTPException(404, "Order tidak ditemukan di cabang ini")
    if order.status == "void":
        raise HTTPException(400, "Order sudah void")
    
    for item in order.items:
        # Product must belong to the current branch
        product = db.query(Product).filter(Product.id == item.product_id, Product.branch_id == current_branch.id).first()
        if product:
            product.stock += item.qty
    order.status = "void"

    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", response_model=Message)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    order = db.query(Order).filter(Order.id == order_id, Order.branch_id == current_branch.id).first()
    if not order:
        raise HTTPException(404, "Order tidak ditemukan di cabang ini")
    if order.status == "paid":
        raise HTTPException(400, "Tidak bisa menghapus order yang sudah dibayar")

    db.delete(order)
    db.commit()
    return Message(detail="Order berhasil dihapus")