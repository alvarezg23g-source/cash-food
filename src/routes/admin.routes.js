const express = require('express');
const { kiosks, products, nextProductId } = require('../data/store');

const router = express.Router();

router.get('/admin/kioscos/:kioskId', (req, res) => {
  const kiosk = findKiosk(req, res);
  if (kiosk) res.json(kiosk);
});

router.put('/admin/kioscos/:kioskId', (req, res) => {
  const kiosk = findKiosk(req, res);
  if (!kiosk) return;
  const { name, description, location, schedule, coverImage } = req.body;
  if (!name || !description || !location) {
    return res.status(400).json({ error: 'Nombre, descripción y ubicación son obligatorios.' });
  }
  Object.assign(kiosk, { name, description, location, schedule: schedule || '', coverImage: coverImage || '', published: true });
  return res.json({ message: 'Perfil actualizado', kiosk });
});

router.get('/admin/kioscos/:kioskId/productos', (req, res) => {
  const kiosk = findKiosk(req, res);
  if (kiosk) res.json(products.filter(product => product.kioskId === kiosk.id));
});

router.post('/admin/kioscos/:kioskId/productos', (req, res) => {
  const kiosk = findKiosk(req, res);
  if (!kiosk) return;
  const product = productPayload(req.body);
  if (!product.name || !product.price) {
    return res.status(400).json({ error: 'Nombre y precio son obligatorios.' });
  }
  const newProduct = { id: nextProductId(), kioskId: kiosk.id, ...product };
  products.push(newProduct);
  return res.json({ message: 'Producto publicado', product: newProduct });
});

router.put('/admin/productos/:productId', (req, res) => {
  const product = products.find(item => item.id === Number(req.params.productId));
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
  Object.assign(product, productPayload(req.body));
  return res.json({ message: 'Producto actualizado', product });
});

router.delete('/admin/productos/:productId', (req, res) => {
  const index = products.findIndex(item => item.id === Number(req.params.productId));
  if (index === -1) return res.status(404).json({ error: 'Producto no encontrado.' });
  products.splice(index, 1);
  return res.json({ message: 'Producto eliminado' });
});

function findKiosk(req, res) {
  const kiosk = kiosks.find(item => item.id === Number(req.params.kioskId));
  if (!kiosk) res.status(404).json({ error: 'Quiosco no encontrado.' });
  return kiosk;
}

function productPayload(body) {
  return {
    name: String(body.name || '').trim(),
    price: Number(body.price),
    category: String(body.category || 'Comida'),
    description: String(body.description || '').trim(),
    image: String(body.image || ''),
    available: body.available !== false
  };
}

module.exports = router;
