from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user, get_current_branch
from app.database import get_db
from app.models import Table, User, Branch
from app.schemas import Message, TableCreate, TableOut, TableUpdate

router = APIRouter(prefix="/tables", tags=["tables"])


@router.get("", response_model=list[TableOut])
def list_tables(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Table)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Table.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Table.branch_id == current_branch.id)

    if status:
        q = q.filter(Table.status == status)
    return q.order_by(Table.number).all()


@router.get("/{id}", response_model=TableOut)
def get_table(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Table)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Table.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Table.branch_id == current_branch.id)
            
    t = q.filter(Table.id == id).first()
    if not t:
        raise HTTPException(404, "Meja tidak ditemukan")
    return t


@router.post("", response_model=TableOut)
def create_table(
    body: TableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    # Check uniqueness of table number within the branch
    branch_id = current_branch.id
    if db.query(Table).filter(Table.number == body.number, Table.branch_id == branch_id).first():
        raise HTTPException(400, "Nomor meja sudah ada di cabang ini")
    
    t = Table(**body.model_dump(exclude={"branch_id"}), branch_id=branch_id) # Assign current branch_id
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/{id}", response_model=TableOut)
def update_table(
    id: int,
    body: TableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    # Filter by ID and branch_id
    t = db.query(Table).filter(Table.id == id, Table.branch_id == current_branch.id).first()
    if not t:
        raise HTTPException(404, "Meja tidak ditemukan di cabang ini")
    
    # Check if number changed and is unique within the branch
    if body.number and body.number != t.number:
        if db.query(Table).filter(Table.number == body.number, Table.branch_id == current_branch.id).first():
            raise HTTPException(400, "Nomor meja baru sudah terpakai di cabang ini")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


@router.put("/{id}/status", response_model=TableOut)
def update_table_status(
    id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Branch = Depends(get_current_branch), # User must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    # Role rules: superadmin/admin can set any status; kasir can only "open" a table (available)
    if current_user.role == "kasir" and status != "available":
        raise HTTPException(403, "Kasir hanya boleh membuka meja (status available)")

    t = db.query(Table).filter(Table.id == id, Table.branch_id == current_branch.id).first()
    if not t:
        raise HTTPException(404, "Meja tidak ditemukan di cabang ini")
    t.status = status
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{id}", response_model=Message)
def delete_table(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    # Filter by ID and branch_id
    t = db.query(Table).filter(Table.id == id, Table.branch_id == current_branch.id).first()
    if not t:
        raise HTTPException(404, "Meja tidak ditemukan di cabang ini")
    db.delete(t)
    db.commit()
    return Message(detail="Meja berhasil dihapus")