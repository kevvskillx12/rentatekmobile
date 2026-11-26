// Cambios de esquema. Todas las sentencias son idempotentes: se pueden ejecutar
// cada vez que arranca el servidor sin romper nada.
export async function migrar(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id serial PRIMARY KEY,
      nombre text NOT NULL UNIQUE,
      descripcion text NOT NULL DEFAULT '',
      imagen text,
      orden int NOT NULL DEFAULT 0
    );

    -- Usuarios: perfil, verificación, suspensión, recuperación de contraseña y rol admin
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono text;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verificado boolean NOT NULL DEFAULT false;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido boolean NOT NULL DEFAULT false;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_hash text;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_expira timestamptz;
    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('cliente', 'proveedor', 'admin'));

    -- Solicitudes con rango de fechas
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS fecha_inicio date;
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS fecha_fin date;
    UPDATE solicitudes
       SET fecha_inicio = (created_at AT TIME ZONE 'America/Mexico_City')::date + 2,
           fecha_fin = (created_at AT TIME ZONE 'America/Mexico_City')::date + 1 + dias
     WHERE fecha_inicio IS NULL;
    CREATE INDEX IF NOT EXISTS solicitudes_maquina_idx ON solicitudes (maquina_id, estado);

    CREATE TABLE IF NOT EXISTS resenas (
      id serial PRIMARY KEY,
      solicitud_id int NOT NULL UNIQUE REFERENCES solicitudes(id) ON DELETE CASCADE,
      maquina_id int NOT NULL REFERENCES maquinaria(id) ON DELETE CASCADE,
      cliente_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      proveedor_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      calificacion int NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
      comentario text NOT NULL DEFAULT '',
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS resenas_maquina_idx ON resenas (maquina_id);
    CREATE INDEX IF NOT EXISTS resenas_proveedor_idx ON resenas (proveedor_id);

    CREATE TABLE IF NOT EXISTS favoritos (
      usuario_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      maquina_id int NOT NULL REFERENCES maquinaria(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (usuario_id, maquina_id)
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id serial PRIMARY KEY,
      usuario_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo text NOT NULL DEFAULT 'info',
      titulo text NOT NULL,
      mensaje text NOT NULL DEFAULT '',
      enlace text,
      leida boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx ON notificaciones (usuario_id, leida, created_at DESC);

    CREATE TABLE IF NOT EXISTS mensajes (
      id serial PRIMARY KEY,
      solicitud_id int NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
      autor_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      texto text NOT NULL,
      leido boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS mensajes_solicitud_idx ON mensajes (solicitud_id, created_at);

    CREATE TABLE IF NOT EXISTS contactos (
      id serial PRIMARY KEY,
      nombre text NOT NULL,
      email text NOT NULL,
      asunto text NOT NULL DEFAULT '',
      mensaje text NOT NULL,
      atendido boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
  `);
}
