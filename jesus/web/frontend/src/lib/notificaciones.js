import { writable } from 'svelte/store';
import { api } from './api.js';
import { usuario } from './sesion.js';

export const notifs = writable({ items: [], no_leidas: 0 });

let timer;
export async function cargarNotifs() {
  try {
    notifs.set(await api('/notificaciones'));
  } catch {
    /* sin conexión: se reintenta en el siguiente ciclo */
  }
}

usuario.subscribe((u) => {
  clearInterval(timer);
  if (!u) return notifs.set({ items: [], no_leidas: 0 });
  cargarNotifs();
  timer = setInterval(() => document.visibilityState === 'visible' && cargarNotifs(), 30000);
});

export async function leerNotif(n) {
  if (n.leida) return;
  notifs.update((s) => ({
    items: s.items.map((x) => (x.id === n.id ? { ...x, leida: true } : x)),
    no_leidas: Math.max(0, s.no_leidas - 1)
  }));
  try { await api(`/notificaciones/${n.id}/leer`, { method: 'PATCH' }); } catch {}
}

export async function leerTodas() {
  notifs.update((s) => ({ items: s.items.map((x) => ({ ...x, leida: true })), no_leidas: 0 }));
  try { await api('/notificaciones/leer-todas', { method: 'PATCH' }); } catch {}
}
