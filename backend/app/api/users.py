from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_superadmin_user, get_current_user, get_current_branch
from app.core.security import hash_password, verify_password
from app.database import get_db
from app.models import User, Branch, Role
from app.schemas import Message, PasswordChange, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Admin roles can list users
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(User)
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(User.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(User.branch_id == current_branch.id)
        
    return q.order_by(User.username).all()


# NOTE: route ini harus didefinisikan SEBELUM route dengan path parameter (/{id})
# agar tidak tertangkap sebagai id oleh FastAPI.
@router.put("/change-password", response_model=Message)
def change_password(
    body: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(400, "Password saat ini salah")

    if len(body.new_password) < 6:
        raise HTTPException(400, "Password baru minimal 6 karakter")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return Message(detail="Password berhasil diganti")


@router.get("/{id}", response_model=UserOut)
def get_user(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user), # Admin roles can view users
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(User)
    if current_user.role != Role.SUPERADMIN.value:
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(User.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(User.branch_id == current_branch.id)
            
    u = q.filter(User.id == id).first()
    if not u:
        raise HTTPException(404, "User tidak ditemukan")
    return u


@router.post("", response_model=UserOut)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_superadmin_user), # Only superadmin can create users
    # For non-superadmin, branch_id is implicitly taken from current_user's branch.
    # Superadmin can explicitly set branch_id or leave None for other superadmins.
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, "Username sudah terpakai")
    
    # Superadmin can assign any branch or leave None. Other admins are restricted to their branch.
    if current_user.role != Role.SUPERADMIN.value and body.branch_id and body.branch_id != current_user.branch_id:
        raise HTTPException(403, "Admin hanya bisa membuat user di cabang sendiri")
    
    if current_user.role == Role.SUPERADMIN.value:
        branch_id_to_assign = body.branch_id
    else: # Admin creating user will be assigned to their own branch
        branch_id_to_assign = current_user.branch_id

    u = User(
        username=body.username,
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        branch_id=branch_id_to_assign,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.put("/{id}", response_model=UserOut)
def update_user(
    id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_superadmin_user), # Only superadmin can update users
    # current_branch is not directly used for filtering here, as superadmin can update any user.
    # But current_user.branch_id is used for restriction for non-superadmins.
):
    # Superadmin can update any user. Non-superadmins only users in their branch (implicitly handled by get_superadmin_user)
    u = db.query(User).get(id)
    if not u:
        raise HTTPException(404, "User tidak ditemukan")
    
    # Restrict non-superadmin from changing user's branch_id
    if current_user.role != Role.SUPERADMIN.value and body.branch_id and body.branch_id != u.branch_id:
        raise HTTPException(403, "Admin tidak bisa mengubah cabang user lain")
    
    # Superadmin can change branch_id. Others can't.
    if body.branch_id is not None and current_user.role == Role.SUPERADMIN.value:
        u.branch_id = body.branch_id
        
    if body.username is not None:
        # Check uniqueness of username, global constraint
        if db.query(User).filter(User.username == body.username, User.id != id).first():
            raise HTTPException(400, "Username sudah terpakai")
        u.username = body.username

    if body.full_name is not None:
        u.full_name = body.full_name
    if body.email is not None:
        u.email = body.email
    if body.password:
        u.password_hash = hash_password(body.password)
    if body.role is not None:
        u.role = body.role
    if body.is_active is not None:
        u.is_active = body.is_active
        
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{id}", response_model=Message)
def delete_user(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_superadmin_user), # Only superadmin can delete users
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    u = db.query(User).get(id)
    if not u:
        raise HTTPException(404, "User tidak ditemukan")
    if u.role == "superadmin":
        raise HTTPException(400, "Tidak bisa menghapus superadmin")
    
    # Non-superadmin can only delete users in their branch
    if current_user.role != Role.SUPERADMIN.value and u.branch_id != current_user.branch_id:
        raise HTTPException(403, "Admin tidak bisa menghapus user di cabang lain")

    db.delete(u)
    db.commit()
    return Message(detail="User berhasil dihapus")
