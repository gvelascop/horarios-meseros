let csrf = '';
export function actualizarCsrf(valor) { csrf = valor || ''; }
export async function apiJson(url, opciones = {}) {
  const metodo = (opciones.method || 'GET').toUpperCase();
  const headers = new Headers(opciones.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(metodo) && csrf) headers.set('X-CSRF-Token', csrf);
  const respuesta = await fetch(url, { ...opciones, headers, credentials: 'same-origin' });
  const datos = await respuesta.json().catch(() => ({}));
  if (datos.csrf) actualizarCsrf(datos.csrf);
  if (!respuesta.ok) {
    if (respuesta.status === 401 && !['/api/auth/login', '/api/auth/sesion', '/api/auth/configurar'].includes(url)) window.dispatchEvent(new Event('sesion-expirada'));
    throw new Error(datos.mensaje || 'No se pudo completar la solicitud');
  }
  return datos;
}
export function enviarJson(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
