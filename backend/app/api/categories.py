from typing import Optional
from slugify import slugify
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models import Category, User
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate, Message

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Category)
    if search:
        q = q.filter(Category.name.ilike(f"%{search}%"))
    return q.order_by(Category.name).all()


@router.get("/{id}", response_model=CategoryOut)
def get_category(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = db.query(Category).get(id)
    if not cat:
        raise HTTPException(404, "Kategori tidak ditemukan")
    return cat


@router.post("", response_model=CategoryOut)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    slug = slugify(body.name)
    existing = db.query(Category).filter(
        (Category.name == body.name) | (Category.slug == slug)
    ).first()
    if existing:
        raise HTTPException(400, "Kategori sudah ada")
    cat = Category(name=body.name, slug=slug, description=body.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{id}", response_model=CategoryOut)
def update_category(
    id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    cat = db.query(Category).get(id)
    if not cat:
        raise HTTPException(404, "Kategori tidak ditemukan")
    if body.name is not None:
        cat.name = body.name
        cat.slug = slugify(body.name)
    if body.description is not None:
        cat.description = body.description
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{id}", response_model=Message)
def delete_category(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    cat = db.query(Category).get(id)
    if not cat:
        raise HTTPException(404, "Kategori tidak ditemukan")
    db.delete(cat)
    db.commit()
    return Message(detail="Kategori berhasil dihapus")