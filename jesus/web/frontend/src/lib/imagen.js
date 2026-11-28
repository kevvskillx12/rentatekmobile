// Utilidades para fotos tomadas con el celular

// true en celulares/tablets (pantalla táctil): ahí se muestra el botón "Tomar foto" con la cámara
export const esTactil = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

// Reduce la foto a máx. 1600 px por lado y la convierte a JPG. Las fotos de cámara suelen
// pesar 4-8 MB; así quedan en unos cientos de KB y suben rápido.
export async function comprimirImagen(archivo, { lado = 1600, calidad = 0.85 } = {}) {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  return blob;
}
