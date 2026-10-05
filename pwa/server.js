const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PWA_PORT || 5000;
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:4000';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Forward API requests to Cloud Backend
app.use('/api', async (req, res) => {
  const targetUrl = `${CLOUD_API_URL}/api${req.url}`;
  try {
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

    const apiRes = await fetch(targetUrl, fetchOptions);
    const data = await apiRes.json();
    res.status(apiRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Облачный сервер недоступен: ' + err.message });
  }
});

// Fallback to index.html for SPA / PWA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` MedStock Pro - Мобильный PWA-кабинет руководителя`);
  console.log(` Порт: http://localhost:${PORT}`);
  console.log(` Доступ с iPhone по Wi-Fi: http://<Ваш-IP>:${PORT}`);
  console.log(`=======================================================`);
});
