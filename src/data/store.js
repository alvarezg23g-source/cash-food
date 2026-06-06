const users = [];
const orders = [];

const kiosks = [];
const products = [];

let userIdCounter = 1;
let orderIdCounter = 1;
let productIdCounter = 1;
let kioskIdCounter = 1;

function nextUserId() {
  return userIdCounter++;
}

function nextOrderId() {
  return orderIdCounter++;
}

function nextProductId() {
  return productIdCounter++;
}

function nextKioskId() {
  return kioskIdCounter++;
}

module.exports = { kiosks, products, users, orders, nextUserId, nextOrderId, nextProductId, nextKioskId };
