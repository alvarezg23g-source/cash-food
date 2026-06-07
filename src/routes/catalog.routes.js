const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/kioscos', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, location, description, cover_image AS "coverImage", schedule
       FROM kiosks WHERE published = TRUE ORDER BY created_at DESC`
    );
    res.json(result.rows.map(row => ({ ...row, id: Number(row.id) })));
  } catch (error) {
    next(error);
  }
});

router.get('/productos', async (req, res, next) => {
  try {
    const kioskId = Number(req.query.kioskId) || null;
    const result = await pool.query(
      `SELECT id, kiosk_id AS "kioskId", name, price, category, description, image, available
       FROM products
       WHERE available = TRUE AND ($1::bigint IS NULL OR kiosk_id = $1)
       ORDER BY created_at DESC`,
      [kioskId]
    );
    res.json(result.rows.map(productRow));
  } catch (error) {
    next(error);
  }
});

function productRow(row) {
  return { ...row, id: Number(row.id), kioskId: Number(row.kioskId), price: Number(row.price) };
}

module.exports = router;
