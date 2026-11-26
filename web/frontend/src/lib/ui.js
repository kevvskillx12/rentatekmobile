import { writable } from 'svelte/store';

// ---------- Notificaciones (toasts) ----------
export const toasts = writable([]);
let contador = 0;

export function toast(mensaje, tipo = 'ok') {
  const id = ++contador;
  toasts.update((t) => [...t, { id, mensaje, tipo }]);
  setTimeout(() => cerrarToast(id), 4000);
}

export function cerrarToast(id) {
  toasts.update((t) => t.filter((x) => x.id !== id));
}

// ---------- Diálogo de confirmación ----------
// Uso: if (await confirmar({ titulo, mensaje, accion: 'Eliminar', peligro: true })) { ... }
export const dialogo = writable(null);

export function confirmar(opciones) {
  return new Promise((resolve) => dialogo.set({ ...opciones, resolve }));
}

// ---------- Bloqueo de scroll mientras hay modales abiertos ----------
let abiertos = 0;

export function bloquearScroll() {
  abiertos++;
  document.body.style.overflow = 'hidden';
  return {
    destroy() {
      abiertos = Math.max(0, abiertos - 1);
      if (abiertos === 0) document.body.style.overflow = '';
    }
  };
}

// Enfoca el primer campo (o el propio nodo) al abrir
export function enfocar(node) {
  setTimeout(() => {
    const campo = node.querySelector('input, select, textarea, button.btn-primary');
    (campo || node).focus({ preventScroll: true });
  }, 60);
}
