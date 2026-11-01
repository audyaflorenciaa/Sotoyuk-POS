import sys
import random
from datetime import datetime, timedelta, timezone
from faker import Faker

from app.config import get_settings
from app.core.security import hash_password
from app.database import Base, engine, SessionLocal
from app.models import (
    Branch, Category, Customer, Order, OrderItem, Payment, Product,
    Setting, User, Voucher,
)

fake = Faker("id_ID")
settings = get_settings()
# Base.metadata.create_all(bind=engine) # This should be called only once by seed.py
db = SessionLocal()

# ---------------------------------------------------------------------------
# Schema seed data
# ---------------------------------------------------------------------------

BRANCHES = [
    {"name": "Gading Serpong (Pisa Grande)", "address": "Pisa Grande, Gading Serpong, Tangerang"},
]

USERS = [
    {"username": "superadmin", "full_name": "Super Admin", "password": "superadmin", "role": "superadmin", "email": "super@kasir.id", "branch_name": None},
    {"username": "admin_utama", "full_name": "Admin Pisa Grande", "password": "admin", "role": "admin", "email": "admin.pisagrande@kasir.id", "branch_name": "Gading Serpong (Pisa Grande)"},
    {"username": "kasir_utama", "full_name": "Kasir Pisa Grande", "password": "kasir1", "role": "kasir", "email": "kasir.pisagrande@kasir.id", "branch_name": "Gading Serpong (Pisa Grande)"},
]

CATEGORIES = [
    {"name": "Makanan",  "slug": "makanan",  "description": "Menu makanan utama"},
    {"name": "Minuman",  "slug": "minuman",  "description": "Minuman segar & panas"},
    {"name": "Snack",    "slug": "snack",    "description": "Camilan ringan"},
    {"name": "Dessert",  "slug": "dessert",  "description": "Menu penutup"},
    {"name": "Paket",    "slug": "paket",    "description": "Paket combo hemat"},
]

BASE_PRODUCTS = [
    # ---- Makanan (12) ----
    {"sku": "FD001", "name": "Nasi Goreng Spesial",    "category": "Makanan", "price": 28000, "hpp": 18000, "stock": 100},
    {"sku": "FD002", "name": "Mie Goreng Seafood",     "category": "Makanan", "price": 32000, "hpp": 20000, "stock": 80},
    {"sku": "FD003", "name": "Nasi Ayam Penyet",       "category": "Makanan", "price": 30000, "hpp": 19000, "stock": 60},
    {"sku": "FD004", "name": "Nasi Rendang Padang",    "category": "Makanan", "price": 35000, "hpp": 22000, "stock": 50},
    {"sku": "FD005", "name": "Soto Ayam Lamongan",     "category": "Makanan", "price": 25000, "hpp": 14000, "stock": 70},
    {"sku": "FD006", "name": "Ayam Bakar Madu",         "category": "Makanan", "price": 33000, "hpp": 21000, "stock": 40},
    {"sku": "FD007", "name": "Ikan Gurame Asam Manis", "category": "Makanan", "price": 55000, "hpp": 35000, "stock": 30},
    {"sku": "FD008", "name": "Sate Ayam Madura",        "category": "Makanan", "price": 28000, "hpp": 16000, "stock": 90},
    {"sku": "FD009", "name": "Bakso Urat Special",      "category": "Makanan", "price": 22000, "hpp": 12000, "stock": 60},
    {"sku": "FD010", "name": "Nasi Pecel Lele",         "category": "Makanan", "price": 20000, "hpp": 11000, "stock": 80},
    {"sku": "FD011", "name": "Nasi Campur Bali",        "category": "Makanan", "price": 32000, "hpp": 20000, "stock": 55},
    {"sku": "FD012", "name": "Mie Ayam Jamur",          "category": "Makanan", "price": 24000, "hpp": 13000, "stock": 75},
    # ---- Minuman (12) ----
    {"sku": "DR001", "name": "Es Teh Manis",            "category": "Minuman", "price": 8000,  "hpp": 2000,  "stock": 999},
    {"sku": "DR002", "name": "Es Jeruk Segar",          "category": "Minuman", "price": 12000, "hpp": 4000,  "stock": 999},
    {"sku": "DR003", "name": "Kopi Tubruk",             "category": "Minuman", "price": 10000, "hpp": 3000,  "stock": 999},
    {"sku": "DR004", "name": "Es Cappuccino",           "category": "Minuman", "price": 18000, "hpp": 6000,  "stock": 999},
    {"sku": "DR005", "name": "Jus Alpukat",             "category": "Minuman", "price": 15000, "hpp": 7000,  "stock": 999},
    {"sku": "DR006", "name": "Teh Tarik",               "category": "Minuman", "price": 12000, "hpp": 3500,  "stock": 999},
    {"sku": "DR007", "name": "Es Kelapa Muda",          "category": "Minuman", "price": 15000, "hpp": 5000,  "stock": 999},
    {"sku": "DR008", "name": "Wedang Jahe",             "category": "Minuman", "price": 10000, "hpp": 3000,  "stock": 999},
    {"sku": "DR009", "name": "Milkshake Cokelat",       "category": "Minuman", "price": 20000, "hpp": 8000,  "stock": 999},
    {"sku": "DR010", "name": "Es Campur",               "category": "Minuman", "price": 18000, "hpp": 7000,  "stock": 999},
    {"sku": "DR011", "name": "Kopi Susu",               "category": "Minuman", "price": 22000, "hpp": 9000,  "stock": 999},
    {"sku": "DR012", "name": "Thai Tea",                "category": "Minuman", "price": 16000, "hpp": 5000,  "stock": 999},
    # ---- Snack (10) ----
    {"sku": "SN001", "name": "Kentang Goreng",          "category": "Snack",   "price": 18000, "hpp": 7000,  "stock": 100},
    {"sku": "SN002", "name": "Pisang Goreng",           "category": "Snack",   "price": 12000, "hpp": 4000,  "stock": 80},
    {"sku": "SN003", "name": "Tahu Isi",                "category": "Snack",   "price": 10000, "hpp": 3500,  "stock": 90},
    {"sku": "SN004", "name": "Tempe Mendoan",           "category": "Snack",   "price": 12000, "hpp": 4000,  "stock": 70},
    {"sku": "SN005", "name": "Risol Mayo",              "category": "Snack",   "price": 15000, "hpp": 6000,  "stock": 60},
    {"sku": "SN006", "name": "Lumpia Semarang",         "category": "Snack",   "price": 18000, "hpp": 7000,  "stock": 50},
    {"sku": "SN007", "name": "Cireng",                  "category": "Snack",   "price": 10000, "hpp": 3000,  "stock": 85},
    {"sku": "SN008", "name": "Sosis Solo",              "category": "Snack",   "price": 14000, "hpp": 5500,  "stock": 65},
    {"sku": "SN009", "name": "Pastel",                  "category": "Snack",   "price": 12000, "hpp": 4500,  "stock": 75},
    {"sku": "SN010", "name": "Bakwan Jagung",           "category": "Snack",   "price": 10000, "hpp": 3500,  "stock": 80},
    # ---- Dessert (8) ----
    {"sku": "DS001", "name": "Ice Cream Vanilla",       "category": "Dessert", "price": 18000, "hpp": 7000,  "stock": 100},
    {"sku": "DS002", "name": "Pudding Cokelat",         "category": "Dessert", "price": 15000, "hpp": 5000,  "stock": 60},
    {"sku": "DS003", "name": "Klepon",                  "category": "Dessert", "price": 12000, "hpp": 4000,  "stock": 50},
    {"sku": "DS004", "name": "Es Doger",                "category": "Dessert", "price": 15000, "hpp": 5500,  "stock": 45},
    {"sku": "DS005", "name": "Dadar Gulung",            "category": "Dessert", "price": 12000, "hpp": 4000,  "stock": 55},
    {"sku": "DS006", "name": "Es Kepal Milo",           "category": "Dessert", "price": 18000, "hpp": 7000,  "stock": 40},
    {"sku": "DS007", "name": "Matcha Ice",              "category": "Dessert", "price": 20000, "hpp": 8000,  "stock": 35},
    {"sku": "DS008", "name": "Pancake Cokelat",         "category": "Dessert", "price": 22000, "hpp": 9000,  "stock": 30},
    # ---- Paket (8) ----
    {"sku": "PK001", "name": "Paket Hemat 1",           "category": "Paket",   "price": 45000, "hpp": 28000, "stock": 50},
    {"sku": "PK002", "name": "Paket Hemat 2",           "category": "Paket",   "price": 55000, "hpp": 35000, "stock": 40},
    {"sku": "PK003", "name": "Paket Sarapan",           "category": "Paket",   "price": 30000, "hpp": 18000, "stock": 60},
    {"sku": "PK004", "name": "Paket Keluarga",          "category": "Paket",   "price": 120000, "hpp": 72000, "stock": 25},
    {"sku": "PK005", "name": "Paket Nasi + Es Teh",     "category": "Paket",   "price": 32000, "hpp": 19000, "stock": 70},
    {"sku": "PK006", "name": "Paket Kopi & Snack",      "category": "Paket",   "price": 28000, "hpp": 16000, "stock": 55},
    {"sku": "PK007", "name": "Paket Anniversary",        "category": "Paket",   "price": 250000, "hpp": 150000, "stock": 10},
    {"sku": "PK008", "name": "Paket Gathering 10Pax",   "category": "Paket",   "price": 500000, "hpp": 300000, "stock": 5},
]

VOUCHERS = [ # Global vouchers
    {"code": "HEMAT10", "name": "Diskon 10%",   "discount_type": "percent",  "discount_value": 10, "max_discount": 50000,  "min_order": 50000},
    {"code": "HEMAT20", "name": "Diskon 20%",   "discount_type": "percent",  "discount_value": 20, "max_discount": 100000, "min_order": 100000},
    {"code": "HEMAT25K","name": "Hemat Rp25.000","discount_type": "nominal", "discount_value": 25000, "max_discount": None, "min_order": 75000},
    {"code": "GRATIS1", "name": "Hemat Rp10.000", "discount_type": "nominal", "discount_value": 10000, "max_discount": None, "min_order": 30000},
    {"code": "WELCOME", "name": "Welcome 15%",   "discount_type": "percent",  "discount_value": 15, "max_discount": 30000,  "min_order": 0},
]

def seed():
    print("Seeding database...")

    # --- Branches ---
    branch_map = {}
    for b_data in BRANCHES:
        branch = Branch(name=b_data["name"], address=b_data["address"])
        db.add(branch)
        db.flush()
        branch_map[branch.name] = branch
    print(f"  Branches:    {len(BRANCHES)}")

    # --- Users ---
    users_by_branch = {b.id: [] for b in branch_map.values()}
    superadmin_user = None
    for u_data in USERS:
        branch_id = branch_map[u_data["branch_name"]].id if u_data["branch_name"] else None
        user = User(
            username=u_data["username"],
            full_name=u_data["full_name"],
            email=u_data.get("email"),
            password_hash=hash_password(u_data["password"]),
            role=u_data["role"],
            is_active=True,
            branch_id=branch_id,
        )
        db.add(user)
        db.flush()
        if user.role == "superadmin":
            superadmin_user = user
        elif branch_id:
            users_by_branch[branch_id].append(user)
    print(f"  Users:       {len(USERS)}")

    # --- Categories (Global) ---
    cat_map = {}
    for c_data in CATEGORIES:
        obj = Category(name=c_data["name"], slug=c_data["slug"], description=c_data.get("description"))
        db.add(obj)
        db.flush()
        cat_map[c_data["name"]] = obj.id
    print(f"  Categories:  {len(CATEGORIES)}")

    # --- Products (Duplicated per Branch) ---
    all_products = []
    for branch_name, branch_obj in branch_map.items():
        for p_data in BASE_PRODUCTS:
            product = Product(
                sku=f"{p_data['sku']}-{branch_name.replace(' ', '')}", # Make SKU unique per branch
                name=f"{p_data['name']} ({branch_name})",
                category_id=cat_map[p_data["category"]],
                price=p_data["price"],
                hpp=p_data["hpp"],
                stock=p_data["stock"],
                is_active=True,
                branch_id=branch_obj.id,
            )
            db.add(product)
            all_products.append(product)
    db.flush()
    print(f"  Products:    {len(all_products)}")

    # --- Customers (Allocated to Branches) ---
    customers_by_branch = {b.id: [] for b in branch_map.values()}
    for i in range(10): # 10 customers total
        branch_obj = random.choice(list(branch_map.values()))
        c = Customer(
            name=fake.name(),
            phone=fake.phone_number()[:20],
            email=fake.email(),
            branch_id=branch_obj.id,
        )
        db.add(c)
        customers_by_branch[branch_obj.id].append(c)
    db.flush()
    print(f"  Customers:   {sum(len(v) for v in customers_by_branch.values())}")

    # --- Vouchers (Global) ---
    for v_data in VOUCHERS:
        db.add(Voucher(**v_data))
    db.flush()
    print(f"  Vouchers:    {len(VOUCHERS)}")

    # --- Settings (Duplicated per Branch) ---
    for branch_name, branch_obj in branch_map.items():
        # Override default settings to ensure they are unique per branch
        branch_settings = [
            ("store_name", f"Sotoyuk {branch_name}"),
            ("store_address", f"{branch_obj.address}"),
            ("store_phone", fake.phone_number()[:20]),
            ("service_charge", "0"),
            ("receipt_footer", f"Terima kasih atas kunjungan Anda di {branch_name}!"),
            ("currency", "IDR"),
            ("opening_time", "08:00"),
            ("closing_time", "22:00"),
        ]
        for key, val in branch_settings:
            db.add(Setting(key=key, value=val, branch_id=branch_obj.id))
    db.flush()
    print(f"  Settings:    {len(BRANCHES) * len(branch_settings)}") # Use actual count for the new settings list

    # --- Dummy Orders (per branch) ---
    order_count = 0
    for branch_name, branch_obj in branch_map.items():
        branch_products = [p for p in all_products if p.branch_id == branch_obj.id]
        branch_cashiers = users_by_branch[branch_obj.id]
        branch_customers = customers_by_branch[branch_obj.id]
        
        if not branch_products or not branch_cashiers or not branch_customers:
            print(f"  Skipping orders for {branch_name} due to insufficient data.")
            continue

        for day_offset in range(30, 0, -1):
            orders_per_day = random.randint(2, 5)
            for _ in range(orders_per_day):
                dt = datetime.now(timezone.utc) - timedelta(days=day_offset, hours=random.randint(8, 21), minutes=random.randint(0, 59))
                
                customer = random.choice(branch_customers)
                cashier = random.choice(branch_cashiers)
                
                n_items = random.randint(1, 5)
                selected = random.sample(branch_products, min(n_items, len(branch_products)))

                order_num = f"ORD-{branch_obj.id}-{dt.strftime('%Y%m%d')}-{order_count + 1:05d}"
                subtotal = 0
                order = Order(
                    order_number=order_num,
                    customer_id=customer.id,
                    cashier_id=cashier.id,
                    branch_id=branch_obj.id, # Assign branch_id to order
                    status="paid",
                    created_at=dt,
                    paid_at=dt + timedelta(minutes=random.randint(5, 30)),
                )
                db.add(order)
                db.flush()

                for prod in selected:
                    qty = random.randint(1, 3)
                    item_sub = prod.price * qty
                    db.add(OrderItem(
                        order_id=order.id,
                        product_id=prod.id,
                        product_name=prod.name,
                        sku=prod.sku,
                        price=prod.price,
                        hpp=prod.hpp,
                        qty=qty,
                        subtotal=item_sub,
                    ))
                    subtotal += item_sub

                total = subtotal - order.discount
                method = random.choice(["cash", "qris", "debit", "credit"])

                order.subtotal = round(subtotal)
                order.total = total
                order.payment_method = method

                db.add(Payment(
                    order_id=order.id,
                    method=method,
                    amount=total,
                    status="success",
                ))
                order_count += 1

    # Add a few open orders (for testing)
    for branch_name, branch_obj in branch_map.items():
        branch_products = [p for p in all_products if p.branch_id == branch_obj.id]
        branch_cashiers = users_by_branch[branch_obj.id]

        if not branch_products or not branch_cashiers:
            print(f"  Skipping open orders for {branch_name} due to insufficient data.")
            continue

        for i in range(1): # 1 open order per branch
            dt = datetime.now(timezone.utc) - timedelta(minutes=random.randint(5, 30))
            order_num = f"ORD-OPEN-{branch_obj.id}-{order_count + 1:05d}"
            
            cashier = random.choice(branch_cashiers)

            n_items = random.randint(1, 3)
            selected = random.sample(branch_products, min(n_items, len(branch_products)))

            order = Order(
                order_number=order_num,
                cashier_id=cashier.id,
                branch_id=branch_obj.id, # Assign branch_id to order
                status="open",
                created_at=dt,
            )
            db.add(order)
            db.flush()

            subtotal = 0
            for prod in selected:
                qty = 1
                item_sub = prod.price * qty
                db.add(OrderItem(
                    order_id=order.id,
                    product_id=prod.id,
                    product_name=prod.name,
                    sku=prod.sku,
                    price=prod.price,
                    hpp=prod.hpp,
                    qty=qty,
                    subtotal=item_sub,
                ))
                subtotal += item_sub

            order.subtotal = round(subtotal)
            order.total = subtotal
            order.payment_method = None
            order_count += 1

    db.commit()
    print(f"  Total Orders: {order_count}")
    print("Seeding complete!\n")
    print("Login credentials:")
    for u_data in USERS:
        print(f"  {u_data['username']:12s} / {u_data['password']}  (role={u_data['role']})")


if __name__ == "__main__":
    if "--reset" in sys.argv:
        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("Recreated tables.\n")
    else:
        Base.metadata.create_all(bind=engine)

    seed()
    db.close()
