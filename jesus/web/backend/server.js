import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { migrar } from './db/migraciones.js';
import { enviarCorreo, correoActivo } from './correo.js';
import { verificarIdentidad } from './identidad.js';
import { agruparUbicaciones } from './ubicaciones.js';

const { DATABASE_URL, JWT_SECRET, PORT = 3001, CORS_ORIGIN, APP_URL = 'http://localhost:5173' } = process.env;
if (!DATABASE_URL || !JWT_SECRET) {
  console.error('Faltan DATABASE_URL o JWT_SECRET en backend/.env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(cors(CORS_ORIGIN ? { origin: CORS_ORIGIN.split(',') } : undefined));
app.use(express.json());

const ESTADOS_MAQUINA = ['disponible', 'por_liberar', 'rentada'];
const HOY = `(now() AT TIME ZONE 'America/Mexico_City')::date`;
const URL_APP = APP_URL.replace(/\/$/, '');

// ---------- utilidades ----------
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const id = (v) => Number(v) || 0;
const texto = (v, max = 2000) => String(v ?? '').trim().slice(0, max);

function firmar(u) {
  return jwt.sign({ id: u.id, rol: u.rol }, JWT_SECRET, { expiresIn: '7d' });
}

function publico(u) {
  return {
    id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, empresa: u.empresa,
    telefono: u.telefono, verificado: u.verificado, created_at: u.created_at, rfc: u.rfc ?? null
  };
}

function auth(rol) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    try {
      req.usuario = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
    if (rol && req.usuario.rol !== rol) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }
    next();
  };
}

// Crea una notificación en la app y, si hay SMTP, también la manda por correo.
async function notificar(usuarioId, { tipo = 'info', titulo, mensaje = '', enlace = null }, { correo = true } = {}) {
  try {
    await pool.query(
      'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, enlace) VALUES ($1, $2, $3, $4, $5)',
      [usuarioId, tipo, titulo, mensaje, enlace]
    );
    if (correo && correoActivo) {
      const { rows: [u] } = await pool.query('SELECT email FROM usuarios WHERE id = $1', [usuarioId]);
      if (u) enviarCorreo(u.email, `Rentatek: ${titulo}`, mensaje, enlace ? `${URL_APP}/${enlace}` : URL_APP);
    }
  } catch (e) {
    console.error('No se pudo crear la notificación:', e.message);
  }
}

function limpiarSpecs(specs) {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return {};
  const out = {};
  for (const [k, v] of Object.entries(specs)) {
    const key = String(k).trim();
    if (key) out[key] = String(v ?? '').trim();
  }
  return out;
}

function validarMaquina(b) {
  const nombre = texto(b.nombre, 120);
  const categoria = texto(b.categoria, 80);
  const ciudad = texto(b.ciudad, 80);
  const precio = Number(b.precio_dia);
  if (!nombre || !categoria || !ciudad) return { error: 'Completa nombre, categoría y ciudad.' };
  if (!(precio > 0)) return { error: 'El precio por día debe ser mayor a 0.' };
  const estado = b.estado ?? 'disponible';
  if (!ESTADOS_MAQUINA.includes(estado)) return { error: 'Estado inválido.' };
  return {
    datos: {
      nombre, categoria, ciudad, precio_dia: precio, descripcion: texto(b.descripcion), specs: limpiarSpecs(b.specs), estado,
      destacado: b.destacado === undefined ? null : !!b.destacado // null = no cambiarlo
    }
  };
}

// Celular de México: 10 dígitos (acepta +52 / 521 al inicio). Devuelve los 10 dígitos o null.
function telefonoMx(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  else if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  return d.length === 10 ? d : null;
}
const ERROR_TELEFONO = 'El teléfono debe tener 10 dígitos.';

function fechaValida(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(s));
}

// Columnas públicas de una máquina (sin la foto binaria) + datos del proveedor y calificación
const SELECT_MAQUINA = `
  SELECT m.id, m.proveedor_id, m.nombre, m.categoria, m.ciudad, m.precio_dia, m.descripcion, m.specs,
         m.estado, m.destacado, m.created_at, (m.foto IS NOT NULL) AS tiene_foto, m.foto_v,
         u.nombre AS proveedor_nombre, u.empresa AS proveedor_empresa, u.verificado AS proveedor_verificado,
         c.imagen AS categoria_imagen, r.promedio, COALESCE(r.resenas, 0) AS resenas
  FROM maquinaria m
  JOIN usuarios u ON u.id = m.proveedor_id
  LEFT JOIN categorias c ON c.nombre = m.categoria
  LEFT JOIN LATERAL (
    SELECT round(avg(calificacion), 1)::float AS promedio, count(*)::int AS resenas
    FROM resenas WHERE maquina_id = m.id
  ) r ON true`;

const SIN_ACENTOS = (col) => `translate(lower(${col}), 'áéíóúüñ', 'aeiouun')`;

// ---------- auth ----------
app.post('/api/auth/registro', ah(async (req, res) => {
  const nombre = texto(req.body.nombre, 120);
  const email = texto(req.body.email, 200).toLowerCase();
  const password = String(req.body.password || '');
  const rol = req.body.rol;
  const empresa = texto(req.body.empresa, 120) || null;
  const telefono = req.body.telefono ? telefonoMx(req.body.telefono) : null;
  if (req.body.telefono && !telefono) return res.status(400).json({ error: ERROR_TELEFONO });

  if (!nombre || !email || !password) return res.status(400).json({ error: 'Completa todos los campos.' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  if (!['cliente', 'proveedor'].includes(rol)) return res.status(400).json({ error: 'Rol inválido.' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, empresa, telefono)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, email, hash, rol, empresa, telefono]
    );
    notificar(rows[0].id, {
      tipo: 'bienvenida',
      titulo: '¡Bienvenido a Rentatek!',
      mensaje: rol === 'proveedor'
        ? 'Publica tu primer equipo desde tu panel para empezar a recibir solicitudes.'
        : 'Explora el catálogo y solicita la maquinaria que tu obra necesita.',
      enlace: rol === 'proveedor' ? '#/panel' : '#/catalogo'
    }, { correo: false });
    res.status(201).json({ token: firmar(rows[0]), usuario: publico(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    throw e;
  }
}));

app.post('/api/auth/login', ah(async (req, res) => {
  const email = texto(req.body.email, 200).toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  if (u.suspendido) return res.status(403).json({ error: 'Tu cuenta está suspendida. Escríbenos desde la página de contacto.' });
  res.json({ token: firmar(u), usuario: publico(u) });
}));

app.get('/api/auth/yo', auth(), ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!rows[0] || rows[0].suspendido) return res.status(401).json({ error: 'Usuario no encontrado.' });
  res.json(publico(rows[0]));
}));

app.put('/api/auth/perfil', auth(), ah(async (req, res) => {
  const nombre = texto(req.body.nombre, 120);
  const empresa = texto(req.body.empresa, 120) || null;
  const telefono = req.body.telefono ? telefonoMx(req.body.telefono) : null;
  if (req.body.telefono && !telefono) return res.status(400).json({ error: ERROR_TELEFONO });
  if (!nombre) return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
  const { rows } = await pool.query(
    'UPDATE usuarios SET nombre = $1, empresa = $2, telefono = $3 WHERE id = $4 RETURNING *',
    [nombre, empresa, telefono, req.usuario.id]);
  res.json(publico(rows[0]));
}));

app.put('/api/auth/password', auth(), ah(async (req, res) => {
  const actual = String(req.body.actual || '');
  const nueva = String(req.body.nueva || '');
  if (nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  const { rows: [u] } = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!u || !(await bcrypt.compare(actual, u.password_hash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  }
  await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(nueva, 10), req.usuario.id]);
  res.json({ ok: true });
}));

const MSG_OLVIDE = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';

app.post('/api/auth/olvide', ah(async (req, res) => {
  const email = texto(req.body.email, 200).toLowerCase();
  const { rows: [u] } = await pool.query('SELECT id, nombre FROM usuarios WHERE email = $1 AND NOT suspendido', [email]);
  if (u) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query(
      `UPDATE usuarios SET reset_hash = $1, reset_expira = now() + interval '1 hour' WHERE id = $2`, [hash, u.id]);
    const enlace = `${URL_APP}/#/restablecer/${token}`;
    const enviado = await enviarCorreo(email, 'Restablece tu contraseña de Rentatek',
      `Hola ${u.nombre.split(' ')[0]}, recibimos una solicitud para cambiar tu contraseña.\nEl enlace es válido por 1 hora. Si no fuiste tú, ignora este correo.`,
      enlace);
    if (!enviado) console.log(`\n[Recuperación de contraseña] ${email}\n  ${enlace}\n  (configura SMTP_* en .env para enviarlo por correo)\n`);
  }
  res.json({ ok: true, mensaje: MSG_OLVIDE });
}));

app.post('/api/auth/restablecer', ah(async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows: [u] } = await pool.query(
    'SELECT * FROM usuarios WHERE reset_hash = $1 AND reset_expira > now()', [hash]);
  if (!u) return res.status(400).json({ error: 'El enlace no es válido o ya expiró. Pide uno nuevo.' });
  await pool.query(
    'UPDATE usuarios SET password_hash = $1, reset_hash = NULL, reset_expira = NULL WHERE id = $2',
    [await bcrypt.hash(password, 10), u.id]);
  res.json({ token: firmar(u), usuario: publico(u) });
}));

// ---------- catálogo público ----------
app.get('/api/categorias', ah(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.nombre, c.descripcion, c.imagen,
            count(m.id)::int AS total,
            count(m.id) FILTER (WHERE m.estado = 'disponible')::int AS disponibles
     FROM categorias c
     LEFT JOIN maquinaria m ON m.categoria = c.nombre
       AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = m.proveedor_id AND u.suspendido)
     GROUP BY c.id ORDER BY c.orden, c.nombre`);
  res.json(rows);
}));

app.get('/api/estadisticas', ah(async (_req, res) => {
  const { rows: [r] } = await pool.query(
    `SELECT count(*)::int AS equipos,
            count(*) FILTER (WHERE m.estado = 'disponible')::int AS disponibles,
            count(DISTINCT m.ciudad)::int AS ciudades,
            count(DISTINCT m.proveedor_id)::int AS proveedores
     FROM maquinaria m JOIN usuarios u ON u.id = m.proveedor_id WHERE NOT u.suspendido`);
  res.json(r);
}));

// Listado paginado con filtros: q, categoria, ciudad, precio_max, disponibles, orden, pagina, limite, excluir
app.get('/api/maquinaria', ah(async (req, res) => {
  const where = ['NOT u.suspendido'];
  const vals = [];
  const p = (v) => (vals.push(v), `$${vals.length}`);
  const q = req.query;

  if (q.q) {
    const t = `%${String(q.q).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}%`;
    where.push(`(${SIN_ACENTOS('m.nombre')} LIKE ${p(t)} OR ${SIN_ACENTOS('m.categoria')} LIKE ${p(t)}
                 OR ${SIN_ACENTOS('m.descripcion')} LIKE ${p(t)})`);
  }
  if (q.categoria) where.push(`m.categoria = ${p(String(q.categoria))}`);
  if (q.ciudad) {
    const t = `%${String(q.ciudad).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}%`;
    where.push(`${SIN_ACENTOS('m.ciudad')} LIKE ${p(t)}`);
  }
  if (Number(q.precio_max) > 0) where.push(`m.precio_dia <= ${p(Number(q.precio_max))}`);
  if (q.disponibles === '1') where.push(`m.estado = 'disponible'`);
  if (q.excluir) where.push(`m.id <> ${p(id(q.excluir))}`);
  if (q.proveedor) where.push(`m.proveedor_id = ${p(id(q.proveedor))}`);
  // Filtro Estado/Ciudad: lista exacta de textos de ubicación (ver /api/maquinaria/filtros)
  if (q.ciudades) where.push(`m.ciudad = ANY(${p([].concat(q.ciudades).map(String).slice(0, 200))})`);

  const ORDENES = {
    recientes: 'm.created_at DESC',
    'precio-asc': 'm.precio_dia ASC',
    'precio-desc': 'm.precio_dia DESC',
    calificacion: 'r.promedio DESC NULLS LAST, r.resenas DESC',
    destacadas: `(m.estado = 'disponible') DESC, m.destacado DESC, r.promedio DESC NULLS LAST, m.created_at DESC`
  };
  const orden = ORDENES[q.orden] || ORDENES.recientes;
  const limite = Math.min(48, Math.max(1, id(q.limite) || 12));
  const pagina = Math.max(1, id(q.pagina) || 1);
  const filtro = `WHERE ${where.join(' AND ')}`;

  const [{ rows: items }, { rows: [{ total }] }] = await Promise.all([
    pool.query(`${SELECT_MAQUINA} ${filtro} ORDER BY ${orden}, m.id DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, vals),
    pool.query(`SELECT count(*)::int AS total FROM maquinaria m JOIN usuarios u ON u.id = m.proveedor_id ${filtro}`, vals)
  ]);
  res.json({ items, total, pagina, paginas: Math.max(1, Math.ceil(total / limite)) });
}));

app.get('/api/maquinaria/filtros', ah(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT m.ciudad FROM maquinaria m JOIN usuarios u ON u.id = m.proveedor_id
     WHERE NOT u.suspendido ORDER BY m.ciudad`);
  const { rows: [r] } = await pool.query('SELECT COALESCE(max(precio_dia), 0)::float AS precio_max FROM maquinaria');
  const ciudades = rows.map((x) => x.ciudad);
  res.json({ ciudades, estados: agruparUbicaciones(ciudades), precio_max: r.precio_max });
}));

app.get('/api/maquinaria/:id', ah(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_MAQUINA} WHERE m.id = $1 AND NOT u.suspendido`, [id(req.params.id)]);
  const m = rows[0];
  if (!m) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  const { rows: [prov] } = await pool.query(
    `SELECT u.created_at AS proveedor_desde,
            (SELECT round(avg(calificacion), 1)::float FROM resenas WHERE proveedor_id = u.id) AS proveedor_promedio,
            (SELECT count(*)::int FROM resenas WHERE proveedor_id = u.id) AS proveedor_resenas,
            (SELECT count(*)::int FROM solicitudes s JOIN maquinaria mm ON mm.id = s.maquina_id
              WHERE mm.proveedor_id = u.id AND s.estado = 'aceptada') AS proveedor_rentas
     FROM usuarios u WHERE u.id = $1`, [m.proveedor_id]);
  res.json({ ...m, ...prov });
}));

// Pública: se usa directo en <img src>. La URL lleva ?v= para refrescar la caché al cambiar la foto.
app.get('/api/maquinaria/:id/foto', ah(async (req, res) => {
  const { rows: [m] } = await pool.query('SELECT foto, foto_tipo FROM maquinaria WHERE id = $1', [id(req.params.id)]);
  if (!m?.foto) return res.status(404).json({ error: 'Sin foto.' });
  res.set({ 'Content-Type': m.foto_tipo, 'Cache-Control': 'public, max-age=31536000, immutable' }).send(m.foto);
}));

app.get('/api/maquinaria/:id/ocupadas', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT to_char(fecha_inicio, 'YYYY-MM-DD') AS inicio, to_char(fecha_fin, 'YYYY-MM-DD') AS fin
     FROM solicitudes WHERE maquina_id = $1 AND estado = 'aceptada' AND fecha_fin >= ${HOY}
     ORDER BY fecha_inicio`, [id(req.params.id)]);
  res.json(rows);
}));

app.get('/api/maquinaria/:id/resenas', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.calificacion, r.comentario, r.created_at, u.nombre AS cliente_nombre
     FROM resenas r JOIN usuarios u ON u.id = r.cliente_id
     WHERE r.maquina_id = $1 ORDER BY r.created_at DESC LIMIT 50`, [id(req.params.id)]);
  res.json(rows);
}));

app.post('/api/contacto', ah(async (req, res) => {
  const nombre = texto(req.body.nombre, 120);
  const email = texto(req.body.email, 200);
  const asunto = texto(req.body.asunto, 160);
  const mensaje = texto(req.body.mensaje, 4000);
  if (!nombre || !email || !mensaje) return res.status(400).json({ error: 'Completa nombre, correo y mensaje.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Escribe un correo válido.' });
  await pool.query('INSERT INTO contactos (nombre, email, asunto, mensaje) VALUES ($1, $2, $3, $4)', [nombre, email, asunto, mensaje]);
  const { rows: admins } = await pool.query(`SELECT id FROM usuarios WHERE rol = 'admin'`);
  for (const a of admins) notificar(a.id, { tipo: 'contacto', titulo: 'Nuevo mensaje de contacto', mensaje: `${nombre}: ${asunto || mensaje.slice(0, 80)}`, enlace: '#/admin/contacto' }, { correo: false });
  res.status(201).json({ ok: true });
}));

// ---------- notificaciones ----------
app.get('/api/notificaciones', auth(), ah(async (req, res) => {
  const [{ rows: items }, { rows: [{ n }] }] = await Promise.all([
    pool.query('SELECT * FROM notificaciones WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 30', [req.usuario.id]),
    pool.query('SELECT count(*)::int AS n FROM notificaciones WHERE usuario_id = $1 AND NOT leida', [req.usuario.id])
  ]);
  res.json({ items, no_leidas: n });
}));

app.patch('/api/notificaciones/leer-todas', auth(), ah(async (req, res) => {
  await pool.query('UPDATE notificaciones SET leida = true WHERE usuario_id = $1 AND NOT leida', [req.usuario.id]);
  res.json({ ok: true });
}));

app.patch('/api/notificaciones/:id/leer', auth(), ah(async (req, res) => {
  await pool.query('UPDATE notificaciones SET leida = true WHERE id = $1 AND usuario_id = $2', [id(req.params.id), req.usuario.id]);
  res.json({ ok: true });
}));

// ---------- favoritos ----------
app.get('/api/favoritos', auth(), ah(async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT_MAQUINA} JOIN favoritos f ON f.maquina_id = m.id
     WHERE f.usuario_id = $1 AND NOT u.suspendido ORDER BY f.created_at DESC`, [req.usuario.id]);
  res.json(rows);
}));

app.get('/api/favoritos/ids', auth(), ah(async (req, res) => {
  const { rows } = await pool.query('SELECT maquina_id FROM favoritos WHERE usuario_id = $1', [req.usuario.id]);
  res.json(rows.map((r) => r.maquina_id));
}));

app.post('/api/favoritos/:id', auth(), ah(async (req, res) => {
  try {
    await pool.query('INSERT INTO favoritos (usuario_id, maquina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.usuario.id, id(req.params.id)]);
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'Maquinaria no encontrada.' });
    throw e;
  }
  res.status(201).json({ ok: true });
}));

app.delete('/api/favoritos/:id', auth(), ah(async (req, res) => {
  await pool.query('DELETE FROM favoritos WHERE usuario_id = $1 AND maquina_id = $2', [req.usuario.id, id(req.params.id)]);
  res.status(204).end();
}));

// ---------- chat por solicitud ----------
async function accesoSolicitud(solId, usuarioId) {
  const { rows: [s] } = await pool.query(
    `SELECT s.id, s.cliente_id, m.proveedor_id, m.nombre AS maquina_nombre
     FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id WHERE s.id = $1`, [solId]);
  if (!s || (s.cliente_id !== usuarioId && s.proveedor_id !== usuarioId)) return null;
  return s;
}

// Bandeja de mensajes: una conversación por renta, con el último mensaje y los no leídos
app.get('/api/conversaciones', auth(), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.estado, s.maquina_id, to_char(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            m.nombre AS maquina_nombre, m.categoria, (m.foto IS NOT NULL) AS tiene_foto, m.foto_v, cat.imagen AS categoria_imagen,
            (s.cliente_id = $1) AS soy_cliente,
            CASE WHEN s.cliente_id = $1 THEN COALESCE(NULLIF(p.empresa, ''), p.nombre) ELSE COALESCE(NULLIF(s.nombre_contacto, ''), c.nombre) END AS otro_nombre,
            ult.texto AS ultimo_texto, ult.created_at AS ultimo_en, (ult.autor_id = $1) AS ultimo_mio,
            (SELECT count(*)::int FROM mensajes mj WHERE mj.solicitud_id = s.id AND mj.autor_id <> $1 AND NOT mj.leido) AS no_leidos
     FROM solicitudes s
     JOIN maquinaria m ON m.id = s.maquina_id
     JOIN usuarios p ON p.id = m.proveedor_id
     JOIN usuarios c ON c.id = s.cliente_id
     LEFT JOIN categorias cat ON cat.nombre = m.categoria
     LEFT JOIN LATERAL (SELECT texto, created_at, autor_id FROM mensajes WHERE solicitud_id = s.id ORDER BY id DESC LIMIT 1) ult ON true
     WHERE s.cliente_id = $1 OR m.proveedor_id = $1
     ORDER BY COALESCE(ult.created_at, s.created_at) DESC
     LIMIT 200`, [req.usuario.id]);
  res.json(rows);
}));

app.get('/api/solicitudes/:id/mensajes', auth(), ah(async (req, res) => {
  const s = await accesoSolicitud(id(req.params.id), req.usuario.id);
  if (!s) return res.status(404).json({ error: 'Conversación no encontrada.' });
  await pool.query('UPDATE mensajes SET leido = true WHERE solicitud_id = $1 AND autor_id <> $2 AND NOT leido', [s.id, req.usuario.id]);
  const { rows } = await pool.query(
    `SELECT mj.id, mj.autor_id, mj.texto, mj.created_at, u.nombre AS autor_nombre
     FROM mensajes mj JOIN usuarios u ON u.id = mj.autor_id
     WHERE mj.solicitud_id = $1 ORDER BY mj.created_at, mj.id`, [s.id]);
  res.json(rows);
}));

app.post('/api/solicitudes/:id/mensajes', auth(), ah(async (req, res) => {
  const s = await accesoSolicitud(id(req.params.id), req.usuario.id);
  if (!s) return res.status(404).json({ error: 'Conversación no encontrada.' });
  const t = texto(req.body.texto, 2000);
  if (!t) return res.status(400).json({ error: 'Escribe un mensaje.' });
  const { rows: [msg] } = await pool.query(
    'INSERT INTO mensajes (solicitud_id, autor_id, texto) VALUES ($1, $2, $3) RETURNING *', [s.id, req.usuario.id, t]);

  const destino = req.usuario.id === s.cliente_id ? s.proveedor_id : s.cliente_id;
  const enlace = `#/mensajes/${s.id}`; // abre la conversación en el apartado Mensajes
  // Una sola notificación sin leer por conversación, para no saturar
  const { rows: [ya] } = await pool.query(
    `SELECT 1 FROM notificaciones WHERE usuario_id = $1 AND tipo = 'mensaje' AND enlace = $2 AND NOT leida`, [destino, enlace]);
  if (!ya) {
    const { rows: [autor] } = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id]);
    notificar(destino, { tipo: 'mensaje', titulo: `Nuevo mensaje de ${autor.nombre.split(' ')[0]}`, mensaje: `Sobre "${s.maquina_nombre}": ${t.slice(0, 120)}`, enlace });
  }
  res.status(201).json(msg);
}));

// ---------- dashboard proveedor ----------
const proveedor = express.Router();
proveedor.use(auth('proveedor'));

proveedor.get('/resumen', ah(async (req, res) => {
  const pid = req.usuario.id;
  const { rows: [m] } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE estado = 'disponible')::int AS disponibles,
            count(*) FILTER (WHERE estado = 'rentada')::int AS rentadas,
            count(*) FILTER (WHERE estado = 'por_liberar')::int AS por_liberar
     FROM maquinaria WHERE proveedor_id = $1`, [pid]);
  const { rows: [s] } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE s.estado = 'pendiente')::int AS pendientes,
            count(*) FILTER (WHERE s.estado = 'aceptada')::int AS aceptadas,
            COALESCE(sum(m.precio_dia * s.dias) FILTER (WHERE s.estado = 'aceptada'), 0)::float AS ingresos
     FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE m.proveedor_id = $1`, [pid]);
  const { rows: [r] } = await pool.query(
    'SELECT round(avg(calificacion), 1)::float AS promedio, count(*)::int AS total FROM resenas WHERE proveedor_id = $1', [pid]);
  res.json({ maquinaria: m, solicitudes: s, resenas: r });
}));

// Ingresos de rentas aceptadas por mes (últimos 12 meses, según la fecha de inicio)
proveedor.get('/ingresos', ah(async (req, res) => {
  const { rows } = await pool.query(
    `WITH meses AS (
       SELECT generate_series(date_trunc('month', ${HOY}) - interval '11 months', date_trunc('month', ${HOY}), interval '1 month')::date AS mes
     )
     SELECT to_char(meses.mes, 'YYYY-MM') AS mes,
            COALESCE(sum(m.precio_dia * s.dias), 0)::float AS ingresos,
            count(s.id)::int AS rentas
     FROM meses
     LEFT JOIN solicitudes s ON date_trunc('month', s.fecha_inicio) = meses.mes AND s.estado = 'aceptada'
       AND s.maquina_id IN (SELECT id FROM maquinaria WHERE proveedor_id = $1)
     LEFT JOIN maquinaria m ON m.id = s.maquina_id
     GROUP BY meses.mes ORDER BY meses.mes`, [req.usuario.id]);
  res.json(rows);
}));

proveedor.get('/maquinaria', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.proveedor_id, m.nombre, m.categoria, m.ciudad, m.precio_dia, m.descripcion, m.specs, m.estado,
            m.destacado, m.created_at, (m.foto IS NOT NULL) AS tiene_foto, m.foto_v, c.imagen AS categoria_imagen,
       (SELECT count(*)::int FROM solicitudes s WHERE s.maquina_id = m.id AND s.estado = 'pendiente') AS pendientes,
       (SELECT round(avg(calificacion), 1)::float FROM resenas WHERE maquina_id = m.id) AS promedio,
       (SELECT count(*)::int FROM resenas WHERE maquina_id = m.id) AS resenas
     FROM maquinaria m LEFT JOIN categorias c ON c.nombre = m.categoria
     WHERE m.proveedor_id = $1 ORDER BY m.created_at DESC`, [req.usuario.id]);
  res.json(rows);
}));

proveedor.post('/maquinaria', ah(async (req, res) => {
  const { error, datos } = validarMaquina(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `INSERT INTO maquinaria (proveedor_id, nombre, categoria, ciudad, precio_dia, descripcion, specs, estado, destacado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, false)) RETURNING id`,
    [req.usuario.id, datos.nombre, datos.categoria, datos.ciudad, datos.precio_dia, datos.descripcion, datos.specs, datos.estado,
     datos.destacado]
  );
  res.status(201).json(rows[0]);
}));

proveedor.put('/maquinaria/:id', ah(async (req, res) => {
  const { error, datos } = validarMaquina(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `UPDATE maquinaria SET nombre=$1, categoria=$2, ciudad=$3, precio_dia=$4, descripcion=$5, specs=$6, estado=$7,
       destacado = COALESCE($10, destacado)
     WHERE id = $8 AND proveedor_id = $9 RETURNING id`,
    [datos.nombre, datos.categoria, datos.ciudad, datos.precio_dia, datos.descripcion, datos.specs, datos.estado,
     id(req.params.id), req.usuario.id, datos.destacado]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.json(rows[0]);
}));

proveedor.patch('/maquinaria/:id/estado', ah(async (req, res) => {
  if (!ESTADOS_MAQUINA.includes(req.body.estado)) return res.status(400).json({ error: 'Estado inválido.' });
  const { rows } = await pool.query(
    'UPDATE maquinaria SET estado = $1 WHERE id = $2 AND proveedor_id = $3 RETURNING id, estado',
    [req.body.estado, id(req.params.id), req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.json(rows[0]);
}));

// Verificación automática: la app lee la INE (OCR en el dispositivo) y manda nombre, apellidos y CURP.
// Aquí se valida la CURP, que coincida con el nombre, la mayoría de edad, y se calcula el RFC con homoclave.
proveedor.post('/verificacion', ah(async (req, res) => {
  const { error, datos } = verificarIdentidad(req.body);
  if (error) return res.status(400).json({ error });
  const { rows: [otro] } = await pool.query('SELECT 1 FROM usuarios WHERE curp = $1 AND id <> $2', [datos.curp, req.usuario.id]);
  if (otro) return res.status(409).json({ error: 'Esa CURP ya está registrada en otra cuenta.' });
  const { rows: [u] } = await pool.query(
    `UPDATE usuarios SET nombre_legal = $1, curp = $2, rfc = $3, fecha_nacimiento = $4, verificado = true, verificado_en = now()
     WHERE id = $5 RETURNING *`,
    [datos.nombre_legal, datos.curp, datos.rfc, datos.fecha_nacimiento, req.usuario.id]);
  notificar(u.id, { tipo: 'verificado', titulo: '¡Tu cuenta fue verificada!', mensaje: `Verificamos tu identidad. Tu RFC es ${datos.rfc}. Tus equipos ya muestran la insignia de proveedor verificado.`, enlace: '#/panel' });
  res.json(publico(u));
}));

// Foto del equipo: se guarda en PostgreSQL (BYTEA), igual que en el backend de Kevin,
// así las fotos subidas desde la app Flutter o desde esta web se ven en ambas.
proveedor.put('/maquinaria/:id/foto', express.raw({ type: 'image/*', limit: '4mb' }), ah(async (req, res) => {
  const b = req.body;
  if (!Buffer.isBuffer(b) || b.length < 12) return res.status(400).json({ error: 'Imagen inválida.' });
  const tipo = b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg'
    : b.subarray(1, 4).toString() === 'PNG' ? 'image/png'
    : b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
  if (!tipo) return res.status(415).json({ error: 'Formato no soportado (usa JPG, PNG o WEBP).' });
  const { rows } = await pool.query(
    'UPDATE maquinaria SET foto = $1, foto_tipo = $2, foto_v = foto_v + 1 WHERE id = $3 AND proveedor_id = $4 RETURNING foto_v',
    [b, tipo, id(req.params.id), req.usuario.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.json({ ok: true, foto_v: rows[0].foto_v });
}));

proveedor.delete('/maquinaria/:id/foto', ah(async (req, res) => {
  const { rowCount } = await pool.query(
    'UPDATE maquinaria SET foto = NULL, foto_tipo = NULL, foto_v = foto_v + 1 WHERE id = $1 AND proveedor_id = $2',
    [id(req.params.id), req.usuario.id]);
  if (!rowCount) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.status(204).end();
}));

proveedor.delete('/maquinaria/:id', ah(async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM maquinaria WHERE id = $1 AND proveedor_id = $2', [id(req.params.id), req.usuario.id]);
  if (!rowCount) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.status(204).end();
}));

const COLS_FECHAS = `to_char(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin`;

proveedor.get('/solicitudes', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.maquina_id, s.cliente_id, s.nombre_contacto, s.telefono, s.dias, s.mensaje, s.estado, s.created_at,
            ${COLS_FECHAS},
            m.nombre AS maquina_nombre, m.precio_dia, m.estado AS maquina_estado,
            c.nombre AS cliente_nombre, c.email AS cliente_email,
            r.calificacion AS resena_calificacion, r.comentario AS resena_comentario,
            ext.id AS ext_id, to_char(ext.nueva_fin, 'YYYY-MM-DD') AS ext_nueva_fin, ext.dias_extra AS ext_dias, ext.estado AS ext_estado,
            (SELECT count(*)::int FROM mensajes mj WHERE mj.solicitud_id = s.id AND mj.autor_id <> $1 AND NOT mj.leido) AS no_leidos
     FROM solicitudes s
     JOIN maquinaria m ON m.id = s.maquina_id
     JOIN usuarios c ON c.id = s.cliente_id
     LEFT JOIN resenas r ON r.solicitud_id = s.id
     LEFT JOIN LATERAL (SELECT * FROM extensiones e WHERE e.solicitud_id = s.id ORDER BY e.id DESC LIMIT 1) ext ON true
     WHERE m.proveedor_id = $1
     ORDER BY (s.estado = 'pendiente' OR ext.estado = 'pendiente') DESC, s.created_at DESC`, [req.usuario.id]);
  res.json(rows);
}));

// Proveedor: aceptar o rechazar una petición de más días. Al aceptar, la misma renta se alarga.
proveedor.patch('/extensiones/:id', ah(async (req, res) => {
  const estado = req.body.estado;
  if (!['aceptada', 'rechazada'].includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });
  const db = await pool.connect();
  let e;
  try {
    await db.query('BEGIN');
    ({ rows: [e] } = await db.query(
      `SELECT e.id, e.solicitud_id, e.dias_extra, to_char(e.nueva_fin, 'YYYY-MM-DD') AS nueva_fin,
              s.cliente_id, s.maquina_id, to_char(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin, m.nombre AS maquina_nombre, m.precio_dia
       FROM extensiones e JOIN solicitudes s ON s.id = e.solicitud_id JOIN maquinaria m ON m.id = s.maquina_id
       WHERE e.id = $1 AND m.proveedor_id = $2 AND e.estado = 'pendiente' FOR UPDATE OF e`,
      [id(req.params.id), req.usuario.id]));
    if (!e) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'La petición ya no está pendiente.' });
    }
    if (estado === 'aceptada') {
      const { rows: [choque] } = await db.query(
        `SELECT 1 FROM solicitudes WHERE maquina_id = $1 AND id <> $2 AND estado = 'aceptada'
           AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL
           AND daterange(fecha_inicio, fecha_fin, '[]') && daterange($3::date + 1, $4::date, '[]')`,
        [e.maquina_id, e.solicitud_id, e.fecha_fin, e.nueva_fin]);
      if (choque) {
        await db.query('ROLLBACK');
        return res.status(409).json({ error: 'Esos días ya están rentados a otro cliente. Rechaza la petición o platícalo por el chat.' });
      }
      await db.query('UPDATE solicitudes SET fecha_fin = $1, dias = dias + $2 WHERE id = $3', [e.nueva_fin, e.dias_extra, e.solicitud_id]);
    }
    await db.query('UPDATE extensiones SET estado = $1, respondida_en = now() WHERE id = $2', [estado, e.id]);
    const fin = e.nueva_fin;
    await db.query('INSERT INTO mensajes (solicitud_id, autor_id, texto) VALUES ($1, $2, $3)', [e.solicitud_id, req.usuario.id,
      estado === 'aceptada' ? `✅ Acepté extender la renta hasta el ${fin} (+${e.dias_extra} día(s)).` : `❌ No puedo extender la renta hasta el ${fin}.`]);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
  notificar(e.cliente_id, estado === 'aceptada'
    ? { tipo: 'aceptada', titulo: 'Te dieron más días', mensaje: `El proveedor aceptó extender la renta de "${e.maquina_nombre}" ${e.dias_extra} día(s) más.`, enlace: `#/mis-rentas/${e.solicitud_id}` }
    : { tipo: 'rechazada', titulo: 'No se pudo extender tu renta', mensaje: `El proveedor no aceptó extender la renta de "${e.maquina_nombre}". Puedes platicarlo por el chat.`, enlace: `#/mis-rentas/${e.solicitud_id}` });
  res.json({ ok: true });
}));

proveedor.patch('/solicitudes/:id', ah(async (req, res) => {
  const estado = req.body.estado;
  if (!['aceptada', 'rechazada'].includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });
  const cliente = await pool.connect();
  let sol;
  try {
    await cliente.query('BEGIN');
    const { rows: [s] } = await cliente.query(
      `SELECT s.*, m.nombre AS maquina_nombre FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
       WHERE s.id = $1 AND m.proveedor_id = $2 AND s.estado = 'pendiente' FOR UPDATE OF s`,
      [id(req.params.id), req.usuario.id]);
    if (!s) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada o ya respondida.' });
    }
    // Las solicitudes sin fechas (p. ej. creadas desde la app Flutter) no se revisan por choque
    if (estado === 'aceptada' && s.fecha_inicio && s.fecha_fin) {
      const { rows: [choque] } = await cliente.query(
        `SELECT 1 FROM solicitudes WHERE maquina_id = $1 AND estado = 'aceptada' AND id <> $2
           AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL
           AND daterange(fecha_inicio, fecha_fin, '[]') && daterange($3::date, $4::date, '[]')`,
        [s.maquina_id, s.id, s.fecha_inicio, s.fecha_fin]);
      if (choque) {
        await cliente.query('ROLLBACK');
        return res.status(409).json({ error: 'Ya aceptaste otra renta de este equipo en esas fechas.' });
      }
    }
    await cliente.query('UPDATE solicitudes SET estado = $1 WHERE id = $2', [estado, s.id]);
    if (estado === 'aceptada') {
      await cliente.query(
        `UPDATE maquinaria SET estado = 'rentada' WHERE id = $1 AND COALESCE($2::date, ${HOY}) <= ${HOY}`, [s.maquina_id, s.fecha_inicio]);
    }
    await cliente.query('COMMIT');
    sol = { ...s, estado };
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
  notificar(sol.cliente_id, estado === 'aceptada'
    ? { tipo: 'aceptada', titulo: '¡Tu solicitud fue aceptada!', mensaje: `El proveedor aceptó tu renta de "${sol.maquina_nombre}". Escríbele por el chat para coordinar la entrega.`, enlace: `#/mis-rentas/${sol.id}` }
    : { tipo: 'rechazada', titulo: 'Tu solicitud fue rechazada', mensaje: `El proveedor no puede atender tu renta de "${sol.maquina_nombre}". Busca otras opciones en el catálogo.`, enlace: `#/mis-rentas/${sol.id}` });
  res.json(sol);
}));

app.use('/api/proveedor', proveedor);

// ---------- dashboard cliente ----------
const clienteR = express.Router();
clienteR.use(auth('cliente'));

clienteR.get('/solicitudes', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.maquina_id, s.cliente_id, s.nombre_contacto, s.telefono, s.dias, s.mensaje, s.estado, s.created_at,
            ${COLS_FECHAS},
            m.nombre AS maquina_nombre, m.categoria, m.ciudad, m.precio_dia, m.estado AS maquina_estado,
            p.nombre AS proveedor_nombre, p.empresa AS proveedor_empresa, p.email AS proveedor_email,
            p.telefono AS proveedor_telefono, p.verificado AS proveedor_verificado,
            r.calificacion AS resena_calificacion, r.comentario AS resena_comentario,
            ext.id AS ext_id, to_char(ext.nueva_fin, 'YYYY-MM-DD') AS ext_nueva_fin, ext.dias_extra AS ext_dias, ext.estado AS ext_estado,
            (SELECT count(*)::int FROM mensajes mj WHERE mj.solicitud_id = s.id AND mj.autor_id <> $1 AND NOT mj.leido) AS no_leidos
     FROM solicitudes s
     JOIN maquinaria m ON m.id = s.maquina_id
     JOIN usuarios p ON p.id = m.proveedor_id
     LEFT JOIN resenas r ON r.solicitud_id = s.id
     LEFT JOIN LATERAL (SELECT * FROM extensiones e WHERE e.solicitud_id = s.id ORDER BY e.id DESC LIMIT 1) ext ON true
     WHERE s.cliente_id = $1
     ORDER BY s.created_at DESC`, [req.usuario.id]);
  res.json(rows);
}));

clienteR.post('/solicitudes', ah(async (req, res) => {
  const maquinaId = id(req.body.maquina_id);
  const nombre = texto(req.body.nombre_contacto, 120);
  const telefono = telefonoMx(req.body.telefono);
  const { fecha_inicio: ini, fecha_fin: fin } = req.body;
  const mensaje = texto(req.body.mensaje);

  if (!nombre) return res.status(400).json({ error: 'Escribe tu nombre.' });
  if (!telefono) return res.status(400).json({ error: ERROR_TELEFONO });
  if (!fechaValida(ini) || !fechaValida(fin)) return res.status(400).json({ error: 'Elige las fechas de inicio y fin.' });

  const { rows: [f] } = await pool.query(
    `SELECT ($1::date < ${HOY}) AS pasado, ($2::date - $1::date + 1) AS dias`, [ini, fin]);
  if (f.pasado) return res.status(400).json({ error: 'La fecha de inicio no puede ser anterior a hoy.' });
  if (!(f.dias >= 1 && f.dias <= 365)) return res.status(400).json({ error: 'El periodo debe ser de 1 a 365 días.' });

  const { rows: [m] } = await pool.query(
    `SELECT m.id, m.nombre, m.proveedor_id FROM maquinaria m JOIN usuarios u ON u.id = m.proveedor_id
     WHERE m.id = $1 AND NOT u.suspendido`, [maquinaId]);
  if (!m) return res.status(404).json({ error: 'Maquinaria no encontrada.' });

  const { rows: [choque] } = await pool.query(
    `SELECT 1 FROM solicitudes WHERE maquina_id = $1 AND estado = 'aceptada'
       AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL
           AND daterange(fecha_inicio, fecha_fin, '[]') && daterange($2::date, $3::date, '[]')`, [maquinaId, ini, fin]);
  if (choque) return res.status(409).json({ error: 'El equipo ya está rentado en parte de esas fechas. Elige otras.' });

  const { rows: [dup] } = await pool.query(
    `SELECT 1 FROM solicitudes WHERE maquina_id = $1 AND cliente_id = $2 AND estado = 'pendiente'`,
    [maquinaId, req.usuario.id]);
  if (dup) return res.status(409).json({ error: 'Ya tienes una solicitud pendiente para este equipo.' });

  const { rows } = await pool.query(
    `INSERT INTO solicitudes (maquina_id, cliente_id, nombre_contacto, telefono, dias, mensaje, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [maquinaId, req.usuario.id, nombre, telefono, f.dias, mensaje, ini, fin]
  );
  notificar(m.proveedor_id, {
    tipo: 'solicitud',
    titulo: 'Nueva solicitud de renta',
    mensaje: `${nombre} quiere rentar "${m.nombre}" por ${f.dias} día(s), del ${ini} al ${fin}.`,
    enlace: `#/panel/solicitud/${rows[0].id}`
  });
  res.status(201).json(rows[0]);
}));

// Cliente: pedir más días en una renta aceptada que no ha terminado
clienteR.post('/solicitudes/:id/extension', ah(async (req, res) => {
  const nuevaFin = req.body.nueva_fin;
  if (!fechaValida(nuevaFin)) return res.status(400).json({ error: 'Elige la nueva fecha de fin.' });
  const { rows: [s] } = await pool.query(
    `SELECT s.id, s.maquina_id, s.estado, s.nombre_contacto, m.nombre AS maquina_nombre, m.precio_dia, m.proveedor_id,
            ($1::date - s.fecha_fin) AS dias_extra, (s.fecha_fin < ${HOY}) AS terminada
     FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE s.id = $2 AND s.cliente_id = $3 AND s.fecha_fin IS NOT NULL`, [nuevaFin, id(req.params.id), req.usuario.id]);
  if (!s) return res.status(404).json({ error: 'Renta no encontrada.' });
  if (s.estado !== 'aceptada') return res.status(400).json({ error: 'Solo puedes pedir más días en una renta aceptada.' });
  if (s.terminada) return res.status(400).json({ error: 'Esta renta ya terminó. Haz una solicitud nueva.' });
  if (!(s.dias_extra >= 1 && s.dias_extra <= 365)) return res.status(400).json({ error: 'La nueva fecha debe ser posterior a la fecha de fin actual.' });
  const { rows: [pend] } = await pool.query("SELECT 1 FROM extensiones WHERE solicitud_id = $1 AND estado = 'pendiente'", [s.id]);
  if (pend) return res.status(409).json({ error: 'Ya tienes una petición de más días esperando respuesta.' });
  const { rows: [choque] } = await pool.query(
    `SELECT 1 FROM solicitudes s2 JOIN solicitudes s ON s.id = $2
     WHERE s2.maquina_id = s.maquina_id AND s2.id <> s.id AND s2.estado = 'aceptada'
       AND s2.fecha_inicio IS NOT NULL AND s2.fecha_fin IS NOT NULL
       AND daterange(s2.fecha_inicio, s2.fecha_fin, '[]') && daterange(s.fecha_fin + 1, $1::date, '[]')`, [nuevaFin, s.id]);
  if (choque) return res.status(409).json({ error: 'El equipo ya está rentado en parte de esos días. Elige una fecha más cercana.' });

  const { rows: [e] } = await pool.query(
    'INSERT INTO extensiones (solicitud_id, nueva_fin, dias_extra) VALUES ($1, $2, $3) RETURNING id', [s.id, nuevaFin, s.dias_extra]);
  const extra = Number(s.precio_dia) * s.dias_extra;
  await pool.query('INSERT INTO mensajes (solicitud_id, autor_id, texto) VALUES ($1, $2, $3)', [s.id, req.usuario.id,
    `📅 Pedí extender la renta hasta el ${nuevaFin} (+${s.dias_extra} día(s), $${extra.toLocaleString('es-MX')} más).`]);
  notificar(s.proveedor_id, {
    tipo: 'solicitud', titulo: 'Piden más días de renta',
    mensaje: `${s.nombre_contacto} quiere extender la renta de "${s.maquina_nombre}" hasta el ${nuevaFin} (+${s.dias_extra} día(s)).`,
    enlace: `#/panel/solicitud/${s.id}`
  });
  res.status(201).json(e);
}));

clienteR.patch('/extensiones/:id/cancelar', ah(async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE extensiones e SET estado = 'cancelada', respondida_en = now() FROM solicitudes s
     WHERE e.id = $1 AND s.id = e.solicitud_id AND s.cliente_id = $2 AND e.estado = 'pendiente'`, [id(req.params.id), req.usuario.id]);
  if (!rowCount) return res.status(404).json({ error: 'La petición ya no está pendiente.' });
  res.json({ ok: true });
}));

clienteR.patch('/solicitudes/:id/cancelar', ah(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE solicitudes s SET estado = 'cancelada'
     FROM maquinaria m
     WHERE s.id = $1 AND s.cliente_id = $2 AND s.estado = 'pendiente' AND m.id = s.maquina_id
     RETURNING s.id, m.proveedor_id, m.nombre AS maquina_nombre, s.nombre_contacto`,
    [id(req.params.id), req.usuario.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Solo puedes cancelar solicitudes pendientes.' });
  const s = rows[0];
  notificar(s.proveedor_id, { tipo: 'cancelada', titulo: 'Solicitud cancelada', mensaje: `${s.nombre_contacto} canceló su solicitud de "${s.maquina_nombre}".`, enlace: `#/panel/solicitud/${s.id}` }, { correo: false });
  res.json(s);
}));

clienteR.post('/solicitudes/:id/resena', ah(async (req, res) => {
  const calificacion = Math.round(Number(req.body.calificacion));
  const comentario = texto(req.body.comentario, 1000);
  if (!(calificacion >= 1 && calificacion <= 5)) return res.status(400).json({ error: 'Elige de 1 a 5 estrellas.' });
  const { rows: [s] } = await pool.query(
    `SELECT s.id, s.maquina_id, m.proveedor_id, m.nombre AS maquina_nombre FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE s.id = $1 AND s.cliente_id = $2 AND s.estado = 'aceptada'`, [id(req.params.id), req.usuario.id]);
  if (!s) return res.status(404).json({ error: 'Solo puedes calificar rentas aceptadas.' });
  try {
    await pool.query(
      `INSERT INTO resenas (solicitud_id, maquina_id, cliente_id, proveedor_id, calificacion, comentario)
       VALUES ($1, $2, $3, $4, $5, $6)`, [s.id, s.maquina_id, req.usuario.id, s.proveedor_id, calificacion, comentario]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya calificaste esta renta.' });
    throw e;
  }
  notificar(s.proveedor_id, { tipo: 'resena', titulo: `Nueva reseña: ${'★'.repeat(calificacion)}`, mensaje: `Calificaron tu renta de "${s.maquina_nombre}".${comentario ? ` "${comentario.slice(0, 120)}"` : ''}`, enlace: `#/maquina/${s.maquina_id}` }, { correo: false });
  res.status(201).json({ ok: true });
}));

app.use('/api/cliente', clienteR);

// ---------- administración ----------
const admin = express.Router();
admin.use(auth('admin'));

admin.get('/resumen', ah(async (_req, res) => {
  const { rows: [r] } = await pool.query(`
    SELECT (SELECT count(*)::int FROM usuarios WHERE rol = 'cliente') AS clientes,
           (SELECT count(*)::int FROM usuarios WHERE rol = 'proveedor') AS proveedores,
           (SELECT count(*)::int FROM usuarios WHERE rol = 'proveedor' AND NOT verificado) AS por_verificar,
           (SELECT count(*)::int FROM usuarios WHERE suspendido) AS suspendidos,
           (SELECT count(*)::int FROM maquinaria) AS maquinas,
           (SELECT count(*)::int FROM solicitudes) AS solicitudes,
           (SELECT count(*)::int FROM solicitudes WHERE estado = 'pendiente') AS pendientes,
           (SELECT count(*)::int FROM resenas) AS resenas,
           (SELECT count(*)::int FROM contactos WHERE NOT atendido) AS contactos_pendientes`);
  res.json(r);
}));

admin.get('/usuarios', ah(async (req, res) => {
  const vals = [];
  const where = [];
  if (['cliente', 'proveedor', 'admin'].includes(req.query.rol)) { vals.push(req.query.rol); where.push(`u.rol = $${vals.length}`); }
  if (req.query.q) {
    vals.push(`%${String(req.query.q).toLowerCase()}%`);
    where.push(`(lower(u.nombre) LIKE $${vals.length} OR lower(u.email) LIKE $${vals.length} OR lower(COALESCE(u.empresa, '')) LIKE $${vals.length})`);
  }
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.email, u.rol, u.empresa, u.telefono, u.verificado, u.suspendido, u.created_at,
            u.nombre_legal, u.curp, u.rfc, u.verificado_en,
            (SELECT count(*)::int FROM maquinaria WHERE proveedor_id = u.id) AS maquinas,
            (SELECT count(*)::int FROM solicitudes WHERE cliente_id = u.id) AS solicitudes,
            (SELECT round(avg(calificacion), 1)::float FROM resenas WHERE proveedor_id = u.id) AS promedio
     FROM usuarios u ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.created_at DESC LIMIT 200`, vals);
  res.json(rows);
}));

admin.patch('/usuarios/:id', ah(async (req, res) => {
  const uid = id(req.params.id);
  if (uid === req.usuario.id) return res.status(400).json({ error: 'No puedes modificar tu propia cuenta desde aquí.' });
  const { rows: [antes] } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [uid]);
  if (!antes) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const verificado = typeof req.body.verificado === 'boolean' ? req.body.verificado : antes.verificado;
  const suspendido = typeof req.body.suspendido === 'boolean' ? req.body.suspendido : antes.suspendido;
  const { rows: [u] } = await pool.query(
    'UPDATE usuarios SET verificado = $1, suspendido = $2 WHERE id = $3 RETURNING *', [verificado, suspendido, uid]);
  if (verificado && !antes.verificado) {
    notificar(uid, { tipo: 'verificado', titulo: '¡Tu cuenta fue verificada!', mensaje: 'Ahora tus equipos muestran la insignia de proveedor verificado.', enlace: '#/panel' });
  }
  res.json(publico(u));
}));

admin.get('/maquinaria', ah(async (req, res) => {
  const vals = [];
  let where = '';
  if (req.query.q) {
    vals.push(`%${String(req.query.q).toLowerCase()}%`);
    where = `WHERE lower(m.nombre) LIKE $1 OR lower(m.ciudad) LIKE $1 OR lower(COALESCE(u.empresa, u.nombre)) LIKE $1`;
  }
  const { rows } = await pool.query(`${SELECT_MAQUINA} ${where} ORDER BY m.created_at DESC LIMIT 200`, vals);
  res.json(rows);
}));

admin.delete('/maquinaria/:id', ah(async (req, res) => {
  const { rows: [m] } = await pool.query('DELETE FROM maquinaria WHERE id = $1 RETURNING proveedor_id, nombre', [id(req.params.id)]);
  if (!m) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  notificar(m.proveedor_id, { tipo: 'moderacion', titulo: 'Publicación retirada', mensaje: `Un administrador retiró "${m.nombre}" del catálogo por no cumplir las políticas. Escríbenos si crees que es un error.`, enlace: '#/contacto' });
  res.status(204).end();
}));

admin.get('/contactos', ah(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM contactos ORDER BY atendido, created_at DESC LIMIT 200');
  res.json(rows);
}));

admin.patch('/contactos/:id', ah(async (req, res) => {
  const { rows } = await pool.query('UPDATE contactos SET atendido = $1 WHERE id = $2 RETURNING *', [!!req.body.atendido, id(req.params.id)]);
  if (!rows[0]) return res.status(404).json({ error: 'Mensaje no encontrado.' });
  res.json(rows[0]);
}));

app.use('/api/admin', admin);

app.get('/api/salud', ah(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, correo: correoActivo });
}));

app.use((err, _req, res, _next) => {
  if (err.status === 413) return res.status(413).json({ error: 'La imagen es demasiado grande (máx. 4 MB).' });
  if (err.status === 400) return res.status(400).json({ error: 'Petición inválida.' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor.' });
});

await migrar(pool);
app.listen(PORT, () => console.log(`API Rentatek en http://localhost:${PORT}${correoActivo ? ' (correo activo)' : ''}`));
