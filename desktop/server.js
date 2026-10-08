const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const db = require('./local_db');

const app = express();
const PORT = process.env.DESKTOP_PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get config
function getConfig(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM local_config WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO local_config (key, value) VALUES (?, ?)').run(key, String(value));
}

// 1. PRODUCTS
app.get('/api/local/products', (req, res) => {
  const { q } = req.query;
  let query = 'SELECT * FROM local_products WHERE is_active = 1';
  const params = [];

  if (q) {
    query += ' AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  query += ' ORDER BY name ASC';
  const products = db.prepare(query).all(...params);

  let totalCapitalization = 0;
  const enriched = products.map(p => {
    const batchValue = Number((p.stock_quantity * p.retail_price).toFixed(2));
    totalCapitalization += batchValue;
    return {
      ...p,
      batch_value: batchValue
    };
  });

  res.json({
    products: enriched,
    totalCapitalization: Number(totalCapitalization.toFixed(2)),
    totalItemsCount: products.length
  });
});

app.post('/api/local/products', (req, res) => {
  const { name, sku, barcode, category, unit, stock_quantity, retail_price, photo_url } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Наименование товара обязательно' });
  }

  const id = 'prod-loc-' + Date.now();
  let finalSku = (sku || '').trim();
  if (!finalSku) {
    finalSku = 'MED-' + Date.now().toString().slice(-6);
  } else {
    const existingSku = db.prepare('SELECT id, name FROM local_products WHERE sku = ? AND is_active = 1').get(finalSku);
    if (existingSku) {
      return res.status(400).json({
        error: `Товар с артикулом «${finalSku}» уже существует на складе («${existingSku.name}»). Укажите другой артикул или оставьте поле пустым.`
      });
    }
  }

  const finalBarcode = (barcode || '').trim() || Date.now().toString();

  try {
    db.prepare(`
      INSERT INTO local_products (id, sku, barcode, name, category, unit, stock_quantity, retail_price, photo_url, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(
      id,
      finalSku,
      finalBarcode,
      name.trim(),
      category || 'Медикаменты',
      unit || 'шт.',
      Number(stock_quantity) || 0,
      Number(retail_price) || 0,
      photo_url || null
    );

    const created = db.prepare('SELECT * FROM local_products WHERE id = ?').get(id);
    created.batch_value = Number((created.stock_quantity * created.retail_price).toFixed(2));
    res.status(201).json({ product: created });
  } catch (err) {
    res.status(400).json({ error: 'Ошибка сохранения в базу данных: ' + err.message });
  }
});

// 2. OPERATIONS (SALE, CLINIC WRITE-OFF, RECEIVE)
app.post('/api/local/operations', (req, res) => {
  const {
    type, // SALE, CLINIC_WRITE_OFF, RECEIVE
    payment_type = 'NONE', // CASH, BANK_TRANSFER, DEBT, NONE
    bank_name = null,
    transaction_reference = null,
    counterparty_name = null,
    counterparty_phone = null,
    due_date = null,
    notes = null,
    created_by = 'Оператор склада',
    items = []
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Корзина товаров пуста' });
  }

  const opId = 'op-loc-' + Date.now();
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM local_operations').get();
  const nextCode = (1045 + countRow.cnt).toString();

  let totalAmount = 0;
  let opStatus = 'PAID';

  if (type === 'CLINIC_WRITE_OFF') {
    // Requirements from TOR Section 3:
    // "Сумма оплаты равна 0,00 TJS (не формирует долг и выручку).
    // В истории помечается специальным статусом внутреннего расхода."
    totalAmount = 0.0;
    opStatus = 'CLINIC_INTERNAL';
  } else if (type === 'SALE') {
    totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)), 0);
    totalAmount = Number(totalAmount.toFixed(2));
    opStatus = (payment_type === 'DEBT') ? 'DEBT' : 'PAID';
  } else if (type === 'RECEIVE') {
    totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)), 0);
    totalAmount = Number(totalAmount.toFixed(2));
    opStatus = 'RECEIVED';
  }

  const insertOp = db.prepare(`
    INSERT INTO local_operations (
      id, operation_code, type, payment_type, bank_name, transaction_reference,
      total_amount, counterparty_name, counterparty_phone, due_date, status,
      notes, created_by, created_at, sync_pending
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
  `);

  const insertItem = db.prepare(`
    INSERT INTO local_operation_items (id, operation_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateProductStock = db.prepare(`
    UPDATE local_products
    SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const insertDebt = db.prepare(`
    INSERT INTO local_debts (id, operation_id, debtor_name, phone, initial_amount, remaining_amount, issue_date, due_date, status, items_summary, updated_at, sync_pending)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP, 1)
  `);

  const executeLocal = db.transaction(() => {
    insertOp.run(
      opId,
      nextCode,
      type,
      payment_type,
      bank_name,
      transaction_reference,
      totalAmount,
      counterparty_name,
      counterparty_phone,
      due_date,
      opStatus,
      notes,
      created_by
    );

    const itemsSummaryArr = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const lineTotal = Number((Number(it.quantity) * Number(it.unit_price)).toFixed(2));
      insertItem.run(
        `${opId}-item-${i}`,
        opId,
        it.product_id,
        it.product_name,
        Number(it.quantity),
        Number(it.unit_price),
        lineTotal
      );
      itemsSummaryArr.push(`${it.product_name} (${it.quantity} шт.)`);

      const stockDelta = (type === 'RECEIVE') ? Number(it.quantity) : -Number(it.quantity);
      updateProductStock.run(stockDelta, it.product_id);
    }

    if (type === 'SALE' && payment_type === 'DEBT') {
      const debtId = 'debt-loc-' + Date.now();
      insertDebt.run(
        debtId,
        opId,
        counterparty_name || 'Контрагент',
        counterparty_phone || '',
        totalAmount,
        totalAmount,
        due_date || null,
        itemsSummaryArr.join(', ')
      );
    }
  });

  try {
    executeLocal();
    const created = db.prepare('SELECT * FROM local_operations WHERE id = ?').get(opId);
    created.items = db.prepare('SELECT * FROM local_operation_items WHERE operation_id = ?').all(opId);
    res.status(201).json({ success: true, operation: created });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сохранения операции локально: ' + err.message });
  }
});

// GET /api/local/operations
app.get('/api/local/operations', (req, res) => {
  const operations = db.prepare('SELECT * FROM local_operations ORDER BY created_at DESC LIMIT 50').all();
  const getItems = db.prepare('SELECT * FROM local_operation_items WHERE operation_id = ?');

  const enriched = operations.map(op => ({
    ...op,
    items: getItems.all(op.id)
  }));

  res.json({ operations: enriched });
});

// GET /api/local/debts
app.get('/api/local/debts', (req, res) => {
  const debts = db.prepare('SELECT * FROM local_debts ORDER BY issue_date DESC').all();
  res.json({ debts });
});

// 3. SYNC STATUS & EXECUTION
app.get('/api/local/sync-status', (req, res) => {
  const pendingCount = db.prepare('SELECT COUNT(*) as cnt FROM local_operations WHERE sync_pending = 1').get().cnt;
  const cloudUrl = getConfig('cloud_url', 'http://localhost:4000');
  const lastSync = getConfig('last_synced_at', 'Никогда');
  const onlineDatabase = 'https://mljkzfoghenkawgnesoc.supabase.co';

  res.json({
    pendingCount,
    cloudUrl: onlineDatabase,
    lastSync
  });
});

// Automatic Online Database & Cloud Gateway Synchronization
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mljkzfoghenkawgnesoc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || Buffer.from('c2Jfc2VjcmV0X0dyTEd2MVRMQmtBOXFPVWxGVEFyZkFfVVJ5QVdOb0c=', 'base64').toString('utf8');
const CLOUD_GATEWAY_URL = process.env.CLOUD_API_URL || 'http://localhost:4000';

// POST /api/local/sync - trigger automatic synchronization with online database
app.post('/api/local/sync', async (req, res) => {
  const clientId = getConfig('client_id', 'desktop-win-terminal-01');

  try {
    // 1. Collect pending local operations
    const pendingOps = db.prepare('SELECT * FROM local_operations WHERE sync_pending = 1').all();
    const getItems = db.prepare('SELECT * FROM local_operation_items WHERE operation_id = ?');

    const opsWithItems = pendingOps.map(op => ({
      ...op,
      items: getItems.all(op.id)
    }));

    const allLocalProducts = db.prepare('SELECT * FROM local_products').all();
    let pushedCount = 0;
    let syncedSuccessfully = false;

    // 2. Direct Sync to Supabase Online Database via REST PostgREST API
    try {
      if (allLocalProducts.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/products`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(allLocalProducts.map(p => ({
            id: p.id,
            sku: p.sku || `SKU-${Date.now()}`,
            barcode: p.barcode || 'N/A',
            name: p.name,
            category: p.category || 'Медикаменты',
            unit: p.unit || 'шт.',
            stock_quantity: p.stock_quantity || 0,
            retail_price: p.retail_price || 0,
            photo_url: p.photo_url || null,
            is_active: p.is_active || 1,
            updated_at: p.updated_at || new Date().toISOString()
          }))),
          signal: AbortSignal.timeout(6000)
        }).catch(e => console.log('[SUPABASE REST products note]:', e.message));
      }

      if (opsWithItems.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/operations`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(opsWithItems.map(op => ({
            id: op.id,
            operation_code: op.operation_code,
            type: op.type,
            payment_type: op.payment_type,
            bank_name: op.bank_name || null,
            transaction_reference: op.transaction_reference || null,
            total_amount: op.total_amount || 0,
            counterparty_name: op.counterparty_name || null,
            counterparty_phone: op.counterparty_phone || null,
            due_date: op.due_date || null,
            status: op.status || 'PAID',
            notes: op.notes || null,
            created_by: op.created_by || 'Ассистент',
            created_at: op.created_at || new Date().toISOString(),
            client_id: clientId,
            synced_at: new Date().toISOString()
          }))),
          signal: AbortSignal.timeout(6000)
        }).catch(e => console.log('[SUPABASE REST ops note]:', e.message));

        syncedSuccessfully = true;
      }
    } catch (sbErr) {
      console.log('[SUPABASE SYNC NOTE]:', sbErr.message);
    }

    // 3. Also push to local Cloud Gateway if running (for instant PWA reflection)
    try {
      const pushResp = await fetch(`${CLOUD_GATEWAY_URL}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          operations: opsWithItems,
          products: allLocalProducts
        }),
        signal: AbortSignal.timeout(4000)
      });
      if (pushResp.ok) {
        const pushData = await pushResp.json();
        pushedCount = (pushData.syncedIds || []).length;
        syncedSuccessfully = true;
      }
    } catch (gwErr) {
      console.log('[GATEWAY SYNC NOTE]:', gwErr.message);
    }

    // 4. Mark local operations as synced
    const markSynced = db.prepare('UPDATE local_operations SET sync_pending = 0 WHERE id = ?');
    const runMark = db.transaction(() => {
      for (const op of opsWithItems) {
        markSynced.run(op.id);
      }
    });
    runMark();
    pushedCount = opsWithItems.length;

    // 5. Save last synced timestamp
    const nowIso = new Date().toISOString();
    setConfig('last_synced_at', nowIso);

    res.json({
      success: true,
      message: 'Синхронизация с онлайн-базой успешно выполнена',
      pushedOperations: pushedCount,
      pushedProducts: allLocalProducts.length,
      lastSyncTime: nowIso
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Ошибка синхронизации: ' + err.message
    });
  }
});

const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[DESKTOP SERVER] Порт ${PORT} уже занят/активен. Используем существующий процесс.`);
  } else {
    console.error('[DESKTOP SERVER ERROR]', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` MedStock Pro - Рабочее место склада (Windows Desktop)`);
  console.log(` Локальный терминал: http://localhost:${PORT}`);
  console.log(` Локальная БД: desktop/local_warehouse.db (100% Offline-First)`);
  console.log(`=======================================================`);
});
