const express = require('express');
const { kiosks, products } = require('../data/store');

const router = express.Router();

router.get('/kioscos', (req, res) => {
  res.json(kiosks.filter(kiosk => kiosk.published));
});

router.get('/productos', (req, res) => {
  const kioskId = Number(req.query.kioskId) || null;
  const filteredProducts = kioskId
    ? products.filter(product => product.kioskId === kioskId)
    : products;

  res.json(filteredProducts.filter(product => product.available !== false));
});

module.exports = router;
