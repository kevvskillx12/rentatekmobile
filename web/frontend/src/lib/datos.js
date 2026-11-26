const IMAGENES = {
  'Elevación': '/img/Grua.jpeg',
  'Construcción': '/img/Retroexcavadora.jpg',
  'Compactación': '/img/Retroexcavadora.jpg'
};

export const CATEGORIAS = ['Excavación', 'Construcción', 'Elevación', 'Compactación', 'Transporte', 'Otra'];

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
    imagen: imagenPara(m.categoria),
    pendientes: m.pendientes ?? 0
  };
}

export function formatoDinero(n) {
  return '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
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
