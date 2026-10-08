const express = require('express');
const router = express.Router();
const db = require('../db');
const { supabase } = require('../supabase');

// GET /api/sync/health - connection test
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    serverTime: new Date().toISOString(),
    version: '1.0.0',
    system: 'MedStock Pro Cloud Gateway',
    supabaseUrl: 'https://mljkzfoghenkawgnesoc.supabase.co'
  });
});

// POST /api/sync/push - receives offline operations and products from Windows desktop client
router.post('/push', async (req, res) => {
  const { clientId = 'desktop-win-01', operations = [], products = [], debts = [] } = req.body;

  // 1. Process products if sent
  if (Array.isArray(products) && products.length > 0) {
    const upsertProd = db.prepare(`
      INSERT INTO products (id, sku, barcode, name, category, unit, stock_quantity, retail_price, photo_url, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sku = excluded.sku,
        barcode = excluded.barcode,
        name = excluded.name,
        category = excluded.category,
        unit = excluded.unit,
        stock_quantity = excluded.stock_quantity,
        retail_price = excluded.retail_price,
        photo_url = excluded.photo_url,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `);
    const runProdUpsert = db.transaction(() => {
      for (const p of products) {
        upsertProd.run(p.id, p.sku, p.barcode, p.name, p.category || 'Медикаменты', p.unit || 'шт.', p.stock_quantity || 0, p.retail_price || 0, p.photo_url || null, 1, p.updated_at || new Date().toISOString());
      }
    });
    runProdUpsert();

    // Also push products to Supabase if configured
    if (supabase) {
      try {
        await supabase.from('products').upsert(products.map(p => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          category: p.category || 'Медикаменты',
          unit: p.unit || 'шт.',
          stock_quantity: p.stock_quantity || 0,
          retail_price: p.retail_price || 0,
          photo_url: p.photo_url || null,
          is_active: 1,
          updated_at: p.updated_at || new Date().toISOString()
        })));
      } catch (err) {
        console.log('[SUPABASE] Products sync note:', err.message);
      }
    }
  }

  // 2. Process debts if sent
  if (Array.isArray(debts) && debts.length > 0) {
    const upsertDebt = db.prepare(`
      INSERT INTO debts (id, operation_id, debtor_name, phone, initial_amount, remaining_amount, issue_date, due_date, status, items_summary, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        debtor_name = excluded.debtor_name,
        phone = excluded.phone,
        initial_amount = excluded.initial_amount,
        remaining_amount = excluded.remaining_amount,
        status = excluded.status,
        items_summary = excluded.items_summary,
        updated_at = excluded.updated_at
    `);
    const runDebtsUpsert = db.transaction(() => {
      for (const d of debts) {
        upsertDebt.run(
          d.id,
          d.operation_id || null,
          d.debtor_name,
          d.phone || '',
          d.initial_amount,
          d.remaining_amount,
          d.issue_date || new Date().toISOString(),
          d.due_date || null,
          d.status || 'ACTIVE',
          d.items_summary || '',
          d.updated_at || new Date().toISOString()
        );
      }
    });
    runDebtsUpsert();
  }

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.json({ success: true, pushedCount: 0, syncedIds: [] });
  }

  const syncedIds = [];
  const hasSyncedProducts = Array.isArray(products) && products.length > 0;

  const insertOp = db.prepare(`
    INSERT OR IGNORE INTO operations (
      id, operation_code, type, payment_type, bank_name, transaction_reference,
      total_amount, counterparty_name, counterparty_phone, due_date, status,
      notes, created_by, created_at, client_id, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO operation_items (id, operation_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateProductStock = db.prepare(`
    UPDATE products
    SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const insertDebt = db.prepare(`
    INSERT OR IGNORE INTO debts (id, operation_id, debtor_name, phone, initial_amount, remaining_amount, issue_date, due_date, status, items_summary, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP)
  `);

  const checkExisting = db.prepare('SELECT id FROM operations WHERE id = ?');

  const executeSync = db.transaction(() => {
    for (const op of operations) {
      const exists = checkExisting.get(op.id);
      if (exists) {
        syncedIds.push(op.id);
        continue;
      }

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
        op.created_at,
        clientId
      );

      const itemsSummaryArr = [];
      if (op.items && Array.isArray(op.items)) {
        for (let i = 0; i < op.items.length; i++) {
          const it = op.items[i];
          const lineTotal = Number((Number(it.quantity) * Number(it.unit_price)).toFixed(2));
          insertItem.run(
            `${op.id}-item-${i}`,
            op.id,
            it.product_id,
            it.product_name,
            Number(it.quantity),
            Number(it.unit_price),
            lineTotal
          );
          itemsSummaryArr.push(`${it.product_name} (${it.quantity} шт.)`);

          // Stock adjustment only if products were not explicitly passed
          if (!hasSyncedProducts) {
            const stockDelta = (op.type === 'RECEIVE') ? Number(it.quantity) : -Number(it.quantity);
            updateProductStock.run(stockDelta, it.product_id);
          }
        }
      }

      // If debt
      if (op.type === 'SALE' && op.payment_type === 'DEBT') {
        const debtId = 'debt-' + op.id;
        insertDebt.run(
          debtId,
          op.id,
          op.counterparty_name || 'Контрагент',
          op.counterparty_phone || '',
          op.total_amount,
          op.total_amount,
          op.created_at,
          op.due_date || null,
          itemsSummaryArr.join(', ')
        );
      }

      syncedIds.push(op.id);
    }

    // Record in sync journal
    const syncLogId = 'sync-' + Date.now();
    db.prepare(`
      INSERT INTO sync_journal (id, client_id, sync_type, items_pushed, items_pulled, status)
      VALUES (?, ?, 'PUSH', ?, 0, 'SUCCESS')
    `).run(syncLogId, clientId, syncedIds.length);
  });

  try {
    executeSync();
    res.json({
      success: true,
      pushedCount: syncedIds.length,
      syncedIds
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка синхронизации: ' + err.message });
  }
});

// GET /api/sync/pull - sends updated catalog and debts to desktop client
router.get('/pull', (req, res) => {
  const { since } = req.query;

  let prodQuery = 'SELECT * FROM products';
  let debtQuery = 'SELECT * FROM debts';
  const prodParams = [];
  const debtParams = [];

  if (since) {
    prodQuery += ' WHERE updated_at > ?';
    prodParams.push(since);
    debtQuery += ' WHERE updated_at > ?';
    debtParams.push(since);
  }

  const products = db.prepare(prodQuery).all(...prodParams);
  const debts = db.prepare(debtQuery).all(...debtParams);

  res.json({
    serverTime: new Date().toISOString(),
    products,
    debts
  });
});

module.exports = router;
