const express = require('express');
const pool = require('../db/pool');
const { publishOrderEvent, subscribe } = require('../realtime/order-events');

const router = express.Router();
const validStatuses = new Set(['pendiente', 'en-preparacion', 'listo', 'entregado']);

// Canal SSE: pedidos y estados viajan al navegador sin esperar una recarga.
router.get('/pedidos/eventos', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const unsubscribe = subscribe(res);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);

  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// El precio final siempre se calcula en servidor. Confiar en el carrito seria valiente.
router.post('/pedidos', async (req, res, next) => {
  const { userId, items, kioskId } = req.body;
  if (!userId || !Array.isArray(items) || !items.length || !kioskId) {
    return res.status(400).json({ error: 'El pedido debe contener usuario, productos y quiosco.' });
  }
  if (items.some(item => !Number.isInteger(Number(item.id)) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
    return res.status(400).json({ error: 'Los productos o cantidades del pedido no son válidos.' });
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
      'INSERT INTO orders (user_id, kiosk_id, total) VALUES ($1,$2,$3) RETURNING id',
      [userId, kioskId, total]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      const product = products.get(Number(item.id));
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, product.id, product.name, product.price, Number(item.quantity)]
      );
    }
    await client.query('COMMIT');
    const order = await getOrder(orderId);
    publishOrderEvent({ type: 'created', order });
    res.json({ message: 'Pedido registrado', order });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.get('/pedidos', async (req, res, next) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'Se requiere userId.' });
    res.json(await getOrders('o.user_id=$1 AND o.hidden_by_client=FALSE', [userId]));
  } catch (error) {
    next(error);
  }
});

router.get('/admin/pedidos', async (req, res, next) => {
  try {
    const kioskId = Number(req.query.kioskId);
    if (!kioskId) return res.status(400).json({ error: 'Se requiere kioskId.' });
    res.json(await getOrders('o.kiosk_id=$1 AND o.hidden_by_kiosk=FALSE', [kioskId]));
  } catch (error) {
    next(error);
  }
});

router.post('/admin/pedidos/:orderId/status', async (req, res, next) => {
  try {
    const kioskId = Number(req.body.kioskId);
    const status = String(req.body.status || '');
    if (!kioskId || !validStatuses.has(status)) {
      return res.status(400).json({ error: 'Estado o quiosco no válido.' });
    }
    const result = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 AND kiosk_id=$3 RETURNING id',
      [status, req.params.orderId, kioskId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado.' });
    const order = await getOrder(result.rows[0].id);
    publishOrderEvent({ type: 'status', order });
    res.json({ message: 'Estado actualizado', order });
  } catch (error) {
    next(error);
  }
});

router.post('/pedidos/:orderId/ocultar', async (req, res, next) => {
  try {
    const userId = Number(req.body.userId);
    const kioskId = Number(req.body.kioskId);
    if ((!userId && !kioskId) || (userId && kioskId)) {
      return res.status(400).json({ error: 'Se requiere identificar al cliente o al quiosco.' });
    }
    const ownerColumn = userId ? 'user_id' : 'kiosk_id';
    const hiddenColumn = userId ? 'hidden_by_client' : 'hidden_by_kiosk';
    const ownerId = userId || kioskId;
    const result = await pool.query(
      `UPDATE orders SET ${hiddenColumn}=TRUE
       WHERE id=$1 AND ${ownerColumn}=$2 AND status='entregado'
       RETURNING id`,
      [req.params.orderId, ownerId]
    );
    if (!result.rowCount) {
      return res.status(400).json({ error: 'La factura solo se puede eliminar cuando el pedido esté entregado.' });
    }
    publishOrderEvent({
      type: 'hidden',
      orderId: Number(result.rows[0].id),
      userId: userId || null,
      kioskId: kioskId || null
    });
    res.json({ message: 'Factura eliminada de tu historial', orderId: Number(result.rows[0].id) });
  } catch (error) {
    next(error);
  }
});

async function getOrder(orderId) {
  const orders = await getOrders('o.id=$1', [orderId]);
  return orders[0];
}

async function getOrders(where, values) {
  // Una consulta arma la factura completa y evita perseguir productos uno por uno.
  const result = await pool.query(
    `SELECT o.id, o.user_id AS "userId", o.kiosk_id AS "kioskId", o.status, o.total,
     o.created_at AS "createdAt", u.name AS "userName", u.email AS "userEmail",
     k.name AS "kioskName", k.location AS "kioskLocation",
     COALESCE(
       json_agg(json_build_object(
         'id', oi.id,
         'productId', oi.product_id,
         'name', oi.product_name,
         'price', oi.unit_price,
         'quantity', oi.quantity
       ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL),
       '[]'::json
     ) AS items
     FROM orders o
     JOIN users u ON u.id=o.user_id
     JOIN kiosks k ON k.id=o.kiosk_id
     LEFT JOIN order_items oi ON oi.order_id=o.id
     WHERE ${where}
     GROUP BY o.id, u.id, k.id
     ORDER BY o.created_at DESC`,
    values
  );
  return result.rows.map(mapOrder);
}

function mapOrder(row) {
  return {
    ...row,
    id: Number(row.id),
    userId: Number(row.userId),
    kioskId: Number(row.kioskId),
    total: Number(row.total),
    items: row.items.map(item => ({
      ...item,
      id: Number(item.id),
      productId: item.productId ? Number(item.productId) : null,
      price: Number(item.price),
      quantity: Number(item.quantity)
    }))
  };
}

module.exports = router;
