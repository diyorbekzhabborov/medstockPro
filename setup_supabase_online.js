const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

async function runSetup() {
  const connStr = 'postgresql://postgres.mljkzfoghenkawgnesoc:1223rtsA%40Tim@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
  console.log('Connecting to Supabase PostgreSQL in ap-northeast-1...');
  
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL successfully!');

  // 1. Create tables if not exist
  const ddl = `
    CREATE TABLE IF NOT EXISTS public.products (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        barcode TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'Медикаменты',
        unit TEXT DEFAULT 'шт.',
        stock_quantity NUMERIC DEFAULT 0,
        retail_price NUMERIC DEFAULT 0.0,
        photo_url TEXT,
        is_active INTEGER DEFAULT 1,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.operations (
        id TEXT PRIMARY KEY,
        operation_code TEXT NOT NULL,
        type TEXT NOT NULL,
        payment_type TEXT NOT NULL,
        bank_name TEXT,
        transaction_reference TEXT,
        total_amount NUMERIC DEFAULT 0.0,
        counterparty_name TEXT,
        counterparty_phone TEXT,
        due_date TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        client_id TEXT,
        synced_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.operation_items (
        id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        unit_price NUMERIC NOT NULL,
        total_price NUMERIC NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.debts (
        id TEXT PRIMARY KEY,
        operation_id TEXT,
        debtor_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        initial_amount NUMERIC NOT NULL,
        remaining_amount NUMERIC NOT NULL,
        issue_date TIMESTAMPTZ NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL,
        items_summary TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.debt_payments (
        id TEXT PRIMARY KEY,
        debt_id TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        payment_method TEXT NOT NULL,
        transaction_reference TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.operations DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.operation_items DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.debts DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.debt_payments DISABLE ROW LEVEL SECURITY;

    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
  `;

  console.log('Applying database DDL and permissions...');
  await client.query(ddl);
  console.log('Tables and permissions verified!');

  // Reload PostgREST schema cache
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('PostgREST schema cache reloaded!');

  // 2. Read local warehouse database and sync to Supabase
  let localDbPath = 'C:\\Users\\ASUS\\AppData\\Roaming\\MedStock Pro\\local_warehouse.db';
  if (!fs.existsSync(localDbPath)) {
    localDbPath = path.join(__dirname, 'desktop', 'local_warehouse.db');
  }

  console.log('Reading local data from:', localDbPath);
  const localDb = new DatabaseSync(localDbPath);

  const localProducts = localDb.prepare('SELECT * FROM local_products WHERE is_active = 1').all();
  const localOps = localDb.prepare('SELECT * FROM local_operations').all();
  const getItems = localDb.prepare('SELECT * FROM local_operation_items WHERE operation_id = ?');
  const localDebts = localDb.prepare('SELECT * FROM local_debts').all();

  console.log(`Found ${localProducts.length} products, ${localOps.length} operations, ${localDebts.length} debts locally.`);

  // Insert products into Supabase
  for (const p of localProducts) {
    await client.query(`
      INSERT INTO public.products (id, sku, barcode, name, category, unit, stock_quantity, retail_price, photo_url, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        stock_quantity = EXCLUDED.stock_quantity,
        retail_price = EXCLUDED.retail_price,
        photo_url = EXCLUDED.photo_url,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at;
    `, [
      p.id, p.sku || `SKU-${Date.now()}`, p.barcode || 'N/A', p.name,
      p.category || 'Медикаменты', p.unit || 'шт.', p.stock_quantity || 0,
      p.retail_price || 0, p.photo_url || null, p.is_active || 1,
      p.updated_at || new Date().toISOString()
    ]);
  }
  console.log(`Synced ${localProducts.length} products to Supabase.`);

  // Insert operations & items into Supabase
  for (const op of localOps) {
    await client.query(`
      INSERT INTO public.operations (
        id, operation_code, type, payment_type, bank_name, transaction_reference,
        total_amount, counterparty_name, counterparty_phone, due_date, status,
        notes, created_by, created_at, client_id, synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (id) DO UPDATE SET
        operation_code = EXCLUDED.operation_code,
        type = EXCLUDED.type,
        payment_type = EXCLUDED.payment_type,
        bank_name = EXCLUDED.bank_name,
        transaction_reference = EXCLUDED.transaction_reference,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status;
    `, [
      op.id, op.operation_code, op.type, op.payment_type,
      op.bank_name || null, op.transaction_reference || null, op.total_amount || 0,
      op.counterparty_name || null, op.counterparty_phone || null, op.due_date || null,
      op.status || 'PAID', op.notes || null, op.created_by || 'Ассистент',
      op.created_at || new Date().toISOString(), 'desktop-win-01'
    ]);

    const items = getItems.all(op.id);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await client.query(`
        INSERT INTO public.operation_items (id, operation_id, product_id, product_name, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING;
      `, [
        it.id || `${op.id}-item-${i}`,
        op.id,
        it.product_id,
        it.product_name,
        it.quantity,
        it.unit_price,
        it.total_price || (it.quantity * it.unit_price)
      ]);
    }
  }
  console.log(`Synced ${localOps.length} operations to Supabase.`);

  // Insert debts into Supabase
  for (const d of localDebts) {
    await client.query(`
      INSERT INTO public.debts (id, operation_id, debtor_name, phone, initial_amount, remaining_amount, issue_date, due_date, status, items_summary, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        remaining_amount = EXCLUDED.remaining_amount,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at;
    `, [
      d.id, d.operation_id || null, d.debtor_name, d.phone || '',
      d.initial_amount || 0, d.remaining_amount || 0, d.issue_date || new Date().toISOString(),
      d.due_date || null, d.status || 'ACTIVE', d.items_summary || '',
      d.updated_at || new Date().toISOString()
    ]);
  }
  console.log(`Synced ${localDebts.length} debts to Supabase.`);

  // Reload cache again
  await client.query("NOTIFY pgrst, 'reload schema';");

  const tablesCheck = await client.query("SELECT count(*) FROM public.products;");
  console.log('Total products count in Supabase now:', tablesCheck.rows[0].count);

  await client.end();
  console.log('>>> ALL DONE! ONLINE DATABASE IS 100% READY AND POPULATED! <<<');
}

runSetup().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});
