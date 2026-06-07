const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const selectedRole = role === 'admin' ? 'admin' : 'cliente';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail]);
    if (exists.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El usuario ya existe.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [String(name).trim(), normalizedEmail, passwordHash, selectedRole]
    );
    const user = userResult.rows[0];
    let kioskId = null;

    if (selectedRole === 'admin') {
      const kioskResult = await client.query(
        'INSERT INTO kiosks (owner_id) VALUES ($1) RETURNING id',
        [user.id]
      );
      kioskId = kioskResult.rows[0].id;
    }

    await client.query('COMMIT');
    return res.json({ message: 'Registro exitoso', user: publicUser(user, kioskId) });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.password_hash, k.id AS kiosk_id
       FROM users u
       LEFT JOIN kiosks k ON k.owner_id = u.id
       WHERE u.email = $1`,
      [normalizedEmail]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }
    return res.json({ message: 'Inicio de sesión exitoso', user: publicUser(user, user.kiosk_id) });
  } catch (error) {
    return next(error);
  }
});

function publicUser(user, kioskId) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    kioskId: kioskId ? Number(kioskId) : null
  };
}

module.exports = router;
