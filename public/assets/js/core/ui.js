export const $ = id => document.getElementById(id);

export function setButtonState(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = text;
}

export function renderEmpty(container, title, detail, className = 'market-empty') {
  container.innerHTML = `<div class="${className}"><b>${title}</b><span>${detail}</span></div>`;
}
