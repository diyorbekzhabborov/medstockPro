const db = require('./db');
const seedData = require('../../shared/seedData');

function seedDatabase() {
  console.log('--- Наполнение базы данных MedStock Pro тестовыми данными ---');

  // Insert Users
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, password_hash, full_name, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  const runUsers = db.transaction(() => {
    for (const u of seedData.initialUsers) {
      insertUser.run(u.id, u.username, u.password, u.fullName, u.role);
    }
  });
  runUsers();
  console.log(`[OK] Загружено пользователей: ${seedData.initialUsers.length}`);

  // Insert Products
  const insertProduct = db.prepare(`
    INSERT OR REPLACE INTO products (id, sku, barcode, name, category, unit, stock_quantity, retail_price, photo_url, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `);

  const runProducts = db.transaction(() => {
    for (const p of seedData.products) {
      insertProduct.run(
        p.id,
        p.sku,
        p.barcode,
        p.name,
        p.category,
        p.unit,
        p.stock_quantity,
        p.retail_price,
        p.photo_url
      );
    }
  });
  runProducts();
  console.log(`[OK] Загружено товаров: ${seedData.products.length}`);

  // Insert Operations & Items
  const insertOp = db.prepare(`
    INSERT OR REPLACE INTO operations (
      id, operation_code, type, payment_type, bank_name, transaction_reference,
      total_amount, counterparty_name, counterparty_phone, due_date, status,
      notes, created_by, created_at, client_id, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cloud-init', CURRENT_TIMESTAMP)
  `);

  const insertOpItem = db.prepare(`
    INSERT OR REPLACE INTO operation_items (id, operation_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const runOps = db.transaction(() => {
    for (const op of seedData.initialOperations) {
      insertOp.run(
        op.id,
        op.operation_code,
        op.type,
        op.payment_type,
        op.bank_name || null,
        op.transaction_reference || null,
        op.total_amount,
        op.counterparty_name || null,
        op.counterparty_phone || null,
        op.due_date || null,
        op.status,
        op.notes || null,
        op.created_by,
        op.created_at
      );

      for (let i = 0; i < op.items.length; i++) {
        const it = op.items[i];
        insertOpItem.run(
          `${op.id}-item-${i}`,
          op.id,
          it.product_id,
          it.product_name,
          it.quantity,
          it.unit_price,
          it.total_price
        );
      }
    }
  });
  runOps();
  console.log(`[OK] Загружено операций: ${seedData.initialOperations.length}`);

  // Insert Debts
  const insertDebt = db.prepare(`
    INSERT OR REPLACE INTO debts (id, operation_id, debtor_name, phone, initial_amount, remaining_amount, issue_date, due_date, status, items_summary, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const runDebts = db.transaction(() => {
    for (const d of seedData.initialDebts) {
      insertDebt.run(
        d.id,
        d.operation_id,
        d.debtor_name,
        d.phone,
        d.initial_amount,
        d.remaining_amount,
        d.issue_date,
        d.due_date,
        d.status,
        d.items_summary
      );
    }
  });
  runDebts();
  console.log(`[OK] Загружено должников: ${seedData.initialDebts.length}`);
  console.log('--- База данных MedStock Pro готова к работе! ---');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
