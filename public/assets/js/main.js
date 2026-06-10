// Coordinador principal: sesion, pedidos compartidos y cambio de vistas.
import { apiBase, post } from './core/api.js';
import { escapeHtml, formatOrderDate, orderCode, statusLabel } from './core/format.js';
import { $, renderEmpty, setButtonState } from './core/ui.js';
import { createMarketplace } from './marketplace.js';
import { createAdminPanel } from './admin.js';
import { downloadReceipt, initReceiptActions, printInvoice, showReceipt } from './receipts.js';

let currentUser = null;
let clientOrders = [];
let adminOrders = [];
let orderRefreshTimer = null;
let orderEventSource = null;
let clientOrderStatuses = new Map();
let clientOrdersLoaded = false;

const authPanel = $('auth-panel');
const authCard = document.querySelector('.auth-card');
const authTabs = document.querySelector('.auth-tabs');
const siteHeader = $('site-header');
const marketplacePanel = $('marketplace');
const userPanel = $('user-panel');
const adminPanelElement = $('admin-panel');
const clientOrderList = $('client-order-list');
const adminOrderList = $('admin-order-list');
const clientNoticeStack = $('client-notice-stack');
const registerForm = $('register-form');
const loginForm = $('login-form');
const registerRoleRadios = document.querySelectorAll('input[name="register-role"]');
const adminRegisterNote = document.querySelector('.admin-register-note');

const marketplace = createMarketplace({
  getCurrentUser: () => currentUser,
  onOrderPlaced: async order => {
    await loadClientOrders();
    showClientOrderNotice(order);
    document.querySelector('.client-order-center').scrollIntoView({ behavior: 'smooth', block: 'start' });
    alert(`Pedido #${order.id} enviado. Tu factura ya está disponible.`);
  }
});

const adminPanel = createAdminPanel({
  getCurrentUser: () => currentUser,
  onProfileSaved: () => marketplace.loadKiosks(),
  onWorkspaceLoaded: loadAdminOrders
});

function init() {
  marketplace.init();
  adminPanel.init();
  initReceiptActions();
  registerRoleRadios.forEach(radio => radio.addEventListener('change', handleRoleChange));
  document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => showAuthView(tab.dataset.authView)));
  document.querySelectorAll('[data-open-auth]').forEach(link => link.addEventListener('click', () => showAuthView(link.dataset.openAuth)));
  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', logout));
  $('logout-button').addEventListener('click', logout);
  document.querySelector('[data-admin-logout]').addEventListener('click', logout);
  document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => togglePassword(button)));
  registerForm.addEventListener('submit', register);
  loginForm.addEventListener('submit', login);
  marketplace.loadKiosks().then(() => {
    handleRoleChange();
    showApp();
  });
}

// Autenticacion y sesion.
function handleRoleChange() {
  const role = document.querySelector('input[name="register-role"]:checked').value;
  adminRegisterNote.hidden = role !== 'admin';
  registerRoleRadios.forEach(radio => radio.closest('.role-card')?.classList.toggle('selected', radio.checked));
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

async function register(event) {
  event.preventDefault();
  const payload = {
    name: $('register-name').value.trim(),
    email: $('register-email').value.trim(),
    password: $('register-password').value.trim(),
    role: document.querySelector('input[name="register-role"]:checked').value
  };
  const response = await post('/register', payload);
  if (!response.ok) return alert(response.data.error || 'No se pudo completar el registro.');
  alert('Cuenta creada. Ya podés iniciar sesión.');
  registerForm.reset();
  handleRoleChange();
  showAuthView('login');
  $('login-email').value = payload.email;
}

async function login(event) {
  event.preventDefault();
  const button = event.submitter || loginForm.querySelector('button[type="submit"]');
  const email = $('login-email').value.trim().toLowerCase();
  setButtonState(button, true, 'Comprobando...');
  showAuthMessage('');
  try {
    const response = await post('/login', { email, password: $('login-password').value.trim() });
    if (!response.ok) return showAuthMessage(`No pudimos ingresar. Revisá el correo ${email} y la contraseña.`);
    currentUser = response.data.user;
    loginForm.reset();
    showApp();
  } catch (error) {
    console.error('Error durante el inicio de sesión:', error);
    showAuthMessage(error.message);
  } finally {
    setButtonState(button, false, 'Entrar a Cash Food');
  }
}

function logout() {
  clearInterval(orderRefreshTimer);
  orderRefreshTimer = null;
  disconnectOrderEvents();
  clientOrderStatuses.clear();
  clientOrdersLoaded = false;
  clientNoticeStack?.replaceChildren();
  currentUser = null;
  marketplace.reset();
  showApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Pedidos, facturas y avisos en tiempo real.
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

async function loadAdminOrders() {
  if (!currentUser || currentUser.role !== 'admin') return;
  const response = await fetch(`${apiBase}/admin/pedidos?kioskId=${currentUser.kioskId}`);
  if (!response.ok) return;
  adminOrders = await response.json();
  renderOrders(adminOrderList, adminOrders, true);
  $('admin-order-count').textContent = adminOrders.length;
}

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
  notice.innerHTML = `<div class="notice-motion"><span></span><i></i><b></b></div><div><small>${message.eyebrow} · ${escapeHtml(order.kioskName)}</small><strong>${message.title}</strong><p>${message.detail}</p></div><button type="button" aria-label="Cerrar aviso">×</button>`;
  notice.querySelector('button').addEventListener('click', () => removeClientNotice(notice));
  clientNoticeStack.appendChild(notice);
  requestAnimationFrame(() => notice.classList.add('visible'));
  setTimeout(() => removeClientNotice(notice), order.status === 'listo' ? 10000 : 7000);
}

function removeClientNotice(notice) {
  notice.classList.remove('visible');
  setTimeout(() => notice.remove(), 350);
}

function connectOrderEvents() {
  disconnectOrderEvents();
  if (!currentUser || typeof EventSource === 'undefined') return;
  orderEventSource = new EventSource(`${apiBase}/pedidos/eventos`);
  orderEventSource.addEventListener('order', event => {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    const order = payload.order;
    const isClientEvent = currentUser?.role === 'cliente' && (order?.userId === currentUser.id || payload.userId === currentUser.id);
    const isAdminEvent = currentUser?.role === 'admin' && (order?.kioskId === currentUser.kioskId || payload.kioskId === currentUser.kioskId);
    if (isClientEvent) loadClientOrders();
    if (isAdminEvent) {
      loadAdminOrders();
      if (payload.type === 'created') adminPanel.showToast(`Nuevo pedido ${orderCode(order.id)} recibido.`);
    }
  });
}

function disconnectOrderEvents() {
  orderEventSource?.close();
  orderEventSource = null;
}

function renderOrders(container, orders, adminView) {
  container.innerHTML = '';
  if (!orders.length) return renderEmpty(container, adminView ? 'Todavía no recibiste pedidos' : 'Todavía no hiciste pedidos', adminView ? 'Los pedidos enviados por clientes aparecerán aquí.' : 'Cuando envíes un pedido, su factura aparecerá aquí.');
  orders.forEach(order => container.appendChild(adminView ? createInvoiceCard(order) : createPickupCard(order)));
}

function createPickupCard(order) {
  const card = document.createElement('article');
  card.className = 'pickup-card';
  card.innerHTML = `<div class="pickup-card-top"><div><span>Pedido para retirar en</span><h3>${escapeHtml(order.kioskName)}</h3></div><b class="invoice-status status-${order.status}">${statusLabel(order.status)}</b></div><div class="pickup-code"><span>Código de pedido</span><strong>${orderCode(order.id)}</strong></div><div class="pickup-summary"><span>${order.items.reduce((sum, item) => sum + item.quantity, 0)} productos<br>${formatOrderDate(order.createdAt)}</span><strong>$${order.total.toFixed(2)}</strong></div><div class="pickup-actions"><button type="button" data-view-pickup>Mostrar comprobante</button><button type="button" data-delete-order>Eliminar</button></div>`;
  card.querySelector('[data-view-pickup]').addEventListener('click', () => showReceipt(order));
  card.querySelector('[data-delete-order]').addEventListener('click', () => deleteOrder(order.id, false));
  return card;
}

function createInvoiceCard(order) {
  const card = document.createElement('article');
  card.className = `invoice-card status-card-${order.status}`;
  const items = order.items.map(item => `<div class="invoice-item"><b>${item.quantity}×</b><span>${escapeHtml(item.name)}<small>$${item.price.toFixed(2)} c/u</small></span><strong>$${(item.price * item.quantity).toFixed(2)}</strong></div>`).join('');
  const statuses = ['pendiente', 'en-preparacion', 'listo', 'entregado'].map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('');
  card.innerHTML = `<div class="invoice-card-head"><div><span>Factura Cash Food</span><h3>${orderCode(order.id)}</h3><small>${formatOrderDate(order.createdAt)}</small></div><b class="invoice-status status-${order.status}">${statusLabel(order.status)}</b></div><div class="admin-invoice-customer"><span class="admin-invoice-avatar">${escapeHtml(order.userName).charAt(0)}</span><div><small>Pedido de</small><strong>${escapeHtml(order.userName)}</strong><span>${escapeHtml(order.userEmail)}</span></div><b>${order.items.reduce((sum, item) => sum + item.quantity, 0)} uds.</b></div><div class="invoice-meta"><div><span>Retiro</span><b>${escapeHtml(order.kioskLocation)}</b></div><div><span>Estado actual</span><b>${statusLabel(order.status)}</b></div></div><div class="invoice-items">${items}</div><div class="invoice-total"><span>Total del pedido</span><strong>$${order.total.toFixed(2)}</strong></div><div class="invoice-status-control"><label><span>Cambiar estado</span><select aria-label="Estado del pedido ${order.id}" data-order-status>${statuses}</select></label></div><div class="invoice-actions"><button type="button" data-view-invoice>Ver comprobante</button><button type="button" data-download-invoice>Descargar</button><button type="button" data-print-invoice>Imprimir</button><button type="button" data-delete-order>Eliminar</button></div>`;
  card.querySelector('[data-view-invoice]').addEventListener('click', () => showReceipt(order, true));
  card.querySelector('[data-download-invoice]').addEventListener('click', () => downloadReceipt(order, true));
  card.querySelector('[data-print-invoice]').addEventListener('click', () => printInvoice(order));
  card.querySelector('[data-delete-order]').addEventListener('click', () => deleteOrder(order.id, true));
  card.querySelector('[data-order-status]').addEventListener('change', event => updateOrderStatus(order.id, event.target.value));
  return card;
}

async function updateOrderStatus(orderId, status) {
  const response = await post(`/admin/pedidos/${orderId}/status`, { status, kioskId: currentUser.kioskId });
  if (!response.ok) return adminPanel.showToast(response.data.error || 'No se pudo actualizar el pedido.', 'error');
  await loadAdminOrders();
  adminPanel.showToast(`Pedido #${orderId} actualizado a ${statusLabel(status)}.`);
}

async function deleteOrder(orderId, adminView) {
  const code = orderCode(orderId);
  const order = (adminView ? adminOrders : clientOrders).find(item => item.id === orderId);
  if (order?.status !== 'entregado') {
    const message = 'Solo podés eliminar la factura cuando el pedido esté entregado.';
    return adminView ? adminPanel.showToast(message, 'error') : alert(message);
  }
  if (!confirm(`¿Eliminar la factura ${code} de tu historial? La otra persona conservará su comprobante.`)) return;
  const response = await post(`/pedidos/${orderId}/ocultar`, adminView ? { kioskId: currentUser.kioskId } : { userId: currentUser.id });
  if (!response.ok) return adminView ? adminPanel.showToast(response.data.error || 'No se pudo eliminar la factura.', 'error') : alert(response.data.error || 'No se pudo eliminar la factura.');
  adminView ? await loadAdminOrders() : await loadClientOrders();
  if (adminView) adminPanel.showToast(`Factura ${code} eliminada de tu historial.`);
}

function showAuthMessage(message) {
  const element = $('auth-message');
  element.textContent = message;
  element.classList.remove('success');
  element.hidden = !message;
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
  marketplacePanel.hidden = !client;
  userPanel.hidden = true;
  adminPanelElement.hidden = !admin;
  clearInterval(orderRefreshTimer);
  orderRefreshTimer = null;
  disconnectOrderEvents();

  if (client) {
    clientOrderStatuses.clear();
    clientOrdersLoaded = false;
    clientNoticeStack?.replaceChildren();
    marketplace.showForClient(currentUser);
    loadClientOrders();
    connectOrderEvents();
    orderRefreshTimer = setInterval(loadClientOrders, 30000);
  }
  if (admin) {
    $('user-name').textContent = currentUser.name;
    $('user-role').textContent = 'Administrador del quiosco';
    adminPanel.loadWorkspace();
    connectOrderEvents();
    orderRefreshTimer = setInterval(loadAdminOrders, 30000);
  }
}

init();
