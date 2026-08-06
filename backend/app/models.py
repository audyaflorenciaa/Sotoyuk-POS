from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Role(str, Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    KASIR = "kasir"


class OrderStatus(str, Enum):
    OPEN = "open"
    PAID = "paid"
    VOID = "void"


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    address = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="branch")
    products = relationship("Product", back_populates="branch")
    orders = relationship("Order", back_populates="branch")
    tables = relationship("Table", back_populates="branch")
    settings = relationship("Setting", back_populates="branch")
    customers = relationship("Customer", back_populates="branch")


class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(20), nullable=False) # Not unique globally, unique per branch
    name = Column(String(50), nullable=True)
    capacity = Column(Integer, default=4)
    status = Column(String(20), default="available")  # available | occupied | reserved
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False) # Each table belongs to a branch
    created_at = Column(DateTime, default=datetime.utcnow)

    branch = relationship("Branch", back_populates="tables")
    orders = relationship("Order", back_populates="table")
    
    __table_args__ = (UniqueConstraint('number', 'branch_id', name='uq_table_number_branch'),)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    email = Column(String(120), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default=Role.KASIR.value, nullable=False)
    is_active = Column(Boolean, default=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True) # User belongs to a branch, Superadmin can be None
    created_at = Column(DateTime, default=datetime.utcnow)

    orders = relationship("Order", back_populates="cashier")
    branch = relationship("Branch", back_populates="users")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    slug = Column(String(120), unique=True, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), index=True, nullable=False) # SKU is unique per branch
    name = Column(String(150), index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    price = Column(Float, default=0)
    hpp = Column(Float, default=0)  # harga pokok penjualan / cost
    discount = Column(Float, default=0)  # diskon produk (rupiah)
    stock = Column(Integer, default=0)
    image = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False) # Each product belongs to a branch
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("Category", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    branch = relationship("Branch", back_populates="products")
    
    __table_args__ = (UniqueConstraint('sku', 'branch_id', name='uq_product_sku_branch'),)


class Voucher(Base):
    __tablename__ = "vouchers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=True)
    discount_type = Column(String(20), default="percent")  # percent | nominal
    discount_value = Column(Float, default=0)
    max_discount = Column(Float, nullable=True)
    min_order = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    valid_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(30), unique=True, index=True, nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False) # Each order belongs to a branch
    status = Column(String(20), default=OrderStatus.OPEN.value, nullable=False)
    subtotal = Column(Float, default=0)
    discount = Column(Float, default=0)
    tax = Column(Float, default=0)
    service_charge = Column(Float, default=0)
    total = Column(Float, default=0)
    payment_method = Column(String(20), nullable=True)
    voucher_code = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    paid_at = Column(DateTime, nullable=True)

    cashier = relationship("User", back_populates="orders")
    items = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    payments = relationship(
        "Payment", back_populates="order", cascade="all, delete-orphan"
    )
    table = relationship("Table", back_populates="orders")
    branch = relationship("Branch", back_populates="orders")


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (UniqueConstraint("order_id", "product_id", name="uq_order_product"),)

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_name = Column(String(150), nullable=False)
    sku = Column(String(50), nullable=True)
    price = Column(Float, default=0)
    hpp = Column(Float, default=0)
    discount = Column(Float, default=0)
    qty = Column(Integer, default=1)
    subtotal = Column(Float, default=0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    method = Column(String(20), nullable=False)
    amount = Column(Float, default=0)
    status = Column(String(20), default="success")
    reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="payments")


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), index=True, nullable=False) # key is unique per branch, not global
    value = Column(Text, nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False) # Each setting belongs to a branch
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    branch = relationship("Branch", back_populates="settings")

    __table_args__ = (UniqueConstraint('key', 'branch_id', name='uq_setting_key_branch'),)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(120), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True) # Optional home branch
    created_at = Column(DateTime, default=datetime.utcnow)

    member = relationship("Member", back_populates="customer", uselist=False)
    branch = relationship("Branch", back_populates="customers")


class MembershipTier(Base):
    __tablename__ = "membership_tiers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    point_rate = Column(Float, default=0)  # poin per Rupiah dibayar
    discount_percent = Column(Float, default=0)  # diskon khusus tier (opsional)
    minimum_spend = Column(Float, default=0)  # spend minimum untuk pakai diskon tier
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("Member", back_populates="tier")


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, unique=True)
    member_code = Column(String(30), unique=True, index=True, nullable=False)
    tier_id = Column(Integer, ForeignKey("membership_tiers.id"), nullable=True)
    points = Column(Integer, default=0)
    expiry_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="member")
    tier = relationship("MembershipTier", back_populates="members")
    point_ledger = relationship("MemberPoint", back_populates="member", cascade="all, delete-orphan")


class MemberPoint(Base):
    __tablename__ = "member_points"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    points = Column(Integer, default=0)  # positif = earn, negatif = redeem
    balance_after = Column(Integer, nullable=False)
    type = Column(String(20), default="earn")  # earn | redeem | expire
    description = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    member = relationship("Member", back_populates="point_ledger")
    order = relationship("Order")
