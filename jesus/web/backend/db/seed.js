// Crea la tabla `categorias` y llena la base con datos de demostración.
//   npm run seed           -> crea/actualiza categorías e inserta los datos demo (si aún no existen)
//   npm run seed -- --reset -> borra las cuentas demo (y sus máquinas/solicitudes) y las vuelve a crear
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { migrar } from './migraciones.js';

const DOMINIO = 'demo.rentatek.mx';
const PASSWORD_DEMO = 'Rentatek123';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ---------- categorías de maquinaria pesada ----------
const CATEGORIAS = [
  ['Excavadoras', 'Excavadoras hidráulicas de oruga y miniexcavadoras para zanjas, cimentaciones y demolición.', '/img/Excavadora.jpg'],
  ['Retroexcavadoras', 'Equipos 4x4 con cargador frontal y brazo excavador, ideales para obra urbana.', '/img/Retroexcavadora.jpg'],
  ['Cargadores frontales', 'Cargadores sobre ruedas para mover material, llenar camiones y patios de acopio.', '/img/Retroexcavadora.jpg'],
  ['Minicargadores', 'Minicargadores compactos con accesorios: cucharón, martillo, barredora y horquillas.', '/img/Retroexcavadora.jpg'],
  ['Tractores de oruga', 'Bulldozers para desmonte, empuje de tierra y apertura de caminos.', '/img/Excavadora.jpg'],
  ['Motoniveladoras', 'Motoniveladoras para conformación de terracerías, caminos y plataformas.', '/img/Excavadora.jpg'],
  ['Compactadoras', 'Rodillos vibratorios lisos, pata de cabra y neumáticos, bailarinas y placas.', '/img/Retroexcavadora.jpg'],
  ['Grúas', 'Grúas todo terreno, hidráulicas y articuladas para izaje de cargas.', '/img/Grua.jpeg'],
  ['Plataformas de elevación', 'Plataformas de tijera y articuladas para trabajos en altura.', '/img/Grua.jpeg'],
  ['Montacargas', 'Montacargas de combustión y eléctricos para almacenes y obra.', '/img/Grua.jpeg'],
  ['Camiones de volteo', 'Camiones de volteo y tractocamiones para acarreo de material.', '/img/Retroexcavadora.jpg'],
  ['Equipo para concreto', 'Ollas revolvedoras, bombas de concreto y revolvedoras de obra.', '/img/Retroexcavadora.jpg'],
  ['Perforadoras', 'Perforadoras de roca, piloteadoras y equipos de barrenación.', '/img/Excavadora.jpg']
];

// Categorías viejas del frontend -> nuevas
const MAPEO_VIEJO = {
  'Excavación': 'Excavadoras',
  'Construcción': 'Retroexcavadoras',
  'Elevación': 'Grúas',
  'Compactación': 'Compactadoras',
  'Transporte': 'Camiones de volteo'
};

// ---------- usuarios ----------
const PROVEEDORES = [
  ['Ricardo Peniche Cámara', 'ricardo.peniche', 'Maquinaria Peninsular'],
  ['Laura Canché Euán', 'laura.canche', 'Rentas del Sureste'],
  ['Jorge Villanueva Ortiz', 'jorge.villanueva', 'Equipos Pesados Villanueva'],
  ['Ana Sofía Treviño Garza', 'ana.trevino', 'Grúas y Montajes del Norte'],
  ['Héctor Medina Ruiz', 'hector.medina', 'Constructora y Arrendadora Medina'],
  ['Mariana Rosales Pech', 'mariana.rosales', 'Caribe Maquinaria'],
  ['Fernando Aguilar Leal', 'fernando.aguilar', 'Bajío Rent Equipment'],
  ['Daniela Ortega Salas', 'daniela.ortega', 'Elevación Total']
];

const CLIENTES = [
  ['Carlos Méndez Alcocer', 'carlos.mendez'],
  ['Sofía Herrera Dzul', 'sofia.herrera'],
  ['Miguel Ángel Pool Chan', 'miguel.pool'],
  ['Valeria Castillo Novelo', 'valeria.castillo'],
  ['Luis Enrique Baeza', 'luis.baeza'],
  ['Andrea Martínez Uc', 'andrea.martinez'],
  ['José Antonio Ku May', 'jose.ku'],
  ['Paola Domínguez Ríos', 'paola.dominguez'],
  ['Roberto Sánchez Lara', 'roberto.sanchez'],
  ['Gabriela Solís Ancona', 'gabriela.solis'],
  ['Eduardo Ramírez Tun', 'eduardo.ramirez'],
  ['Fernanda López Vera', 'fernanda.lopez'],
  ['Arturo Cervera Gamboa', 'arturo.cervera'],
  ['Daniel Torres Patrón', 'daniel.torres'],
  ['Mónica Esquivel Coral', 'monica.esquivel'],
  ['Iván Rodríguez Cetina', 'ivan.rodriguez']
];

// ---------- maquinaria ----------
// [proveedorIdx, nombre, categoria, ciudad, precio, descripcion, specs]
const MAQUINAS = [
  [0, 'Excavadora Caterpillar 320 GC', 'Excavadoras', 'Mérida, Yuc.', 6800, 'Excavadora de 22 t en excelente estado, cucharón de 1.2 m³. Ideal para cimentaciones y zanjas profundas.', { Marca: 'Caterpillar', Modelo: '320 GC', 'Año': '2021', 'Peso operativo': '22 t', Potencia: '121 hp', 'Operador incluido': 'Sí' }],
  [0, 'Retroexcavadora JCB 3CX', 'Retroexcavadoras', 'Mérida, Yuc.', 3200, 'Retroexcavadora 4x4 con extensión de brazo. Mantenimiento al día.', { Marca: 'JCB', Modelo: '3CX', 'Año': '2020', Potencia: '92 hp', 'Profundidad de excavación': '5.9 m', 'Operador incluido': 'Opcional' }],
  [0, 'Cargador frontal CAT 950 GC', 'Cargadores frontales', 'Mérida, Yuc.', 5900, 'Cargador sobre ruedas con cucharón de 3.1 m³, perfecto para patios de material.', { Marca: 'Caterpillar', Modelo: '950 GC', 'Año': '2019', 'Capacidad de cucharón': '3.1 m³', Potencia: '225 hp' }],
  [0, 'Rodillo vibratorio Dynapac CA250', 'Compactadoras', 'Progreso, Yuc.', 2900, 'Rodillo liso de 10 t para compactación de bases y sub-bases.', { Marca: 'Dynapac', Modelo: 'CA250D', 'Peso operativo': '10 t', 'Ancho de tambor': '2.13 m' }],
  [0, 'Camión de volteo International 14 m³', 'Camiones de volteo', 'Mérida, Yuc.', 3500, 'Camión de volteo de 14 m³ con chofer, ideal para acarreo de material pétreo.', { Marca: 'International', Modelo: '7600', 'Capacidad': '14 m³', 'Chofer incluido': 'Sí' }],
  [0, 'Minicargador Bobcat S650', 'Minicargadores', 'Mérida, Yuc.', 1900, 'Minicargador con cucharón y horquillas. Accesorio de martillo disponible.', { Marca: 'Bobcat', Modelo: 'S650', 'Capacidad de operación': '1,227 kg', Potencia: '74 hp' }],

  [1, 'Miniexcavadora Kubota U35', 'Excavadoras', 'Mérida, Yuc.', 2400, 'Miniexcavadora de 3.5 t, cabe en espacios reducidos. Sin giro de cola.', { Marca: 'Kubota', Modelo: 'U35-4', 'Peso operativo': '3.5 t', 'Profundidad de excavación': '3.5 m' }],
  [1, 'Retroexcavadora John Deere 310L', 'Retroexcavadoras', 'Valladolid, Yuc.', 3000, 'Retroexcavadora confiable para obra civil y drenajes.', { Marca: 'John Deere', Modelo: '310L', 'Año': '2019', Potencia: '93 hp' }],
  [1, 'Bailarina compactadora Wacker BS60', 'Compactadoras', 'Mérida, Yuc.', 450, 'Apisonador para zanjas y áreas reducidas. Incluye gasolina para el primer día.', { Marca: 'Wacker Neuson', Modelo: 'BS60-2i', Peso: '68 kg' }],
  [1, 'Placa vibratoria Mikasa MVC-88', 'Compactadoras', 'Mérida, Yuc.', 380, 'Placa vibratoria para compactar arena, grava y adoquín.', { Marca: 'Mikasa', Modelo: 'MVC-88', Peso: '80 kg' }],
  [1, 'Revolvedora de 1 saco', 'Equipo para concreto', 'Mérida, Yuc.', 350, 'Revolvedora a gasolina de un saco, ideal para colados pequeños.', { Motor: 'Honda 9 hp', Capacidad: '1 saco' }],
  [1, 'Montacargas Toyota 2.5 t', 'Montacargas', 'Mérida, Yuc.', 1500, 'Montacargas a gas LP con mástil triple, altura de levante 4.7 m.', { Marca: 'Toyota', Modelo: '8FGU25', Capacidad: '2.5 t', 'Altura de levante': '4.7 m' }],

  [2, 'Tractor de oruga Caterpillar D6T', 'Tractores de oruga', 'Villahermosa, Tab.', 9800, 'Bulldozer con hoja semi-U y ripper. Ideal para desmonte y terracerías.', { Marca: 'Caterpillar', Modelo: 'D6T', 'Peso operativo': '23 t', Potencia: '215 hp', 'Operador incluido': 'Sí' }],
  [2, 'Excavadora Komatsu PC200', 'Excavadoras', 'Villahermosa, Tab.', 6200, 'Excavadora de 20 t con martillo hidráulico opcional.', { Marca: 'Komatsu', Modelo: 'PC200-8', 'Peso operativo': '20 t', Potencia: '148 hp' }],
  [2, 'Motoniveladora Caterpillar 140K', 'Motoniveladoras', 'Villahermosa, Tab.', 7500, 'Motoniveladora con hoja de 3.7 m para caminos y plataformas.', { Marca: 'Caterpillar', Modelo: '140K', Potencia: '183 hp', 'Hoja': '3.7 m' }],
  [2, 'Rodillo pata de cabra Bomag BW211', 'Compactadoras', 'Villahermosa, Tab.', 3400, 'Rodillo pata de cabra para suelos arcillosos.', { Marca: 'Bomag', Modelo: 'BW211 PD-5', 'Peso operativo': '11 t' }],
  [2, 'Camión de volteo Kenworth 20 m³', 'Camiones de volteo', 'Villahermosa, Tab.', 4600, 'Camión de volteo doble eje de 20 m³ con chofer.', { Marca: 'Kenworth', Modelo: 'T800', 'Capacidad': '20 m³', 'Chofer incluido': 'Sí' }],
  [2, 'Perforadora Atlas Copco FlexiROC', 'Perforadoras', 'Villahermosa, Tab.', 11500, 'Perforadora de superficie para barrenación en roca y canteras.', { Marca: 'Atlas Copco', Modelo: 'FlexiROC T35', 'Diámetro de barreno': '64–115 mm' }],

  [3, 'Grúa todo terreno Grove RT890E 90 t', 'Grúas', 'Monterrey, N.L.', 24000, 'Grúa todo terreno de 90 t con operador y maniobrista certificados.', { Marca: 'Grove', Modelo: 'RT890E', Capacidad: '90 t', 'Pluma': '43 m', 'Operador incluido': 'Sí' }],
  [3, 'Grúa articulada Hiab 30 t-m', 'Grúas', 'Monterrey, N.L.', 7800, 'Grúa articulada montada en camión, ideal para descarga de material y estructuras.', { Marca: 'Hiab', Capacidad: '30 t-m', 'Alcance': '16 m' }],
  [3, 'Grúa hidráulica Terex 50 t', 'Grúas', 'Saltillo, Coah.', 15500, 'Grúa hidráulica de 50 t para montajes industriales.', { Marca: 'Terex', Modelo: 'RT555', Capacidad: '50 t', 'Operador incluido': 'Sí' }],
  [3, 'Plataforma articulada JLG 600AJ', 'Plataformas de elevación', 'Monterrey, N.L.', 3900, 'Plataforma articulada de 18 m de altura de trabajo, diésel 4x4.', { Marca: 'JLG', Modelo: '600AJ', 'Altura de trabajo': '20.3 m', 'Capacidad': '230 kg' }],
  [3, 'Montacargas Hyster 5 t', 'Montacargas', 'Monterrey, N.L.', 2300, 'Montacargas diésel para patio, llantas neumáticas.', { Marca: 'Hyster', Modelo: 'H110FT', Capacidad: '5 t' }],
  [3, 'Excavadora Volvo EC220', 'Excavadoras', 'Monterrey, N.L.', 6500, 'Excavadora de 22 t, bajo consumo de combustible.', { Marca: 'Volvo', Modelo: 'EC220E', 'Peso operativo': '22 t', Potencia: '173 hp' }],

  [4, 'Retroexcavadora Case 580N', 'Retroexcavadoras', 'Campeche, Camp.', 2950, 'Retroexcavadora 4x4 con martillo opcional.', { Marca: 'Case', Modelo: '580N', 'Año': '2018', Potencia: '90 hp' }],
  [4, 'Cargador frontal Komatsu WA320', 'Cargadores frontales', 'Campeche, Camp.', 5200, 'Cargador frontal con cucharón de 2.5 m³.', { Marca: 'Komatsu', Modelo: 'WA320-7', 'Capacidad de cucharón': '2.5 m³' }],
  [4, 'Tractor de oruga Komatsu D65', 'Tractores de oruga', 'Campeche, Camp.', 9200, 'Bulldozer para desmonte y apertura de caminos rurales.', { Marca: 'Komatsu', Modelo: 'D65EX', Potencia: '217 hp' }],
  [4, 'Olla revolvedora 7 m³', 'Equipo para concreto', 'Campeche, Camp.', 4200, 'Camión revolvedor de 7 m³ con chofer.', { Capacidad: '7 m³', 'Chofer incluido': 'Sí' }],
  [4, 'Motoniveladora John Deere 670G', 'Motoniveladoras', 'Ciudad del Carmen, Camp.', 7100, 'Motoniveladora para mantenimiento de caminos.', { Marca: 'John Deere', Modelo: '670G', Potencia: '200 hp' }],

  [5, 'Excavadora Hyundai HX220', 'Excavadoras', 'Cancún, Q. Roo', 6000, 'Excavadora de 22 t lista para obra en la Riviera Maya.', { Marca: 'Hyundai', Modelo: 'HX220L', 'Peso operativo': '22 t' }],
  [5, 'Minicargador Caterpillar 262D', 'Minicargadores', 'Cancún, Q. Roo', 2100, 'Minicargador con barredora y martillo disponibles.', { Marca: 'Caterpillar', Modelo: '262D3', Potencia: '74 hp' }],
  [5, 'Retroexcavadora Caterpillar 416F', 'Retroexcavadoras', 'Playa del Carmen, Q. Roo', 3300, 'Retroexcavadora con cabina cerrada y aire acondicionado.', { Marca: 'Caterpillar', Modelo: '416F2', Potencia: '87 hp' }],
  [5, 'Bomba de concreto Putzmeister 36 m', 'Equipo para concreto', 'Cancún, Q. Roo', 12500, 'Bomba pluma de 36 m con operador para colados de losas y muros.', { Marca: 'Putzmeister', Modelo: 'M36-4', 'Alcance vertical': '36 m', 'Rendimiento': '160 m³/h' }],
  [5, 'Plataforma de tijera Genie GS-1930', 'Plataformas de elevación', 'Cancún, Q. Roo', 1100, 'Plataforma eléctrica para interiores, 7.8 m de altura de trabajo.', { Marca: 'Genie', Modelo: 'GS-1930', 'Altura de trabajo': '7.8 m' }],
  [5, 'Camión de volteo Freightliner 14 m³', 'Camiones de volteo', 'Tulum, Q. Roo', 3700, 'Camión de volteo con chofer para acarreos en zona hotelera.', { Marca: 'Freightliner', 'Capacidad': '14 m³', 'Chofer incluido': 'Sí' }],

  [6, 'Excavadora Caterpillar 336', 'Excavadoras', 'Querétaro, Qro.', 8900, 'Excavadora de 36 t para movimiento masivo de tierra.', { Marca: 'Caterpillar', Modelo: '336', 'Peso operativo': '36 t', Potencia: '311 hp' }],
  [6, 'Cargador frontal Volvo L90', 'Cargadores frontales', 'León, Gto.', 5600, 'Cargador frontal con báscula integrada.', { Marca: 'Volvo', Modelo: 'L90H', 'Capacidad de cucharón': '3 m³' }],
  [6, 'Rodillo neumático Hamm GRW 280', 'Compactadoras', 'Querétaro, Qro.', 3600, 'Compactador neumático para carpetas asfálticas.', { Marca: 'Hamm', Modelo: 'GRW 280', 'Peso operativo': '10–28 t' }],
  [6, 'Piloteadora Bauer BG 28', 'Perforadoras', 'Querétaro, Qro.', 22000, 'Perforadora para pilas de cimentación de hasta 1.5 m de diámetro.', { Marca: 'Bauer', Modelo: 'BG 28', 'Profundidad máxima': '60 m' }],
  [6, 'Retroexcavadora New Holland B95', 'Retroexcavadoras', 'Guadalajara, Jal.', 3100, 'Retroexcavadora con 4 cilindros y cabina cerrada.', { Marca: 'New Holland', Modelo: 'B95C', Potencia: '97 hp' }],
  [6, 'Montacargas eléctrico Crown 1.8 t', 'Montacargas', 'Guadalajara, Jal.', 1300, 'Montacargas eléctrico silencioso para naves industriales.', { Marca: 'Crown', Modelo: 'SC 5200', Capacidad: '1.8 t' }],

  [7, 'Plataforma articulada Genie Z-45', 'Plataformas de elevación', 'Ciudad de México', 3200, 'Plataforma articulada de 15.8 m, diésel 4x4.', { Marca: 'Genie', Modelo: 'Z-45/25J', 'Altura de trabajo': '15.8 m' }],
  [7, 'Plataforma telescópica JLG 860SJ', 'Plataformas de elevación', 'Ciudad de México', 5400, 'Plataforma telescópica de 28 m de altura de trabajo.', { Marca: 'JLG', Modelo: '860SJ', 'Altura de trabajo': '28 m' }],
  [7, 'Grúa Liebherr LTM 1060 60 t', 'Grúas', 'Puebla, Pue.', 18500, 'Grúa móvil todo terreno de 60 t para montajes.', { Marca: 'Liebherr', Modelo: 'LTM 1060-3.1', Capacidad: '60 t', 'Operador incluido': 'Sí' }],
  [7, 'Plataforma de tijera Skyjack SJ6832', 'Plataformas de elevación', 'Toluca, Edo. Méx.', 1800, 'Tijera todo terreno con 11.7 m de altura de trabajo.', { Marca: 'Skyjack', Modelo: 'SJ6832 RT', 'Altura de trabajo': '11.7 m' }],
  [7, 'Miniexcavadora Bobcat E35', 'Excavadoras', 'Ciudad de México', 2500, 'Miniexcavadora ideal para obra urbana y jardinería.', { Marca: 'Bobcat', Modelo: 'E35', 'Peso operativo': '3.5 t' }]
];

const MENSAJES = [
  'La necesito para una obra en el centro, ¿incluye traslado?',
  'Buen día, ¿el precio incluye operador?',
  'Requiero el equipo a partir del lunes, favor de confirmar.',
  'Es para una cimentación de una bodega, ¿tienen disponibilidad?',
  '¿Me pueden enviar la factura a nombre de la empresa?',
  'Necesito el equipo para nivelar un terreno de 2,000 m².',
  'Hola, ¿cuál es el costo del flete?',
  'Lo requiero para un colado de losa, ¿pueden llegar temprano?',
  '',
  'Proyecto de drenaje pluvial, aproximadamente una semana de trabajo.'
];

// PRNG determinista para que los datos sean siempre los mismos
let semilla = 20261126;
const rnd = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const diasAtras = (max, min = 0) => new Date(Date.now() - (min + rnd() * (max - min)) * 86400000);
const telefono = () => '99' + String(Math.floor(10000000 + rnd() * 89999999));

async function migrarCategorias(db) {
  await migrar(db);
  for (const [i, [nombre, descripcion, imagen]] of CATEGORIAS.entries()) {
    await db.query(
      `INSERT INTO categorias (nombre, descripcion, imagen, orden) VALUES ($1, $2, $3, $4)
       ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion, imagen = EXCLUDED.imagen, orden = EXCLUDED.orden`,
      [nombre, descripcion, imagen, i + 1]
    );
  }
  // Reasigna las máquinas que tenían categorías del esquema viejo
  await db.query(`UPDATE maquinaria SET categoria = 'Grúas' WHERE categoria = 'Excavación' AND nombre ILIKE '%gr_a%'`);
  for (const [viejo, nuevo] of Object.entries(MAPEO_VIEJO)) {
    await db.query('UPDATE maquinaria SET categoria = $1 WHERE categoria = $2', [nuevo, viejo]);
  }
  console.log(`✔ ${CATEGORIAS.length} categorías listas`);
}

async function sembrar(db) {
  const hash = await bcrypt.hash(PASSWORD_DEMO, 10);

  const insUsuario = async (nombre, user, rol, empresa) => {
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, empresa, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [nombre, `${user}@${DOMINIO}`, hash, rol, empresa, diasAtras(200, 120)]
    );
    return rows[0].id;
  };

  const proveedores = [];
  for (const [nombre, user, empresa] of PROVEEDORES) proveedores.push(await insUsuario(nombre, user, 'proveedor', empresa));
  const clientes = [];
  for (const [nombre, user] of CLIENTES) clientes.push({ id: await insUsuario(nombre, user, 'cliente', null), nombre });

  // Estados de las máquinas: ~65% disponible, ~25% rentada, ~10% por liberar
  const maquinas = [];
  for (const [pIdx, nombre, categoria, ciudad, precio, descripcion, specs] of MAQUINAS) {
    const r = rnd();
    const estado = r < 0.65 ? 'disponible' : r < 0.9 ? 'rentada' : 'por_liberar';
    const { rows } = await db.query(
      `INSERT INTO maquinaria (proveedor_id, nombre, categoria, ciudad, precio_dia, descripcion, specs, estado, destacado, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [proveedores[pIdx], nombre, categoria, ciudad, precio, descripcion, specs, estado, rnd() < 0.2, diasAtras(110, 30)]
    );
    maquinas.push({ id: rows[0].id, estado });
  }

  // Rangos de fechas por máquina para que las rentas aceptadas no se encimen
  const ocupado = new Map();
  const insSolicitud = (maquinaId, cliente, estado, haceMax, haceMin) => {
    const creada = diasAtras(haceMax, haceMin);
    const dias = 1 + Math.floor(rnd() * 10);
    let inicio = new Date(creada.getTime() + (1 + Math.floor(rnd() * 3)) * 86400000);
    if (estado === 'aceptada') {
      const libre = ocupado.get(maquinaId) || 0;
      if (inicio.getTime() < libre) inicio = new Date(libre);
      ocupado.set(maquinaId, inicio.getTime() + (dias + 1) * 86400000);
    }
    const fin = new Date(inicio.getTime() + (dias - 1) * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    return db.query(
      `INSERT INTO solicitudes (maquina_id, cliente_id, nombre_contacto, telefono, dias, mensaje, estado, created_at, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [maquinaId, cliente.id, cliente.nombre, telefono(), dias, elegir(MENSAJES), estado, creada, iso(inicio), iso(fin)]
    );
  };

  let total = 0;
  for (const m of maquinas) {
    const usados = new Set();
    const cliente = () => { let c; do { c = elegir(clientes); } while (usados.has(c.id)); usados.add(c.id); return c; };

    // Historial: solicitudes antiguas ya resueltas
    const historicas = Math.floor(rnd() * 3);
    for (let i = 0; i < historicas; i++) {
      const r = rnd();
      await insSolicitud(m.id, cliente(), r < 0.5 ? 'aceptada' : r < 0.8 ? 'rechazada' : 'cancelada', 28, 8);
      total++;
    }
    // Las máquinas rentadas tienen una solicitud aceptada reciente
    if (m.estado !== 'disponible') { await insSolicitud(m.id, cliente(), 'aceptada', 7, 1); total++; }
    // Solicitudes pendientes en máquinas disponibles
    if (m.estado === 'disponible' && rnd() < 0.55) {
      const n = 1 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) { await insSolicitud(m.id, cliente(), 'pendiente', 4, 0); total++; }
    }
  }

  console.log(`✔ ${proveedores.length} proveedores, ${clientes.length} clientes, ${maquinas.length} máquinas, ${total} solicitudes`);
}

// ---------- datos demo de las funciones nuevas (admin, verificación, reseñas, favoritos, chat, avisos) ----------
const COMENTARIOS = [
  [5, 'Excelente equipo, llegó puntual y en perfectas condiciones. El operador muy profesional.'],
  [5, 'Muy buena atención, el proveedor respondió rápido y el precio es justo. Volveré a rentar.'],
  [4, 'Todo bien, solo llegó una hora tarde el primer día. La máquina trabajó sin problemas.'],
  [5, 'Nos salvó la obra. Maquinaria bien mantenida y cero fallas.'],
  [4, 'Buen servicio. Recomendable para trabajos de terracería.'],
  [3, 'Cumplió, aunque el equipo ya tiene sus años. El trato fue amable.'],
  [5, 'Súper recomendado, nos apoyaron con el flete sin costo extra.'],
  [4, 'Equipo en buen estado y facturación sin complicaciones.']
];
const CHAT = [
  ['c', 'Hola, ¿el equipo incluye operador o lo tengo que llevar yo?'],
  ['p', 'Hola, sí incluye operador certificado. ¿En qué dirección sería la obra?'],
  ['c', 'Es en la zona norte, cerca del periférico. ¿Cobran flete aparte?'],
  ['p', 'Dentro de la ciudad el flete va incluido. Le confirmo la entrega a las 8:00 a.m.']
];

async function extras(db) {
  const { rows: [ya] } = await db.query('SELECT count(*)::int n FROM usuarios WHERE email = $1', [`admin@${DOMINIO}`]);
  if (ya.n) return console.log('• Los datos demo de reseñas/chat/admin ya existen');

  const hash = await bcrypt.hash(PASSWORD_DEMO, 10);
  await db.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, empresa, verificado)
     VALUES ('Administrador Rentatek', $1, $2, 'admin', 'Rentatek', true)`, [`admin@${DOMINIO}`, hash]);

  // 6 de los 8 proveedores demo verificados
  await db.query(
    `UPDATE usuarios SET verificado = true WHERE rol = 'proveedor' AND email LIKE $1 AND email NOT IN ($2, $3)`,
    [`%@${DOMINIO}`, `fernando.aguilar@${DOMINIO}`, `daniela.ortega@${DOMINIO}`]);
  await db.query(
    `UPDATE usuarios SET telefono = '99' || lpad((id * 7919 % 100000000)::text, 8, '1') WHERE email LIKE $1 AND telefono IS NULL`,
    [`%@${DOMINIO}`]);

  // Reseñas en ~75% de las rentas aceptadas ya terminadas
  const { rows: aceptadas } = await db.query(
    `SELECT s.id, s.maquina_id, s.cliente_id, m.proveedor_id, s.fecha_fin FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE s.estado = 'aceptada' AND s.fecha_fin < CURRENT_DATE AND NOT EXISTS (SELECT 1 FROM resenas r WHERE r.solicitud_id = s.id)`);
  let nRes = 0;
  for (const s of aceptadas) {
    if (rnd() > 0.75) continue;
    const [cal, com] = elegir(COMENTARIOS);
    await db.query(
      `INSERT INTO resenas (solicitud_id, maquina_id, cliente_id, proveedor_id, calificacion, comentario, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date + 1)`, [s.id, s.maquina_id, s.cliente_id, s.proveedor_id, cal, com, s.fecha_fin]);
    nRes++;
  }

  // Favoritos: cada cliente demo guarda de 2 a 5 máquinas
  const { rows: clientes } = await db.query(`SELECT id FROM usuarios WHERE rol = 'cliente' AND email LIKE $1`, [`%@${DOMINIO}`]);
  const { rows: maquinas } = await db.query('SELECT id FROM maquinaria');
  let nFav = 0;
  for (const c of clientes) {
    const n = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const r = await db.query('INSERT INTO favoritos (usuario_id, maquina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, elegir(maquinas).id]);
      nFav += r.rowCount;
    }
  }

  // Conversaciones en solicitudes recientes
  const { rows: conv } = await db.query(
    `SELECT s.id, s.cliente_id, m.proveedor_id, s.created_at FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE s.estado IN ('pendiente', 'aceptada') AND s.created_at > now() - interval '10 days' ORDER BY s.id`);
  let nMsg = 0;
  for (const s of conv) {
    if (rnd() > 0.6) continue;
    const largo = 1 + Math.floor(rnd() * CHAT.length);
    for (let i = 0; i < largo; i++) {
      const [quien, t] = CHAT[i];
      await db.query(
        `INSERT INTO mensajes (solicitud_id, autor_id, texto, leido, created_at)
         VALUES ($1, $2, $3, $4, $5::timestamptz + make_interval(mins => $6))`,
        [s.id, quien === 'c' ? s.cliente_id : s.proveedor_id, t, i < largo - 1, s.created_at, 30 + i * 25]);
      nMsg++;
    }
  }

  // Avisos iniciales para que la campana no esté vacía
  const { rows: pend } = await db.query(
    `SELECT s.id, s.nombre_contacto, m.nombre, m.proveedor_id, s.created_at FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE s.estado = 'pendiente'`);
  for (const s of pend) {
    await db.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, enlace, created_at) VALUES ($1, 'solicitud', 'Nueva solicitud de renta', $2, $3, $4)`,
      [s.proveedor_id, `${s.nombre_contacto} quiere rentar "${s.nombre}".`, `#/panel/solicitud/${s.id}`, s.created_at]);
  }
  const { rows: acep } = await db.query(
    `SELECT s.id, s.cliente_id, m.nombre, s.created_at FROM solicitudes s JOIN maquinaria m ON m.id = s.maquina_id
     WHERE s.estado = 'aceptada' AND s.created_at > now() - interval '10 days'`);
  for (const s of acep) {
    await db.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, enlace, created_at)
       VALUES ($1, 'aceptada', '¡Tu solicitud fue aceptada!', $2, $3, $4::timestamptz + interval '3 hours')`,
      [s.cliente_id, `El proveedor aceptó tu renta de "${s.nombre}".`, `#/mis-rentas/${s.id}`, s.created_at]);
  }

  // Mensajes de contacto para el panel de administración
  await db.query(`INSERT INTO contactos (nombre, email, asunto, mensaje, created_at) VALUES
    ('Pedro Ávila', 'pedro.avila@ejemplo.com', '¿Cómo me registro como proveedor?', 'Tengo 3 retroexcavadoras y quiero publicarlas, ¿tiene algún costo?', now() - interval '2 days'),
    ('Constructora Itzá', 'compras@ejemplo.com', 'Factura', 'Necesitamos saber si los proveedores emiten factura con IVA desglosado.', now() - interval '5 hours')`);

  console.log(`✔ admin creado, ${nRes} reseñas, ${nFav} favoritos, ${nMsg} mensajes de chat, ${pend.length + acep.length} avisos`);
}

// ---------- historial: rentas terminadas de los últimos 12 meses (para gráficas y reseñas) ----------
async function historial(db) {
  const { rows: [h] } = await db.query(`SELECT count(*)::int n FROM solicitudes WHERE fecha_inicio < CURRENT_DATE - 60`);
  if (h.n > 20) return console.log('• El historial de rentas ya existe');
  const { rows: maquinas } = await db.query(
    `SELECT m.id, m.proveedor_id FROM maquinaria m JOIN usuarios u ON u.id = m.proveedor_id WHERE u.email LIKE $1`, [`%@${DOMINIO}`]);
  const { rows: clientes } = await db.query(`SELECT id, nombre FROM usuarios WHERE rol = 'cliente' AND email LIKE $1`, [`%@${DOMINIO}`]);
  let nSol = 0, nRes = 0;
  for (const m of maquinas) {
    // Recorre el año de atrás hacia adelante con huecos aleatorios entre rentas
    let cursor = 365 - Math.floor(rnd() * 40);
    while (cursor > 40) {
      const dias = 2 + Math.floor(rnd() * 12);
      const c = elegir(clientes);
      const estado = rnd() < 0.82 ? 'aceptada' : elegir(['rechazada', 'cancelada']);
      const { rows: [s] } = await db.query(
        `INSERT INTO solicitudes (maquina_id, cliente_id, nombre_contacto, telefono, dias, mensaje, estado, created_at, fecha_inicio, fecha_fin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() - make_interval(days => $8 + 3), CURRENT_DATE - $8::int, CURRENT_DATE - $8::int + $5::int - 1)
         RETURNING id, fecha_fin`,
        [m.id, c.id, c.nombre, telefono(), dias, elegir(MENSAJES), estado, cursor]);
      nSol++;
      if (estado === 'aceptada' && rnd() < 0.6) {
        const [cal, com] = elegir(COMENTARIOS);
        await db.query(
          `INSERT INTO resenas (solicitud_id, maquina_id, cliente_id, proveedor_id, calificacion, comentario, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::date + 1)`, [s.id, m.id, c.id, m.proveedor_id, cal, com, s.fecha_fin]);
        nRes++;
      }
      cursor -= dias + 6 + Math.floor(rnd() * 35);
    }
  }
  console.log(`✔ historial: ${nSol} rentas pasadas, ${nRes} reseñas`);
}

const db = await pool.connect();
try {
  await db.query('BEGIN');
  await migrarCategorias(db);

  if (process.argv.includes('--reset')) {
    const { rowCount } = await db.query('DELETE FROM usuarios WHERE email LIKE $1', [`%@${DOMINIO}`]);
    await db.query(`DELETE FROM contactos WHERE email LIKE '%@ejemplo.com'`);
    console.log(`✔ ${rowCount} cuentas demo eliminadas`);
  }

  const { rows: [{ n }] } = await db.query('SELECT count(*)::int n FROM usuarios WHERE email LIKE $1', [`%@${DOMINIO}`]);
  if (n > 0) console.log('• Los datos demo ya existen (usa --reset para regenerarlos)');
  else await sembrar(db);
  await extras(db);
  await historial(db);

  await db.query('COMMIT');
  console.log(`\nContraseña de todas las cuentas demo: ${PASSWORD_DEMO}`);
} catch (e) {
  await db.query('ROLLBACK');
  console.error('✖ Error, no se guardó nada:', e.message);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
