// Controla la interfaz completa: autenticacion, marketplace, pedidos y panel admin.
import { apiBase, post, request } from './core/api.js';
import { escapeHtml, formatOrderDate, imageFileToDataUrl, orderCode, statusLabel } from './core/format.js';
import { downloadReceipt, initReceiptActions, printInvoice, showReceipt } from './receipts.js';

let currentUser = null;
let selectedKioskId = null;
let kiosksData = [];
let currentProducts = [];
let adminProducts = [];
let clientOrders = [];
let adminOrders = [];
let kioskCoverImage = '';
let productDraftImage = '';
let orderRefreshTimer = null;
let orderEventSource = null;
let clientOrderStatuses = new Map();
let clientOrdersLoaded = false;
const cart = [];

const $ = id => document.getElementById(id);
const authPanel = $('auth-panel');
const authCard = document.querySelector('.auth-card');
const authTabs = document.querySelector('.auth-tabs');
const siteHeader = $('site-header');
const marketplace = $('marketplace');
const userPanel = $('user-panel');
const adminPanel = $('admin-panel');
const kioskPanel = $('kiosk-panel');
const productsPanel = $('products-panel');
const cartPanel = $('cart-panel');
const kioskList = $('kiosk-list');
const productList = $('product-list');
const cartList = $('cart-list');
const cartTotal = $('cart-total');
const adminProductList = $('admin-product-list');
const clientOrderList = $('client-order-list');
const adminOrderList = $('admin-order-list');
const clientNoticeStack = $('client-notice-stack');
const registerForm = $('register-form');
const loginForm = $('login-form');
const productSearch = $('product-search');
const selectedKioskName = $('selected-kiosk-name');
const marketWelcome = $('market-welcome');
const backToKiosks = $('back-to-kiosks');
const marketLayout = document.querySelector('.market-layout');
const marketSearch = document.querySelector('.market-search');
const marketCartLink = document.querySelector('.market-cart-link');
const registerRoleRadios = document.querySelectorAll('input[name="register-role"]');
const adminRegisterNote = document.querySelector('.admin-register-note');

// Eventos de la interfaz. Mejor reunirlos aqui que jugar a encontrarlos por todo el archivo.
registerRoleRadios.forEach(radio => radio.addEventListener('change', handleRoleChange));
document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => showAuthView(tab.dataset.authView)));
document.querySelectorAll('[data-open-auth]').forEach(link => link.addEventListener('click', () => showAuthView(link.dataset.openAuth)));
document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', logout));
$('logout-button').addEventListener('click', logout);
document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => togglePassword(button)));
document.querySelector('[data-scroll-cart]').addEventListener('click', () => cartPanel.scrollIntoView({ behavior: 'smooth' }));
productSearch.addEventListener('input', () => renderProductCards(currentProducts));
backToKiosks.addEventListener('click', showKioskDirectory);
$('place-order-button').addEventListener('click', placeOrder);
document.querySelector('[data-admin-logout]').addEventListener('click', logout);
$('kiosk-profile-form').addEventListener('submit', saveKioskProfile);
$('product-form').addEventListener('submit', saveProduct);
$('cancel-product-edit').addEventListener('click', resetProductForm);
initReceiptActions();
$('admin-kiosk-image').addEventListener('change', async event => {
  kioskCoverImage = await imageFileToDataUrl(event.target.files[0]);
  renderAdminCover();
});
$('admin-product-image').addEventListener('change', async event => {
  productDraftImage = await imageFileToDataUrl(event.target.files[0]);
});
['admin-kiosk-name', 'admin-kiosk-location', 'admin-kiosk-schedule', 'admin-kiosk-description']
  .forEach(id => $(id).addEventListener('input', renderClientPreview));

// Autenticacion y sesion.
function handleRoleChange() {
  const role = document.querySelector('input[name="register-role"]:checked').value;
  adminRegisterNote.hidden = role !== 'admin';
  updateSelectedRole(registerRoleRadios);
}

function updateSelectedRole(radios) {
  radios.forEach(radio => radio.closest('.role-card')?.classList.toggle('selected', radio.checked));
}

function showAuthView(viewName) {
  const showingRegister = viewName === 'register';
  authTabs.classList.toggle('register-active', showingRegister);
  authCard.classList.toggle('show-register', showingRegister);

  document.querySelectorAll('.auth-tab').forEach(tab => {
    const active = tab.dataset.authView === viewName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
  });
  document.querySelectorAll('.auth-view').forEach(view => {
    const active = view.id === `${viewName}-view`;
    view.classList.toggle('active', active);
    view.hidden = !active;
  });
}

function togglePassword(button) {
  const input = $(button.dataset.passwordTarget);
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.textContent = showing ? 'Ver' : 'Ocultar';
}

registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const role = document.querySelector('input[name="register-role"]:checked').value;
  const payload = {
    name: $('register-name').value.trim(),
    email: $('register-email').value.trim(),
    password: $('register-password').value.trim(),
    role
  };

  const response = await post('/register', payload);
  if (!response.ok) return alert(response.data.error || 'No se pudo completar el registro.');
  alert('Cuenta creada. Ya podés iniciar sesión.');
  registerForm.reset();
  handleRoleChange();
  showAuthView('login');
  $('login-email').value = payload.email;
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter || loginForm.querySelector('button[type="submit"]');
  const email = $('login-email').value.trim().toLowerCase();
  setButtonState(button, true, 'Comprobando...');
  showAuthMessage('');
  try {
    const response = await post('/login', {
      email,
      password: $('login-password').value.trim()
    });
    if (!response.ok) {
      return showAuthMessage(`No pudimos ingresar. Revisá el correo ${email} y la contraseña.`);
    }
    currentUser = response.data.user;
    loginForm.reset();
    showApp();
  } catch (error) {
    console.error('Error durante el inicio de sesión:', error);
    showAuthMessage(error.message);
  } finally {
    setButtonState(button, false, 'Entrar a Cash Food');
  }
});

function logout() {
  clearInterval(orderRefreshTimer);
  orderRefreshTimer = null;
  disconnectOrderEvents();
  clientOrderStatuses.clear();
  clientOrdersLoaded = false;
  clientNoticeStack?.replaceChildren();
  currentUser = null;
  selectedKioskId = null;
  currentProducts = [];
  cart.length = 0;
  showApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Marketplace del cliente.
async function loadKiosks() {
  const response = await fetch(`${apiBase}/kioscos`);
  kiosksData = await response.json();
  kioskList.innerHTML = '';
  if (!kiosksData.length) {
    renderEmpty(kioskList, 'Todavía no hay negocios publicados', 'Cuando un administrador cree su perfil, aparecerá aquí.', 'market-empty marketplace-empty');
    return;
  }
  kiosksData.forEach(kiosk => {
    const card = document.createElement('article');
    card.className = 'kiosk-card';
    card.innerHTML = `
      <div class="kiosk-mark" ${kiosk.coverImage ? `style="background-image:url('${kiosk.coverImage}')"` : ''}>${kiosk.coverImage ? '' : kiosk.name.charAt(0)}</div>
      <span class="kiosk-open">Abierto ahora</span>
      <h3>${kiosk.name}</h3>
      <p>${kiosk.description}</p>
      <small>${kiosk.location}</small>
      <small>${kiosk.schedule || ''}</small>
      <button>Ver menú <span>→</span></button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (selectedKioskId && selectedKioskId !== kiosk.id) {
        cart.length = 0;
        renderCart();
      }
      selectedKioskId = kiosk.id;
      showKioskMenu();
      loadProducts(kiosk.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    kioskList.appendChild(card);
  });
}

async function loadProducts(kioskId) {
  const response = await fetch(`${apiBase}/productos?kioskId=${kioskId}`);
  currentProducts = await response.json();
  selectedKioskName.textContent = kiosksData.find(kiosk => kiosk.id === kioskId)?.name || 'Menú';
  productSearch.value = '';
  renderProductCards(currentProducts);
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
  currentProducts = [];
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

function renderProductCards(products) {
  const search = productSearch.value.trim().toLowerCase();
  const filtered = products.filter(product =>
    `${product.name} ${product.category || ''} ${product.description || ''}`.toLowerCase().includes(search)
  );
  productList.innerHTML = '';
  if (!selectedKioskId) return renderEmpty(productList, 'Primero elegí un quiosco', 'Su menú aparecerá aquí.');
  if (!filtered.length && search) return renderEmpty(productList, 'No encontramos ese producto', 'Probá con otra búsqueda.');
  if (!filtered.length) return renderEmpty(productList, 'Este negocio todavía no publicó productos', 'Volvé pronto para ver su menú.');

  filtered.forEach((product, index) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-visual product-visual-${index % 3}" ${product.image ? `style="background-image:url('${product.image}')"` : ''}><span ${product.image ? 'hidden' : ''}>${product.name.charAt(0)}</span></div>
      <div class="product-info"><span>${product.category || 'Disponible'}</span><h3>${product.name}</h3><p>${product.description || ''}</p><strong>$${product.price.toFixed(2)}</strong></div>
      <button aria-label="Agregar ${product.name}">+</button>`;
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
  if (!cart.length) {
    renderEmpty(cartList, 'Tu pedido está vacío', 'Agregá algo rico del menú.', 'empty-cart');
  } else {
    cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `<div><b>${item.quantity}×</b><span>${item.name}</span></div><strong>$${(item.price * item.quantity).toFixed(2)}</strong>`;
      cartList.appendChild(row);
    });
  }
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartTotal.textContent = total.toFixed(2);
  $('cart-count').textContent = count;
  $('cart-side-count').textContent = count;
}

async function placeOrder() {
  if (!cart.length) return alert('Tu carrito está vacío.');
  if (!selectedKioskId) return alert('Elegí un quiosco antes de enviar el pedido.');
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const response = await post('/pedidos', { userId: currentUser.id, items: cart, total, kioskId: selectedKioskId });
  if (!response.ok) return alert(response.data.error || 'No se pudo enviar el pedido.');
  cart.length = 0;
  renderCart();
  await loadClientOrders();
  showClientOrderNotice(response.data.order);
  document.querySelector('.client-order-center').scrollIntoView({ behavior: 'smooth', block: 'start' });
  alert(`Pedido #${response.data.order.id} enviado. Tu factura ya está disponible.`);
}

// Panel del administrador.
async function loadAdminWorkspace() {
  const [kioskResponse, productsResponse] = await Promise.all([
    fetch(`${apiBase}/admin/kioscos/${currentUser.kioskId}`),
    fetch(`${apiBase}/admin/kioscos/${currentUser.kioskId}/productos`)
  ]);
  const kiosk = await kioskResponse.json();
  adminProducts = await productsResponse.json();
  $('admin-kiosk-name').value = kiosk.name || '';
  $('admin-kiosk-location').value = kiosk.location;
  $('admin-kiosk-schedule').value = kiosk.schedule || '';
  $('admin-kiosk-description').value = kiosk.description;
  kioskCoverImage = kiosk.coverImage || '';
  renderAdminCover();
  renderAdminProducts();
  renderClientPreview();
  loadAdminOrders();
}

async function loadClientOrders() {
  if (!currentUser || currentUser.role !== 'cliente') return;
  const response = await fetch(`${apiBase}/pedidos?userId=${currentUser.id}`);
  if (!response.ok) return;
  const orders = await response.json();
  notifyClientOrderChanges(orders);
  clientOrders = orders;
  renderOrders(clientOrderList, clientOrders, false);
  $('client-order-count').textContent = clientOrders.length;
}

// Pedidos, facturas y avisos en tiempo real.
function notifyClientOrderChanges(orders) {
  if (clientOrdersLoaded) {
    orders.forEach(order => {
      const previousStatus = clientOrderStatuses.get(order.id);
      if (previousStatus && previousStatus !== order.status) showClientOrderNotice(order);
    });
  }
  clientOrderStatuses = new Map(orders.map(order => [order.id, order.status]));
  clientOrdersLoaded = true;
}

function showClientOrderNotice(order) {
  const messages = {
    pendiente: { eyebrow: 'Pedido recibido', title: 'El quiosco recibió tu pedido', detail: 'En breve comenzarán a prepararlo.' },
    'en-preparacion': { eyebrow: 'En preparación', title: 'Están preparando tu comida', detail: 'Tu pedido ya está en marcha.' },
    listo: { eyebrow: '¡Pedido listo!', title: 'Vení por tu comida', detail: `Mostrá el código ${orderCode(order.id)} al retirarlo.` },
    entregado: { eyebrow: 'Pedido entregado', title: '¡Que lo disfrutés!', detail: 'Tu comprobante quedará disponible en el historial.' }
  };
  const message = messages[order.status];
  if (!message || !clientNoticeStack) return;
  const notice = document.createElement('article');
  notice.className = `client-order-notice notice-${order.status}`;
  notice.innerHTML = `
    <div class="notice-motion"><span></span><i></i><b></b></div>
    <div><small>${message.eyebrow} · ${escapeHtml(order.kioskName)}</small><strong>${message.title}</strong><p>${message.detail}</p></div>
    <button type="button" aria-label="Cerrar aviso">×</button>`;
  notice.querySelector('button').addEventListener('click', () => removeClientNotice(notice));
  clientNoticeStack.appendChild(notice);
  requestAnimationFrame(() => notice.classList.add('visible'));
  setTimeout(() => removeClientNotice(notice), order.status === 'listo' ? 10000 : 7000);
}

function removeClientNotice(notice) {
  notice.classList.remove('visible');
  setTimeout(() => notice.remove(), 350);
}

async function loadAdminOrders() {
  if (!currentUser || currentUser.role !== 'admin') return;
  const response = await fetch(`${apiBase}/admin/pedidos?kioskId=${currentUser.kioskId}`);
  if (!response.ok) return;
  adminOrders = await response.json();
  renderOrders(adminOrderList, adminOrders, true);
  $('admin-order-count').textContent = adminOrders.length;
}

function connectOrderEvents() {
  disconnectOrderEvents();
  if (!currentUser || typeof EventSource === 'undefined') return;

  orderEventSource = new EventSource(`${apiBase}/pedidos/eventos`);
  orderEventSource.addEventListener('order', event => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    const order = payload.order;
    const isClientEvent = currentUser?.role === 'cliente'
      && (order?.userId === currentUser.id || payload.userId === currentUser.id);
    const isAdminEvent = currentUser?.role === 'admin'
      && (order?.kioskId === currentUser.kioskId || payload.kioskId === currentUser.kioskId);

    if (isClientEvent) loadClientOrders();
    if (isAdminEvent) {
      loadAdminOrders();
      if (payload.type === 'created') {
        showAdminToast(`Nuevo pedido ${orderCode(order.id)} recibido.`);
      }
    }
  });
}

function disconnectOrderEvents() {
  orderEventSource?.close();
  orderEventSource = null;
}

function renderOrders(container, orders, adminView) {
  container.innerHTML = '';
  if (!orders.length) {
    return renderEmpty(
      container,
      adminView ? 'Todavía no recibiste pedidos' : 'Todavía no hiciste pedidos',
      adminView ? 'Los pedidos enviados por clientes aparecerán aquí.' : 'Cuando envíes un pedido, su factura aparecerá aquí.'
    );
  }
  if (!adminView) {
    orders.forEach(order => container.appendChild(createPickupCard(order)));
    return;
  }
  orders.forEach(order => container.appendChild(createInvoiceCard(order, adminView)));
}

function createPickupCard(order) {
  const card = document.createElement('article');
  card.className = 'pickup-card';
  card.innerHTML = `
    <div class="pickup-card-top">
      <div><span>Pedido para retirar en</span><h3>${escapeHtml(order.kioskName)}</h3></div>
      <b class="invoice-status status-${order.status}">${statusLabel(order.status)}</b>
    </div>
    <div class="pickup-code"><span>Código de pedido</span><strong>${orderCode(order.id)}</strong></div>
    <div class="pickup-summary"><span>${order.items.reduce((sum, item) => sum + item.quantity, 0)} productos<br>${formatOrderDate(order.createdAt)}</span><strong>$${order.total.toFixed(2)}</strong></div>
    <div class="pickup-actions"><button type="button" data-view-pickup>Mostrar comprobante</button><button type="button" data-delete-order>Eliminar</button></div>`;
  card.querySelector('[data-view-pickup]').addEventListener('click', () => showReceipt(order));
  card.querySelector('[data-delete-order]').addEventListener('click', () => deleteOrder(order.id, false));
  return card;
}

function createInvoiceCard(order, adminView) {
  const card = document.createElement('article');
  card.className = `invoice-card status-card-${order.status}`;
  const items = order.items.map(item => `
    <div class="invoice-item">
      <b>${item.quantity}×</b>
      <span>${escapeHtml(item.name)}<small>$${item.price.toFixed(2)} c/u</small></span>
      <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
    </div>`).join('');
  const statusControl = adminView ? `
    <select aria-label="Estado del pedido ${order.id}" data-order-status>
      ${['pendiente', 'en-preparacion', 'listo', 'entregado'].map(status =>
        `<option value="${status}" ${status === order.status ? 'selected' : ''}>${statusLabel(status)}</option>`
      ).join('')}
    </select>` : '';
  card.innerHTML = `
    <div class="invoice-card-head">
      <div><span>Factura Cash Food</span><h3>${orderCode(order.id)}</h3><small>${formatOrderDate(order.createdAt)}</small></div>
      <b class="invoice-status status-${order.status}">${statusLabel(order.status)}</b>
    </div>
    <div class="admin-invoice-customer">
      <span class="admin-invoice-avatar">${escapeHtml(order.userName).charAt(0)}</span>
      <div><small>Pedido de</small><strong>${escapeHtml(order.userName)}</strong><span>${escapeHtml(order.userEmail)}</span></div>
      <b>${order.items.reduce((sum, item) => sum + item.quantity, 0)} uds.</b>
    </div>
    <div class="invoice-meta">
      <div><span>Retiro</span><b>${escapeHtml(order.kioskLocation)}</b></div>
      <div><span>Estado actual</span><b>${statusLabel(order.status)}</b></div>
    </div>
    <div class="invoice-items">${items}</div>
    <div class="invoice-total"><span>Total del pedido</span><strong>$${order.total.toFixed(2)}</strong></div>
    <div class="invoice-status-control"><label><span>Cambiar estado</span>${statusControl}</label></div>
    <div class="invoice-actions">
      <button type="button" data-view-invoice>Ver comprobante</button>
      <button type="button" data-download-invoice>Descargar</button>
      <button type="button" data-print-invoice>Imprimir</button>
      <button type="button" data-delete-order>Eliminar</button>
    </div>`;
  card.querySelector('[data-view-invoice]').addEventListener('click', () => showReceipt(order, true));
  card.querySelector('[data-download-invoice]').addEventListener('click', () => downloadReceipt(order, true));
  card.querySelector('[data-print-invoice]').addEventListener('click', () => printInvoice(order));
  card.querySelector('[data-delete-order]').addEventListener('click', () => deleteOrder(order.id, true));
  card.querySelector('[data-order-status]')?.addEventListener('change', event => updateOrderStatus(order.id, event.target.value));
  return card;
}

async function updateOrderStatus(orderId, status) {
  const response = await post(`/admin/pedidos/${orderId}/status`, { status, kioskId: currentUser.kioskId });
  if (!response.ok) return showAdminToast(response.data.error || 'No se pudo actualizar el pedido.', 'error');
  await loadAdminOrders();
  showAdminToast(`Pedido #${orderId} actualizado a ${statusLabel(status)}.`);
}

async function deleteOrder(orderId, adminView) {
  const code = orderCode(orderId);
  const orders = adminView ? adminOrders : clientOrders;
  const order = orders.find(item => item.id === orderId);
  if (order?.status !== 'entregado') {
    const message = 'Solo podés eliminar la factura cuando el pedido esté entregado.';
    return adminView ? showAdminToast(message, 'error') : alert(message);
  }
  if (!confirm(`¿Eliminar la factura ${code} de tu historial? La otra persona conservará su comprobante.`)) return;
  const response = await post(`/pedidos/${orderId}/ocultar`, adminView
    ? { kioskId: currentUser.kioskId }
    : { userId: currentUser.id });
  if (!response.ok) {
    const message = response.data.error || 'No se pudo eliminar la factura.';
    return adminView ? showAdminToast(message, 'error') : alert(message);
  }
  adminView ? await loadAdminOrders() : await loadClientOrders();
  if (adminView) showAdminToast(`Factura ${code} eliminada de tu historial.`);
}

// Perfil y catalogo del administrador.
function renderAdminCover() {
  const cover = $('admin-cover');
  cover.style.backgroundImage = kioskCoverImage ? `url('${kioskCoverImage}')` : '';
  $('admin-cover-letter').hidden = Boolean(kioskCoverImage);
  $('admin-cover-letter').textContent = $('admin-kiosk-name').value.charAt(0) || 'C';
}

async function saveKioskProfile(event) {
  event.preventDefault();
  const button = event.submitter;
  setButtonState(button, true, 'Guardando...');
  try {
    const response = await request(`/admin/kioscos/${currentUser.kioskId}`, 'PUT', {
      name: $('admin-kiosk-name').value.trim(),
      location: $('admin-kiosk-location').value.trim(),
      schedule: $('admin-kiosk-schedule').value.trim(),
      description: $('admin-kiosk-description').value.trim(),
      coverImage: kioskCoverImage
    });
    if (!response.ok) return showAdminToast(response.data.error || 'No se pudo guardar el perfil.', 'error');
    await loadKiosks();
    renderAdminCover();
    renderClientPreview();
    showAdminToast('Perfil guardado. Los clientes ya pueden verlo.');
  } catch (error) {
    showAdminToast(error.message, 'error');
  } finally {
    setButtonState(button, false, 'Guardar perfil');
  }
}

async function saveProduct(event) {
  event.preventDefault();
  const submitButton = event.submitter;
  const editingId = Number($('editing-product-id').value);
  const existing = adminProducts.find(product => product.id === editingId);
  const payload = {
    name: $('admin-product-name').value.trim(),
    price: Number($('admin-product-price').value),
    category: $('admin-product-category').value,
    description: $('admin-product-description').value.trim(),
    available: $('admin-product-available').checked,
    image: productDraftImage || existing?.image || ''
  };
  setButtonState(submitButton, true, editingId ? 'Guardando...' : 'Publicando...');
  try {
    const response = editingId
      ? await request(`/admin/productos/${editingId}`, 'PUT', payload)
      : await post(`/admin/kioscos/${currentUser.kioskId}/productos`, payload);
    if (!response.ok) return showAdminToast(response.data.error || 'No se pudo guardar el producto.', 'error');
    resetProductForm();
    await loadAdminProducts();
    showAdminToast(editingId ? 'Producto actualizado.' : 'Producto publicado. Ya aparece para los clientes.');
  } catch (error) {
    showAdminToast(error.message, 'error');
  } finally {
    setButtonState(submitButton, false, editingId ? 'Guardar cambios' : 'Publicar producto');
  }
}

async function loadAdminProducts() {
  const response = await fetch(`${apiBase}/admin/kioscos/${currentUser.kioskId}/productos`);
  adminProducts = await response.json();
  renderAdminProducts();
}

function renderAdminProducts() {
  adminProductList.innerHTML = '';
  $('admin-product-count').textContent = adminProducts.length;
  if (!adminProducts.length) {
    renderEmpty(adminProductList, 'Todavía no publicaste productos', 'Creá el primero con el formulario.');
    renderClientPreview();
    return;
  }
  adminProducts.forEach(product => {
    const card = document.createElement('article');
    card.className = 'admin-product-card';
    card.innerHTML = `
      <div class="admin-product-thumb" ${product.image ? `style="background-image:url('${product.image}')"` : ''}>${product.image ? '' : product.name.charAt(0)}</div>
      <div><span>${product.category} · ${product.available ? 'Visible' : 'Oculto'}</span><h3>${product.name}</h3><p>${product.description || 'Sin descripción'}</p><strong>$${product.price.toFixed(2)}</strong></div>
      <div class="admin-product-actions"><button data-edit>Editar</button><button data-delete>Eliminar</button></div>`;
    card.querySelector('[data-edit]').addEventListener('click', () => editProduct(product));
    card.querySelector('[data-delete]').addEventListener('click', () => deleteProduct(product.id));
    adminProductList.appendChild(card);
  });
  renderClientPreview();
}

function editProduct(product) {
  $('editing-product-id').value = product.id;
  $('admin-product-name').value = product.name;
  $('admin-product-price').value = product.price;
  $('admin-product-category').value = product.category;
  $('admin-product-description').value = product.description || '';
  $('admin-product-available').checked = product.available;
  productDraftImage = product.image || '';
  $('save-product-button').textContent = 'Guardar cambios';
  $('cancel-product-edit').hidden = false;
  $('product-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteProduct(productId) {
  if (!confirm('¿Eliminar este producto del menú?')) return;
  await request(`/admin/productos/${productId}`, 'DELETE');
  loadAdminProducts();
}

function resetProductForm() {
  $('product-form').reset();
  $('editing-product-id').value = '';
  $('admin-product-available').checked = true;
  $('save-product-button').textContent = 'Publicar producto';
  $('cancel-product-edit').hidden = true;
  productDraftImage = '';
}

function renderClientPreview() {
  const cover = $('preview-kiosk-cover');
  cover.style.backgroundImage = kioskCoverImage ? `url('${kioskCoverImage}')` : '';
  $('preview-kiosk-letter').hidden = Boolean(kioskCoverImage);
  $('preview-kiosk-letter').textContent = $('admin-kiosk-name').value.charAt(0) || 'C';
  $('preview-kiosk-name').textContent = $('admin-kiosk-name').value || 'Tu quiosco';
  $('preview-kiosk-location').textContent = $('admin-kiosk-location').value || 'Ubicación';
  $('preview-kiosk-schedule').textContent = $('admin-kiosk-schedule').value || 'Horario por definir';
  $('preview-kiosk-description').textContent = $('admin-kiosk-description').value || 'Descripción del negocio';
  $('preview-product-count').textContent = adminProducts.filter(product => product.available).length;
  const list = $('preview-product-list');
  list.innerHTML = '';
  const visibleProducts = adminProducts.filter(product => product.available);
  if (!visibleProducts.length) return renderEmpty(list, 'Sin productos visibles', 'Publicá un producto para verlo aquí.');
  visibleProducts.slice(0, 5).forEach(product => {
    const card = document.createElement('article');
    card.className = 'preview-product-card';
    card.innerHTML = `<div ${product.image ? `style="background-image:url('${product.image}')"` : ''}>${product.image ? '' : product.name.charAt(0)}</div><span><b>${product.name}</b><small>${product.category}</small></span><strong>$${product.price.toFixed(2)}</strong>`;
    list.appendChild(card);
  });
}

// Ayudantes compartidos. Pequenos, aburridos y bastante utiles.
function setButtonState(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = text;
}

function showAdminToast(message, type = 'success') {
  const toast = $('admin-toast');
  toast.textContent = message;
  toast.classList.toggle('error', type === 'error');
  toast.hidden = false;
  clearTimeout(showAdminToast.timeout);
  showAdminToast.timeout = setTimeout(() => { toast.hidden = true; }, 3500);
}

function showAuthMessage(message) {
  const element = $('auth-message');
  element.textContent = message;
  element.classList.remove('success');
  element.hidden = !message;
}

function renderEmpty(container, title, detail, className = 'market-empty') {
  container.innerHTML = `<div class="${className}"><b>${title}</b><span>${detail}</span></div>`;
}

function showApp() {
  const logged = Boolean(currentUser);
  const client = logged && currentUser.role === 'cliente';
  const admin = logged && currentUser.role === 'admin';
  document.body.classList.toggle('app-mode', logged);
  siteHeader.hidden = logged;
  document.querySelector('footer').hidden = logged;
  document.querySelectorAll('.landing-only').forEach(section => { section.hidden = logged; });
  authPanel.hidden = logged;
  marketplace.hidden = !client;
  userPanel.hidden = true;
  adminPanel.hidden = !admin;
  clearInterval(orderRefreshTimer);
  orderRefreshTimer = null;
  disconnectOrderEvents();

  if (client) {
    clientOrderStatuses.clear();
    clientOrdersLoaded = false;
    clientNoticeStack?.replaceChildren();
    $('market-user-name').textContent = currentUser.name.split(' ')[0];
    selectedKioskName.textContent = 'Elegí un quiosco';
    loadKiosks();
    renderCart();
    renderProductCards([]);
    showKioskDirectory();
    loadClientOrders();
    connectOrderEvents();
    orderRefreshTimer = setInterval(loadClientOrders, 30000);
  }
  if (admin) {
    $('user-name').textContent = currentUser.name;
    $('user-role').textContent = 'Administrador del quiosco';
    loadAdminWorkspace();
    connectOrderEvents();
    orderRefreshTimer = setInterval(loadAdminOrders, 30000);
  }
}

loadKiosks().then(() => {
  handleRoleChange();
  showApp();
});
