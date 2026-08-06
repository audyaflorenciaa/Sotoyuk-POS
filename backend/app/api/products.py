import os
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user, get_current_branch
from app.database import get_db
from app.models import Category, Product, User, Branch
from app.schemas import Message, ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])

# UPLOAD_DIR is global, but filenames can include branch_id to avoid conflicts
BASE_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
BASE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(file: UploadFile, branch_id: int) -> str:
    """Save uploaded file and return relative URL path."""
    branch_upload_dir = BASE_UPLOAD_DIR / "products" / str(branch_id)
    branch_upload_dir.mkdir(parents=True, exist_ok=True)

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(400, "Format gambar harus JPG, PNG, atau WebP")
    
    filename = f"{int(os.urandom(4).hex(), 16):x}{ext}"
    path = branch_upload_dir / filename
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    return f"/uploads/products/{branch_id}/{filename}"


@router.post("/upload-image")
def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    """Upload product image, return image URL."""
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")
    path = save_upload(file, current_branch.id)
    return {"url": path}


@router.post("/import-excel")
def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    """Import products from Excel file (.xlsx)."""
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Format file harus .xlsx")

    try:
        import openpyxl
    except ImportError:
        raise HTTPException(500, "Module openpyxl belum terinstall")

    wb = openpyxl.load_workbook(file.file)
    ws = wb.active

    # Expected columns: SKU, Nama, Kategori, Harga, HPP, Stok, Gambar (opsional)
    required_headers = ["sku", "nama", "kategori", "harga", "hpp", "stok"]
    headers = [str(c.value).strip().lower() for c in next(ws.iter_rows(min_row=1, max_row=1))]
    
    for h in required_headers:
        if h not in headers:
            raise HTTPException(400, f"Kolom wajib hilang: {h}")

    # Build category map (categories are global)
    cat_map = {c.name.lower(): c.id for c in db.query(Category).all()}

    created = 0
    updated = 0
    errors = []

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0]:
            continue
        
        try:
            data = dict(zip(headers, row))
            sku = str(data.get("sku", "")).strip()
            if not sku:
                errors.append(f"Baris {row_idx}: SKU kosong")
                continue

            nama = str(data.get("nama", "")).strip()
            if not nama:
                errors.append(f"Baris {row_idx}: Nama kosong")
                continue

            kategori = str(data.get("kategori", "")).strip().lower()
            cat_id = cat_map.get(kategori)
            if not cat_id:
                errors.append(f"Baris {row_idx}: Kategori '{kategori}' tidak ditemukan")
                continue

            try:
                harga = float(data.get("harga", 0) or 0)
                hpp = float(data.get("hpp", 0) or 0)
                stok = int(data.get("stok", 0) or 0)
            except ValueError:
                errors.append(f"Baris {row_idx}: Harga/HPP/Stok harus angka")
                continue

            gambar = str(data.get("gambar", "")).strip() if data.get("gambar") else None

            # Filter by SKU and branch_id
            existing = db.query(Product).filter(Product.sku == sku, Product.branch_id == current_branch.id).first()
            if existing:
                existing.name = nama
                existing.category_id = cat_id
                existing.price = harga
                existing.hpp = hpp
                existing.stock = stok
                if gambar:
                    existing.image = gambar
                updated += 1
            else:
                p = Product(
                    sku=sku,
                    name=nama,
                    category_id=cat_id,
                    price=harga,
                    hpp=hpp,
                    stock=stok,
                    image=gambar,
                    is_active=True,
                    branch_id=current_branch.id, # Assign current branch_id
                )
                db.add(p)
                created += 1

        except Exception as e:
            errors.append(f"Baris {row_idx}: {str(e)}")

    db.commit()

    return {
        "created": created,
        "updated": updated,
        "errors": errors,
    }


@router.get("", response_model=list[ProductOut])
def list_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Product)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Product.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Product.branch_id == current_branch.id)
        
    if active_only:
        q = q.filter(Product.is_active == True)
    if search:
        q = q.filter(
            (Product.name.ilike(f"%{search}%")) | (Product.sku.ilike(f"%{search}%"))
        )
    if category_id:
        q = q.filter(Product.category_id == category_id)
    products = q.order_by(Product.name).all()
    for p in products:
        if p.category:
            p.category_name = p.category.name
    return products


@router.get("/{id}", response_model=ProductOut)
def get_product(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_branch: Optional[Branch] = Depends(get_current_branch), # Superadmin can query all
):
    q = db.query(Product)
    if current_user.role != "superadmin":
        if not current_branch:
            raise HTTPException(400, "Branch selection is required for this operation.")
        q = q.filter(Product.branch_id == current_branch.id)
    elif current_branch: # Superadmin specified a branch
        q = q.filter(Product.branch_id == current_branch.id)

    p = q.filter(Product.id == id).first()
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    if p.category:
        p.category_name = p.category.name
    return p


@router.post("", response_model=ProductOut)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")
    
    # Check SKU uniqueness within the branch
    if db.query(Product).filter(Product.sku == body.sku, Product.branch_id == current_branch.id).first():
        raise HTTPException(400, "SKU sudah terpakai di cabang ini")
    
    if body.category_id:
        cat = db.query(Category).get(body.category_id)
        if not cat:
            raise HTTPException(404, "Kategori tidak ditemukan")
    
    p = Product(**body.model_dump(exclude={"branch_id"}), branch_id=current_branch.id) # Assign current branch_id
    db.add(p)
    db.commit()
    db.refresh(p)
    if p.category:
        p.category_name = p.category.name
    return p


@router.put("/{id}", response_model=ProductOut)
def update_product(
    id: int,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    # Filter by ID and branch_id
    p = db.query(Product).filter(Product.id == id, Product.branch_id == current_branch.id).first()
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan di cabang ini")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    if p.category:
        p.category_name = p.category.name
    return p


@router.delete("/{id}", response_model=Message)
def delete_product(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    current_branch: Branch = Depends(get_current_branch), # Admin must select a branch
):
    if not current_branch:
        raise HTTPException(400, "Branch selection is required for this operation.")

    # Filter by ID and branch_id
    p = db.query(Product).filter(Product.id == id, Product.branch_id == current_branch.id).first()
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan di cabang ini")
    db.delete(p)
    db.commit()
    return Message(detail="Produk berhasil dihapus")