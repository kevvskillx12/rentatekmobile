# Rentatek

Plataforma de renta de maquinaria pesada. Este repositorio reúne las versiones del proyecto, cada una en su carpeta:

```
.
├── jesus/
│   ├── web/       Página web (Svelte + Vite) y API (Node/Express + PostgreSQL)
│   │   ├── backend/
│   │   └── frontend/
│   └── movil/     App Android (Capacitor) que empaqueta la web de jesus/web/frontend
├── kevin/
│   └── movil/     App móvil en Flutter
└── render.yaml    Despliegue del backend de jesus/web en Render
```

## jesus/web — web + API

Requisitos: Node.js 18+.

```bash
cd jesus/web
npm run install:all                      # instala raíz, backend y frontend
cp backend/.env.example backend/.env     # rellena DATABASE_URL y JWT_SECRET (SMTP_* opcional)
npm --prefix backend run seed            # opcional: datos de demostración
npm run dev                              # API en :3001 y web en :5173
```

Funciones: catálogo paginado, 13 categorías de maquinaria pesada, fechas de renta con calendario,
reseñas, favoritos, chat por solicitud, notificaciones (y correo), proveedores verificados,
gráfica de ingresos, panel de administrador, recuperar contraseña y modo oscuro.
Más detalles en `jesus/web/backend/README.md`.

## jesus/movil — APK de Android (sin Android Studio)

Requisitos: JDK 21 y Android SDK (command-line tools), con `sdk.dir` en `android/local.properties`.

```bash
cd jesus/movil
npm install
# compila la web apuntando al backend que usará la app y genera el APK
VITE_API_URL=https://TU-API.onrender.com npm run apk
# resultado: android/app/build/outputs/apk/debug/app-debug.apk
```

## kevin/movil — app Flutter

Requisitos: Flutter SDK.

```bash
cd kevin/movil
flutter pub get
flutter run
```
