from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user, get_current_branch
from app.database import get_db
from app.models import Customer, Member, MembershipTier, MemberPoint, Order, User, Branch, Role
from app.schemas import (
    MemberCreate,
    MemberOut,
    MemberPointOut,
    MembershipTierCreate,
    MembershipTierOut,
    MembershipTierUpdate,
    MemberUpdate,
    Message,
)
from app.utils.membership import earn_points as _earn_points, redeem_points as _redeem_points

router = APIRouter(prefix="/memberships", tags=["memberships"])


def generate_member_code(db: Session) -> str:
    # member codes are global, not per-branch
    last = db.query(Member).order_by(Member.id.desc()).first()
    num = (last.id + 1) if last else 1
    return f"MB{num:05d}"


# ---------- Tiers (Global) ----------
@router.get("/tiers", response_model=list[MembershipTierOut])
def list_tiers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), # Admin roles can list tiers
):
    # Tiers are global, no branch filtering needed
    return db.query(MembershipTier).order_by(MembershipTier.name).all()


@router.post("/tiers", response_model=MembershipTierOut)
def create_tier(
    body: MembershipTierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Only admins can create tiers
):
    # Tiers are global
    if db.query(MembershipTier).filter(MembershipTier.name == body.name).first():
        raise HTTPException(400, "Nama tier sudah ada")
    tier = MembershipTier(**body.model_dump())
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return tier


@router.put("/tiers/{id}", response_model=MembershipTierOut)
def update_tier(
    id: int,
    body: MembershipTierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Only admins can update tiers
):
    # Tiers are global
    tier = db.query(MembershipTier).get(id)
    if not tier:
        raise HTTPException(404, "Tier tidak ditemukan")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(tier, k, v)
    db.commit()
    db.refresh(tier)
    return tier


@router.delete("/tiers/{id}", response_model=Message)
def delete_tier(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Only admins can delete tiers
):
    # Tiers are global
    tier = db.query(MembershipTier).get(id)
    if not tier:
        raise HTTPException(404, "Tier tidak ditemukan")
    if db.query(Member).filter(Member.tier_id == id).first():
        raise HTTPException(400, "Tier masih dipakai member")
    db.delete(tier)
    db.commit()
    return Message(detail="Tier berhasil dihapus")


# ---------- Members ----------
@router.get("/members", response_model=list[MemberOut])
def list_members(
    search: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Member)
    # Filter members by the branch of their associated customer
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.join(Customer).filter(Customer.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.join(Customer).filter(Customer.branch_id == current_branch.id)

    if active_only:
        q = q.filter(Member.is_active == True)
    if search:
        q = q.join(Customer).filter(
            (Customer.name.ilike(f"%{search}%")) | (Member.member_code.ilike(f"%{search}%"))
        )
    return q.order_by(Member.created_at.desc()).all()


@router.get("/members/{id}", response_model=MemberOut)
def get_member(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Member)
    # Filter members by the branch of their associated customer
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.join(Customer).filter(Customer.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.join(Customer).filter(Customer.branch_id == current_branch.id)

    m = q.filter(Member.id == id).first()
    if not m:
        raise HTTPException(404, "Member tidak ditemukan")
    return m


@router.post("/members", response_model=MemberOut)
def create_member(
    body: MemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Only admins can create members
    current_branch: Optional[Branch] = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    customer = db.query(Customer).filter(Customer.id == body.customer_id, Customer.branch_id == current_branch.id).first()
    if not customer:
        raise HTTPException(404, "Customer tidak ditemukan di cabang ini")
    
    if db.query(Member).filter(Member.customer_id == body.customer_id).first():
        raise HTTPException(400, "Customer sudah menjadi member")
    
    member = Member(
        customer_id=body.customer_id,
        member_code=generate_member_code(db),
        tier_id=body.tier_id,
        points=body.points or 0,
        expiry_at=body.expiry_at,
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/members/{id}", response_model=MemberOut)
def update_member(
    id: int,
    body: MemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Only admins can update members
    current_branch: Optional[Branch] = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    q = db.query(Member)
    q = q.join(Customer).filter(Customer.branch_id == current_branch.id)
    
    m = q.filter(Member.id == id).first()
    if not m:
        raise HTTPException(404, "Member tidak ditemukan di cabang ini")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/members/{id}", response_model=Message)
def delete_member(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Only admins can delete members
    current_branch: Optional[Branch] = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    q = db.query(Member)
    q = q.join(Customer).filter(Customer.branch_id == current_branch.id)
        
    m = q.filter(Member.id == id).first()
    if not m:
        raise HTTPException(404, "Member tidak ditemukan di cabang ini")
    db.query(MemberPoint).filter(MemberPoint.member_id == id).delete()
    db.delete(m)
    db.commit()
    return Message(detail="Member berhasil dihapus")


# ---------- Ledgers ----------
@router.get("/members/{id}/points", response_model=list[MemberPointOut])
def list_point_ledger(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Member)
    # Filter members by the branch of their associated customer
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.join(Customer).filter(Customer.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.join(Customer).filter(Customer.branch_id == current_branch.id)

    m = q.filter(Member.id == id).first()
    if not m:
        raise HTTPException(404, "Member tidak ditemukan")
    return (
        db.query(MemberPoint)
        .filter(MemberPoint.member_id == id)
        .order_by(MemberPoint.created_at.desc())
        .all()
    )


# ---------- Redeem (at POS / cashier) ----------
@router.post("/members/{id}/redeem")
def redeem(
    id: int,
    points: int = Query(gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), # Can be cashier
    current_branch: Optional[Branch] = Depends(get_current_branch), # Must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    q = db.query(Member)
    q = q.join(Customer).filter(Customer.branch_id == current_branch.id)
        
    m = q.filter(Member.id == id).first()
    if not m:
        raise HTTPException(404, "Member tidak ditemukan di cabang ini")
    if not m.is_active:
        raise HTTPException(400, "Member tidak aktif")
    if points > m.points:
        raise HTTPException(400, "Poin tidak mencukupi")
    value = _redeem_points(m, points, db)
    return {"member_id": m.id, "points_used": points, "discount_rupiah": value, "balance_after": m.points}


# ---------- Bulk expiry ----------
@router.post("/members/expired", response_model=Message)
def expire_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Only admins can run expiry
    current_branch: Optional[Branch] = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    now = datetime.utcnow()
    # Filter members by the branch of their associated customer
    expired = db.query(Member).join(Customer).filter(
        Customer.branch_id == current_branch.id,
        Member.expiry_at != None,
        Member.expiry_at < now,
        Member.points > 0
    ).all()
    
    cnt = 0
    for m in expired:
        _expire_points(m, db)
        cnt += 1
    return Message(detail=f"{cnt} member point kadaluarsa dibersihkan di cabang ini")


def _expire_points(member: Member, db: Session):
    """Zero-out expired member points and record ledger entry."""
    lost = member.points
    member.points = 0
    db.add(MemberPoint(member_id=member.id, points=-lost, balance_after=0, type="expire", description="Poin kadaluarsa"))
    db.add(member)
    db.commit()
    db.refresh(member)
