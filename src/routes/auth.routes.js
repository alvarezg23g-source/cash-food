const express = require('express');
const { kiosks, users, nextUserId, nextKioskId } = require('../data/store');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (users.some(user => user.email === normalizedEmail)) {
    return res.status(400).json({ error: 'El usuario ya existe.' });
  }

  const selectedRole = role === 'admin' ? 'admin' : 'cliente';
  let assignedKioskId = null;
  if (selectedRole === 'admin') {
    assignedKioskId = nextKioskId();
    kiosks.push({
      id: assignedKioskId,
      ownerEmail: normalizedEmail,
      name: '',
      location: 'Ubicación por definir',
      description: 'Completá el mini perfil para presentar tu negocio.',
      coverImage: '',
      schedule: 'Horario por definir',
      published: false
    });
  }

  const newUser = {
    id: nextUserId(),
    name,
    email: normalizedEmail,
    password,
    role: selectedRole,
    kioskId: assignedKioskId
  };
  users.push(newUser);

  return res.json({ message: 'Registro exitoso', user: publicUser(newUser) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = users.find(item => item.email === normalizedEmail && item.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }

  return res.json({ message: 'Inicio de sesión exitoso', user: publicUser(user) });
});

function publicUser(user) {
  const { id, name, email, role, kioskId } = user;
  return { id, name, email, role, kioskId };
}

module.exports = router;
