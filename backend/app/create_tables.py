from app import models  # noqa: F401 - ensure models are registered
from app.database import Base, engine
from sqlalchemy import text, inspect


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_add_columns()


def _migrate_add_columns():
    """Add missing columns to existing tables (SQLite safe)."""
    inspector = inspect(engine)
    migrations = [
        ("products", "discount", "REAL DEFAULT 0"),
        ("order_items", "discount", "REAL DEFAULT 0"),
    ]
    for table, column, col_def in migrations:
        if table in inspector.get_table_names():
            existing = {c["name"] for c in inspector.get_columns(table)}
            if column not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))


if __name__ == "__main__":
    init_db()
    print("Database tables created.")