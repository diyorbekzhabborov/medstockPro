const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const seedDatabase = require('./seed');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const operationsRoutes = require('./routes/operations');
const debtsRoutes = require('./routes/debts');
const analyticsRoutes = require('./routes/analytics');
const syncRoutes = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[CLOUD API] ${req.method} ${req.url}`);
  next();
});

// Чистая база данных (начинается с нуля по требованию пользователя)

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sync', syncRoutes);

// Root info
app.get('/', (req, res) => {
  res.json({
    app: 'MedStock Pro Cloud API & Sync Gateway',
    version: '1.0.0',
    currency: 'TJS',
    status: 'ACTIVE',
    endpoints: [
      '/api/auth',
      '/api/products',
      '/api/operations',
      '/api/debts',
      '/api/analytics/dashboard',
      '/api/sync/health',
      '/api/sync/push',
      '/api/sync/pull'
    ]
  });
});

const http = require('http');
const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[CLOUD API SERVER] Порт ${PORT} уже занят/активен. Сервер работает.`);
  } else {
    console.error('[CLOUD API SERVER ERROR]', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` MedStock Pro - Облачный сервер API & Синхронизация`);
  console.log(` Порт: http://localhost:${PORT}`);
  console.log(` Доступ по сети: http://0.0.0.0:${PORT}`);
  console.log(`=======================================================`);
});
