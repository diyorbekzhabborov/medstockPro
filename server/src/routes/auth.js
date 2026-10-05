const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'medstock-secret-key-2026';

// Defined system users according to requirements:
// 1. Windows App (Ассистент): login: asistent, pass: 12345678
// 2. Web/PWA Site (Владелец Абдуллочон Чабборов): login: asistent, pass: 123456781
const USERS = [
  {
    username: 'asistent',
    password: '12345678',
    role: 'ASSISTANT',
    roleName: 'Ассистент',
    fullName: 'Ассистент склада',
    clientType: 'DESKTOP'
  },
  {
    username: 'asistent',
    password: '123456781',
    role: 'OWNER',
    roleName: 'Владелец',
    fullName: 'Абдуллочон Чабборов',
    clientType: 'PWA'
  }
];

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password, clientType } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  // Find matching user by login and password
  const matchedUser = USERS.find(u => {
    if (clientType) {
      return u.username.toLowerCase() === username.toLowerCase().trim() &&
             u.password === password &&
             u.clientType === clientType;
    }
    return u.username.toLowerCase() === username.toLowerCase().trim() && u.password === password;
  });

  if (!matchedUser) {
    return res.status(401).json({
      error: 'Неверный логин или пароль. Проверьте правильность введённых данных.'
    });
  }

  const token = jwt.sign(
    {
      username: matchedUser.username,
      role: matchedUser.role,
      roleName: matchedUser.roleName,
      fullName: matchedUser.fullName
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    success: true,
    token,
    user: {
      username: matchedUser.username,
      role: matchedUser.role,
      roleName: matchedUser.roleName,
      fullName: matchedUser.fullName
    }
  });
});

module.exports = router;
