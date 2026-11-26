# Rentatek API

API en Express que conecta el frontend con PostgreSQL (tablas `usuarios`, `maquinaria`, `solicitudes`).

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
