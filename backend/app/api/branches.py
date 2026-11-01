from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_superadmin_user, get_current_user
from app.database import get_db
from app.models import Branch, User, Product, Order, Setting, Customer
from app.schemas import Message, BranchCreate, BranchOut

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchOut])
def list_branches(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), # Any user can list branches they have access to
):
    q = db.query(Branch)
    if search:
        q = q.filter(Branch.name.ilike(f"%{search}%"))
    # Non-superadmins only see their assigned branch
    if current_user.role != "superadmin" and current_user.branch_id:
        q = q.filter(Branch.id == current_user.branch_id)
    return q.order_by(Branch.name).all()


@router.get("/{id}", response_model=BranchOut)
def get_branch(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), # Any user can get their branch
):
    q = db.query(Branch)
    # Non-superadmins only see their assigned branch
    if current_user.role != "superadmin" and current_user.branch_id:
        q = q.filter(Branch.id == current_user.branch_id)
    
    branch = q.filter(Branch.id == id).first()
    if not branch:
        raise HTTPException(404, "Cabang tidak ditemukan")
    return branch


@router.post("", response_model=BranchOut)
def create_branch(
    body: BranchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_superadmin_user), # Only superadmin can create branches
):
    if db.query(Branch).filter(Branch.name == body.name).first():
        raise HTTPException(400, "Nama cabang sudah ada")
    branch = Branch(**body.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.put("/{id}", response_model=BranchOut)
def update_branch(
    id: int,
    body: BranchCreate, # Re-use BranchCreate schema for simplicity
    db: Session = Depends(get_db),
    current_user: User = Depends(get_superadmin_user), # Only superadmin can update branches
):
    branch = db.query(Branch).get(id)
    if not branch:
        raise HTTPException(404, "Cabang tidak ditemukan")
    if body.name and body.name != branch.name:
        if db.query(Branch).filter(Branch.name == body.name).first():
            raise HTTPException(400, "Nama cabang sudah ada")
    
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(branch, k, v)
    db.commit()
    db.refresh(branch)
    return branch


@router.delete("/{id}", response_model=Message)
def delete_branch(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_superadmin_user), # Only superadmin can delete branches
):
    branch = db.query(Branch).get(id)
    if not branch:
        raise HTTPException(404, "Cabang tidak ditemukan")
    
    # Check for dependent records before deleting a branch
    if db.query(User).filter(User.branch_id == id).first():
        raise HTTPException(400, "Tidak bisa menghapus cabang yang masih memiliki user")
    if db.query(Product).filter(Product.branch_id == id).first():
        raise HTTPException(400, "Tidak bisa menghapus cabang yang masih memiliki produk")
    if db.query(Order).filter(Order.branch_id == id).first():
        raise HTTPException(400, "Tidak bisa menghapus cabang yang masih memiliki order")
    if db.query(Setting).filter(Setting.branch_id == id).first():
        raise HTTPException(400, "Tidak bisa menghapus cabang yang masih memiliki pengaturan")
    if db.query(Customer).filter(Customer.branch_id == id).first():
        raise HTTPException(400, "Tidak bisa menghapus cabang yang masih memiliki customer")
        
    db.delete(branch)
    db.commit()
    return Message(detail="Cabang berhasil dihapus")