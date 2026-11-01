from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Branch ---
class BranchBase(BaseModel):
    name: str
    address: Optional[str] = None

class BranchCreate(BranchBase):
    pass

class BranchOut(BranchBase, ORMModel):
    id: int
    created_at: datetime


# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(min_length=4)
    role: str = "kasir"
    branch_id: Optional[int] = None # Superadmin can be None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    branch_id: Optional[int] = None


class UserOut(ORMModel):
    id: int
    username: str
    full_name: Optional[str]
    email: Optional[str]
    role: str
    is_active: bool
    branch_id: Optional[int] = None
    created_at: Optional[datetime] = None
    branch: Optional[BranchOut] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


# --- Category ---
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CategoryOut(CategoryBase):
    id: int
    slug: Optional[str] = None


# --- Product ---
class ProductBase(BaseModel):
    sku: str
    name: str
    category_id: Optional[int] = None
    price: float = 0
    hpp: float = 0
    discount: float = 0
    stock: int = 0
    image: Optional[str] = None
    is_active: bool = True
    branch_id: Optional[int] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    price: Optional[float] = None
    hpp: Optional[float] = None
    discount: Optional[float] = None
    stock: Optional[int] = None
    image: Optional[str] = None
    is_active: Optional[bool] = None
    branch_id: Optional[int] = None


class ProductOut(ProductBase):
    id: int
    category_name: Optional[str] = None
    category: Optional[CategoryOut] = None
    branch: Optional[BranchOut] = None


# --- Customer ---
class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    branch_id: Optional[int] = None


class CustomerOut(ORMModel):
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    branch_id: Optional[int] = None
    branch: Optional[BranchOut] = None


# --- Voucher ---
class VoucherCreate(BaseModel):
    code: str
    name: Optional[str] = None
    discount_type: str = "percent"
    discount_value: float = 0
    max_discount: Optional[float] = None
    min_order: float = 0


class VoucherOut(ORMModel):
    id: int
    code: str
    name: Optional[str] = None
    discount_type: str
    discount_value: float
    max_discount: Optional[float] = None
    min_order: float
    is_active: bool
    valid_until: Optional[datetime] = None


# --- POS / Order ---
class OrderItemIn(BaseModel):
    product_id: int
    qty: int = Field(ge=1)
    price: Optional[float] = None


class OrderCreate(BaseModel):
    customer_id: Optional[int] = None
    items: List[OrderItemIn]
    notes: Optional[str] = None


class OrderItemOut(ORMModel):
    id: int
    product_id: int
    product_name: str
    sku: Optional[str] = None
    price: float
    hpp: float = 0
    discount: float = 0
    qty: int
    subtotal: float


class OrderOut(ORMModel):
    id: int
    order_number: str
    customer_id: Optional[int] = None
    cashier_id: Optional[int] = None
    branch_id: int
    status: str
    subtotal: float
    discount: float
    service_charge: float
    total: float
    payment_method: Optional[str] = None
    voucher_code: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    items: List["OrderItemOut"] = []
    customer: Optional["CustomerOut"] = None
    cashier: Optional["UserOut"] = None
    branch: Optional[BranchOut] = None


class PaymentRequest(BaseModel):
    order_id: int
    method: str
    amount: float
    cash_received: Optional[float] = None
    voucher_code: Optional[str] = None
    reference: Optional[str] = None


class PaymentResult(BaseModel):
    order: OrderOut
    change: float = 0
    payment: dict = {}


# --- Settings ---
class SettingIn(BaseModel):
    key: str
    value: Optional[str] = None
    branch_id: Optional[int] = None


class SettingOut(ORMModel):
    key: str
    value: Optional[str] = None
    branch_id: int
    updated_at: Optional[datetime] = None
    branch: Optional[BranchOut] = None


# --- Dashboard ---
class DashboardStats(BaseModel):
    today_revenue: float
    today_orders: int
    today_items: int
    today_customers: int
    open_orders: int
    low_stock: int
    revenue_7d: List[dict] = []


# --- Generic ---
class Message(BaseModel):
    detail: str


class Paginated(BaseModel):
    items: List[dict]
    total: int
    page: int
    size: int


# --- Rebuild forward references ---
Token.model_rebuild()
UserOut.model_rebuild()
ProductOut.model_rebuild()
CustomerOut.model_rebuild()
OrderItemOut.model_rebuild()
OrderOut.model_rebuild()
SettingOut.model_rebuild()
