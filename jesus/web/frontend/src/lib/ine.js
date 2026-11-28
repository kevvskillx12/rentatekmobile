// Lectura automática de la INE (frente) con OCR en el propio dispositivo (Tesseract.js, gratis).
// La foto no se sube a ningún lado: solo se extraen el nombre y la CURP.
import { curpValida, normalizar, verificarIdentidad } from './identidad.js';

const A_LETRA = { 0: 'O', 1: 'I', 2: 'Z', 4: 'A', 5: 'S', 6: 'G', 8: 'B' };
const A_DIGITO = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', T: '7', B: '8' };
// Qué tipo de carácter va en cada posición de la CURP (L = letra, D = dígito, X = cualquiera)
const PATRON = 'LLLLDDDDDDLLLLLLXD';

function corregirCurp(s) {
  const c = [...s].map((ch, i) => {
    if (PATRON[i] === 'L') return A_LETRA[ch] ?? ch;
    if (PATRON[i] === 'D') return A_DIGITO[ch] ?? ch;
    return ch;
  });
  // Posición 17: dígito si nació en el siglo XX, letra si nació del 2000 en adelante.
  // Si el año (YY) es mayor que el actual, por fuerza nació en 19YY y debe ser dígito.
  if (Number(c.slice(4, 6).join('')) > new Date().getFullYear() % 100) c[16] = A_DIGITO[c[16]] ?? c[16];
  return c.join('');
}

// Busca una CURP válida en el texto, corrigiendo confusiones típicas del OCR (O/0, I/1, S/5…)
export function buscarCurp(texto) {
  const lineas = texto.toUpperCase().split('\n').map((l) => l.replace(/[^A-Z0-9Ñ]/g, ''));
  for (const l of [...lineas, lineas.join('')]) {
    for (let i = 0; i + 18 <= l.length; i++) {
      const c = corregirCurp(l.slice(i, i + 18));
      if (curpValida(c)) return c;
    }
  }
  return '';
}

const ETIQUETAS = /\b(FECHA DE NACIMIENTO|CREDENCIAL PARA VOTAR|SEXO|FECHA|NACIMIENTO|NOMBRE|DOMICILIO|INSTITUTO|NACIONAL|ELECTORAL|MEXICO|CREDENCIAL|PARA|VOTAR)\b/g;

// Renglones entre "NOMBRE" y "DOMICILIO": apellido paterno, materno y nombre(s)
function renglonesNombre(texto) {
  const lineas = texto.toUpperCase().split('\n');
  const ini = lineas.findIndex((l) => /NOMBRE/.test(l));
  if (ini < 0) return [];
  const out = [];
  for (const l of lineas.slice(ini + 1)) {
    if (/DOMICILIO|CLAVE|CURP/.test(l)) break;
    const limpio = normalizar(l).replace(ETIQUETAS, ' ').split(' ').filter((p) => p.length > 1).join(' ');
    if (limpio) out.push(limpio);
    if (out.length === 4) break;
  }
  return out;
}

// Elige cómo repartir los renglones en paterno / materno / nombres usando la CURP como referencia
function repartirNombre(renglones, curp) {
  const opciones = [];
  for (let n = Math.min(renglones.length, 4); n >= 2; n--) {
    const r = renglones.slice(0, n);
    opciones.push({ paterno: r[0], materno: r[1], nombres: r.slice(2).join(' ') });
    opciones.push({ paterno: r[0], materno: '', nombres: r.slice(1).join(' ') });
  }
  const valida = opciones.find((o) => o.nombres && !verificarIdentidad({ ...o, curp }).error);
  return valida || opciones.find((o) => o.nombres) || { paterno: renglones[0] || '', materno: '', nombres: '' };
}

export function analizarTexto(texto) {
  const curp = buscarCurp(texto);
  return { ...repartirNombre(renglonesNombre(texto), curp), curp };
}

// Escala de grises y tamaño adecuado: mejora bastante la lectura
async function prepararImagen(archivo) {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)) || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext('2d');
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return canvas;
}

// Devuelve { paterno, materno, nombres, curp } leídos de la foto. alAvanzar(0..1) para la barra de progreso.
export async function leerIne(archivo, alAvanzar = () => {}) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    logger: (m) => m.status === 'recognizing text' && alAvanzar(m.progress)
  });
  try {
    const imagen = await prepararImagen(archivo);
    const { data } = await worker.recognize(imagen);
    return analizarTexto(data.text);
  } finally {
    await worker.terminate();
  }
}
