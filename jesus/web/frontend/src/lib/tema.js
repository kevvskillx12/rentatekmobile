import { writable } from 'svelte/store';

const CLAVE = 'rentatek_tema';
const oscuroSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

let guardado = null;
try { guardado = localStorage.getItem(CLAVE); } catch {}

// 'light' | 'dark' (si no hay preferencia guardada, sigue al sistema)
export const tema = writable(guardado === 'light' || guardado === 'dark' ? guardado : oscuroSistema() ? 'dark' : 'light');

tema.subscribe((t) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0b1120' : '#172033');
});

export function alternarTema() {
  tema.update((t) => {
    const nuevo = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(CLAVE, nuevo); } catch {}
    return nuevo;
  });
}
