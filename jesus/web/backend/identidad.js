// Verificación automática de identidad (personas físicas) con las reglas oficiales
// de RENAPO (CURP) y del SAT (RFC con homoclave). Todo se calcula aquí, sin servicios externos.
// Nota: comprueba que los datos sean coherentes y válidos; no consulta al SAT ni al INE.

const PARTICULAS = new Set(['DA', 'DAS', 'DE', 'DEL', 'DER', 'DI', 'DIE', 'DD', 'EL', 'LA', 'LAS', 'LE', 'LES',
  'LOS', 'MAC', 'MC', 'VAN', 'VON', 'Y']);
const NOMBRES_COMUNES = new Set(['JOSE', 'J', 'MARIA', 'MA', 'M']);
const INCONVENIENTES = new Set(['BACA', 'BAKA', 'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO',
  'COGE', 'COGI', 'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO', 'GETA', 'GUEI', 'GUEY', 'JETA',
  'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KAKA', 'KAKO', 'KOGE', 'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA',
  'KULO', 'LILO', 'LOCA', 'LOCO', 'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR', 'MION', 'MOCO',
  'MOKO', 'MULA', 'MULO', 'NACA', 'NACO', 'PEDA', 'PEDO', 'PENE', 'PIPI', 'PITO', 'POPO', 'PUTA', 'PUTO', 'QULO',
  'RATA', 'ROBA', 'ROBE', 'ROBO', 'RUIN', 'SENO', 'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY']);
const ESTADOS = new Set(['AS', 'BC', 'BS', 'CC', 'CL', 'CM', 'CS', 'CH', 'DF', 'DG', 'GT', 'GR', 'HG', 'JC', 'MC',
  'MN', 'MS', 'NT', 'NL', 'OC', 'PL', 'QT', 'QR', 'SP', 'SL', 'SR', 'TC', 'TS', 'TL', 'VZ', 'YN', 'ZS', 'NE']);

const VOCALES = 'AEIOU';

// Mayúsculas sin acentos, conservando la Ñ
export function normalizar(s) {
  return String(s ?? '').toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'Ñ').replace(/[^A-ZÑ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const sinParticulas = (s) => normalizar(s).split(' ').filter((p) => p && !PARTICULAS.has(p));

function nombreUsado(nombres) {
  const p = sinParticulas(nombres);
  return p.length > 1 && NOMBRES_COMUNES.has(p[0]) ? p[1] : p[0] || '';
}

const vocalInterna = (s) => [...s.slice(1)].find((c) => VOCALES.includes(c)) || 'X';
const consonanteInterna = (s) => {
  const c = [...s.slice(1)].find((x) => /[A-ZÑ]/.test(x) && !VOCALES.includes(x));
  return !c || c === 'Ñ' ? 'X' : c;
};
const inicial = (s) => (!s || s[0] === 'Ñ' ? 'X' : s[0]);

// ---------- CURP ----------
const TABLA_CURP = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
export const RE_CURP = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/;

export function digitoCurp(c17) {
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += TABLA_CURP.indexOf(c17[i]) * (18 - i);
  return String((10 - (suma % 10)) % 10);
}

export function fechaDeCurp(curp) {
  const anio = (/\d/.test(curp[16]) ? 1900 : 2000) + Number(curp.slice(4, 6));
  const f = `${anio}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`;
  const d = new Date(`${f}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== f ? null : f;
}

export function curpValida(curp) {
  return RE_CURP.test(curp) && ESTADOS.has(curp.slice(11, 13)) && !!fechaDeCurp(curp)
    && digitoCurp(curp.slice(0, 17)) === curp[17];
}

// Las 4 letras iniciales y las 3 consonantes que la CURP debe tener según el nombre
function letrasCurp({ paterno, materno, nombres }) {
  const pat = sinParticulas(paterno).join(' ');
  const mat = sinParticulas(materno).join(' ');
  const nom = nombreUsado(nombres);
  let cuatro = inicial(pat) + vocalInterna(pat) + inicial(mat) + inicial(nom);
  if (INCONVENIENTES.has(cuatro)) cuatro = cuatro[0] + 'X' + cuatro.slice(2);
  return { cuatro, consonantes: consonanteInterna(pat) + consonanteInterna(mat) + consonanteInterna(nom) };
}

// ---------- RFC ----------
const TABLA_HOMONIMIA = { ' ': '00', '&': '10', 'Ñ': '40' };
[...'ABCDEFGHI'].forEach((c, i) => (TABLA_HOMONIMIA[c] = String(11 + i)));
[...'JKLMNOPQR'].forEach((c, i) => (TABLA_HOMONIMIA[c] = String(21 + i)));
[...'STUVWXYZ'].forEach((c, i) => (TABLA_HOMONIMIA[c] = String(32 + i)));
for (let d = 0; d <= 9; d++) TABLA_HOMONIMIA[d] = '0' + d;
const TABLA_HOMOCLAVE = '123456789ABCDEFGHIJKLMNPQRSTUVWXYZ';
const TABLA_DIGITO_RFC = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ';

export function digitoRfc(rfc12) {
  const base = rfc12.padStart(12, ' ');
  let suma = 0;
  for (let i = 0; i < 12; i++) suma += TABLA_DIGITO_RFC.indexOf(base[i]) * (13 - i);
  const r = suma % 11;
  if (r === 0) return '0';
  return 11 - r === 10 ? 'A' : String(11 - r);
}

function homoclave(nombreCompleto) {
  const cad = '0' + [...nombreCompleto].map((c) => TABLA_HOMONIMIA[c] ?? '00').join('');
  let suma = 0;
  for (let i = 0; i < cad.length - 1; i++) suma += Number(cad.slice(i, i + 2)) * Number(cad[i + 1]);
  const tres = suma % 1000;
  return TABLA_HOMOCLAVE[Math.floor(tres / 34)] + TABLA_HOMOCLAVE[tres % 34];
}

export function calcularRfc({ paterno, materno, nombres }, fechaISO) {
  const pat = sinParticulas(paterno).join(' ');
  const mat = sinParticulas(materno).join(' ');
  const nom = nombreUsado(nombres);
  let cuatro;
  if (!mat) cuatro = pat[0] + vocalInterna(pat) + nom.slice(0, 2);
  else if (pat.length <= 2) cuatro = pat[0] + mat[0] + nom.slice(0, 2);
  else cuatro = pat[0] + vocalInterna(pat) + mat[0] + nom[0];
  cuatro = cuatro.padEnd(4, 'X');
  if (INCONVENIENTES.has(cuatro)) cuatro = cuatro.slice(0, 3) + 'X';
  const fecha = fechaISO.slice(2, 4) + fechaISO.slice(5, 7) + fechaISO.slice(8, 10);
  const completo = [normalizar(paterno), normalizar(materno), normalizar(nombres)].filter(Boolean).join(' ');
  const doce = cuatro + fecha + homoclave(completo);
  return doce + digitoRfc(doce);
}

function edad(fechaISO) {
  const hoy = new Date();
  const [y, m, d] = fechaISO.split('-').map(Number);
  let e = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
  return e;
}

// Valida los datos leídos de la INE y devuelve { error } o { datos } listos para guardar.
export function verificarIdentidad(b) {
  const persona = { paterno: normalizar(b.paterno), materno: normalizar(b.materno), nombres: normalizar(b.nombres) };
  const curp = String(b.curp ?? '').toUpperCase().replace(/[^A-Z0-9Ñ]/g, '');
  if (!persona.paterno || !persona.nombres) return { error: 'Falta el nombre o el primer apellido.' };
  if (!curpValida(curp)) return { error: 'La CURP no es válida. Revisa que esté bien escrita.' };

  const esperado = letrasCurp(persona);
  if (curp.slice(0, 4) !== esperado.cuatro || curp.slice(13, 16) !== esperado.consonantes) {
    return { error: 'El nombre no coincide con la CURP. Revisa que los apellidos y el nombre estén bien escritos.' };
  }
  const fecha = fechaDeCurp(curp);
  if (edad(fecha) < 18) return { error: 'Debes ser mayor de edad para verificar tu cuenta.' };

  return {
    datos: {
      nombre_legal: [persona.nombres, persona.paterno, persona.materno].filter(Boolean).join(' '),
      curp, rfc: calcularRfc(persona, fecha), fecha_nacimiento: fecha
    }
  };
}
