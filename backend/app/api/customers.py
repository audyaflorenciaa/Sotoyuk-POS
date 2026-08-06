from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_branch
from app.database import get_db
from app.models import Customer, User, Branch, Role
from app.schemas import CustomerCreate, CustomerOut, Message

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def list_customers(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Customer)
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Customer.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Customer.branch_id == current_branch.id)

    if search:
        q = q.filter(Customer.name.ilike(f"%{search}%"))
    return q.order_by(Customer.name).all()


@router.get("/{id}", response_model=CustomerOut)
def get_customer(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Customer)
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Customer.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Customer.branch_id == current_branch.id)

    c = q.filter(Customer.id == id).first()
    if not c:
        raise HTTPException(404, "Customer tidak ditemukan")
    return c


@router.post("", response_model=CustomerOut)
def create_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Must have a branch if not superadmin
):
    # For non-superadmins, branch_id is required
    if current_user.role != Role.SUPERADMIN.value and not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")
    
    # Superadmin can provide branch_id in body, otherwise use current_branch
    branch_id_to_assign = None
    if current_user.role == Role.SUPERADMIN.value:
        branch_id_to_assign = body.branch_id
    else:
        branch_id_to_assign = current_branch.id

    c = Customer(**body.model_dump(), branch_id=branch_id_to_assign)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{id}", response_model=Message)
def delete_customer(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Customer)
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Customer.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Customer.branch_id == current_branch.id)

    c = q.filter(Customer.id == id).first()
    if not c:
        raise HTTPException(404, "Customer tidak ditemukan")
    db.delete(c)
    db.commit()
    return Message(detail="Customer berhasil dihapus")