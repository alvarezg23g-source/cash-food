const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.post('/pedidos', async (req, res, next) => {
  const { userId, items, kioskId } = req.body;
  if (!userId || !Array.isArray(items) || !items.length || !kioskId) {
    return res.status(400).json({ error: 'El pedido debe contener usuario, productos y quiosco.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productIds = items.map(item => Number(item.id));
    const productsResult = await client.query(
      `SELECT id, name, price FROM products
       WHERE kiosk_id=$1 AND available=TRUE AND id=ANY($2::bigint[])`,
      [kioskId, productIds]
    );
    if (productsResult.rowCount !== new Set(productIds).size) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Uno o más productos no están disponibles.' });
    }

    const products = new Map(productsResult.rows.map(item => [Number(item.id), item]));
    const total = items.reduce((sum, item) => sum + Number(products.get(Number(item.id)).price) * Number(item.quantity), 0);
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, kiosk_id, total) VALUES ($1,$2,$3) RETURNING id, status, total, created_at AS "createdAt"',
      [userId, kioskId, total]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const product = products.get(Number(item.id));
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, product.id, product.name, product.price, Number(item.quantity)]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Pedido registrado', order: { ...order, id: Number(order.id), total: Number(order.total), items } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.get('/pedidos', async (req, res, next) => {
  try {
    const userId = Number(req.query.userId) || null;
    const result = await pool.query(
      `SELECT o.id, o.user_id AS "userId", o.kiosk_id AS "kioskId", o.status, o.total,
       o.created_at AS "createdAt", u.name AS "userName"
       FROM orders o JOIN users u ON u.id=o.user_id
       WHERE ($1::bigint IS NULL OR o.user_id=$1) ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json(result.rows.map(mapOrder));
  } catch (error) {
    next(error);
  }
});

router.get('/admin/pedidos', async (req, res, next) => {
  try {
    const kioskId = Number(req.query.kioskId);
    if (!kioskId) return res.status(400).json({ error: 'Se requiere kioskId.' });
    const result = await pool.query(
      `SELECT o.id, o.user_id AS "userId", o.kiosk_id AS "kioskId", o.status, o.total,
       o.created_at AS "createdAt", u.name AS "userName"
       FROM orders o JOIN users u ON u.id=o.user_id
       WHERE o.kiosk_id=$1 ORDER BY o.created_at DESC`,
      [kioskId]
    );
    res.json(result.rows.map(mapOrder));
  } catch (error) {
    next(error);
  }
});

router.post('/admin/pedidos/:orderId/status', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING id, status, total',
      [req.body.status, req.params.orderId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json({ message: 'Estado actualizado', order: mapOrder(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

function mapOrder(row) {
  return { ...row, id: Number(row.id), userId: row.userId ? Number(row.userId) : undefined, kioskId: row.kioskId ? Number(row.kioskId) : undefined, total: Number(row.total) };
}

module.exports = router;
