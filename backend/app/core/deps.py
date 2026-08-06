from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_access_token
from app.database import get_db
from app.models import Role, User, Branch

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ADMIN_ROLES = {Role.SUPERADMIN.value, Role.ADMIN.value}


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    user = db.query(User).options(joinedload(User.branch)).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user"
        )
    
    # Handle multi-branch selection
    selected_branch_id = request.headers.get("X-Branch-Id")
    if selected_branch_id:
        try:
            selected_branch_id = int(selected_branch_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Branch-Id header")

        # Superadmin can choose any branch, other roles are restricted
        if user.role != Role.SUPERADMIN.value and user.branch_id != selected_branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="You do not have access to this branch"
            )
        user.selected_branch_id = selected_branch_id # Attach to user object for easy access
    elif user.role != Role.SUPERADMIN.value: # Non-superadmin must have a branch selected
        user.selected_branch_id = user.branch_id
    else: # Superadmin without explicit selection can see all or pick one
        user.selected_branch_id = None # Means all branches for Superadmin


    return user


def get_current_branch(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Optional[Branch]:
    if current_user.selected_branch_id:
        branch = db.query(Branch).get(current_user.selected_branch_id)
        if not branch:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected branch not found")
        return branch
    elif current_user.role != Role.SUPERADMIN.value and current_user.branch_id:
        # For non-superadmins who didn't explicitly select, use their assigned branch
        branch = db.query(Branch).get(current_user.branch_id)
        if not branch: # Should not happen if DB is consistent
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User's assigned branch not found")
        return branch
    
    return None # Superadmin without selection, or non-superadmin without assigned branch (error handled in get_current_user)


def require_roles(*roles: str):
    allowed = set(roles)

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return checker


get_admin_user = require_roles(Role.SUPERADMIN.value, Role.ADMIN.value)
get_superadmin_user = require_roles(Role.SUPERADMIN.value)