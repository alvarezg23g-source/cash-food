export function statusLabel(status) {
  return ({
    pendiente: 'Pendiente',
    'en-preparacion': 'En preparacion',
    listo: 'Listo',
    entregado: 'Entregado'
  })[status] || status;
}

export function orderCode(orderId) {
  return `CF-${String(orderId).padStart(4, '0')}`;
}

export function formatOrderDate(value) {
  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

// Las plantillas usan HTML; esta funcion evita que un nombre creativo se vuelva codigo.
export function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

export function imageFileToDataUrl(file) {
  if (!file) return Promise.resolve('');
  if (file.size > 3 * 1024 * 1024) {
    alert('La imagen debe pesar menos de 3 MB.');
    return Promise.resolve('');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
