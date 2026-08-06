from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models import Voucher, User
from app.schemas import Message, VoucherCreate, VoucherOut

router = APIRouter(prefix="/vouchers", tags=["vouchers"])


@router.get("", response_model=list[VoucherOut])
def list_vouchers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Voucher).order_by(Voucher.code).all()


@router.post("", response_model=VoucherOut)
def create_voucher(
    body: VoucherCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    if db.query(Voucher).filter(Voucher.code == body.code).first():
        raise HTTPException(400, "Kode voucher sudah ada")
    v = Voucher(**body.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.post("/validate")
def validate_voucher(code: str, subtotal: float, db: Session = Depends(get_db)):
    v = db.query(Voucher).filter(Voucher.code == code, Voucher.is_active == True).first()
    if not v:
        raise HTTPException(400, "Voucher tidak valid atau tidak aktif")
    if subtotal < v.min_order:
        raise HTTPException(400, f"Minimal order Rp{v.min_order:,.0f}")
    discount = 0
    if v.discount_type == "percent":
        discount = subtotal * (v.discount_value / 100)
        if v.max_discount and discount > v.max_discount:
            discount = v.max_discount
    else:
        discount = v.discount_value
    return {"discount": round(discount), "voucher": v.code, "type": v.discount_type}


@router.delete("/{id}", response_model=Message)
def delete_voucher(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    v = db.query(Voucher).get(id)
    if not v:
        raise HTTPException(404, "Voucher tidak ditemukan")
    db.delete(v)
    db.commit()
    return Message(detail="Voucher berhasil dihapus")