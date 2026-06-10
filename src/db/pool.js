const { Pool } = require('pg');

// Una sola piscina de conexiones. Abrir una por consulta seria cardio innecesario.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on('error', error => {
  console.error('Error inesperado de PostgreSQL:', error.message);
});

module.exports = pool;
