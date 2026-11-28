import { BASE } from './api.js';

// Imagen de respaldo por categoría (la principal viene de la tabla `categorias`)
const IMAGENES = {
  'Grúas': '/img/Grua.jpeg',
  'Plataformas de elevación': '/img/Grua.jpeg',
  'Montacargas': '/img/Grua.jpeg',
  'Retroexcavadoras': '/img/Retroexcavadora.jpg',
  'Cargadores frontales': '/img/Retroexcavadora.jpg',
  'Minicargadores': '/img/Retroexcavadora.jpg',
  'Compactadoras': '/img/Retroexcavadora.jpg',
  'Camiones de volteo': '/img/Retroexcavadora.jpg',
  'Equipo para concreto': '/img/Retroexcavadora.jpg'
};

export const ESTADOS_MAQUINA = {
  disponible: 'Disponible',
  por_liberar: 'Por liberar',
  rentada: 'Rentada'
};

export const ESTADOS_SOLICITUD = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada'
};

export function imagenPara(categoria) {
  return IMAGENES[categoria] || '/img/Excavadora.jpg';
}

// Convierte una fila de la tabla `maquinaria` al formato que usa la interfaz.
export function normalizar(m) {
  return {
    id: m.id,
    nombre: m.nombre,
    categoria: m.categoria,
    ubicacion: m.ciudad,
    precio: Number(m.precio_dia),
    estado: m.estado,
    descripcion: m.descripcion || '',
    specs: Object.entries(m.specs || {}).map(([k, v]) => (v ? `${k}: ${v}` : k)),
    specsObj: m.specs || {},
    proveedor: m.proveedor_empresa || m.proveedor_nombre || '',
    // Foto propia del equipo (guardada en la BD); si no tiene, la imagen de su categoría
    imagen: m.tiene_foto ? `${BASE}/maquinaria/${m.id}/foto?v=${m.foto_v}` : m.categoria_imagen || imagenPara(m.categoria),
    tieneFoto: !!m.tiene_foto,
    pendientes: m.pendientes ?? 0,
    proveedorId: m.proveedor_id,
    verificado: !!m.proveedor_verificado,
    promedio: m.promedio ?? null,
    resenas: m.resenas ?? 0,
    destacado: !!m.destacado
  };
}

export function formatoDinero(n) {
  return '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

// $1.6M / $250k para espacios reducidos (KPIs)
export function formatoCompacto(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return '$' + (n / 1e6).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + 'M';
  if (n >= 1e4) return '$' + Math.round(n / 1e3).toLocaleString('es-MX') + 'k';
  return formatoDinero(n);
}

export function formatoPrecio(n) {
  return formatoDinero(n) + ' / día';
}

export function formatoFecha(f) {
  return new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function whatsapp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length === 10) d = '52' + d;
  return `https://wa.me/${d}`;
}

// ---------- Fechas 'YYYY-MM-DD' (sin desfase de zona horaria) ----------
const pad = (n) => String(n).padStart(2, '0');
export const aISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function deISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const hoyISO = () => aISO(new Date());
export function diasEntre(ini, fin) {
  return Math.round((deISO(fin) - deISO(ini)) / 86400000) + 1;
}
export function formatoDia(iso, conAnio = false) {
  if (!iso) return '';
  return deISO(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) });
}
export function formatoRango(ini, fin) {
  if (!ini) return '';
  return ini === fin ? formatoDia(ini, true) : `${formatoDia(ini)} – ${formatoDia(fin, true)}`;
}
export function haceTiempo(f) {
  const s = Math.max(0, (Date.now() - new Date(f)) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return formatoFecha(f);
}
export function iniciales(nombre) {
  return String(nombre || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
