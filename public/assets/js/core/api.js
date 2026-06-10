const apiBase = '/api';

// Punto unico para hablar con el servidor. Fetch repetido no cuenta como arquitectura.
export async function request(path, method, body) {
  let response;

  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('El servidor esta desactualizado. Reinicialo y vuelve a intentar.');
  }

  return { ok: response.ok, data: await response.json() };
}

export function post(path, body) {
  return request(path, 'POST', body);
}

export { apiBase };
