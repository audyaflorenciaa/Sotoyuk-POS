from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user, get_current_branch
from app.database import get_db
from app.models import Setting, User, Branch
from app.schemas import Message, SettingIn, SettingOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=list[SettingOut])
def list_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Setting)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Setting.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Setting.branch_id == current_branch.id)
            
    return q.order_by(Setting.key).all()


@router.get("/{key}", response_model=SettingOut)
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Setting)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Setting.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Setting.branch_id == current_branch.id)

    s = q.filter(Setting.key == key).first()
    if not s:
        raise HTTPException(404, "Setting tidak ditemukan")
    return s


@router.post("", response_model=SettingOut)
def upsert_setting(
    body: SettingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    branch_id = body.branch_id or current_branch.id
    s = db.query(Setting).filter(Setting.key == body.key, Setting.branch_id == branch_id).first()
    if s:
        s.value = body.value
    else:
        s = Setting(key=body.key, value=body.value, branch_id=branch_id)
        db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{key}", response_model=Message)
def delete_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    s = db.query(Setting).filter(Setting.key == key, Setting.branch_id == current_branch.id).first()
    if not s:
        raise HTTPException(404, "Setting tidak ditemukan di cabang ini")
    db.delete(s)
    db.commit()
    return Message(detail="Setting berhasil dihapus")