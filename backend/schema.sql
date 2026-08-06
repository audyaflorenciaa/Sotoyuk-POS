-- schema.sql  –  PostgreSQL schema for F&B POS MVP
-- Run after init.sql or via seed.py

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    full_name     VARCHAR(100),
    email         VARCHAR(120) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'kasir',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(120) UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    sku         VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(150) NOT NULL,
    category_id INT REFERENCES categories(id),
    price       NUMERIC(12,2) DEFAULT 0,
    hpp         NUMERIC(12,2) DEFAULT 0,
    stock       INT DEFAULT 0,
    image       VARCHAR(255),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    phone      VARCHAR(30),
    email      VARCHAR(120),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
    id             SERIAL PRIMARY KEY,
    code           VARCHAR(50) UNIQUE NOT NULL,
    name           VARCHAR(120),
    discount_type  VARCHAR(20) DEFAULT 'percent',
    discount_value NUMERIC(12,2) DEFAULT 0,
    max_discount   NUMERIC(12,2),
    min_order      NUMERIC(12,2) DEFAULT 0,
    is_active      BOOLEAN DEFAULT TRUE,
    valid_until    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tables (
    id        SERIAL PRIMARY KEY,
    number    VARCHAR(20) UNIQUE NOT NULL,
    name      VARCHAR(50),
    capacity  INT DEFAULT 4,
    status    VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(30) UNIQUE NOT NULL,
    table_id        INT REFERENCES tables(id),
    customer_id     INT REFERENCES customers(id),
    cashier_id      INT REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    subtotal        NUMERIC(12,2) DEFAULT 0,
    discount        NUMERIC(12,2) DEFAULT 0,
    tax             NUMERIC(12,2) DEFAULT 0,
    service_charge  NUMERIC(12,2) DEFAULT 0,
    total           NUMERIC(12,2) DEFAULT 0,
    payment_method  VARCHAR(20),
    voucher_code    VARCHAR(50),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    paid_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
    id            SERIAL PRIMARY KEY,
    order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    INT NOT NULL REFERENCES products(id),
    product_name  VARCHAR(150) NOT NULL,
    sku           VARCHAR(50),
    price         NUMERIC(12,2) DEFAULT 0,
    hpp           NUMERIC(12,2) DEFAULT 0,
    qty           INT DEFAULT 1,
    subtotal      NUMERIC(12,2) DEFAULT 0,
    UNIQUE(order_id, product_id)
);

CREATE TABLE IF NOT EXISTS payments (
    id         SERIAL PRIMARY KEY,
    order_id   INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method     VARCHAR(20) NOT NULL,
    amount     NUMERIC(12,2) DEFAULT 0,
    status     VARCHAR(20) DEFAULT 'success',
    reference  VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id         SERIAL PRIMARY KEY,
    key        VARCHAR(100) UNIQUE NOT NULL,
    value      TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_sku       ON products(sku);
CREATE INDEX idx_orders_status      ON orders(status);
CREATE INDEX idx_orders_created     ON orders(created_at);
CREATE INDEX idx_order_items_order  ON order_items(order_id);
CREATE INDEX idx_payments_order     ON payments(order_id);