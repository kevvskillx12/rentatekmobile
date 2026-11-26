import { writable, derived } from 'svelte/store';

const CLAVE = 'rentatek_sesion';

function cargar() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE));
  } catch {
    return null;
  }
}

// { token, usuario: { id, nombre, email, rol, empresa } }
export const sesion = writable(cargar());

sesion.subscribe((valor) => {
  try {
    if (valor) localStorage.setItem(CLAVE, JSON.stringify(valor));
    else localStorage.removeItem(CLAVE);
  } catch {}
});

export const usuario = derived(sesion, ($s) => $s?.usuario ?? null);

try {
  localStorage.removeItem('rentatek_usuario');
  localStorage.removeItem('rentatek_usuarios');
  localStorage.removeItem('rentatek_equipos');
} catch {}
