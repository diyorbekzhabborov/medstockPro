const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/analytics/dashboard
router.get('/dashboard', (req, res) => {
  // 1. Капитализация склада (Общая сумма товаров на балансе TJS)
  const capRow = db.prepare(`
    SELECT SUM(stock_quantity * retail_price) as total_capitalization,
           COUNT(*) as total_items_count,
           SUM(stock_quantity) as total_units_count
    FROM products
    WHERE is_active = 1
  `).get();
  const capitalization = Number((capRow.total_capitalization || 0).toFixed(2));

  // 2. Счётчик долгов (Суммарная цифра «Мне должны клиенты»)
  const debtRow = db.prepare(`
    SELECT SUM(remaining_amount) as total_debts,
           COUNT(*) as active_debtors_count
    FROM debts
    WHERE status != 'PAID'
  `).get();
  const totalDebts = Number((debtRow.total_debts || 0).toFixed(2));

  // 3. Расход клиники: Стоимость медикаментов, ушедших в клинику за текущий месяц
  // In SQLite, date('now', 'start of month')
  const clinicRow = db.prepare(`
    SELECT SUM(oi.quantity * oi.unit_price) as total_clinic_expense,
           COUNT(DISTINCT o.id) as clinic_operations_count
    FROM operations o
    JOIN operation_items oi ON o.id = oi.operation_id
    WHERE o.type = 'CLINIC_WRITE_OFF'
      AND o.created_at >= date('now', 'start of month')
  `).get();
  const clinicExpenseMonth = Number((clinicRow.total_clinic_expense || 0).toFixed(2));

  // 4. Выручка за сегодня: Наличные vs Безнал (DC / Эсхата / Алиф)
  const todayOps = db.prepare(`
    SELECT payment_type, bank_name, SUM(total_amount) as sum_amount, COUNT(*) as cnt
    FROM operations
    WHERE type = 'SALE'
      AND date(created_at) = date('now')
    GROUP BY payment_type, bank_name
  `).all();

  let revenueToday = {
    total: 0,
    cash: 0,
    cashless: 0,
    banks: {
      'Dushanbe City (DC)': 0,
      'Банк Эсхата': 0,
      'Алиф Банк / Alif Mobi': 0,
      'Амонатбонк / Другой банк': 0
    }
  };

  for (const row of todayOps) {
    const amt = Number(row.sum_amount) || 0;
    if (row.payment_type === 'CASH') {
      revenueToday.cash += amt;
      revenueToday.total += amt;
    } else if (row.payment_type === 'BANK_TRANSFER') {
      revenueToday.cashless += amt;
      revenueToday.total += amt;
      if (row.bank_name && revenueToday.banks[row.bank_name] !== undefined) {
        revenueToday.banks[row.bank_name] += amt;
      } else if (row.bank_name) {
        revenueToday.banks[row.bank_name] = amt;
      }
    }
  }

  // If there are no operations today in this test session, compute today's or recent for realistic display
  const allSalesRow = db.prepare(`
    SELECT SUM(total_amount) as total_revenue
    FROM operations
    WHERE type = 'SALE' AND status = 'PAID'
  `).get();

  // 5. Лента активности и журнал транзакций (Recent activity matching TOR table)
  const recentOps = db.prepare(`
    SELECT o.*,
      (SELECT GROUP_CONCAT(product_name || ' (' || quantity || ' шт.)', ', ')
       FROM operation_items
       WHERE operation_id = o.id) as items_summary,
      (SELECT SUM(quantity) FROM operation_items WHERE operation_id = o.id) as total_qty
    FROM operations o
    ORDER BY o.created_at DESC
    LIMIT 10
  `).all();

  const formattedTransactions = recentOps.map(op => {
    let categoryBadge = '';
    let categoryBadgeColor = '';
    let financeText = '';
    let financeColor = '';

    if (op.type === 'CLINIC_WRITE_OFF') {
      categoryBadge = 'Использование в клинике';
      categoryBadgeColor = 'orange';
      financeText = '0.00 TJS (Внутр. расход)';
      financeColor = 'text-amber-600 bg-amber-50';
    } else if (op.payment_type === 'DEBT') {
      categoryBadge = `В долг (${op.counterparty_name || 'Контрагент'})`;
      categoryBadgeColor = 'rose';
      financeText = `+${op.total_amount.toFixed(2)} TJS (Дебиторка)`;
      financeColor = 'text-rose-600 bg-rose-50';
    } else if (op.payment_type === 'BANK_TRANSFER') {
      categoryBadge = `Продажа (${op.bank_name || 'Безнал'})`;
      categoryBadgeColor = 'indigo';
      financeText = `+${op.total_amount.toFixed(2)} TJS (Оплачено)`;
      financeColor = 'text-emerald-600 bg-emerald-50';
    } else {
      categoryBadge = 'Продажа (Касса)';
      categoryBadgeColor = 'emerald';
      financeText = `+${op.total_amount.toFixed(2)} TJS (Оплачено)`;
      financeColor = 'text-emerald-600 bg-emerald-50';
    }

    return {
      id: op.id,
      operationCode: `Списание #${op.operation_code}`,
      itemsSummary: op.items_summary || 'Товары',
      categoryBadge,
      categoryBadgeColor,
      financeText,
      financeColor,
      totalAmount: op.total_amount,
      createdAt: op.created_at,
      status: op.status,
      type: op.type,
      paymentType: op.payment_type,
      bankName: op.bank_name
    };
  });

  res.json({
    kpis: {
      capitalization,
      totalDebts,
      clinicExpenseMonth,
      revenueToday: {
        total: Number(revenueToday.total.toFixed(2)),
        cash: Number(revenueToday.cash.toFixed(2)),
        cashless: Number(revenueToday.cashless.toFixed(2)),
        banks: revenueToday.banks
      },
      productsCount: capRow.total_items_count || 0,
      totalUnits: capRow.total_units_count || 0,
      activeDebtorsCount: debtRow.active_debtors_count || 0,
      clinicOperationsCount: clinicRow.clinic_operations_count || 0
    },
    transactions: formattedTransactions
  });
});

module.exports = router;
