# CLAUDE.md — Cuaderno de bitácora · Porra Mundial 2026

## Descripción

Aplicación web para gestionar una porra (quiniela de fútbol) del Mundial 2026 entre un grupo de amigos ("La Porra del Chat"). Cada participante elige 14 selecciones nacionales por categoría y un once de jugadores. El sistema calcula y muestra una clasificación en tiempo real basada en los resultados reales del torneo, con un motor de puntuación que implementa reglas propias detalladas (multiplicadores por fase, capitán doble, suplentes, portero improvisado, etc.). El admin carga los resultados; el público solo ve la clasificación.

---

## Stack y dependencias clave

### Frontend — `./` (raíz)
| Tecnología | Versión | Por qué |
|---|---|---|
| React | 19 | Framework principal |
| Create React App | 5 (react-scripts) | Bundler — **no migrado a Vite** para no perder UI existente |
| React Router DOM | 7 | Navegación SPA |
| CSS manual | — | Sin Tailwind: diseño ya establecido con variables propias |

> **Firebase** está en `package.json` como dependencia inactiva de un plan anterior. No se usa. Se puede eliminar.

### Backend — `./server/`
| Tecnología | Versión | Por qué |
|---|---|---|
| Node + Express | — | Servidor ligero, sin overhead |
| TypeScript | 5 | Motor de cálculo tipado y testeable |
| better-sqlite3 | 9 | SQLite síncrono, archivo único, sin Docker |
| bcryptjs | 2 | Hash de contraseñas del admin |
| jsonwebtoken | 9 | Auth JWT para el panel de admin |
| Jest + ts-jest | 29 | 115 tests del motor de puntuación |

La capa de datos está aislada en `repositories/` → cambiar a Postgres/Supabase sin tocar el motor de cálculo.

---

## Estructura de carpetas

```
porra-mundial/
│
├── src/                              Frontend React (CRA)
│   ├── App.js                        Router principal + rutas públicas y /admin
│   ├── App.css                       Estilos globales (azul Real Sociedad #003DA5)
│   ├── hooks/
│   │   └── useApi.js                 Fetch wrapper con token JWT en cabecera
│   └── components/
│       ├── ArmaTuPorra/              Wizard de creación de porra (UI completa, SIN backend aún)
│       ├── Clasificacion/            Ranking público + desglose por participante
│       ├── Normas/                   Página de reglas (estática)
│       └── Admin/                   Panel de administración protegido por JWT
│
├── server/                           Backend Node + Express + TypeScript
│   ├── src/
│   │   ├── types/index.ts            Tipos compartidos de todo el sistema
│   │   ├── db/
│   │   │   ├── schema.sql            DDL completo con índices
│   │   │   ├── database.ts           Singleton better-sqlite3
│   │   │   └── migrate.ts           Aplica schema al arrancar
│   │   ├── services/
│   │   │   ├── scoring/             ★ NÚCLEO DEL SISTEMA (función pura + 115 tests)
│   │   │   │   ├── engine.ts         Orquestador: eventos + porras → clasificación
│   │   │   │   ├── selecciones.ts    Puntuación de equipos
│   │   │   │   ├── jugadores.ts      Puntuación de jugadores
│   │   │   │   ├── multipliers.ts    Tabla de multiplicadores por fase
│   │   │   │   ├── scoring-tables.ts Tablas base + funciones doblete/hat-trick
│   │   │   │   └── engine.test.ts   115 tests de todos los criterios
│   │   │   └── besoccer/            Scraper opcional (desactivado por defecto)
│   │   │       ├── scraper.ts        Descarga HTML de BeSoccer
│   │   │       ├── parser.ts         HTML → borrador de eventos
│   │   │       └── reconciler.ts     Fuzzy matching de nombres jugador/equipo
│   │   ├── repositories/            Capa de datos (única que toca SQLite)
│   │   │   ├── teams.repo.ts
│   │   │   ├── players.repo.ts
│   │   │   ├── matches.repo.ts      + PhaseResultsRepo
│   │   │   ├── events.repo.ts
│   │   │   ├── porras.repo.ts       + ParticipantsRepo, findAllFull()
│   │   │   └── scores.repo.ts       Caché de puntuaciones calculadas
│   │   ├── routes/
│   │   │   ├── auth.routes.ts        POST /api/auth/login
│   │   │   ├── public.routes.ts      GET /api/clasificacion, /api/teams, /api/players
│   │   │   ├── admin.routes.ts       CRUD completo + POST /api/admin/recalcular
│   │   │   └── scraper.routes.ts     POST fetch borrador + save-draft
│   │   ├── middleware/
│   │   │   ├── auth.ts               Verifica JWT en cabecera Authorization
│   │   │   └── errors.ts             Handler centralizado de errores Express
│   │   ├── scripts/
│   │   │   └── create-admin.ts       CLI para crear/actualizar usuario admin
│   │   └── index.ts                  Entry point: aplica migraciones y arranca Express
│   ├── .env.example                  Variables de entorno documentadas
│   ├── .gitignore                    Excluye node_modules/, dist/, *.db
│   ├── package.json
│   └── tsconfig.json
│
├── public/                           Assets estáticos (Logo_Mundial.png, etc.)
├── package.json                      Frontend deps + "proxy": "http://localhost:3001"
└── CLAUDE.md                         Este archivo
```

---

## Cómo arrancar en local

### 1. Backend (puerto 3001)

```bash
cd server
cp .env.example .env          # editar JWT_SECRET con una cadena aleatoria larga
NODE_TLS_REJECT_UNAUTHORIZED=0 npm install    # ver nota SSL abajo
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
```

> **⚠️ `NODE_TLS_REJECT_UNAUTHORIZED=0` es un parche temporal**, no una práctica segura.
> El problema: `better-sqlite3` intenta descargar un prebuild desde GitHub y el certificado SSL falla en esta máquina (Darwin 22.6.0 con Node 20 instalado via Homebrew). Una vez instalados los `node_modules`, ya **no hace falta** este flag para `npm run dev` ni para los tests. Solo es necesario en la primera instalación o si se limpia `node_modules`. Solución permanente pendiente: actualizar los certificados del sistema o usar `npm config set strict-ssl false` a nivel global (menos recomendable).

### 2. Crear el primer admin (solo la primera vez)

```bash
cd server
NODE_TLS_REJECT_UNAUTHORIZED=0 npx ts-node src/scripts/create-admin.ts admin@ejemplo.com mipassword
```

### 3. Frontend (puerto 3000)

```bash
cd ..          # raíz del proyecto
npm start
```

El frontend hace proxy automático de `/api/*` → `http://localhost:3001` (configurado en `package.json`).

### 4. Ejecutar tests del motor

```bash
cd server
NODE_TLS_REJECT_UNAUTHORIZED=0 npm test
# → 115 tests, 0 failures
```

### Rutas de la aplicación

| URL | Descripción |
|---|---|
| `/` | Landing page |
| `/arma-tu-porra` | Wizard de creación de porra (UI, sin persistencia aún) |
| `/clasificacion` | Ranking público con desglose |
| `/normas` | Reglas del juego |
| `/admin` | Panel de administración (requiere login) |

---

## Estado actual

### ✅ Terminado

- **Landing page** — diseño con logo, stats bar, colores azul Real Sociedad (`#003DA5`)
- **Pestaña Normas** — reglas completas, fondo blanco, multiplicadores y tablas correctas
- **Motor de puntuación** — función pura `calcularClasificacion()`, 115 tests cubriendo todos los casos
- **Base de datos** — schema SQLite completo con índices (`server/src/db/schema.sql`)
- **Backend REST** — Express con rutas públicas, admin (protegido JWT) y scraper
- **Panel admin** — login, CRUD selecciones/jugadores/partidos/eventos, gestión de porras y alineaciones, botón "Recalcular clasificación"
- **Pestaña Clasificación** — ranking general clickable + desglose completo por selección y jugador, con cada concepto y modificadores desglosados
- **Scraper BeSoccer** — stub funcional: descarga HTML, extrae marcador básico, conciliador de nombres por trigramas; desactivado por defecto

### ❌ Pendiente / incompleto

- **`ArmaTuPorra` no guarda en backend** — el wizard es UI completa (3 pasos: selecciones, alineación, revisión) pero al finalizar no llama al API. Falta conectar el paso de revisión (`PasoRevision.js`) con `POST /api/admin/porras-create` + `setSelections` + `setLineup`
- **Sin datos semilla** — hay que cargar manualmente los 48 equipos del Mundial 2026, jugadores y partidos desde el panel admin (o crear un script `seed.ts`)
- **Validación server-side de porras** — el frontend valida la estructura (14 equipos, composición del once, mínimos por categoría), pero el backend acepta cualquier cosa sin verificar
- **El campo de formación tiene errores visuales** — `CampoFormacion.js` tiene bugs conocidos (commit `b9c35f7` los menciona explícitamente). No crítico para el funcionamiento
- **Parser de BeSoccer incompleto** — extrae marcador pero los eventos de jugadores (goles, asistencias, minutos) devuelven lista vacía; requiere ingeniería inversa del HTML de BeSoccer
- **Firebase sin usar** — `firebase` en `package.json` del frontend, no referenciado en ningún fichero. Eliminar o decidir si se va a usar

---

## Decisiones de diseño importantes

### Multiplicadores de fase
`×1` (grupos / 16avos / octavos) → `×1.5` (cuartos) → `×2` (semis) → `×3` (final)
Los valores originales del prompt eran ×1/×2/×3/×4; el usuario los cambió en la sesión de Normas y el motor usa los de Normas como fuente de verdad. Están en `multipliers.ts`.

### Bonus planos (sin multiplicador)
`ganarMundial` (50/100/200/400 según categoría) y `mvpMundial` (+50) **nunca se multiplican** por fase, aunque otros puntos del mismo partido sí. Se implementa pasando `phaseMultiplier: 1` explícitamente en el ítem de desglose.

### Penalti fallado: dos valores distintos
- En juego: **−20** (`PENALTIES.penaltiAlladoPlay`)
- En tanda: **−10** (`PENALTIES.penaltiAlladoShootout`)
Ambos en `scoring-tables.ts`. El criterio está comentado allí para que sea fácil de cambiar si se decide unificar.

### Penalizaciones no se multiplican por fase
Tarjeta roja, penalti cometido, penalti fallado, gol en propia: se aplican con `phaseMultiplier: 1` siempre. Son sanciones deportivas, no méritos. Esto está documentado con un comentario en `jugadores.ts`.

### BeSoccer es opcional y no bloquea nada
El sistema funciona al 100% sin el scraper: el admin carga eventos a mano. BeSoccer solo genera borradores (`is_confirmed: 0`) que el admin revisa y confirma. Desactivar con `BESOCCER_ENABLED=false` en `.env`.

### Motor puro sin I/O
`calcularClasificacion()` no toca la BD. Recibe arrays de tipos y devuelve la clasificación completa. Esto permite testear exhaustivamente sin mocks ni bases de datos de test.

### CRA en lugar de Vite + TypeScript
El prompt sugería migrar a Vite + TS, pero ya había UI funcionando en CRA/JS. Se decidió conservar CRA para no tirar semanas de trabajo. La migración es posible cuando el proyecto esté estable.

### Desglose total transparente
Cada punto tiene su `ScoreLineItem` con concepto, fase, basePoints, phaseMultiplier, winnerMultiplier, roleMultiplier y finalPoints. El frontend muestra este desglose al hacer clic en un participante. El objetivo es que nadie discuta la puntuación.

---

## Próximos pasos sugeridos

1. **Conectar `ArmaTuPorra` al backend** — `PasoRevision.js` necesita llamar a la API al pulsar "Confirmar". Es el paso más urgente para que los participantes puedan guardar sus porras.
2. **Script de seed** — cargar los 48 equipos del Mundial 2026 con sus categorías, jugadores titulares conocidos y el calendario de partidos. Un `server/src/scripts/seed.ts` ahorraría horas de clicks en el admin.
3. **Validación server-side de porras** — añadir checks en `admin.routes.ts` al guardar selecciones y alineación: 14 equipos con distribución correcta, mínimos por categoría en el once, exactamente 1 capitán, máximo 1 Favorito en suplentes.
4. **Eliminar Firebase** — borrar la dependencia de `package.json` a menos que haya un plan concreto para usarla.
5. **Resolver SSL de better-sqlite3** — investigar si el problema es de certificados del sistema en este Mac o una configuración de Node/npm. Mientras tanto el workaround es funcional.
6. **Mejorar parser de BeSoccer** — cuando empiece el torneo, habrá que invertir tiempo en parsear los eventos de jugadores (minutos, goles, asistencias, tarjetas) desde el HTML de BeSoccer o buscar una fuente alternativa con API pública.
7. **Arreglar `CampoFormacion.js`** — tiene errores visuales conocidos en la representación del campo de fútbol.
8. **Deployment** — decidir dónde se despliega (Railway, Fly.io, VPS propio). El SQLite simplifica mucho el hosting: un solo proceso, un solo archivo de BD.

---

## Pendientes y dudas abiertas

| # | Duda | Impacto |
|---|---|---|
| 1 | ¿Los 48 equipos y sus categorías ya están decididos? Si es así, crear `seed.ts` es prioritario. | Alto — sin datos el sistema no se puede probar end-to-end |
| 2 | ¿`ArmaTuPorra` debe guardar vía el panel admin (el admin introduce cada porra) o los propios participantes tienen acceso para guardarla ellos? | Alto — afecta el flujo de auth y si se necesitan cuentas de usuario |
| 3 | ¿El SSL de better-sqlite3 es un problema de esta máquina en concreto o de la red? `NODE_TLS_REJECT_UNAUTHORIZED=0` en `npm install` no es aceptable en producción. | Medio — parche funcional en dev, pero debe resolverse antes de CI/CD |
| 4 | ¿Firebase se queda o se borra? No hace nada ahora mismo. | Bajo — limpieza |
| 5 | ¿El "Ganar Penaltis" en la fase de grupos tiene sentido? En grupos normalmente no hay tandas. No hay validación que lo impida en el motor. | Bajo — borde case improbable |
| 6 | ¿La pestaña "Arma tu Porra" en el nav público debe seguir ahí cuando las porras estén cerradas? ¿O se oculta/deshabilita? | Bajo — UX post-inicio del torneo |

---

> **Mantén este archivo actualizado tras cada cambio relevante.**
