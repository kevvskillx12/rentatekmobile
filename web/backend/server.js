import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { DATABASE_URL, JWT_SECRET, PORT = 3001, CORS_ORIGIN } = process.env;
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

// ---------- utilidades ----------
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function firmar(u) {
  return jwt.sign({ id: u.id, rol: u.rol }, JWT_SECRET, { expiresIn: '7d' });
}

function publico(u) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, empresa: u.empresa };
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
  const nombre = String(b.nombre || '').trim();
  const categoria = String(b.categoria || '').trim();
  const ciudad = String(b.ciudad || '').trim();
  const precio = Number(b.precio_dia);
  if (!nombre || !categoria || !ciudad) return { error: 'Completa nombre, categoría y ciudad.' };
  if (!(precio > 0)) return { error: 'El precio por día debe ser mayor a 0.' };
  const estado = b.estado ?? 'disponible';
  if (!ESTADOS_MAQUINA.includes(estado)) return { error: 'Estado inválido.' };
  return {
    datos: {
      nombre,
      categoria,
      ciudad,
      precio_dia: precio,
      descripcion: String(b.descripcion || '').trim(),
      specs: limpiarSpecs(b.specs),
      estado
    }
  };
}

const SELECT_MAQUINA = `
  SELECT m.*, u.nombre AS proveedor_nombre, u.empresa AS proveedor_empresa
  FROM maquinaria m JOIN usuarios u ON u.id = m.proveedor_id`;

// ---------- auth ----------
app.post('/api/auth/registro', ah(async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const rol = req.body.rol;
  const empresa = String(req.body.empresa || '').trim() || null;

  if (!nombre || !email || !password) return res.status(400).json({ error: 'Completa todos los campos.' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  if (!['cliente', 'proveedor'].includes(rol)) return res.status(400).json({ error: 'Rol inválido.' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, empresa)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, email, hash, rol, empresa]
    );
    res.status(201).json({ token: firmar(rows[0]), usuario: publico(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    throw e;
  }
}));

app.post('/api/auth/login', ah(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  res.json({ token: firmar(u), usuario: publico(u) });
}));

app.get('/api/auth/yo', auth(), ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado.' });
  res.json(publico(rows[0]));
}));

// ---------- catálogo público ----------
app.get('/api/maquinaria', ah(async (_req, res) => {
  const { rows } = await pool.query(`${SELECT_MAQUINA} ORDER BY m.created_at DESC`);
  res.json(rows);
}));

app.get('/api/maquinaria/:id', ah(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_MAQUINA} WHERE m.id = $1`, [Number(req.params.id) || 0]);
  if (!rows[0]) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.json(rows[0]);
}));

// ---------- dashboard proveedor ----------
const proveedor = express.Router();
proveedor.use(auth('proveedor'));

proveedor.get('/resumen', ah(async (req, res) => {
  const id = req.usuario.id;
  const { rows: [m] } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE estado = 'disponible')::int AS disponibles,
            count(*) FILTER (WHERE estado = 'rentada')::int AS rentadas,
            count(*) FILTER (WHERE estado = 'por_liberar')::int AS por_liberar
     FROM maquinaria WHERE proveedor_id = $1`, [id]);
  const { rows: [s] } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE s.estado = 'pendiente')::int AS pendientes,
            count(*) FILTER (WHERE s.estado = 'aceptada')::int AS aceptadas,
            COALESCE(sum(m.precio_dia * s.dias) FILTER (WHERE s.estado = 'aceptada'), 0)::float AS ingresos
     FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE m.proveedor_id = $1`, [id]);
  res.json({ maquinaria: m, solicitudes: s });
}));

proveedor.get('/maquinaria', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.*,
       (SELECT count(*)::int FROM solicitudes s WHERE s.maquina_id = m.id AND s.estado = 'pendiente') AS pendientes
     FROM maquinaria m WHERE m.proveedor_id = $1 ORDER BY m.created_at DESC`, [req.usuario.id]);
  res.json(rows);
}));

proveedor.post('/maquinaria', ah(async (req, res) => {
  const { error, datos } = validarMaquina(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `INSERT INTO maquinaria (proveedor_id, nombre, categoria, ciudad, precio_dia, descripcion, specs, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [req.usuario.id, datos.nombre, datos.categoria, datos.ciudad, datos.precio_dia, datos.descripcion, datos.specs, datos.estado]
  );
  res.status(201).json(rows[0]);
}));

proveedor.put('/maquinaria/:id', ah(async (req, res) => {
  const { error, datos } = validarMaquina(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `UPDATE maquinaria SET nombre=$1, categoria=$2, ciudad=$3, precio_dia=$4, descripcion=$5, specs=$6, estado=$7
     WHERE id = $8 AND proveedor_id = $9 RETURNING *`,
    [datos.nombre, datos.categoria, datos.ciudad, datos.precio_dia, datos.descripcion, datos.specs, datos.estado,
     Number(req.params.id) || 0, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.json(rows[0]);
}));

proveedor.patch('/maquinaria/:id/estado', ah(async (req, res) => {
  if (!ESTADOS_MAQUINA.includes(req.body.estado)) return res.status(400).json({ error: 'Estado inválido.' });
  const { rows } = await pool.query(
    'UPDATE maquinaria SET estado = $1 WHERE id = $2 AND proveedor_id = $3 RETURNING *',
    [req.body.estado, Number(req.params.id) || 0, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.json(rows[0]);
}));

proveedor.delete('/maquinaria/:id', ah(async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM maquinaria WHERE id = $1 AND proveedor_id = $2', [Number(req.params.id) || 0, req.usuario.id]);
  if (!rowCount) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  res.status(204).end();
}));

proveedor.get('/solicitudes', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, m.nombre AS maquina_nombre, m.precio_dia, m.estado AS maquina_estado,
            c.nombre AS cliente_nombre, c.email AS cliente_email
     FROM solicitudes s
     JOIN maquinaria m ON m.id = s.maquina_id
     JOIN usuarios c ON c.id = s.cliente_id
     WHERE m.proveedor_id = $1
     ORDER BY (s.estado = 'pendiente') DESC, s.created_at DESC`, [req.usuario.id]);
  res.json(rows);
}));

proveedor.patch('/solicitudes/:id', ah(async (req, res) => {
  const estado = req.body.estado;
  if (!['aceptada', 'rechazada'].includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `UPDATE solicitudes s SET estado = $1
       FROM maquinaria m
       WHERE s.id = $2 AND m.id = s.maquina_id AND m.proveedor_id = $3 AND s.estado = 'pendiente'
       RETURNING s.*`,
      [estado, Number(req.params.id) || 0, req.usuario.id]
    );
    if (!rows[0]) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada o ya respondida.' });
    }
    if (estado === 'aceptada') {
      await cliente.query(`UPDATE maquinaria SET estado = 'rentada' WHERE id = $1`, [rows[0].maquina_id]);
    }
    await cliente.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}));

app.use('/api/proveedor', proveedor);

// ---------- dashboard cliente ----------
const clienteR = express.Router();
clienteR.use(auth('cliente'));

clienteR.get('/solicitudes', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, m.nombre AS maquina_nombre, m.categoria, m.ciudad, m.precio_dia, m.estado AS maquina_estado,
            p.nombre AS proveedor_nombre, p.empresa AS proveedor_empresa, p.email AS proveedor_email
     FROM solicitudes s
     JOIN maquinaria m ON m.id = s.maquina_id
     JOIN usuarios p ON p.id = m.proveedor_id
     WHERE s.cliente_id = $1
     ORDER BY s.created_at DESC`, [req.usuario.id]);
  res.json(rows);
}));

clienteR.post('/solicitudes', ah(async (req, res) => {
  const maquinaId = Number(req.body.maquina_id) || 0;
  const nombre = String(req.body.nombre_contacto || '').trim();
  const telefono = String(req.body.telefono || '').replace(/[^\d+]/g, '');
  const dias = Math.floor(Number(req.body.dias));
  const mensaje = String(req.body.mensaje || '').trim();

  if (!nombre || !telefono) return res.status(400).json({ error: 'Escribe tu nombre y teléfono.' });
  if (!(dias >= 1 && dias <= 365)) return res.status(400).json({ error: 'Los días deben estar entre 1 y 365.' });

  const { rows: [m] } = await pool.query('SELECT estado FROM maquinaria WHERE id = $1', [maquinaId]);
  if (!m) return res.status(404).json({ error: 'Maquinaria no encontrada.' });
  if (m.estado === 'rentada') return res.status(409).json({ error: 'Esta maquinaria ya está rentada.' });

  const { rows: [dup] } = await pool.query(
    `SELECT 1 FROM solicitudes WHERE maquina_id = $1 AND cliente_id = $2 AND estado = 'pendiente'`,
    [maquinaId, req.usuario.id]);
  if (dup) return res.status(409).json({ error: 'Ya tienes una solicitud pendiente para este equipo.' });

  const { rows } = await pool.query(
    `INSERT INTO solicitudes (maquina_id, cliente_id, nombre_contacto, telefono, dias, mensaje)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [maquinaId, req.usuario.id, nombre, telefono, dias, mensaje]
  );
  res.status(201).json(rows[0]);
}));

clienteR.patch('/solicitudes/:id/cancelar', ah(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE solicitudes SET estado = 'cancelada'
     WHERE id = $1 AND cliente_id = $2 AND estado = 'pendiente' RETURNING *`,
    [Number(req.params.id) || 0, req.usuario.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Solo puedes cancelar solicitudes pendientes.' });
  res.json(rows[0]);
}));

app.use('/api/cliente', clienteR);

app.get('/api/salud', ah(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor.' });
});

app.listen(PORT, () => console.log(`API Rentatek en http://localhost:${PORT}`));
