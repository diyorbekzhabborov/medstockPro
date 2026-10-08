const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PWA_PORT || 5000;
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:4000';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Forward API requests to Cloud Backend with fallback to Desktop Server (port 3000)
app.use('/api', async (req, res) => {
  const fetchOptions = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization || ''
    }
  };
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  // 1. Try primary Cloud API (port 4000)
  try {
    const apiRes = await fetch(`${CLOUD_API_URL}/api${req.url}`, {
      ...fetchOptions,
      signal: AbortSignal.timeout(1500)
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      return res.status(apiRes.status).json(data);
    }
  } catch (e) {}

  // 2. Automatic fallback to Desktop Warehouse Server (port 3000)
  try {
    const fallbackRes = await fetch(`http://localhost:3000/api${req.url}`, {
      ...fetchOptions,
      signal: AbortSignal.timeout(2500)
    });
    const fallbackData = await fallbackRes.json();
    return res.status(fallbackRes.status).json(fallbackData);
  } catch (fallbackErr) {
    res.status(502).json({ error: 'Сервер склада недоступен. Проверьте запуск MedStock Pro: ' + fallbackErr.message });
  }
});

// Fallback to index.html for SPA / PWA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const http = require('http');
const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[PWA SERVER] Порт ${PORT} уже занят/активен. Сервер работает.`);
  } else {
    console.error('[PWA SERVER ERROR]', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` MedStock Pro - Мобильный PWA-кабинет руководителя`);
  console.log(` Порт: http://localhost:${PORT}`);
  console.log(` Доступ с iPhone по Wi-Fi: http://<Ваш-IP>:${PORT}`);
  console.log(`=======================================================`);
});
