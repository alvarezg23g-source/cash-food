require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function init() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en el archivo .env');
  }
  const databaseUrl = new URL(process.env.DATABASE_URL);
  const databaseName = databaseUrl.pathname.slice(1);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
    throw new Error('El nombre de la base de datos no es válido.');
  }

  const adminUrl = new URL(process.env.DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]);
  if (!exists.rowCount) {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`Base de datos ${databaseName} creada.`);
  }
  await admin.end();

  const database = new Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
  await database.query(schema);
  await database.end();
  console.log('Esquema de base de datos creado correctamente.');
}

init()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
