import { apiBase, post, request } from './core/api.js';
import { imageFileToDataUrl } from './core/format.js';
import { $, renderEmpty, setButtonState } from './core/ui.js';

export function createAdminPanel({ getCurrentUser, onProfileSaved, onWorkspaceLoaded }) {
  let products = [];
  let kioskCoverImage = '';
  let productDraftImage = '';
  const productList = $('admin-product-list');

  function init() {
    $('kiosk-profile-form').addEventListener('submit', saveKioskProfile);
    $('product-form').addEventListener('submit', saveProduct);
    $('cancel-product-edit').addEventListener('click', resetProductForm);
    $('admin-kiosk-image').addEventListener('change', async event => {
      kioskCoverImage = await imageFileToDataUrl(event.target.files[0]);
      renderAdminCover();
    });
    $('admin-product-image').addEventListener('change', async event => {
      productDraftImage = await imageFileToDataUrl(event.target.files[0]);
    });
    ['admin-kiosk-name', 'admin-kiosk-location', 'admin-kiosk-schedule', 'admin-kiosk-description']
      .forEach(id => $(id).addEventListener('input', renderClientPreview));
  }

  async function loadWorkspace() {
    const kioskId = getCurrentUser().kioskId;
    const [kioskResponse, productsResponse] = await Promise.all([
      fetch(`${apiBase}/admin/kioscos/${kioskId}`),
      fetch(`${apiBase}/admin/kioscos/${kioskId}/productos`)
    ]);
    const kiosk = await kioskResponse.json();
    products = await productsResponse.json();
    $('admin-kiosk-name').value = kiosk.name || '';
    $('admin-kiosk-location').value = kiosk.location;
    $('admin-kiosk-schedule').value = kiosk.schedule || '';
    $('admin-kiosk-description').value = kiosk.description;
    kioskCoverImage = kiosk.coverImage || '';
    renderAdminCover();
    renderProducts();
    renderClientPreview();
    onWorkspaceLoaded();
  }

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
      const response = await request(`/admin/kioscos/${getCurrentUser().kioskId}`, 'PUT', {
        name: $('admin-kiosk-name').value.trim(),
        location: $('admin-kiosk-location').value.trim(),
        schedule: $('admin-kiosk-schedule').value.trim(),
        description: $('admin-kiosk-description').value.trim(),
        coverImage: kioskCoverImage
      });
      if (!response.ok) return showToast(response.data.error || 'No se pudo guardar el perfil.', 'error');
      await onProfileSaved();
      renderAdminCover();
      renderClientPreview();
      showToast('Perfil guardado. Los clientes ya pueden verlo.');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setButtonState(button, false, 'Guardar perfil');
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    const submitButton = event.submitter;
    const editingId = Number($('editing-product-id').value);
    const existing = products.find(product => product.id === editingId);
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
        : await post(`/admin/kioscos/${getCurrentUser().kioskId}/productos`, payload);
      if (!response.ok) return showToast(response.data.error || 'No se pudo guardar el producto.', 'error');
      resetProductForm();
      await loadProducts();
      showToast(editingId ? 'Producto actualizado.' : 'Producto publicado. Ya aparece para los clientes.');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setButtonState(submitButton, false, editingId ? 'Guardar cambios' : 'Publicar producto');
    }
  }

  async function loadProducts() {
    const response = await fetch(`${apiBase}/admin/kioscos/${getCurrentUser().kioskId}/productos`);
    products = await response.json();
    renderProducts();
  }

  function renderProducts() {
    productList.innerHTML = '';
    $('admin-product-count').textContent = products.length;
    if (!products.length) {
      renderEmpty(productList, 'Todavía no publicaste productos', 'Creá el primero con el formulario.');
      renderClientPreview();
      return;
    }
    products.forEach(product => {
      const card = document.createElement('article');
      card.className = 'admin-product-card';
      card.innerHTML = `<div class="admin-product-thumb" ${product.image ? `style="background-image:url('${product.image}')"` : ''}>${product.image ? '' : product.name.charAt(0)}</div><div><span>${product.category} · ${product.available ? 'Visible' : 'Oculto'}</span><h3>${product.name}</h3><p>${product.description || 'Sin descripción'}</p><strong>$${product.price.toFixed(2)}</strong></div><div class="admin-product-actions"><button data-edit>Editar</button><button data-delete>Eliminar</button></div>`;
      card.querySelector('[data-edit]').addEventListener('click', () => editProduct(product));
      card.querySelector('[data-delete]').addEventListener('click', () => deleteProduct(product.id));
      productList.appendChild(card);
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
    loadProducts();
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
    $('preview-product-count').textContent = products.filter(product => product.available).length;
    const list = $('preview-product-list');
    list.innerHTML = '';
    const visibleProducts = products.filter(product => product.available);
    if (!visibleProducts.length) return renderEmpty(list, 'Sin productos visibles', 'Publicá un producto para verlo aquí.');
    visibleProducts.slice(0, 5).forEach(product => {
      const card = document.createElement('article');
      card.className = 'preview-product-card';
      card.innerHTML = `<div ${product.image ? `style="background-image:url('${product.image}')"` : ''}>${product.image ? '' : product.name.charAt(0)}</div><span><b>${product.name}</b><small>${product.category}</small></span><strong>$${product.price.toFixed(2)}</strong>`;
      list.appendChild(card);
    });
  }

  function showToast(message, type = 'success') {
    const toast = $('admin-toast');
    toast.textContent = message;
    toast.classList.toggle('error', type === 'error');
    toast.hidden = false;
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  return { init, loadWorkspace, showToast };
}
