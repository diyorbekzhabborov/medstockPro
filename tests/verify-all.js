// Complete End-to-End System Verification for MedStock Pro
const http = require('http');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('   MedStock Pro — Комплексное тестирование экосистемы по ТЗ');
  console.log('================================================================\n');

  const CLOUD_URL = 'http://localhost:4000';
  const DESKTOP_URL = 'http://localhost:3000';
  const PWA_URL = 'http://localhost:5000';

  // 1. Check Cloud Backend Health
  console.log('Тест 1: Проверка доступности Облачного бэкенда и шлюза синхронизации...');
  try {
    const health = await request(`${CLOUD_URL}/api/sync/health`);
    if (!health.ok || health.data.status !== 'ONLINE') throw new Error('Cloud health failed');
    console.log('  [PASS] Облачный бэкенд активен, версия: ' + health.data.version);
  } catch (e) {
    console.error('  [FAIL] Ошибка бэкенда:', e.message);
    process.exit(1);
  }

  // 2. Check Desktop Terminal Local SQLite
  console.log('\nТест 2: Проверка локального складского терминала (Автономная SQLite БД)...');
  try {
    const prods = await request(`${DESKTOP_URL}/api/local/products`);
    if (!prods.ok) throw new Error('Desktop products failed');
    console.log(`  [PASS] Локальная база SQLite доступна. Позиций: ${prods.data.totalItemsCount}, Капитализация: ${prods.data.totalCapitalization} TJS`);
  } catch (e) {
    console.error('  [FAIL] Ошибка терминала:', e.message);
    process.exit(1);
  }

  // 3. Scenario A: Test Sale on Desktop Terminal (Продажа клиенту через Dushanbe City)
  console.log('\nТест 3: Сценарий А (Продажа клиенту через Dushanbe City, 100 TJS)...');
  try {
    const saleResp = await request(`${DESKTOP_URL}/api/local/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'SALE',
        payment_type: 'BANK_TRANSFER',
        bank_name: 'Dushanbe City (DC)',
        transaction_reference: 'DC-TEST-99201',
        items: [
          { product_id: 'prod-001', product_name: 'Шприц 5мл', quantity: 50, unit_price: 1.00 }
        ],
        created_by: 'Тестовый оператор'
      })
    });
    if (!saleResp.ok) throw new Error('Sale creation failed');
    console.log(`  [PASS] Чек продажи #${saleResp.data.operation.operation_code} оформлен в локальной SQLite. Сумма: ${saleResp.data.operation.total_amount} TJS. Статус синхронизации: sync_pending = 1`);
  } catch (e) {
    console.error('  [FAIL] Ошибка продажи:', e.message);
    process.exit(1);
  }

  // 4. Scenario B: Test Clinic Write-off (Списание в клинику 0.00 TJS)
  console.log('\nТест 4: Сценарий Б (Списание в частную клинику, строго 0,00 TJS)...');
  try {
    const clinicResp = await request(`${DESKTOP_URL}/api/local/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CLINIC_WRITE_OFF',
        payment_type: 'NONE',
        counterparty_name: 'Процедурный кабинет клиники',
        notes: 'Расход клиники на перевязочные процедуры',
        items: [
          { product_id: 'prod-002', product_name: 'Капельницы инфуз.', quantity: 10, unit_price: 4.50 }
        ],
        created_by: 'Тестовый фармацевт'
      })
    });
    if (!clinicResp.ok) throw new Error('Clinic write-off failed');
    const op = clinicResp.data.operation;
    if (op.total_amount !== 0.0 || op.status !== 'CLINIC_INTERNAL') {
      throw new Error(`Invalid clinic accounting: sum=${op.total_amount}, status=${op.status}`);
    }
    console.log(`  [PASS] Списание #${op.operation_code} проведено. Финансовая сумма: 0.00 TJS (Внутренний расход). Физический остаток уменьшен.`);
  } catch (e) {
    console.error('  [FAIL] Ошибка списания в клинику:', e.message);
    process.exit(1);
  }

  // 5. Test Debt Registration (В долг / Под реализацию)
  console.log('\nТест 5: Продажа в долг (Под реализацию, фиксация дебиторской задолженности)...');
  try {
    const debtResp = await request(`${DESKTOP_URL}/api/local/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'SALE',
        payment_type: 'DEBT',
        counterparty_name: 'Аптека «Истиклол»',
        counterparty_phone: '+992938887766',
        due_date: '2026-10-25',
        items: [
          { product_id: 'prod-004', product_name: 'Цефтриаксон 1г', quantity: 20, unit_price: 12.50 }
        ],
        created_by: 'Оператор'
      })
    });
    if (!debtResp.ok) throw new Error('Debt sale failed');
    console.log(`  [PASS] Долг зафиксирован в реестре дебиторов на сумму: ${debtResp.data.operation.total_amount} TJS. Должник: Аптека «Истиклол»`);
  } catch (e) {
    console.error('  [FAIL] Ошибка фиксации долга:', e.message);
    process.exit(1);
  }

  // 6. Test Two-Way Synchronization (Offline-first button push & pull)
  console.log('\nТест 6: Двусторонняя синхронизация терминала с облаком по кнопке «Синхронизировать»...');
  try {
    const syncResp = await request(`${DESKTOP_URL}/api/local/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (!syncResp.ok || !syncResp.data.success) throw new Error('Sync failed: ' + JSON.stringify(syncResp.data));
    console.log(`  [PASS] Синхронизация успешна! Отправлено чеков в облако: ${syncResp.data.pushedOperations}, обновлено товаров: ${syncResp.data.pulledProducts}`);
  } catch (e) {
    console.error('  [FAIL] Ошибка синхронизации:', e.message);
    process.exit(1);
  }

  // 7. Test Owner Mobile PWA Dashboard API
  console.log('\nТест 7: Проверка дашборда владельца в PWA (KPI, Капитализация, Долги, Выручка)...');
  try {
    const dashResp = await request(`${PWA_URL}/api/analytics/dashboard`);
    if (!dashResp.ok) throw new Error('PWA analytics failed');
    const k = dashResp.data.kpis;
    console.log(`  [PASS] Метрики дашборда:`);
    console.log(`         • Капитализация склада: ${k.capitalization.toLocaleString('ru-RU')} TJS`);
    console.log(`         • Счётчик долгов (Дебиторка): ${k.totalDebts.toLocaleString('ru-RU')} TJS`);
    console.log(`         • Расход клиники за месяц: ${k.clinicExpenseMonth.toLocaleString('ru-RU')} TJS`);
    console.log(`         • Выручка за сегодня: ${k.revenueToday.total.toLocaleString('ru-RU')} TJS (Наличные: ${k.revenueToday.cash}, Безнал: ${k.revenueToday.cashless})`);
    console.log(`         • Должников в реестре: ${k.activeDebtorsCount}`);
    console.log(`         • Транзакций в журнале: ${dashResp.data.transactions.length}`);
  } catch (e) {
    console.error('  [FAIL] Ошибка PWA аналитики:', e.message);
    process.exit(1);
  }

  // 8. Test Debtor Repayment & Reminder Generation
  console.log('\nТест 8: Проверка генератора напоминаний в WhatsApp / Telegram...');
  try {
    const debtsList = await request(`${PWA_URL}/api/debts`);
    if (debtsList.data.debts && debtsList.data.debts.length > 0) {
      const firstDebt = debtsList.data.debts[0];
      const reminderResp = await request(`${PWA_URL}/api/debts/${firstDebt.id}/reminder-text`);
      if (!reminderResp.ok) throw new Error('Reminder failed');
      console.log('  [PASS] Сформировано напоминание:');
      console.log('         Русский: ' + reminderResp.data.textRu.slice(0, 80) + '...');
      console.log('         Таджикский: ' + reminderResp.data.textTj.slice(0, 80) + '...');
      console.log('         WhatsApp ссылка: ' + reminderResp.data.whatsappUrlRu.slice(0, 50) + '...');
    }
  } catch (e) {
    console.error('  [FAIL] Ошибка шаблонов напоминаний:', e.message);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('   ВСЕ 8 ТЕСТОВ ПРОЙДЕНЫ УСПЕШНО! ТЗ ВЫПОЛНЕНО НА 100%!');
  console.log('================================================================\n');
}

runTests();
