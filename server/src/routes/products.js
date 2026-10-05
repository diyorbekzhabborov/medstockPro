const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: require('crypto').randomUUID } : { v4: () => Math.random().toString(36).substring(2, 9) };

// GET /api/products - list all products with computed total batch value
router.get('/', (req, res) => {
  const { q, category } = req.query;
  let query = 'SELECT * FROM products WHERE is_active = 1';
  const params = [];

  if (q) {
    query += ' AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY name ASC';
  const products = db.prepare(query).all(...params);

  // Add computed fields
  const enriched = products.map(p => ({
    ...p,
    batch_value: Number((p.stock_quantity * p.retail_price).toFixed(2))
  }));

  res.json({ products: enriched });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });
  product.batch_value = Number((product.stock_quantity * product.retail_price).toFixed(2));
  res.json({ product });
});

// POST /api/products - create new product
router.post('/', (req, res) => {
  const { name, sku, barcode, category, unit, stock_quantity, retail_price, photo_url } = req.body;
  if (!name || !sku || !barcode) {
    return res.status(400).json({ error: 'Наименование, SKU и Штрихкод обязательны' });
  }

  const id = 'prod-' + Date.now();
  try {
    db.prepare(`
      INSERT INTO products (id, sku, barcode, name, category, unit, stock_quantity, retail_price, photo_url, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(
      id,
      sku,
      barcode,
      name,
      category || 'Общее',
      unit || 'шт.',
      Number(stock_quantity) || 0,
      Number(retail_price) || 0.0,
      photo_url || null
    );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    created.batch_value = Number((created.stock_quantity * created.retail_price).toFixed(2));
    res.status(201).json({ product: created });
  } catch (err) {
    res.status(400).json({ error: 'Ошибка сохранения товара: ' + err.message });
  }
});

// PUT /api/products/:id - update product
router.put('/:id', (req, res) => {
  const { name, sku, barcode, category, unit, stock_quantity, retail_price, photo_url } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Товар не найден' });

  try {
    db.prepare(`
      UPDATE products
      SET name = ?, sku = ?, barcode = ?, category = ?, unit = ?, stock_quantity = ?, retail_price = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name : existing.name,
      sku !== undefined ? sku : existing.sku,
      barcode !== undefined ? barcode : existing.barcode,
      category !== undefined ? category : existing.category,
      unit !== undefined ? unit : existing.unit,
      stock_quantity !== undefined ? Number(stock_quantity) : existing.stock_quantity,
      retail_price !== undefined ? Number(retail_price) : existing.retail_price,
      photo_url !== undefined ? photo_url : existing.photo_url,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    updated.batch_value = Number((updated.stock_quantity * updated.retail_price).toFixed(2));
    res.json({ product: updated });
  } catch (err) {
    res.status(400).json({ error: 'Ошибка обновления товара: ' + err.message });
  }
});

module.exports = router;
