// Bandeja de mensajes: conversaciones del usuario y total de no leídos (para el menú)
import { writable, derived } from 'svelte/store';
import { api } from './api.js';
import { usuario } from './sesion.js';

export const conversaciones = writable([]);
export const noLeidosChat = derived(conversaciones, ($c) => $c.reduce((t, c) => t + (c.no_leidos || 0), 0));

let timer;
export async function cargarConversaciones() {
  try {
    conversaciones.set(await api('/conversaciones'));
  } catch {
    /* sin conexión: se reintenta en el siguiente ciclo */
  }
}

usuario.subscribe((u) => {
  clearInterval(timer);
  if (!u || (u.rol !== 'cliente' && u.rol !== 'proveedor')) return conversaciones.set([]);
  cargarConversaciones();
  timer = setInterval(() => document.visibilityState === 'visible' && cargarConversaciones(), 20000);
});
