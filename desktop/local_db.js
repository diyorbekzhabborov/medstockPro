const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'local_warehouse.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize local offline database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS local_products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    retail_price REAL NOT NULL DEFAULT 0.0,
    photo_url TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS local_operations (
    id TEXT PRIMARY KEY,
    operation_code TEXT NOT NULL,
    type TEXT NOT NULL, -- SALE, CLINIC_WRITE_OFF, RECEIVE, ADJUSTMENT
    payment_type TEXT NOT NULL, -- CASH, BANK_TRANSFER, DEBT, NONE
    bank_name TEXT,
    transaction_reference TEXT,
    total_amount REAL NOT NULL DEFAULT 0.0,
    counterparty_name TEXT,
    counterparty_phone TEXT,
    due_date TEXT,
    status TEXT NOT NULL, -- PAID, DEBT, CLINIC_INTERNAL, RECEIVED
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_pending INTEGER DEFAULT 1 -- 1 = unsynced, 0 = synced
  );

  CREATE TABLE IF NOT EXISTS local_operation_items (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY(operation_id) REFERENCES local_operations(id)
  );

  CREATE TABLE IF NOT EXISTS local_debts (
    id TEXT PRIMARY KEY,
    operation_id TEXT,
    debtor_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    initial_amount REAL NOT NULL,
    remaining_amount REAL NOT NULL,
    issue_date DATETIME NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL, -- ACTIVE, PARTIALLY_PAID, PAID, OVERDUE
    items_summary TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_pending INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS local_debt_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_reference TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_pending INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS local_config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Insert default config if empty
const configCheck = db.prepare('SELECT value FROM local_config WHERE key = ?').get('cloud_url');
if (!configCheck) {
  db.prepare('INSERT INTO local_config (key, value) VALUES (?, ?)').run('cloud_url', 'http://localhost:4000');
  db.prepare('INSERT INTO local_config (key, value) VALUES (?, ?)').run('client_id', 'desktop-win-terminal-01');
}

// Локальная база данных пуста и готова для ручного ввода товаров оператором

module.exports = db;
