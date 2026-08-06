-- init.sql –  Run this first to create the database + extensions (PostgreSQL only)
-- Usage:  psql -U postgres -f init.sql

CREATE DATABASE kasir;
\c kasir
CREATE EXTENSION IF NOT EXISTS "pgcrypto";