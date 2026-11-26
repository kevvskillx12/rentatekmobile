# Rentatek API

API en Express que conecta el frontend con PostgreSQL. Tablas: `usuarios`, `maquinaria`, `solicitudes`, `categorias`, `resenas`, `favoritos`, `notificaciones`, `mensajes`, `contactos`.

Las migraciones (`db/migraciones.js`) se aplican solas al arrancar el servidor. `npm run seed` carga datos de demostración (contraseña de todas las cuentas demo: `Rentatek123`, admin: `admin@demo.rentatek.mx`).

## Arrancar en local

```bash
# terminal 1
cd backend
cp .env.example .env   # y rellena DATABASE_URL y JWT_SECRET
npm install
npm run dev            # http://localhost:3001

# terminal 2
cd frontend
npm run dev            # Vite redirige /api -> localhost:3001
```

## Producción

- Despliega `backend/` (p. ej. Render Web Service, `npm start`) con las variables `DATABASE_URL`, `JWT_SECRET` y opcionalmente `CORS_ORIGIN`.
- Compila el frontend con `VITE_API_URL=https://tu-api.onrender.com npm run build`.

## Endpoints

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/auth/registro`, `/api/auth/login` | público |
| GET | `/api/maquinaria`, `/api/maquinaria/:id` | público |
| GET | `/api/proveedor/resumen`, `/maquinaria`, `/solicitudes` | proveedor |
| POST/PUT/DELETE | `/api/proveedor/maquinaria[/:id]` | proveedor |
| PATCH | `/api/proveedor/maquinaria/:id/estado` | proveedor |
| PATCH | `/api/proveedor/solicitudes/:id` (`aceptada`/`rechazada`) | proveedor |
| GET/POST | `/api/cliente/solicitudes` | cliente |
| PATCH | `/api/cliente/solicitudes/:id/cancelar` | cliente |
| POST | `/api/auth/olvide`, `/api/auth/restablecer` | público |
| PUT | `/api/auth/perfil`, `/api/auth/password` | con sesión |
| GET | `/api/categorias`, `/api/estadisticas`, `/api/maquinaria/filtros` | público |
| GET | `/api/maquinaria?q&categoria&ciudad&precio_max&disponibles&orden&pagina&limite` | público (paginado) |
| GET | `/api/maquinaria/:id/ocupadas`, `/api/maquinaria/:id/resenas` | público |
| GET/POST/DELETE | `/api/favoritos[/:id]` | con sesión |
| GET/PATCH | `/api/notificaciones` | con sesión |
| GET/POST | `/api/solicitudes/:id/mensajes` (chat) | cliente o proveedor de la solicitud |
| POST | `/api/cliente/solicitudes/:id/resena` | cliente |
| GET | `/api/proveedor/ingresos` | proveedor |
| GET/PATCH/DELETE | `/api/admin/...` (usuarios, maquinaria, contactos) | admin |
| POST | `/api/contacto` | público |
