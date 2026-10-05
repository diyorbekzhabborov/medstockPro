const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/debts - list all debtors
router.get('/', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM debts';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY remaining_amount DESC, issue_date DESC';
  const debts = db.prepare(query).all(...params);

  // calculate days overdue
  const now = new Date();
  const enriched = debts.map(d => {
    let isOverdue = false;
    let daysDiff = 0;
    if (d.due_date && d.status !== 'PAID') {
      const dueDate = new Date(d.due_date);
      if (now > dueDate) {
        isOverdue = true;
        daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      }
    }
    return {
      ...d,
      isOverdue,
      daysOverdue: daysDiff
    };
  });

  res.json({ debts: enriched });
});

// POST /api/debts/:id/pay - repay debt
router.post('/:id/pay', (req, res) => {
  const { amount, payment_method = 'CASH', transaction_reference = '', notes = '' } = req.body;
  const payAmount = Number(amount);

  if (!payAmount || payAmount <= 0) {
    return res.status(400).json({ error: 'Укажите корректную сумму оплаты' });
  }

  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(req.params.id);
  if (!debt) return res.status(404).json({ error: 'Запись о долге не найдена' });

  if (payAmount > debt.remaining_amount) {
    return res.status(400).json({ error: `Сумма оплаты (${payAmount} TJS) превышает остаток долга (${debt.remaining_amount} TJS)` });
  }

  const newRemaining = Number((debt.remaining_amount - payAmount).toFixed(2));
  const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';

  const paymentId = 'pay-' + Date.now();

  const executePayment = db.transaction(() => {
    // Record payment
    db.prepare(`
      INSERT INTO debt_payments (id, debt_id, amount, payment_method, transaction_reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(paymentId, debt.id, payAmount, payment_method, transaction_reference, notes);

    // Update debt
    db.prepare(`
      UPDATE debts
      SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newRemaining, newStatus, debt.id);
  });

  try {
    executePayment();
    const updated = db.prepare('SELECT * FROM debts WHERE id = ?').get(debt.id);
    res.json({
      success: true,
      debt: updated,
      payment: { id: paymentId, amount: payAmount, method: payment_method }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка погашения долга: ' + err.message });
  }
});

// GET /api/debts/:id/reminder-text
router.get('/:id/reminder-text', (req, res) => {
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(req.params.id);
  if (!debt) return res.status(404).json({ error: 'Должник не найден' });

  const dateFormatted = new Date(debt.issue_date).toLocaleDateString('ru-RU');
  const amountStr = `${debt.remaining_amount.toLocaleString('ru-RU')} TJS`;

  const textRu = `Здравствуйте, ${debt.debtor_name}! Напоминаем о задолженности перед медицинским складом «MedStock Pro» на сумму ${amountStr} (от ${dateFormatted}). Пожалуйста, погасите задолженность в ближайшее время. Оплата принимается: Наличными, Dushanbe City, Alif Mobi, Банк Эсхата. Спасибо!`;

  const textTj = `Салом, ${debt.debtor_name}! Ёдрас мекунем, ки маблағи қарзи шумо аз анбори тиббии «MedStock Pro» ${amountStr} мебошад (аз санаи ${dateFormatted}). Лутфан, дар муҳлати наздик пардохт намоед. Пардохт тавассути: Пули нақд, Dushanbe City, Alif Mobi, Бонки Эсхата. Ташаккур!`;

  res.json({
    textRu,
    textTj,
    phone: debt.phone,
    whatsappUrlRu: `https://wa.me/${debt.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(textRu)}`,
    telegramUrlRu: `https://t.me/share/url?url=&text=${encodeURIComponent(textRu)}`
  });
});

module.exports = router;
