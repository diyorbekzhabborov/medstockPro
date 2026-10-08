const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'cloud_medstock.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

// Helper for transaction matching better-sqlite3 signature
db.transaction = function(fn) {
  return function(...args) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const res = fn(...args);
      db.exec('COMMIT;');
      return res;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  };
};

db.pragma = function(str) {
  try {
    return db.exec('PRAGMA ' + str + ';');
  } catch (e) {
    return null;
  }
};

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    retail_price REAL NOT NULL DEFAULT 0.0,
    photo_url TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    operation_code TEXT NOT NULL,
    type TEXT NOT NULL, -- SALE, CLINIC_WRITE_OFF, RECEIVE, ADJUSTMENT
    payment_type TEXT NOT NULL, -- CASH, BANK_TRANSFER, DEBT, NONE
    bank_name TEXT, -- Dushanbe City (DC), Банк Эсхата, Алиф Банк / Alif Mobi, Амонатбонк
    transaction_reference TEXT,
    total_amount REAL NOT NULL DEFAULT 0.0,
    counterparty_name TEXT,
    counterparty_phone TEXT,
    due_date TEXT,
    status TEXT NOT NULL, -- PAID, DEBT, CLINIC_INTERNAL, RECEIVED
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    client_id TEXT,
    synced_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS operation_items (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY(operation_id) REFERENCES operations(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS debts (
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS debt_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL, -- CASH, Dushanbe City, Банк Эсхата, Алиф Банк, etc.
    transaction_reference TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(debt_id) REFERENCES debts(id)
  );

  CREATE TABLE IF NOT EXISTS sync_journal (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    sync_type TEXT NOT NULL,
    items_pushed INTEGER DEFAULT 0,
    items_pulled INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
