const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const catalogRoutes = require('./routes/catalog.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const publicDirectory = path.join(__dirname, '..', 'public');

// Middleware comun: JSON, archivos publicos y CORS para que todo converse.
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(publicDirectory));

app.use('/api', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', ordersRoutes);
app.use('/api', adminRoutes);

// Ultima parada de la API. Evita responder HTML cuando alguien inventa una ruta.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada. Reinicia el servidor si acabas de actualizar el proyecto.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === '23505') return res.status(400).json({ error: 'Ese dato ya está registrado.' });
  if (error.code === '23503') return res.status(400).json({ error: 'La referencia solicitada no existe.' });
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

// La interfaz vive en una sola pagina; Express entrega index.html como respaldo.
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

module.exports = app;
