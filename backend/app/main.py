import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import get_settings
from app.create_tables import init_db
from app.api import router as api_router
from app.core.deps import get_admin_user
from app.database import get_db
from app.models import User, Setting
from sqlalchemy.orm import Session

settings = get_settings()

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="F&B POS Berbasis Web - MVP",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/public/store-info")
def public_store_info(db: Session = Depends(get_db)):
    # Return first branch's store settings (for login page branding)
    rows = db.query(Setting).filter(Setting.branch_id == 1).all()
    data = {s.key: s.value for s in rows}
    return {
        "store_name": data.get("store_name") or settings.APP_NAME,
        "store_logo": data.get("store_logo"),
        "store_address": data.get("store_address"),
        "store_phone": data.get("store_phone"),
    }


@app.post("/api/upload/logo")
def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_admin_user),
):
    """Upload store logo, return image URL."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File harus berupa gambar")
    if file.size and file.size > 2 * 1024 * 1024:
        raise HTTPException(400, "Ukuran gambar maksimal 2MB")

    logo_dir = UPLOADS_DIR / "logo"
    logo_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix or ".png"
    filename = f"logo_{uuid.uuid4().hex[:12]}{ext}"
    path = logo_dir / filename
    with open(path, "wb") as f:
        import shutil
        shutil.copyfileobj(file.file, f)

    return {"url": f"/uploads/logo/{filename}"}


# Serve frontend static files
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="static-assets")

    # Serve uploaded images
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "F&B POS API - Frontend not built. Run: cd frontend && npx vite build"}
