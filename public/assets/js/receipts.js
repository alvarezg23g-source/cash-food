import { escapeHtml, formatOrderDate, orderCode, statusLabel } from './core/format.js';

const receiptDialog = document.getElementById('receipt-dialog');
const customerReceipt = document.getElementById('customer-receipt');
let selectedReceipt = null;

// El comprobante sabe abrirse, descargarse e imprimirse. main.js ya tenia suficiente trabajo.
export function initReceiptActions() {
  receiptDialog?.querySelector('[data-close-receipt]')?.addEventListener('click', closeReceipt);
  receiptDialog?.querySelector('[data-print-receipt]')?.addEventListener('click', () => {
    if (selectedReceipt) printInvoice(selectedReceipt.order);
  });
  receiptDialog?.querySelector('[data-download-receipt]')?.addEventListener('click', () => {
    if (selectedReceipt) downloadReceipt(selectedReceipt.order, selectedReceipt.adminView);
  });
  receiptDialog?.addEventListener('cancel', event => {
    event.preventDefault();
    closeReceipt();
  });
}

export function showReceipt(order, adminView = false) {
  if (!receiptDialog || !customerReceipt) {
    return alert('Actualiza la pagina para abrir el comprobante.');
  }

  selectedReceipt = { order, adminView };
  customerReceipt.innerHTML = receiptMarkup(order, adminView);
  lockPagePosition();
  receiptDialog.showModal();
}

export function closeReceipt() {
  if (!receiptDialog?.open) return;
  receiptDialog.close();
  unlockPagePosition();
}

function lockPagePosition() {
  const scrollY = window.scrollY;
  document.body.dataset.receiptScrollY = String(scrollY);
  document.body.style.top = `-${scrollY}px`;
  document.body.classList.add('receipt-open');
}

function unlockPagePosition() {
  const scrollY = Math.abs(Number.parseInt(document.body.dataset.receiptScrollY || '0', 10));
  document.body.classList.remove('receipt-open');
  document.body.style.top = '';
  delete document.body.dataset.receiptScrollY;
  window.scrollTo({ top: scrollY, behavior: 'auto' });
}

function receiptMarkup(order, adminView = false) {
  const items = order.items.map(item => `
    <div class="receipt-line">
      <b>${item.quantity}x</b>
      <span>${escapeHtml(item.name)}<br><small>$${item.price.toFixed(2)} c/u</small></span>
      <span>$${(item.price * item.quantity).toFixed(2)}</span>
    </div>`).join('');

  return `
    <div class="receipt-brand"><b>CASH FOOD</b><span>${adminView ? 'Comprobante interno del quiosco' : 'Comprobante de pedido'}</span></div>
    <div class="receipt-code"><span>${adminView ? 'Codigo de referencia del pedido' : 'Mostra este codigo en el quiosco'}</span><strong>${orderCode(order.id)}</strong></div>
    <div class="receipt-details">
      <div><span>Estado</span><b>${statusLabel(order.status)}</b></div>
      <div><span>Quiosco</span><b>${escapeHtml(order.kioskName)}</b></div>
      <div><span>Cliente</span><b>${escapeHtml(order.userName)}</b></div>
      <div><span>Fecha</span><b>${formatOrderDate(order.createdAt)}</b></div>
      <div><span>Retiro</span><b>${escapeHtml(order.kioskLocation)}</b></div>
    </div>
    <div class="receipt-lines">${items}</div>
    <div class="receipt-grand-total"><span>TOTAL</span><span>$${order.total.toFixed(2)}</span></div>
    <p class="receipt-footer">${adminView ? 'Conserva este comprobante como respaldo del pedido realizado por el cliente.' : 'Conserva este comprobante y mostralo al retirar tu pedido.'}</p>`;
}

export function downloadReceipt(order, adminView = false) {
  const content = `<!doctype html><html><head><meta charset="utf-8"><title>${orderCode(order.id)}</title><style>
    body{max-width:420px;margin:25px auto;padding:25px;font-family:"Courier New",monospace;color:#191919}
    .receipt-code{margin:20px 0;padding:17px;border:3px solid #111;text-align:center}.receipt-code span,.receipt-code strong{display:block}.receipt-code strong{margin-top:6px;font-size:38px}
    .receipt-brand{text-align:center;border-bottom:2px dashed #222;padding-bottom:18px}.receipt-brand b{display:block;font-size:22px}
    .receipt-details,.receipt-lines{display:grid;gap:8px;padding:16px 0;border-bottom:2px dashed #222;font-size:13px}.receipt-details div,.receipt-grand-total{display:flex;justify-content:space-between;gap:12px}
    .receipt-line{display:grid;grid-template-columns:auto 1fr auto;gap:8px}.receipt-grand-total{padding-top:16px;font-size:18px;font-weight:bold}.receipt-footer{text-align:center;font-size:11px}
  </style></head><body>${receiptMarkup(order, adminView)}</body></html>`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }));
  link.download = `factura-${orderCode(order.id)}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function printInvoice(order) {
  const popup = window.open('', '_blank', 'width=720,height=800');
  if (!popup) return alert('Permiti las ventanas emergentes para imprimir la factura.');
  const items = order.items.map(item =>
    `<tr><td>${item.quantity}x ${escapeHtml(item.name)}</td><td>$${item.price.toFixed(2)}</td><td>$${(item.price * item.quantity).toFixed(2)}</td></tr>`
  ).join('');

  popup.document.write(`<!doctype html><html><head><title>Factura ${orderCode(order.id)}</title><style>
    body{max-width:650px;margin:40px auto;padding:0 24px;font-family:Arial,sans-serif;color:#25201d}
    header{display:flex;justify-content:space-between;border-bottom:3px solid #25201d;padding-bottom:18px}
    h1{margin:0}small{color:#71675f}table{width:100%;margin:28px 0;border-collapse:collapse}
    th,td{padding:10px 6px;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}
    .code{margin:22px 0;padding:16px;border:3px solid #25201d;font-size:32px;font-weight:bold;letter-spacing:5px;text-align:center}
    .total{display:flex;justify-content:space-between;font-size:20px;font-weight:bold;border-top:3px solid #25201d;padding-top:14px}
  </style></head><body>
    <header><div><small>Cash Food - Factura</small><h1>Pedido ${orderCode(order.id)}</h1></div><strong>${statusLabel(order.status)}</strong></header>
    <div class="code">${orderCode(order.id)}</div>
    <p><b>Cliente:</b> ${escapeHtml(order.userName)}<br><b>Quiosco:</b> ${escapeHtml(order.kioskName)}<br><b>Fecha:</b> ${formatOrderDate(order.createdAt)}</p>
    <table><thead><tr><th>Producto</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${items}</tbody></table>
    <div class="total"><span>Total</span><span>$${order.total.toFixed(2)}</span></div>
    <script>window.onload=()=>window.print()</script>
  </body></html>`);
  popup.document.close();
}
