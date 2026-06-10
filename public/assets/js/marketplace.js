import { apiBase, post } from './core/api.js';
import { $, renderEmpty } from './core/ui.js';

export function createMarketplace({ getCurrentUser, onOrderPlaced }) {
  let selectedKioskId = null;
  let kiosks = [];
  let products = [];
  const cart = [];

  const kioskPanel = $('kiosk-panel');
  const productsPanel = $('products-panel');
  const cartPanel = $('cart-panel');
  const kioskList = $('kiosk-list');
  const productList = $('product-list');
  const cartList = $('cart-list');
  const productSearch = $('product-search');
  const selectedKioskName = $('selected-kiosk-name');
  const marketWelcome = $('market-welcome');
  const backToKiosks = $('back-to-kiosks');
  const marketLayout = document.querySelector('.market-layout');
  const marketSearch = document.querySelector('.market-search');
  const marketCartLink = document.querySelector('.market-cart-link');

  function init() {
    document.querySelector('[data-scroll-cart]').addEventListener('click', () => cartPanel.scrollIntoView({ behavior: 'smooth' }));
    productSearch.addEventListener('input', () => renderProductCards(products));
    backToKiosks.addEventListener('click', showKioskDirectory);
    $('place-order-button').addEventListener('click', placeOrder);
  }

  async function loadKiosks() {
    const response = await fetch(`${apiBase}/kioscos`);
    kiosks = await response.json();
    kioskList.innerHTML = '';
    if (!kiosks.length) {
      renderEmpty(kioskList, 'Todavía no hay negocios publicados', 'Cuando un administrador cree su perfil, aparecerá aquí.', 'market-empty marketplace-empty');
      return;
    }

    kiosks.forEach(kiosk => {
      const card = document.createElement('article');
      card.className = 'kiosk-card';
      card.innerHTML = `
        <div class="kiosk-mark" ${kiosk.coverImage ? `style="background-image:url('${kiosk.coverImage}')"` : ''}>${kiosk.coverImage ? '' : kiosk.name.charAt(0)}</div>
        <span class="kiosk-open">Abierto ahora</span>
        <h3>${kiosk.name}</h3><p>${kiosk.description}</p><small>${kiosk.location}</small><small>${kiosk.schedule || ''}</small>
        <button>Ver menú <span>→</span></button>`;
      card.querySelector('button').addEventListener('click', () => selectKiosk(kiosk.id));
      kioskList.appendChild(card);
    });
  }

  async function selectKiosk(kioskId) {
    if (selectedKioskId && selectedKioskId !== kioskId) {
      cart.length = 0;
      renderCart();
    }
    selectedKioskId = kioskId;
    showKioskMenu();
    await loadProducts(kioskId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadProducts(kioskId) {
    const response = await fetch(`${apiBase}/productos?kioskId=${kioskId}`);
    products = await response.json();
    selectedKioskName.textContent = kiosks.find(kiosk => kiosk.id === kioskId)?.name || 'Menú';
    productSearch.value = '';
    renderProductCards(products);
  }

  function showKioskMenu() {
    marketLayout.classList.add('menu-open');
    marketWelcome.hidden = true;
    kioskPanel.hidden = true;
    productsPanel.hidden = false;
    cartPanel.hidden = false;
    backToKiosks.hidden = false;
    marketSearch.hidden = false;
    marketCartLink.hidden = false;
  }

  function showKioskDirectory() {
    selectedKioskId = null;
    products = [];
    selectedKioskName.textContent = 'Elegí un quiosco';
    marketLayout.classList.remove('menu-open');
    marketWelcome.hidden = false;
    kioskPanel.hidden = false;
    productsPanel.hidden = true;
    cartPanel.hidden = true;
    backToKiosks.hidden = true;
    marketSearch.hidden = true;
    marketCartLink.hidden = true;
    productSearch.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderProductCards(items) {
    const search = productSearch.value.trim().toLowerCase();
    const filtered = items.filter(product => `${product.name} ${product.category || ''} ${product.description || ''}`.toLowerCase().includes(search));
    productList.innerHTML = '';
    if (!selectedKioskId) return renderEmpty(productList, 'Primero elegí un quiosco', 'Su menú aparecerá aquí.');
    if (!filtered.length && search) return renderEmpty(productList, 'No encontramos ese producto', 'Probá con otra búsqueda.');
    if (!filtered.length) return renderEmpty(productList, 'Este negocio todavía no publicó productos', 'Volvé pronto para ver su menú.');

    filtered.forEach((product, index) => {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.innerHTML = `<div class="product-visual product-visual-${index % 3}" ${product.image ? `style="background-image:url('${product.image}')"` : ''}><span ${product.image ? 'hidden' : ''}>${product.name.charAt(0)}</span></div><div class="product-info"><span>${product.category || 'Disponible'}</span><h3>${product.name}</h3><p>${product.description || ''}</p><strong>$${product.price.toFixed(2)}</strong></div><button aria-label="Agregar ${product.name}">+</button>`;
      card.querySelector('button').addEventListener('click', () => addToCart(product));
      productList.appendChild(card);
    });
  }

  function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    existing ? existing.quantity++ : cart.push({ ...product, quantity: 1 });
    renderCart();
  }

  function renderCart() {
    cartList.innerHTML = '';
    if (!cart.length) renderEmpty(cartList, 'Tu pedido está vacío', 'Agregá algo rico del menú.', 'empty-cart');
    else cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `<div><b>${item.quantity}×</b><span>${item.name}</span></div><strong>$${(item.price * item.quantity).toFixed(2)}</strong>`;
      cartList.appendChild(row);
    });
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    $('cart-total').textContent = total.toFixed(2);
    $('cart-count').textContent = count;
    $('cart-side-count').textContent = count;
  }

  async function placeOrder() {
    if (!cart.length) return alert('Tu carrito está vacío.');
    if (!selectedKioskId) return alert('Elegí un quiosco antes de enviar el pedido.');
    const response = await post('/pedidos', { userId: getCurrentUser().id, items: cart, kioskId: selectedKioskId });
    if (!response.ok) return alert(response.data.error || 'No se pudo enviar el pedido.');
    cart.length = 0;
    renderCart();
    await onOrderPlaced(response.data.order);
  }

  function showForClient(user) {
    $('market-user-name').textContent = user.name.split(' ')[0];
    loadKiosks();
    renderCart();
    renderProductCards([]);
    showKioskDirectory();
  }

  function reset() {
    selectedKioskId = null;
    products = [];
    cart.length = 0;
  }

  return { init, loadKiosks, reset, showForClient };
}
