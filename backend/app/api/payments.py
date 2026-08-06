from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_admin_user, get_current_branch
from app.database import get_db
from app.models import Order, Payment, Voucher, Table, User, Customer, Member, MemberPoint, Branch
from app.schemas import OrderOut, PaymentRequest, PaymentResult
from app.utils.membership import earn_points

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/pay")
def process_payment(
    body: PaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Branch = Depends(get_current_branch), # User must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    order = db.query(Order).filter(Order.id == body.order_id, Order.branch_id == current_branch.id).first()
    if not order:
        raise HTTPException(404, "Order tidak ditemukan di cabang ini")
    if order.status != "open":
        raise HTTPException(400, f"Order sudah berstatus '{order.status}', tidak bisa dibayar")

    # Apply voucher discount (Vouchers are global)
    discount = 0
    if body.voucher_code:
        voucher = db.query(Voucher).filter(Voucher.code == body.voucher_code, Voucher.is_active == True).first()
        if voucher:
            if order.subtotal >= voucher.min_order:
                if voucher.discount_type == "percent":
                    discount = order.subtotal * (voucher.discount_value / 100)
                    if voucher.max_discount and discount > voucher.max_discount:
                        discount = voucher.max_discount
                else:
                    discount = voucher.discount_value
            order.voucher_code = body.voucher_code

    # Load member for this order's customer (for point earning + redemption)
    member = None
    if order.customer_id:
        member = db.query(Member).join(Customer).filter(
            Member.customer_id == order.customer_id, 
            Member.is_active == True,
            Customer.branch_id == current_branch.id # Member's customer must be in the current branch
        ).first()

    # Apply member point redemption
    points_used = 0
    if body.redeem_points > 0:
        if not member:
            raise HTTPException(400, "Order ini tidak memiliki member yang bisa redeem poin di cabang ini")
        if member.points < body.redeem_points:
            raise HTTPException(400, "Poin member tidak mencukupi")
        points_used = body.redeem_points
        member.points -= points_used
        db.add(MemberPoint(
            member_id=member.id,
            order_id=order.id,
            points=-points_used,
            balance_after=member.points,
            type="redeem",
            description="Redeem diskon di kasir",
        ))
        discount += points_used # Add points redemption as a discount
        db.add(member) # Persist member points change

    # Recalculate totals
    tax = round((order.subtotal - discount) * 0.11)
    total = round(order.subtotal - discount + tax)
    order.discount = round(discount)
    order.tax = tax
    order.total = total

    if body.amount < total:
        raise HTTPException(400, f"Jumlah bayar Rp{body.amount:,.0f} kurang dari total Rp{total:,.0f}")

    # Process payment
    change = body.amount - total
    payment = Payment(
        order_id=order.id,
        method=body.method,
        amount=body.amount,
        status="success",
        reference=body.reference,
    )
    db.add(payment)

    order.status = "paid"
    order.payment_method = body.method
    order.paid_at = datetime.now(timezone.utc)

    # NOTE: Table is no longer auto-freed after payment. Cashier must manually
    # mark the table as available/cleaned from the Tables page or POS.

    db.commit()
    db.refresh(order)
    db.refresh(order, ["items"]) # Ensure items are refreshed for the response

    # Earn member points (after payment settled) — based on order total
    points_earned = 0
    if member:
        # Re-fetch member from DB to ensure it has latest state after commit, including updated points
        # Or alternatively, ensure the existing member object is properly refreshed/merged
        member = db.query(Member).get(member.id) 
        points_earned = earn_points(member, order.total, order.id, db)

    return {
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "table_id": order.table_id,
            "table": {
                "id": order.table_id,
                "number": order.table.number if order.table else None,
                "name": order.table.name if order.table else None,
            } if order.table_id else None,
            "customer_id": order.customer_id,
            "cashier_id": order.cashier_id,
            "branch_id": order.branch_id, # Include branch_id in response
            "status": order.status,
            "subtotal": order.subtotal,
            "discount": order.discount,
            "tax": order.tax,
            "service_charge": order.service_charge,
            "total": order.total,
            "payment_method": order.payment_method,
            "voucher_code": order.voucher_code,
            "notes": order.notes,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "paid_at": order.paid_at.isoformat() if order.paid_at else None,
                "items": [
                {
                    "id": i.id,
                    "product_id": i.product_id,
                    "product_name": i.product_name.replace(f" ({order.branch.name})", "").strip() if order.branch else i.product_name,
                    "sku": i.sku,
                    "price": i.price,
                    "discount": i.discount,
                    "qty": i.qty,
                    "subtotal": i.subtotal,
                }
                for i in order.items
            ],
        },
        "change": change,
        "payment": {"id": payment.id, "method": payment.method, "amount": payment.amount},
        "points_earned": points_earned,
        "points_used": points_used,
    }

@router.get("/receipt/{order_id}")
def get_receipt(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Branch = Depends(get_current_branch), # User must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    order = db.query(Order).filter(Order.id == order_id, Order.branch_id == current_branch.id).first()
    if not order:
        raise HTTPException(404, "Order tidak ditemukan di cabang ini")

    payment = None
    if order.payments:
        payment = order.payments[0]

    return {
        "receipt_no": order.order_number,
        "date": order.created_at.isoformat() if order.created_at else "",
        "cashier": current_user.full_name or current_user.username,
        "table": {
            "id": order.table_id,
            "number": order.table.number if order.table else None,
            "name": order.table.name if order.table else None,
        } if order.table_id else None,
        "items": [
            {
                "name": i.product_name.replace(f" ({order.branch.name})", "").strip() if order.branch else i.product_name,
                "sku": i.sku,
                "qty": i.qty,
                "price": i.price,
                "discount": i.discount,
                "subtotal": i.subtotal,
            }
            for i in order.items
        ],
        "subtotal": order.subtotal,
        "discount": order.discount,
        "tax": order.tax,
        "service_charge": order.service_charge,
        "total": order.total,
        "payment_method": order.payment_method,
        "payment_amount": payment.amount if payment else order.total,
        "change": payment.amount - order.total if payment else 0,
        "status": order.status,
    }
