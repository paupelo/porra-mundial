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
| **PostgreSQL (pg)** | 8 | **Migrado de SQLite a Render Postgres (Frankfurt) en `c91797a`**. `DATABASE_URL` en `.env` |
| bcryptjs | 2 | Hash de contraseñas del admin |
| jsonwebtoken | 9 | Auth JWT para el panel de admin |
| Jest + ts-jest | 29 | 134 tests (115 del motor + 19 del mapper de FIFA) |

La capa de datos está aislada en `repositories/` (única que toca Postgres).

### Hosting
Servicio web en Render (plan free, Frankfurt) con auto-deploy desde `master` de GitHub.
Un solo proceso sirve el frontend compilado (`build/`) y la API: `https://porra-mundial-1rco.onrender.com`.
⚠️ El plan free duerme el proceso tras ~15 min sin tráfico → el scheduler de FIFA solo corre despierto;
para puntuación realmente automática hace falta un ping externo periódico (p. ej. cron-job.org o UptimeRobot
golpeando la home cada 10 min) o subir de plan.

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
│   │   │   ├── recalc.ts            Recalcula y persiste: porra_scores + logs por partido
│   │   │   ├── scheduler.ts         Scraping automático: tick cada 60s, estado derivado de la BD
│   │   │   ├── fifa/                ★ Scraper de FIFA (api.fifa.com/v3, JSON)
│   │   │   │   ├── client.ts         fetch con reintentos/backoff; endpoints seasons/calendar/timeline/live
│   │   │   │   ├── mapper.ts         Funciones puras JSON FIFA → dominio (fases, estados, eventos, minutos)
│   │   │   │   ├── mapper.test.ts    19 tests (códigos de evento verificados con datos reales 2026)
│   │   │   │   └── sync.ts           Orquestador: upsert de partidos + borradores de eventos
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
│   │   │   ├── scores.repo.ts       Caché de puntuaciones calculadas
│   │   │   └── points-log.repo.ts   team_points_log / player_points_log (desglose por partido)
│   │   ├── routes/
│   │   │   ├── auth.routes.ts        POST /api/auth/login
│   │   │   ├── public.routes.ts      GET /api/clasificacion, /api/matches, /api/teams, /api/players
│   │   │   ├── admin.routes.ts       CRUD completo + POST /api/admin/recalcular (confirmar ⇒ recalcula)
│   │   │   ├── fifa.routes.ts        /api/admin/fifa: status, sync, tick, sync-match, matches-overview
│   │   │   ├── scraper.routes.ts     POST fetch borrador + save-draft (BeSoccer, legacy)
│   │   │   └── submit.routes.ts      POST /api/submit (envío público de porras, deadline 11-jun 19:00)
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
- **Puntuación automática FIFA** — scraper de api.fifa.com + scheduler + recálculo automático al confirmar + logs por partido + UI en Clasificación y Admin (ver sección propia más arriba)

### ❌ Pendiente / incompleto

- **`ArmaTuPorra` no guarda en backend** — el wizard es UI completa (3 pasos: selecciones, alineación, revisión) pero al finalizar no llama al API. Falta conectar el paso de revisión (`PasoRevision.js`) con `POST /api/admin/porras-create` + `setSelections` + `setLineup`
- **Sin datos semilla** — hay que cargar manualmente los 48 equipos del Mundial 2026, jugadores y partidos desde el panel admin (o crear un script `seed.ts`)
- **Validación server-side de porras** — el frontend valida la estructura (14 equipos, composición del once, mínimos por categoría), pero el backend acepta cualquier cosa sin verificar
- **El campo de formación tiene errores visuales** — `CampoFormacion.js` tiene bugs conocidos (commit `b9c35f7` los menciona explícitamente). No crítico para el funcionamiento
- **Parser de BeSoccer incompleto** — extrae marcador pero los eventos de jugadores (goles, asistencias, minutos) devuelven lista vacía; requiere ingeniería inversa del HTML de BeSoccer
- **Firebase sin usar** — `firebase` en `package.json` del frontend, no referenciado en ningún fichero. Eliminar o decidir si se va a usar

---

## Puntuación automática con scraping de FIFA (junio 2026)

### Arquitectura

```
api.fifa.com/v3 ──► fifa/client.ts ──► fifa/mapper.ts ──► fifa/sync.ts ──► matches + match_player_events (borradores)
                                                                                │
        scheduler.ts (tick 60s) ────────────────────────────────────────────────┤
                                                                                ▼
        admin confirma partido ──► recalc.ts ──► porra_scores + team_points_log + player_points_log
                                                                                ▼
        Clasificación (polling 60s) ◄── /api/clasificacion + /api/matches
```

- **Fuente:** la página pública de fifa.com es una SPA; se consume su API JSON interna
  (`api.fifa.com/api/v3`). El IdSeason del Mundial 2026 (**285023**) se descubre solo;
  `FIFA_SEASON_ID` lo fija a mano si hiciera falta. Todo el scraping ocurre en el servidor.
- **Códigos de evento verificados contra el partido inaugural real** (México 2-0 Sudáfrica, 11-jun-2026):
  `0` gol · `1` asistencia (evento propio) · `3`/`4` roja · `5` cambio · `2,7,8,12,15,16,18,26,57,71,78,79,83` ruido ignorado.
  `34` autogol, `41` penalti fallado, `60` penalti parado y `Period=11` (tanda) quedan por verificar
  cuando ocurran; hay respaldo por texto de la descripción y todo entra como borrador.
- **Conciliación de nombres:** equipos por `country_code` FIFA (ARG, MEX…); jugadores por
  similitud de trigramas (`besoccer/reconciler.ts`) contra la plantilla del equipo, umbral 0.45.
  Los no conciliados se loguean y el admin los carga a mano.

### Política de puntuación (¡importante!)

- El **marcador** de un partido finalizado puntúa automáticamente tras el scrape + recálculo
  (las victorias/derrotas/empates salen de `matches`, es un hecho objetivo → clasificación en tiempo real).
- Los **eventos de jugadores** entran como borrador (`source='fifa_draft'`, `is_confirmed=0`) y solo
  puntúan cuando el admin pulsa "Confirmar partido" (que ahora también dispara el recálculo).
  `FIFA_AUTO_CONFIRM=true` salta esa revisión (no recomendado).
- En **eliminatorias** se derivan `advanced`/`eliminated`/`winner` automáticamente al acabar el partido,
  sin pisar lo que el admin haya fijado a mano. La **fase de grupos queda manual** (depende de
  clasificaciones y mejores terceros). El partido por el **tercer puesto se omite** (la porra no lo puntúa).
- El scraper **nunca pisa datos validados**: si un partido tiene eventos confirmados, FIFA solo
  actualiza `last_scraped_at`.

### Scheduler (`services/scheduler.ts`)

- Tick cada 60 s. **Sin estado propio persistente**: cada tick decide mirando la BD
  (`status`, `last_scraped_at`, eventos existentes) → sobrevive a reinicios.
- Calendario completo: 1 petición. Refresco cada 6 h (`FIFA_CALENDAR_REFRESH_HOURS`), o cada
  10 min si hay partidos "calientes" (en juego, o programados cuya hora de fin estimada ya pasó:
  inicio + `FIFA_MATCH_DURATION_MIN` 105' + `FIFA_SCRAPE_DELAY_MIN` 15'). Cubre prórrogas y penaltis.
- Partido finalizado sin eventos → descarga timeline + alineaciones y guarda borradores (una sola vez;
  re-scrape manual desde el admin si hace falta).
- Disparos manuales: `POST /api/admin/fifa/tick` (ciclo completo) y botón "Sincronizar con FIFA ahora"
  en la sección **Resultados y eventos** del admin.

### Tablas nuevas (todas aditivas; nada existente se modifica)

- `matches` ganó columnas: `fifa_match_id` (único), `fifa_stage_id`, `group_name`, `venue`, `last_scraped_at`.
- `team_points_log` / `player_points_log`: desglose de puntos por porra × partido (JSONB con los
  `ScoreLineItem` del motor, brutos, multiplicador, total). Son una **proyección derivada**: se
  regeneran completas en cada recálculo; la fuente de verdad sigue siendo eventos + porras.
- Migraciones idempotentes en `migrate.ts`: los `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` de `matches`
  corren **antes** de `schema.sql` (este crea un índice sobre `fifa_match_id`); el CHECK de
  `match_player_events.source` se amplía con un par DROP+ADD idempotente para admitir `'fifa_draft'`.

### Frontend (solo lógica/datos añadidos, cero cambios de diseño)

- **Clasificación:** polling cada 60 s + columna "Dif." con el líder.
- **Detalle de participante:** cada selección/jugador muestra tabla por partido
  (Rival | Resultado | Fase | Brutos | Mult. | Pts) con desglose concepto a concepto expandible,
  y modal "📜 Histórico completo" (`HistorialPorPartido.js`, componente nuevo).
- **Admin → "Resultados y eventos"** (`AdminResultados.js`, sección nueva): estado del scheduler,
  partidos con badge ⚠️ PENDIENTE, eventos editables inline, "Confirmar partido (recalcula puntos)"
  y re-scrape por partido.

### Variables de entorno nuevas (ver `.env.example`)

`FIFA_ENABLED` (true) · `FIFA_COMPETITION_ID` (17) · `FIFA_SEASON_ID` (autodescubierto) ·
`FIFA_MATCH_DURATION_MIN` (105) · `FIFA_SCRAPE_DELAY_MIN` (15) · `FIFA_CALENDAR_REFRESH_HOURS` (6) ·
`FIFA_AUTO_CONFIRM` (false)

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
