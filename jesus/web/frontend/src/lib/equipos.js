import { writable } from 'svelte/store';
import { api } from './api.js';

// Categorías con conteo de equipos (tabla `categorias`)
export const categorias = writable([]); // [{ id, nombre, descripcion, imagen, total, disponibles }]

export async function recargar() {
  try {
    categorias.set(await api('/categorias'));
  } catch {
    /* la página sigue funcionando sin categorías */
  }
}

recargar();
