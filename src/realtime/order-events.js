// Mantiene los navegadores conectados para avisar pedidos sin el ritual de F5.
const listeners = new Set();

function subscribe(response) {
  listeners.add(response);
  response.write('event: connected\ndata: {}\n\n');

  return () => {
    listeners.delete(response);
  };
}

function publishOrderEvent(event) {
  const message = `event: order\ndata: ${JSON.stringify(event)}\n\n`;

  // Si un navegador se fue sin despedirse, se limpia al primer intento fallido.
  listeners.forEach(response => {
    try {
      response.write(message);
    } catch {
      listeners.delete(response);
    }
  });
}

module.exports = { publishOrderEvent, subscribe };
