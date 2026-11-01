from fastapi import APIRouter

from app.api import auth, categories, customers, dashboard, orders, payments, products, reports, settings, users, vouchers, branches

router = APIRouter()

router.include_router(auth.router)
router.include_router(dashboard.router)
router.include_router(categories.router)
router.include_router(products.router)
router.include_router(orders.router)
router.include_router(payments.router)
router.include_router(reports.router)
router.include_router(users.router)
router.include_router(settings.router)
router.include_router(customers.router)
router.include_router(vouchers.router)
router.include_router(branches.router)