import { writable, get } from 'svelte/store';
import { api } from './api.js';
import { usuario } from './sesion.js';
import { toast } from './ui.js';

export const favoritos = writable(new Set());

usuario.subscribe(async (u) => {
  if (!u) return favoritos.set(new Set());
  try {
    favoritos.set(new Set(await api('/favoritos/ids')));
  } catch {
    favoritos.set(new Set());
  }
});

export async function alternarFavorito(id) {
  if (!get(usuario)) {
    toast('Inicia sesión para guardar favoritos', 'error');
    window.location.hash = '#/acceso';
    return;
  }
  const actual = get(favoritos);
  const era = actual.has(id);
  const nuevo = new Set(actual);
  era ? nuevo.delete(id) : nuevo.add(id);
  favoritos.set(nuevo); // optimista
  try {
    await api(`/favoritos/${id}`, { method: era ? 'DELETE' : 'POST' });
    toast(era ? 'Quitado de favoritos' : 'Guardado en favoritos');
  } catch (e) {
    favoritos.set(actual);
    toast(e.message, 'error');
  }
}
