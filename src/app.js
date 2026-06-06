const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const catalogRoutes = require('./routes/catalog.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const publicDirectory = path.join(__dirname, '..', 'public');

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(publicDirectory));

app.use('/api', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', ordersRoutes);
app.use('/api', adminRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada. Reinicia el servidor si acabas de actualizar el proyecto.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

module.exports = app;
