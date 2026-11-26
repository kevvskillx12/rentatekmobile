import { writable } from 'svelte/store';
import { api } from './api.js';
import { normalizar } from './datos.js';

export const todos = writable([]);
export const cargando = writable(true);
export const errorCarga = writable('');

export async function recargar() {
  cargando.set(true);
  errorCarga.set('');
  try {
    const filas = await api('/maquinaria');
    todos.set(filas.map(normalizar));
  } catch (e) {
    errorCarga.set(e.message);
  } finally {
    cargando.set(false);
  }
}

recargar();
