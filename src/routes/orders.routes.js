const express = require('express');
const { kiosks, users, orders, nextOrderId } = require('../data/store');

const router = express.Router();

router.post('/pedidos', (req, res) => {
  const { userId, items, total, kioskId } = req.body;
  if (!userId || !items || items.length === 0 || !total || !kioskId) {
    return res.status(400).json({ error: 'El pedido debe contener usuario, productos, total y quiosco.' });
  }

  const user = users.find(item => item.id === Number(userId));
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }
  if (!kiosks.some(kiosk => kiosk.id === Number(kioskId))) {
    return res.status(400).json({ error: 'Quiosco inválido.' });
  }

  const newOrder = {
    id: nextOrderId(),
    userId: user.id,
    userName: user.name,
    kioskId: Number(kioskId),
    items,
    total,
    status: 'pendiente',
    createdAt: new Date().toISOString()
  };
  orders.push(newOrder);

  return res.json({ message: 'Pedido registrado', order: newOrder });
});

router.get('/pedidos', (req, res) => {
  const userId = Number(req.query.userId);
  res.json(userId ? orders.filter(order => order.userId === userId) : orders);
});

router.get('/admin/pedidos', (req, res) => {
  const kioskId = Number(req.query.kioskId);
  if (!kioskId) {
    return res.status(400).json({ error: 'Se requiere kioskId para revisarlo.' });
  }
  return res.json(orders.filter(order => order.kioskId === kioskId));
});

router.post('/admin/pedidos/:orderId/status', (req, res) => {
  const order = orders.find(item => item.id === Number(req.params.orderId));
  const { status } = req.body;
  if (!order) {
    return res.status(404).json({ error: 'Pedido no encontrado.' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Se requiere un nuevo estado.' });
  }

  order.status = status;
  return res.json({ message: 'Estado actualizado', order });
});

module.exports = router;
