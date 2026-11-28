import { get } from 'svelte/store';
import { sesion } from './sesion.js';

// En desarrollo Vite redirige /api al backend (ver vite.config.js).
// En producción define VITE_API_URL con la URL del backend.
export const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

// body puede ser un objeto (se manda como JSON) o un archivo/Blob (se manda crudo, p. ej. una foto).
export async function api(ruta, { method = 'GET', body } = {}) {
  const headers = {};
  const s = get(sesion);
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  const crudo = body instanceof Blob;
  if (body !== undefined) headers['Content-Type'] = crudo ? body.type : 'application/json';

  let res;
  try {
    res = await fetch(BASE + ruta, {
      method,
      headers,
      body: body === undefined ? undefined : crudo ? body : JSON.stringify(body)
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }

  if (res.status === 401 && s?.token) sesion.set(null);
  if (res.status === 204) return null;

  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'Ocurrió un error.');
  return datos;
}
