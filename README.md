# Rentatek

Plataforma de renta de maquinaria. Este repositorio contiene las dos aplicaciones del proyecto, cada una de forma independiente:

```
.
├── web/      Aplicación web (Svelte + Vite) y API (Node/Express + PostgreSQL)
│   ├── frontend/
│   └── backend/
└── movil/    Aplicación móvil (Flutter)
```

## Web

Requisitos: Node.js 18+.

```bash
cd web
npm run install:all          # instala raíz, backend y frontend
cp backend/.env.example backend/.env   # y rellena DATABASE_URL y JWT_SECRET
npm run dev                  # levanta API (puerto 3001) y frontend a la vez
```

Más detalles en `web/frontend/README.md` y `web/backend/README.md`.

## Móvil

Requisitos: Flutter SDK.

```bash
cd movil
flutter pub get
flutter run
```
