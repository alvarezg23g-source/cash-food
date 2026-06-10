require('dotenv').config();
const app = require('./app');
const pool = require('./db/pool');

const PORT = process.env.PORT || 3000;

// Primero confirma PostgreSQL; celebrar un servidor sin base de datos seria prematuro.
async function start() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL. Crea un archivo .env usando .env.example.');
  }
  await pool.query('SELECT 1');
  app.listen(PORT, () => {
    console.log(`Servidor ejecutando en http://localhost:${PORT}`);
  });
}

start().catch(error => {
  console.error(`No se pudo iniciar Cash Food: ${error.message}`);
  process.exit(1);
});
