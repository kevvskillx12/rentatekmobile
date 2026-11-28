// Estados de México y lectura de ubicaciones escritas a mano ("Mérida, Yuc.", "Merida Yucatán"…)
// para agruparlas en el filtro por Estado → Ciudad. Se usa igual en el backend y en la web.

export const ESTADOS = [
  { nombre: 'Aguascalientes', abrev: 'Ags.', alias: ['AGS'] },
  { nombre: 'Baja California', abrev: 'B.C.', alias: ['BC'] },
  { nombre: 'Baja California Sur', abrev: 'B.C.S.', alias: ['BCS'] },
  { nombre: 'Campeche', abrev: 'Camp.', alias: ['CAMP'] },
  { nombre: 'Chiapas', abrev: 'Chis.', alias: ['CHIS'] },
  { nombre: 'Chihuahua', abrev: 'Chih.', alias: ['CHIH'] },
  { nombre: 'Ciudad de México', abrev: 'CDMX', alias: ['CDMX', 'DF', 'MEXICO DF', 'CD DE MEXICO', 'CD MX'] },
  { nombre: 'Coahuila', abrev: 'Coah.', alias: ['COAH', 'COAHUILA DE ZARAGOZA'] },
  { nombre: 'Colima', abrev: 'Col.', alias: ['COL'] },
  { nombre: 'Durango', abrev: 'Dgo.', alias: ['DGO'] },
  { nombre: 'Estado de México', abrev: 'Edo. Méx.', alias: ['EDO MEX', 'EDOMEX', 'EDO DE MEX', 'EDO DE MEXICO', 'MEX'] },
  { nombre: 'Guanajuato', abrev: 'Gto.', alias: ['GTO'] },
  { nombre: 'Guerrero', abrev: 'Gro.', alias: ['GRO'] },
  { nombre: 'Hidalgo', abrev: 'Hgo.', alias: ['HGO'] },
  { nombre: 'Jalisco', abrev: 'Jal.', alias: ['JAL'] },
  { nombre: 'Michoacán', abrev: 'Mich.', alias: ['MICH'] },
  { nombre: 'Morelos', abrev: 'Mor.', alias: ['MOR'] },
  { nombre: 'Nayarit', abrev: 'Nay.', alias: ['NAY'] },
  { nombre: 'Nuevo León', abrev: 'N.L.', alias: ['NL'] },
  { nombre: 'Oaxaca', abrev: 'Oax.', alias: ['OAX'] },
  { nombre: 'Puebla', abrev: 'Pue.', alias: ['PUE'] },
  { nombre: 'Querétaro', abrev: 'Qro.', alias: ['QRO'] },
  { nombre: 'Quintana Roo', abrev: 'Q. Roo', alias: ['Q ROO', 'QROO', 'QR'] },
  { nombre: 'San Luis Potosí', abrev: 'S.L.P.', alias: ['SLP'] },
  { nombre: 'Sinaloa', abrev: 'Sin.', alias: ['SIN'] },
  { nombre: 'Sonora', abrev: 'Son.', alias: ['SON'] },
  { nombre: 'Tabasco', abrev: 'Tab.', alias: ['TAB'] },
  { nombre: 'Tamaulipas', abrev: 'Tamps.', alias: ['TAMPS', 'TAMS'] },
  { nombre: 'Tlaxcala', abrev: 'Tlax.', alias: ['TLAX'] },
  { nombre: 'Veracruz', abrev: 'Ver.', alias: ['VER'] },
  { nombre: 'Yucatán', abrev: 'Yuc.', alias: ['YUC'] },
  { nombre: 'Zacatecas', abrev: 'Zac.', alias: ['ZAC'] }
];

export const SIN_ESTADO = 'Otras ubicaciones';
const CDMX = 'Ciudad de México';

// "Q. Roo" -> "Q ROO", "N.L." -> "NL", "Mérida" -> "MERIDA"
export function clave(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/\./g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Todas las formas de escribir cada estado, de la más larga a la más corta
const FORMAS = ESTADOS.flatMap((e) => [clave(e.nombre), ...e.alias].map((f) => ({ f, e: e.nombre })))
  .sort((a, b) => b.f.length - a.f.length);

// "Merida Yucatán" -> { ciudad: 'Merida', estado: 'Yucatán' }
export function separarUbicacion(texto) {
  const original = String(texto ?? '').replace(/\s+/g, ' ').trim();
  const k = clave(original);
  if (!k) return { ciudad: '', estado: SIN_ESTADO };
  if (k === clave(CDMX) || FORMAS.some((x) => x.e === CDMX && x.f === k)) return { ciudad: CDMX, estado: CDMX };

  const coma = original.lastIndexOf(',');
  if (coma > 0) {
    const fin = clave(original.slice(coma + 1));
    const m = FORMAS.find((x) => x.f === fin);
    if (m) return { ciudad: original.slice(0, coma).trim(), estado: m.e };
  }
  // Sin coma: el estado va al final ("Merida Yucatán", "Cancun QRoo")
  for (const { f, e } of FORMAS) {
    if (k.endsWith(' ' + f)) {
      const palabras = original.split(' ');
      return { ciudad: palabras.slice(0, palabras.length - f.split(' ').length).join(' ').replace(/[,\s]+$/, ''), estado: e };
    }
  }
  return { ciudad: original, estado: SIN_ESTADO };
}

// Texto que se guarda: "Mérida, Yuc."
export function unirUbicacion(ciudad, estado) {
  const c = String(ciudad ?? '').trim();
  const e = ESTADOS.find((x) => x.nombre === estado);
  if (!e) return c;
  if (estado === CDMX && clave(c) === clave(CDMX)) return CDMX;
  return c ? `${c}, ${e.abrev}` : '';
}

const acentos = (s) => (s.match(/[^\x00-\x7F]/g) || []).length;

// Lista de textos de la BD -> [{ nombre: estado, ciudades: [{ nombre, valores: [textos originales] }] }]
export function agruparUbicaciones(textos) {
  const estados = new Map();
  for (const t of textos) {
    const { ciudad, estado } = separarUbicacion(t);
    if (!ciudad) continue;
    if (!estados.has(estado)) estados.set(estado, new Map());
    const ciudades = estados.get(estado);
    const k = clave(ciudad);
    const c = ciudades.get(k) || { nombre: ciudad, valores: [] };
    if (acentos(ciudad) > acentos(c.nombre)) c.nombre = ciudad; // mostrar la versión con acentos
    c.valores.push(t);
    ciudades.set(k, c);
  }
  const orden = (a, b) => (a.nombre === SIN_ESTADO) - (b.nombre === SIN_ESTADO) || a.nombre.localeCompare(b.nombre, 'es');
  return [...estados].map(([nombre, ciudades]) => ({
    nombre,
    ciudades: [...ciudades.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  })).sort(orden);
}
