const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/admin/kioscos/:kioskId', async (req, res, next) => {
  try {
    const kiosk = await getKiosk(req.params.kioskId);
    if (!kiosk) return res.status(404).json({ error: 'Quiosco no encontrado.' });
    res.json(kiosk);
  } catch (error) {
    next(error);
  }
});

router.put('/admin/kioscos/:kioskId', async (req, res, next) => {
  const { name, description, location, schedule, coverImage } = req.body;
  if (!name || !description || !location) {
    return res.status(400).json({ error: 'Nombre, descripción y ubicación son obligatorios.' });
  }
  try {
    const result = await pool.query(
      `UPDATE kiosks SET name=$1, description=$2, location=$3, schedule=$4,
       cover_image=$5, published=TRUE, updated_at=NOW()
       WHERE id=$6 RETURNING id, name, location, description,
       cover_image AS "coverImage", schedule, published`,
      [String(name).trim(), String(description).trim(), String(location).trim(), schedule || '', coverImage || '', req.params.kioskId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Quiosco no encontrado.' });
    res.json({ message: 'Perfil actualizado', kiosk: mapKiosk(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/kioscos/:kioskId/productos', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, kiosk_id AS "kioskId", name, price, category, description, image, available
       FROM products WHERE kiosk_id=$1 ORDER BY created_at DESC`,
      [req.params.kioskId]
    );
    res.json(result.rows.map(mapProduct));
  } catch (error) {
    next(error);
  }
});

router.post('/admin/kioscos/:kioskId/productos', async (req, res, next) => {
  const product = productPayload(req.body);
  if (!product.name || !product.price) return res.status(400).json({ error: 'Nombre y precio son obligatorios.' });
  try {
    const result = await pool.query(
      `INSERT INTO products (kiosk_id, name, price, category, description, image, available)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, kiosk_id AS "kioskId", name, price, category, description, image, available`,
      [req.params.kioskId, product.name, product.price, product.category, product.description, product.image, product.available]
    );
    res.json({ message: 'Producto publicado', product: mapProduct(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/productos/:productId', async (req, res, next) => {
  const product = productPayload(req.body);
  try {
    const result = await pool.query(
      `UPDATE products SET name=$1, price=$2, category=$3, description=$4, image=$5,
       available=$6, updated_at=NOW() WHERE id=$7
       RETURNING id, kiosk_id AS "kioskId", name, price, category, description, image, available`,
      [product.name, product.price, product.category, product.description, product.image, product.available, req.params.productId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ message: 'Producto actualizado', product: mapProduct(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.delete('/admin/productos/:productId', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id=$1', [req.params.productId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    next(error);
  }
});

async function getKiosk(id) {
  const result = await pool.query(
    `SELECT id, name, location, description, cover_image AS "coverImage", schedule, published
     FROM kiosks WHERE id=$1`,
    [id]
  );
  return result.rows[0] ? mapKiosk(result.rows[0]) : null;
}

function productPayload(body) {
  return { name: String(body.name || '').trim(), price: Number(body.price), category: String(body.category || 'Comida'), description: String(body.description || '').trim(), image: String(body.image || ''), available: body.available !== false };
}
function mapKiosk(row) { return { ...row, id: Number(row.id) }; }
function mapProduct(row) { return { ...row, id: Number(row.id), kioskId: Number(row.kioskId), price: Number(row.price) }; }

module.exports = router;
