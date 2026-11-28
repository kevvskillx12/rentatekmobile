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

// Favoritos es para quien renta: clientes y visitantes (a estos se les pide iniciar sesión).
// Proveedores y administradores no rentan, así que no lo ven.
export const usaFavoritos = derived(usuario, ($u) => !$u || $u.rol === 'cliente');

try {
  localStorage.removeItem('rentatek_usuario');
  localStorage.removeItem('rentatek_usuarios');
  localStorage.removeItem('rentatek_equipos');
} catch {}
