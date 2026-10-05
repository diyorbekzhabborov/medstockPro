const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/operations - list all transactions
router.get('/', (req, res) => {
  const { type, limit = 50 } = req.query;
  let query = 'SELECT * FROM operations';
  const params = [];

  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  const operations = db.prepare(query).all(...params);

  // attach items
  const getItemStmt = db.prepare('SELECT * FROM operation_items WHERE operation_id = ?');
  const enriched = operations.map(op => ({
    ...op,
    items: getItemStmt.all(op.id)
  }));

  res.json({ operations: enriched });
});

// POST /api/operations - record operation (Sale, Clinic write-off, Receive)
router.post('/', (req, res) => {
  const {
    type, // SALE, CLINIC_WRITE_OFF, RECEIVE
    payment_type = 'NONE', // CASH, BANK_TRANSFER, DEBT, NONE
    bank_name = null,
    transaction_reference = null,
    counterparty_name = null,
    counterparty_phone = null,
    due_date = null,
    notes = null,
    created_by = 'Оператор',
    items = []
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Список товаров не может быть пустым' });
  }

  const opId = 'op-' + Date.now();
  // Generate short readable code like 1045
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM operations').get();
  const nextCode = (1042 + countRow.cnt).toString();

  let totalAmount = 0;
  let opStatus = 'PAID';

  if (type === 'CLINIC_WRITE_OFF') {
    // Requirements from TOR Section 3:
    // "Сумма оплаты равна 0,00 TJS (не формирует долг и выручку).
    // В истории помечается специальным статусом внутреннего расхода."
    totalAmount = 0.0;
    opStatus = 'CLINIC_INTERNAL';
  } else if (type === 'SALE') {
    // Scenario A: Sale
    totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)), 0);
    totalAmount = Number(totalAmount.toFixed(2));

    if (payment_type === 'DEBT') {
      opStatus = 'DEBT';
    } else {
      opStatus = 'PAID';
    }
  } else if (type === 'RECEIVE') {
    totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)), 0);
    totalAmount = Number(totalAmount.toFixed(2));
    opStatus = 'RECEIVED';
  }

  const insertOp = db.prepare(`
    INSERT INTO operations (
      id, operation_code, type, payment_type, bank_name, transaction_reference,
      total_amount, counterparty_name, counterparty_phone, due_date, status,
      notes, created_by, created_at, client_id, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'local', CURRENT_TIMESTAMP)
  `);

  const insertItem = db.prepare(`
    INSERT INTO operation_items (id, operation_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateProductStock = db.prepare(`
    UPDATE products
    SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const insertDebt = db.prepare(`
    INSERT INTO debts (id, operation_id, debtor_name, phone, initial_amount, remaining_amount, issue_date, due_date, status, items_summary, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP)
  `);

  // Execute in single transaction
  const executeOperation = db.transaction(() => {
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

      // Adjust stock quantity:
      // SALE and CLINIC_WRITE_OFF reduce stock
      // RECEIVE increases stock
      const stockDelta = (type === 'RECEIVE') ? Number(it.quantity) : -Number(it.quantity);
      updateProductStock.run(stockDelta, it.product_id);
    }

    // If sale on DEBT, insert into debts table
    if (type === 'SALE' && payment_type === 'DEBT') {
      const debtId = 'debt-' + Date.now();
      insertDebt.run(
        debtId,
        opId,
        counterparty_name || 'Контрагент без имени',
        counterparty_phone || '',
        totalAmount,
        totalAmount,
        due_date || null,
        itemsSummaryArr.join(', ')
      );
    }
  });

  try {
    executeOperation();
    const createdOp = db.prepare('SELECT * FROM operations WHERE id = ?').get(opId);
    createdOp.items = db.prepare('SELECT * FROM operation_items WHERE operation_id = ?').all(opId);
    res.status(201).json({ operation: createdOp });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка проведения операции: ' + err.message });
  }
});

module.exports = router;
