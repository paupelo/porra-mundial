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
| Jest + ts-jest | 29 | 147 tests (motor + overlay en vivo + mapper de FIFA) |

La capa de datos está aislada en `repositories/` (única que toca Postgres).

### Hosting
Servicio web en Render (plan free, Frankfurt) con auto-deploy desde `master` de GitHub.
Un solo proceso sirve el frontend compilado (`build/`) y la API: `https://porra-mundial-1rco.onrender.com`.
⚠️ El plan free duerme el proceso tras ~15 min sin tráfico → el scheduler de FIFA solo corre despierto.
Para mantenerlo despierto hay un **GitHub Action `keep-alive`** (`.github/workflows/keep-alive.yml`) que
golpea la home cada ~10 min (cron de GitHub, gratis, independiente de Render; puede retrasarse algo y se
desactiva si el repo queda 60 días inactivo). Alternativas: cron-job.org / UptimeRobot, o subir de plan.

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
│       ├── Calendario/               Partidos por fecha + detalle con implicados y puntos en vivo
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
│   │   │   │   ├── live.ts           Overlay EN VIVO: provisionales sin tocar el motor (+ tests)
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
  `34` autogol y `Period=11` (tanda) quedan por verificar cuando ocurran; hay respaldo por texto.
  ⚠️ `41` y `60` NO son fiables como código: datos reales (Inglaterra-Croacia, 17-jun-2026) muestran
  `Type 41` con descripción "convierte el penal" = penalti MARCADO (no fallado). Por eso para `41`/`60`
  el desenlace se resuelve por la DESCRIPCIÓN (`penaltyOutcomeFromText`: gol vs fallo vs parada) y solo
  se cae al supuesto (41=fallado, 60=parado) si el texto no lo aclara. Todo entra como borrador.
- **Penalti cometido (deducido, jun-2026):** FIFA NO emite un evento propio de "penalti cometido";
  la falta es un `Type 18` normal (ruido ignorado para puntuar). `aggregateTimeline` recoge las faltas
  y, por cada penalti en juego, asigna `penalty_conceded` al jugador del equipo DEFENSOR (el que NO
  lanza) que cometió la última falta en los ≤5 min previos al lanzamiento. Una sola penalización por
  falta aunque el penalti se repita. Verificado con datos reales (Modrić comete y Kane lanza,
  Inglaterra-Croacia 17-jun). Aplica en vivo y final.
- **Conciliación de nombres:** equipos por `country_code` FIFA (ARG, MEX…); jugadores por
  similitud de trigramas (`besoccer/reconciler.ts`) contra la plantilla del equipo, umbral 0.45.
  Los no conciliados se loguean y el admin los carga a mano.

### Política de puntuación (¡importante!)

- **Sin aprobación manual (desde jun-2026):** en cuanto un partido pasa a `finished` —por scraping
  o marcándolo el admin— sus eventos se confirman y puntúan automáticamente. El scheduler confirma
  en cada tick cualquier evento sin confirmar de partidos finalizados, y el `PUT /api/admin/matches/:id`
  con `status='finished'` confirma + recalcula. Corregir un evento (`POST /api/admin/events`) también
  recalcula al guardar. El botón "Confirmar partido" se eliminó de la UI (el endpoint
  `/events/:matchId/confirm` sigue existiendo por compatibilidad). `FIFA_AUTO_CONFIRM` ya no se usa.
- El **marcador** de un partido finalizado puntúa con el recálculo
  (las victorias/derrotas/empates salen de `matches`, es un hecho objetivo → clasificación en tiempo real).
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

- `matches` ganó columnas: `fifa_match_id` (único), `fifa_stage_id`, `group_name`, `venue`, `last_scraped_at`,
  y (jun-2026) `home_goal_minutes` / `away_goal_minutes` (`INTEGER[]`, minutos de gol por equipo).
- `match_player_events` ganó (jun-2026) `minute_in` / `minute_out` (intervalo en campo del jugador).
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
  - **Subtotales por bloque (jun-2026):** al final del bloque "Selecciones" y del bloque "Jugadores"
    (pestaña "📊 Puntuación") se muestra una línea destacada "Total selecciones: X pts" / "Total
    jugadores: X pts" (`SubtotalBloque` en `DetalleParticipante.js`). Se calcula en el frontend
    sumando los `totalPoints` que ya llegan en `breakdown.selecciones`/`breakdown.jugadores` (sin
    endpoints ni recálculo nuevos); la suma de ambos subtotales coincide con el "Total" general de la
    cabecera. Mismo estilo que el total general (azul #003DA5 sobre etiqueta gris).
- **Admin → "Resultados y eventos"** (`AdminResultados.js`, sección nueva): estado del scheduler,
  partidos con badge ⚠️ PENDIENTE, eventos editables inline, "Confirmar partido (recalcula puntos)"
  y re-scrape por partido.

### Puntuación EN VIVO (junio 2026)

- **Modelo:** `matches` ganó `minute`, `live_home_score`, `live_away_score` (el marcador FINAL
  sigue en `home/away_score`); `match_player_events.is_live` marca eventos provisionales;
  `team_points_log`/`player_points_log` ganaron `is_live` (los logs hacen de snapshot: al
  regenerarse en cada recálculo, el provisional se "cierra" solo cuando el partido finaliza).
- **Scraper en vivo** (`fifa/sync.ts` → `syncLiveMatch`): mientras un partido está `live`, el
  scheduler lo pollea **cada tick (60 s)**: minuto + marcador provisional + eventos nuevos como
  `is_live=1, is_confirmed=0`. Cuando el endpoint live detecta el final, el calendario (fuente
  autoritativa del resultado/penaltis) se refresca en el mismo tick y el scrape final
  (`syncMatchEvents`) sustituye los provisionales (`clearLiveFlags`); el scheduler los confirma
  automáticamente en el mismo tick (sin aprobación manual). El paso `pending→live` lo hace el
  refresco rápido del calendario (10 min), activado en cuanto pasa la hora de inicio.
- **Motor intacto — overlay en vivo** (`scoring/live.ts`, funciones puras): a los partidos `live`
  se les sintetiza una copia `finished` con el marcador provisional y sus eventos `is_live` se
  tratan como confirmados; tras el motor, los ítems de esos partidos se marcan `isLive` y se
  eliminan los conceptos solo-finales (`porteriaCero*`).
  - **Puntúa en vivo (provisional, cambia con cada poll):** goles a favor/en contra, asistencias,
    rojas, penaltis cometidos/fallados/parados en juego, goles en propia, victoria/empate/derrota
    según el marcador parcial. Multiplicador de fase igual que en modo final.
  - **Solo al finalizar:** resultado definitivo (incl. tanda), portería a 0, pasar ronda,
    ganar tanda, ganar Mundial, MVP.
- **Frontend:** la Clasificación incluye los provisionales (la caché `porra_scores` guarda el
  combinado) y el desglose por partido muestra la etiqueta "🔴 Provisional (en vivo)".
- **Cómo simular un partido en vivo** (testing): con un token de admin,
  `PUT /api/admin/matches/:id` con `{"status":"live","live_home_score":1,"live_away_score":0,"minute":37}`
  y después `POST /api/admin/recalcular`. La Clasificación y el Calendario mostrarán los
  provisionales; para cerrar, volver a poner `status:'finished'` (o dejar que el scheduler lo haga).

### Pestaña "Calendario" (`/calendario`, en el nav entre Clasificación y Normas)

- `src/components/Calendario/` (`Calendario.js` + `Calendario.css` con prefijo `cal-`,
  reutilizando las clases globales de Clasificación: `clas-hero`, `breakdown-table`, etc.).
- Vista principal: partidos agrupados por día (zona horaria del usuario), con fase, grupo, sede
  y badge Próximo / ● En vivo (pulsante, con minuto y marcador) / Finalizado. Polling 60 s a
  `GET /api/matches` (el frontend jamás llama a fifa.com).
- Detalle (`GET /api/calendario/:matchId`): qué porras tienen a los dos equipos (con ⭐ Ganador)
  y qué jugadores de los onces pertenecen a ellos (CAP/Suplente + de quién es la porra). Si el
  partido está en vivo/finalizado, muestra además los puntos de ESTE partido por selección y
  jugador con el desglose por conceptos y la etiqueta "Provisional (en vivo)" / "Definitivo".
  Los puntos salen del `breakdown_json` de `porra_scores` filtrado por `matchId` (sin recálculo).
- **"⚽ Partidos de hoy" (jun-2026):** bloque destacado al principio de la pestaña que muestra solo
  los partidos cuyo día es hoy, ordenados En vivo → Próximos por hora → Finalizados. Reutiliza el
  MISMO componente de tarjeta (`MatchCard`) que el listado general (extraído sin cambios visuales);
  estado vacío discreto "No hay partidos hoy". El calendario completo sigue intacto debajo. Clases
  `cal-today-*` en `Calendario.css`.
  - **Zona de referencia del torneo (jun-2026):** "hoy" se decide por el día natural en la zona del
    torneo `America/Chicago` (`TOURNAMENT_TZ` en `Calendario.js`), no por el día del visitante. Las
    sedes del Mundial están en EE.UU./Canadá/México y Chicago (CDT/CST) es la más central; así un
    partido nocturno de América no "se escapa" al día siguiente para quien lo mira desde Europa. El
    filtro compara `ymdInTz(match_date, 'America/Chicago')` con `ymdInTz(now, 'America/Chicago')`.
    Las horas se siguen mostrando en la zona local del navegador; cuando el partido cae en un día
    distinto en esa zona local respecto al día del torneo, se añade un sufijo discreto " (+1)" /
    " (-1)" junto a la hora (`dayOffsetSuffix`), solo en este bloque (el calendario general no cambia).

### Progreso de la jornada en curso en Clasificación (jun-2026)

Indicador informativo (NO altera puntos ni scoring) que muestra, por participante, cuántas de sus
selecciones y jugadores ya han disputado partido en la ronda activa — explica por qué unos suman
más que otros sin implicar que vayan ganando.
- **Backend puro** (`services/jornada.ts`, con tests): `deriveGroupMatchdays` reparte cada grupo en
  Jornadas 1/2/3 ordenando sus partidos por fecha (no hay columna `matchday`: se deriva, sin tocar
  datos); `currentRound` = ronda de menor índice con partidos sin finalizar (frontera del torneo),
  así el contador se reinicia solo al completarse una jornada/ronda; `computeProgresoJornada` cuenta
  por participante selecciones/jugadores con partido en esa ronda y cuántos ya empezaron (live/finished).
  La pertenencia jugador→selección es `player.team_id` (la misma del motor).
- **Endpoint** `GET /api/clasificacion/progreso-jornada` (solo lectura) → `{ jornada:{key,label},
  participantes:[{porraId,participantId,selecciones:{disputadas,total},jugadores:{disputados,total}}] }`.
  ⚠️ Registrado ANTES de `/clasificacion/:porraId` para que Express no lo capture como `:porraId`.
- **Frontend:** banner "Progreso jornada en curso: <ronda>" + columna nueva con dos mini barras
  (🛡️ X/Y selecciones, ⚽ X/Z jugadores). Responsive: en móvil se ocultan las barras y queda el X/Y.
  Polling 60 s junto al ranking; si el endpoint falla, el ranking sigue intacto.

### Indicador de cambio de posición en Clasificación (jun-2026)

Indicador visual ↑/↓ junto al puesto de cada participante en el ranking, que muestra cuántas
posiciones ha subido o bajado respecto al **cierre del día anterior** del Mundial (antes de los
partidos de hoy). Automático, sin acción del admin. NO altera puntos ni scoring; es puramente
informativo, aditivo y de SOLO LECTURA (no hay tabla nueva ni se persiste nada).
- **"Día anterior" determinista, sin snapshots:** se recalcula con el motor puro la clasificación
  considerando solo los partidos `finished` cuyo día es ANTERIOR al de hoy, y se compara con la
  posición actual. No depende de timing (sirve aunque el proceso free duerma) ni de datos guardados:
  funciona retroactivamente con lo que haya en la BD.
- **Zona horaria:** los partidos se agrupan por día en `RANKING_DAY_TZ` (env, por defecto
  `America/Panama`, UTC-5 sin horario de verano). `match_date` se almacena en UTC; el bucketing usa
  `Intl.DateTimeFormat('en-CA', { timeZone })` → `YYYY-MM-DD` comparable.
- **`services/ranking.ts`** (con `computeRankingEntries` + `computePreviousDayPositions`):
  `computeRankingEntries` arma el ranking actual desde la caché `porra_scores` (incluye provisionales
  en vivo); `computePreviousDayPositions` filtra `MatchesRepo`/`EventsRepo` a los partidos de días
  previos, reusa `buildLiveInput`+`calcularClasificacion`+`applyLiveOverlay` (sin partidos live →
  son no-op) y ordena con `rankByPoints`, el MISMO comparador (puntos desc, empate alfabético) que
  el ranking actual, para que los empates no produzcan cambios de posición falsos.
- **Endpoint público:** `GET /api/clasificacion` añade `position_change: number|null` a cada entrada
  (= posición_día_anterior − posición_actual; positivo sube, negativo baja, 0 igual, null si no hay
  ningún día previo con partidos, p. ej. el primer día del torneo). El resto de la respuesta es igual.
- **Frontend Clasificación** (`Clasificacion.js`): componente `PosChange` que pinta `↑N` (verde
  #16a34a) / `↓N` (rojo #dc2626) tras el badge de puesto; null o 0 → no renderiza nada. Sin cambios
  en el resto de la fila ni en el diseño.

### Subsecciones de Clasificación (junio 2026)

La pestaña Clasificación (`/clasificacion`) tiene un selector interno de tres vistas:
- **🏆 Clasificación** — el ranking de siempre (sin cambios).
- **⚖️ Comparador de porras** (`ComparadorPorras.js/.css`) — hasta 4 porras lado a lado:
  selecciones por categoría (con ⭐ Ganador) y once por posición (⭐CAP / supl.). Las
  coincidencias entre las porras comparadas se resaltan con 🤝 y fondo ámbar. Datos de los
  endpoints públicos existentes (`/api/clasificacion` + `/api/porras/:id`). Scroll horizontal en móvil.
- **📊 Resumen de elegidos** (`ResumenElegidos.js/.css`) — todas las selecciones y los jugadores
  elegidos, con acordeón por equipo/jugador mostrando quiénes los eligieron
  (⭐ GANADOR / ⭐CAP / supl.) y barra de popularidad relativa. Se alimenta del endpoint público
  `GET /api/resumen-elegidos` (agrega `PorrasRepo.findAllFull()` —solo aprobadas— en servidor, una petición).
  - **Selector de ordenación (jun-2026):** toggle único que afecta a selecciones y jugadores:
    - **👥 Más elegidos** (por defecto) — orden por nº de porras que lo eligieron (sin cambios respecto a antes).
    - **🔥 Más puntos** — reordena (en frontend) por la puntuación BRUTA AISLADA de cada
      selección/jugador en el torneo desc (empates: más elegidos, luego alfabético) y muestra un
      badge verde "N pts" en cada tarjeta.
    Los puntos vienen del endpoint vía `services/elegidos-scores.ts` (`computeElegidosScores`), que
    **reutiliza las funciones puras del motor** (`calcTeamScore`/`calcPlayerScore`, sin modificarlas)
    con parámetros neutros porra-independientes: selección NO marcada como Ganador (sin ×2 winner; la
    categoría sí es global a la selección); jugador titular sin capitanía ni MVP (sin ×2 ni ×0.5).
    Es la puntuación que esa selección/jugador genera por sus PROPIOS resultados, **independiente de
    cuántos participantes la eligieron** (p. ej. Suecia con 30 pts sale 30, no 30×nº de porras). Los
    partidos en vivo cuentan provisionalmente igual que el ranking (`buildLiveInput` + descarte de
    conceptos solo-finales). Proyección de SOLO LECTURA; no recalcula ni toca el scoring ni los datos.
    ⚠️ Bug corregido (jun-2026): antes se sumaba `points_total` de `team/player_points_log` sobre
    todas las porras, multiplicando los puntos por el nº de participantes que lo eligieron.
    - **Desglose de puntos en el acordeón (jun-2026, SOLO en "Más puntos"):** al desplegar una
      selección/jugador aparece primero "📊 Puntos obtenidos" (desglose concepto a concepto por
      partido) y debajo "🙋 Elegido por (N)" con los participantes. El desglose reutiliza el
      componente `TablaPorPartido` (el mismo del detalle de participante): agrupa los `ScoreLineItem`
      por partido (Rival/Resultado/Fase/Brutos/Mult./Pts) con detalle expandible. El endpoint
      `/api/resumen-elegidos` añade `items` (los `ScoreLineItem` del motor) por selección/jugador,
      producidos por `computeElegidosScores` (mismos parámetros neutros que `points`); el frontend
      también pide `/api/matches` para resolver rival/resultado. En **"Más elegidos"** el acordeón
      sigue mostrando SOLO los participantes, sin cambios. Clases `res-body-col` / `res-subtitulo` /
      `res-chips` en `ResumenElegidos.css`; el desglose hace scroll horizontal en móvil (regla
      scopeada, no toca el `.breakdown-wrap` del detalle de participante).

### Bugs corregidos: "por jugar" y "penalti fallado" (junio 2026)

Dos fallos en la puntuación de jugadores, corregidos a la vez (engine + scraper, sin tocar
ninguna otra lógica).

**BUG 1 — "Por jugar" (5 pts) no se sumaba a suplentes de prórroga/descuento** (p. ej. Lamine
Yamal, Oyarzabal). Causa en dos capas:
- *Engine* (`scoring/jugadores.ts`): la condición era `if (event.minutes_played > 0)`, un umbral de
  minutos que la regla prohíbe.
- *Scraper* (`fifa/sync.ts`): `syncMatchEvents` usaba `durationMin = decided_by_penalties ? 120 : 90`.
  Una eliminatoria resuelta en la **prórroga sin penaltis** recibía 90 → el `minute_in` de un suplente
  que entraba en el alargue (o en el descuento, 90+x) se clampaba al límite y `minutes_played` quedaba
  en 0; ese jugador (a) ni se guardaba (`hasData` lo descartaba) y (b) aunque se guardara, el engine no
  le daba los 5.
- **Lógica definitiva de "por jugar":** 5 puntos a **todo jugador que pise el campo**, sin ningún
  umbral de minutos (titular, suplente en cualquier minuto, o suplente que entra en la prórroga —
  posible desde dieciseisavos). El engine lo decide con el helper puro `participoEnElPartido(event)`
  (minutos jugados, intervalo en campo `minute_in>0`/`minute_out!=null`, o cualquier acción de juego).
  Un evento sin participación alguna (0 min, sin entrar, sin acciones) sigue sin puntuar.
- *Correcciones del scraper:* `durationMin = phase === 'grupos' ? 90 : 120` (prórroga en toda
  eliminatoria) y `hasData` también guarda al suplente que entró (`minute_in > 0`) aunque sus minutos
  se hayan redondeado a 0.

**BUG 2 — Penalti fallado en juego no descontaba −20** (p. ej. Messi vs Austria). El engine ya
procesaba `penalty_missed_play` (−20) / `penalty_missed_shootout` (−10) correctamente; el fallo
estaba en la **clasificación del scraper** (`fifa/mapper.ts`):
- `classifyEvent` **case 0** devolvía `'penalty_goal'` para CUALQUIER penalti de Type 0, aunque el
  texto dijera "fallado". Ahora un penalti de Type 0 resuelve el desenlace por la descripción
  (`penaltyOutcomeFromText`) y solo cae a gol si el texto no lo contradice.
- `penaltyOutcomeFromText` priorizaba las palabras de gol (`marca`, `anota`, `gol`…) **sin detectar
  negación**: "no marca el penal" / "sin gol" se leían como GOL. Ahora detecta parada → fallo
  (incl. verbo de gol negado: regex de `no` aislado + `sin gol`) → gol, en ese orden. (También se
  sustituyó la palabra de fallo `'err'` por `'erro'`, que matcheaba "Inglat**err**a".)
- **Lógica definitiva de "penalti fallado":** en juego **−20** (`PENALTIES.penaltiAlladoPlay`), en
  tanda **−10** (`penaltiAlladoShootout`). Nunca se multiplican por fase (son sanciones). Un penalti
  fallado que el árbitro manda repetir y acaba en gol cuenta solo como gol (lógica de repetición
  intacta).

**Tests:** +7 nuevos (`engine.test.ts`: suplente de prórroga con `minutes_played=0`, jugador con
acción y 0 min, salida del campo, total con penalti fallado en final; `mapper.test.ts`: penalti
fallado por texto/negación y agregación del fallo de Messi). Suite: 166 tests, 0 fallos.

**Recálculo de partidos ya jugados — AUTOMÁTICO (sin admin):** ver la sección siguiente
("Revisión automática post-partido"). El scheduler re-deriva solos todos los partidos finalizados
tras el deploy (RECONCILE_VERSION subida a 1), reescribiendo sus eventos de origen FIFA con la lógica
corregida — incluidos los suplentes de prórroga que se habían descartado y el penalti de Messi (que
estaba auto-confirmado como gol). No hace falta tocar el panel de admin.

### Datos reales de FIFA: penalti fallado (Type 6) y cambio al descanso (junio 2026)

Verificado contra el timeline REAL del Mundial 2026 (Argentina 2-0 Austria; Panamá 0-1 Croacia):

- **Penalti fallado = `Type 6` sin gol del lanzador.** FIFA NO emite un evento de "penalti fallado".
  Un penalti CONVERTIDO llega como `Type 6` (descripción vacía) **+** `Type 41` ("convierte el penal");
  uno FALLADO llega **solo** como `Type 6`, sin desenlace. Antes el `Type 6` se ignoraba → el fallo de
  Messi (penalti del 9' vs Austria) no se computaba (−20 perdidos). Ahora `aggregateTimeline` recoge los
  `Type 6` como lanzamientos y, tras el bucle, marca **penalti fallado** todo lanzamiento cuyo lanzador
  no marque en ese minuto (±1); si marca, es conversión (o repetición convertida) y no cuenta como fallo.
  El causante de la falta previa (Posch) recibe el penalti cometido por la deducción habitual. La
  detección por TEXTO (Type 41/60 "fallado"/"parado", `penaltyOutcomeFromText`) se mantiene como fallback
  cuando no hay `Type 6` (datos sintéticos/tests); las dos vías no se solapan (`hasType6`).
- **Cambio al descanso = minuto 45.** Los `Type 5` (cambio) hechos en el descanso ("antes de que empiece
  la segunda parte") vienen **sin `MatchMinute`**. Antes `parseMinute("") ?? 0` daba minuto 0, y un
  titular cambiado al descanso conservaba el partido entero → **portería a cero indebida** (caso Gvardiol,
  cambiado al 45' y aun así premiado). Ahora un cambio sin minuto se interpreta como el **minuto 45** (45'
  jugados para el que sale, 2ª parte para el que entra), así Gvardiol ya no llega a los 60' de portería a cero.

Ambos arreglan datos ya jugados de forma automática vía la revisión post-partido (RECONCILE_VERSION=2).

### Datos reales de FIFA: penalti PARADO = Type 57 cruzado con el lanzamiento (junio 2026)

Verificado contra el timeline REAL del Mundial 2026 (Noruega 1-4 Francia: Maignan para a Strand
Larsen; Egipto 1-1 Irán: Shoubir para a Taremi):

- **Penalti parado = `Type 57` ("El arquero de X ataja el balón") en el mismo minuto que un penalti
  no convertido del rival.** FIFA NO emite un evento "penalti parado": el lanzamiento llega como
  `Type 6` (sin gol del lanzador) y la parada como un `Type 57` del portero DEFENSOR en el mismo
  minuto. El `Type 57` está en `IGNORED_EVENT_TYPES` (una parada normal no puntúa), así que la parada
  del penalti se perdía → el portero no sumaba los **+30** (`PLAYER_SCORING.portero.penaltiParado`).
  Caso Maignan: tenía solo `porJugar 5` + `golEncajado −5` = 0; le faltaba la parada del penalti del 50'.
- **Solución (`fifa/mapper.ts`):** `aggregateTimeline` recoge los `Type 57` (`gkSaves`) además de las
  faltas. Al resolver los penaltis (rama `hasType6`), por cada lanzamiento NO convertido cruza su minuto
  (±1) con un `Type 57` de un portero del equipo **contrario** (el que no lanza): si lo hay, ese portero
  suma `penalty_saved_play` (+30; en tanda `penalty_saved_shootout`, +15). Distingue una **parada**
  (+30 al portero **y** −20 al lanzador, son cosas independientes) de un **fallo a las nubes** (sin
  `Type 57` → solo −20 al lanzador, sin premio para nadie). Las paradas normales (sin penalti en ese
  minuto) siguen sin puntuar. El penalti fallado del lanzador (−20) y el penalti cometido del defensor
  (−15) no cambian.
- Arregla datos ya jugados de forma automática vía la revisión post-partido (**RECONCILE_VERSION=3**):
  re-deriva todos los partidos finalizados y corrige las DOS paradas detectadas (Maignan y Shoubir) sin
  intervención del admin. +4 tests en `mapper.test.ts` (174 en total, 0 fallos).

### La TANDA de penaltis NO puntúa a JUGADORES (solo a selecciones) (junio 2026)

Cambio de regla de la porra: **los penaltis de la TANDA dejan de puntuar a los jugadores**. Antes el
motor de jugadores los computaba (penalti parado en tanda +15, gol de penalti en tanda = mitad del
valor, penalti fallado en tanda −10). Ahora **valen 0 para los jugadores**. Las **selecciones siguen
puntuando la tanda exactamente igual** (empate en el marcador + bonus "Ganar Penaltis"), porque eso se
deriva de `match.decided_by_penalties`/`penalty_winner_id` en `selecciones.ts` (NO de eventos de
jugador) — esa lógica **no se ha tocado**.

- **Dónde:** `scoring/jugadores.ts`, `calcMatchPoints`. Una **guarda de diseño** al principio crea una
  copia saneada del evento con `goals_penalty_shootout`, `penalty_saved_shootout` y
  `penalty_missed_shootout` puestos a **0** antes de calcular ningún punto; se eliminaron las tres ramas
  `penaltiParadoTanda` / `golesTanda` / `penaltiFalladoTanda`. Es **defensa en profundidad**: aunque
  alguien reañadiera una rama de tanda, los contadores ya valen 0. "Por jugar" (5 pts) se sigue
  evaluando sobre el evento ORIGINAL (`participoEnElPartido(rawEvent)`), así un jugador que disputó la
  prórroga/tanda no pierde su participación; solo deja de sumar por los penaltis de la tanda.
- **El dato se conserva:** los scrapers (FIFA `mapper.ts`/`sync.ts`, BeSoccer) y la entrada manual del
  admin siguen rellenando las columnas `*_shootout` de `match_player_events`. Esas columnas SON el
  "flag" que segrega la tanda del juego reglamentario; el motor de jugadores simplemente las ignora.
  Nada se borra de la BD.
- **`calcPlayerScore` es el ÚNICO cómputo de puntos de jugador** (lo usan `engine.ts`, el overlay en
  vivo `live.ts` vía el motor, y la proyección `elegidos-scores.ts`): todos quedan cubiertos por la
  guarda. `selecciones.ts` no usa los campos `*_shootout`.
- **Partidos recalculados (dieciseisavos, resueltos en tanda):** **Alemania 1-1 Paraguay**
  (`pen_winner=paraguay`) y **Países Bajos 1-1 Marruecos** (`pen_winner=marruecos`). Eran los **únicos
  dos** partidos con `decided_by_penalties` en la BD. El recálculo retroactivo es **automático y sin
  admin** vía **RECONCILE_VERSION=4** (el scheduler re-deriva y llama a `recalcularYGuardar`). En
  Alemania-Paraguay desaparecen 4 ítems `golesTanda` de jugador (15/15/12,5/15); las selecciones de
  ambos partidos no varían (451 pts y 7 pts, respectivamente).
- **Tests:** los tests de tanda de jugador en `engine.test.ts` se reescribieron para afirmar que la
  tanda NO añade puntos al jugador (penalti parado, gol y penalti fallado en tanda → 0). Los tests de
  tanda de **selección** (Ganar Penaltis) y de portería a cero con tanda siguen iguales. 188 tests, 0
  fallos.

### Revisión automática post-partido / autocorrección (junio 2026)

**Problema:** al finalizar un partido sus eventos se **auto-confirman**, y el scraper tenía la regla
"nunca pisar un evento confirmado". Esa regla protegía las ediciones del admin, pero también
**congelaba para siempre cualquier dato mal interpretado** (p. ej. un penalti fallado clasificado como
gol): aunque se arreglara el código, el dato ya confirmado no se autocorregía nunca.

**Solución — el sistema revisa y re-deriva todo solo, sin intervención del admin:**
- **La protección ahora distingue origen, no confirmación.** `reconcileAndSaveTallies` solo respeta los
  eventos `source='manual'` (ediciones explícitas del admin, intocables). Los `source='fifa_draft'`
  —aunque estén auto-confirmados— se **re-derivan en cada scrape** con la lógica vigente. Al re-derivar
  un evento ya confirmado se mantiene confirmado (los puntos no parpadean). Si FIFA devuelve un timeline
  vacío o no responde, no se toca nada (degradación segura: nunca se borran datos buenos).
- **Versión de reconciliación.** `matches.reconcile_version` (nueva columna, default 0) guarda con qué
  versión de la lógica se derivaron los eventos. El scheduler, en cada tick, re-deriva una vez cada
  partido finalizado cuyo `reconcile_version` sea menor que `RECONCILE_VERSION` (constante en
  `scheduler.ts`) y luego lo sella con esa versión (solo si FIFA respondió). Es persistente → sobrevive
  a reinicios del plan free; está acotado (una pasada por partido y versión, no en bucle).
  **⚠️ Subir `RECONCILE_VERSION` cada vez que cambie la lógica de scraper/scoring de eventos** fuerza el
  recálculo retroactivo automático de todo lo ya jugado. v1 = fix "por jugar" + penalti fallado.
- **Flujo completo al terminar un partido (ya existía + ahora autocorrige):** scrape final → re-derivación
  de eventos FIFA → auto-confirmar → `deriveKnockoutPhaseResults` → `recalcularYGuardar`. El botón
  "Re-scrapear eventos de FIFA" del admin ahora también re-deriva de verdad (antes saltaba los confirmados).
- **Resultado:** si Messi falla un penalti y se computó mal, el sistema lo corrige solo en cuanto el
  scraper sabe interpretarlo (subiendo la versión); el admin no tiene que hacer nada. Sus ediciones
  manuales siguen siendo sagradas.

### Portería a cero y gol encajado por intervalo en campo (junio 2026)

Antes, "portería a cero" y "gol encajado" se calculaban con `minutes_played` y el
**marcador final**: un titular sustituido en el 70' perdía la portería a cero si el equipo
encajaba en el 85', y cargaba todos los goles del partido aunque ya no estuviera en el campo.
Ahora se cuentan **solo los goles encajados en el intervalo que el jugador estuvo en juego**.

- **Modelo (aditivo):** `match_player_events` ganó `minute_in` (0 = titular) y `minute_out`
  (null = jugó hasta el final); `matches` ganó `home_goal_minutes` / `away_goal_minutes`
  (`INTEGER[]`: minutos en los que marcó cada equipo, tiempo reglamentario/prórroga, **NO** tanda).
  Un jugador del local encaja los `away_goal_minutes` y viceversa.
- **Cálculo (`scoring/jugadores.ts`):** helper puro `goalsConcededWhileOnPitch()` —compartido
  por `porteriaCero` y `golEncajado`— cuenta los goles del rival cuyo minuto cae en
  `[minute_in, minute_out]`. **Fallback:** si `{home,away}_goal_minutes` es null (sin datos),
  cae al recuento por marcador final → comportamiento idéntico al anterior (los 147 tests del
  motor siguen pasando sin tocar fixtures).
- **Scraper (`fifa/mapper.ts` + `sync.ts`):** `aggregateTimeline` deriva `minute_in`/`minute_out`
  de las sustituciones y de la **roja** (una expulsión cuenta como salida), y devuelve `goalEvents`
  (minuto + equipo FIFA + autogol). `sync.ts` los reparte en `home/away_goal_minutes` (el autogol
  cuenta para el rival) y los guarda **salvo que el partido tenga eventos confirmados** por el admin.
- **Admin:** `AdminPartidos.js` edita los minutos de gol por equipo (lista separada por comas);
  `AdminEventos.js` y `AdminResultados.js` editan `minute_in` / `minute_out` por jugador
  (campo "sale" vacío = jugó hasta el final).
- **En vivo:** `porteriaCero` se sigue descartando en vivo (`FINAL_ONLY_CONCEPTS`); `golEncajado`
  provisional usa el mismo intervalo con los goles capturados hasta el momento (minute_out aún null).
- **Backfill de partidos ya cerrados:** los partidos finalizados ANTES de esta feature tienen
  `*_goal_minutes` a null y eventos confirmados. El scheduler los re-scrapea **una vez** cuando
  detecta `home_goal_minutes IS NULL` (Set en memoria evita bucles); `reconcileAndSaveTallies`
  rellena `minute_in/minute_out` de jugadores confirmados sin tocar sus stats
  (`EventsRepo.backfillMinutes`) y reescribe los minutos de gol del partido. El botón
  "Re-scrapear eventos de FIFA" hace lo mismo por partido y recalcula al instante.

### Variables de entorno nuevas (ver `.env.example`)

`FIFA_ENABLED` (true) · `FIFA_COMPETITION_ID` (17) · `FIFA_SEASON_ID` (autodescubierto) ·
`FIFA_MATCH_DURATION_MIN` (105) · `FIFA_SCRAPE_DELAY_MIN` (15) · `FIFA_CALENDAR_REFRESH_HOURS` (6) ·
`FIFA_AUTO_CONFIRM` (false)

---

### Fase eliminatoria: bonus de fin de grupos, pasaRonda y eliminados (junio 2026 — inicio de 16avos)

- **Multiplicadores por ronda (confirmados, fuente de verdad `multipliers.ts`):**
  16avos **×1** · octavos **×1** · cuartos **×1.5** · semis **×2** · final **×3**. Aplican a TODOS
  los puntos de esa ronda salvo los bonus planos (`ganarMundial`, `mvpMundial`).
- **Bonus "Pasar Ronda" — multiplicador de la ronda a la que se ACCEDE** (`getPasaRondaMultiplier`
  = `getPhaseMultiplier(getNextPhase(fase))`): grupos→16avos ×1, octavos→cuartos ×1.5,
  cuartos→semis ×2, semis→final ×3. Vale para equipos (`selecciones.ts`) y jugadores (`jugadores.ts`).
- **pasaRonda de JUGADOR a TODA la plantilla que avanza (fix, jun-2026):** antes el +15 solo se daba
  a jugadores con evento en un partido de esa fase (se perdía para los que no jugaron y podía
  repetirse 3× en grupos). Ahora `calcPlayerScore` lo concede **una vez por resultado de fase
  `advanced` del equipo del jugador**, haya jugado o no (se deriva de `team_phase_results`, no de
  tener evento). El multiplicador de rol (capitán ×2, suplente ×0.5/×1 según promoción) se mantiene.
- **Bonus de fin de fase de grupos = filas en `team_phase_results`, NO eventos.** El motor deriva
  todos los bonus de fase de esa tabla: `advanced`@grupos → pasaRonda equipo (+10/+20/+40/+80 ×1) y
  +15 a sus jugadores; `eliminated`@grupos → penalización "No llegar a 16avos" (−100/−50/−25/−10).
  La tabla estaba vacía → estos bonus no se aplicaban. Endpoint **`POST /api/admin/group-bonuses`**
  (`services/group-bonuses.ts`): deriva del cuadro de **dieciseisavos** ya programado quién avanza
  (los 32 equipos que aparecen en algún partido de 16avos) y quién queda eliminado (jugaron grupos y
  no están en 16avos); **dry-run por defecto** (loguea/devuelve qué equipos y jugadores reciben qué),
  y con `{ confirm:true }` escribe `team_phase_results` (upsert idempotente, aditivo — **nunca toca
  eventos aprobados**) y recalcula. Solo aplica si el cuadro está completo (exactamente 32 avanzan).
- **Aplicación AUTOMÁTICA sin admin (jun-2026):** el scheduler (`scheduler.ts`), en cada tick,
  deriva y aplica solo los avances de grupos en cuanto el cuadro de 16avos está completo (32 equipos)
  y aún no hay ningún resultado de fase `grupos` (idempotente: corre una vez). Llama a
  `computeGroupBonuses(true)` y recalcula. Así los bonus de fin de grupos se puntúan sin intervención
  del admin; el endpoint `POST /api/admin/group-bonuses` queda como disparo/preview manual.
- **TODAS las rondas KO también automáticas:** `deriveKnockoutPhaseResults` (scheduler) escribe, al
  acabar cada partido KO, `advanced` al ganador (`winner` en la final) y `eliminated` al perdedor —
  en 16avos, octavos, cuartos, semis y final. Ahora **devuelve si escribió algo y dispara el recálculo
  en el mismo tick**, así el bonus de pasar ronda (equipo +pasaRonda con el multiplicador de la ronda
  a la que se accede, y +15 a TODOS sus jugadores) se aplica sin demora. En resumen: grupos→16avos
  (`computeGroupBonuses`) y todas las rondas KO (`deriveKnockoutPhaseResults`) puntúan solas.
- **Promoción de suplente por eliminación (ya existente, ahora alimentada por los datos de grupos):**
  `isSuplenteFull` activa al suplente (×1 en vez de ×0.5) cuando un titular de su línea tiene el
  equipo `eliminated` en una fase anterior. Al escribir los `eliminated` de grupos, los suplentes de
  líneas con un titular eliminado puntúan al 100% en 16avos en adelante, automáticamente.

### Vista de detalle de participante: eliminados y suplentes promovidos (junio 2026)

En la pestaña "📊 Puntuación" del detalle (`DetalleParticipante.js`), solo lógica de orden/realce
(sin cambios de diseño de tarjetas, colores ni tipografía). Fuente: `GET /api/phase-results` (equipos
con `result='eliminated'`, cualquier fase) + la alineación de la porra; el motor ya calcula los puntos
correctos (suplente promovido al 100%).
- **Selecciones:** las de países eliminados se muestran **sombreadas (opacity 0.45)** y al **final**,
  por debajo de las activas; etiqueta "ELIMINADO".
- **Jugadores agrupados por línea** (porteros/defensas/medios/delanteros): activos primero; el
  **suplente promovido** (un titular de su línea eliminado) aparece en el bloque de titulares con
  etiqueta verde **"SUPLENTE → TITULAR"** y sus puntos al 100%; los eliminados, sombreados con
  etiqueta "ELIMINADO" al final de su línea. La promoción se deriva en el front (titular de la línea
  con equipo eliminado) y coincide con la del motor.

## Decisiones de diseño importantes

### Multiplicadores de fase
`×1` (grupos / 16avos / octavos) → `×1.5` (cuartos) → `×2` (semis) → `×3` (final)
Los valores originales del prompt eran ×1/×2/×3/×4; el usuario los cambió en la sesión de Normas y el motor usa los de Normas como fuente de verdad. Están en `multipliers.ts`.

### Bonus planos (sin multiplicador)
`ganarMundial` (50/100/200/400 según categoría) y `mvpMundial` (+50) **nunca se multiplican** por fase, aunque otros puntos del mismo partido sí. Se implementa pasando `phaseMultiplier: 1` explícitamente en el ítem de desglose.

### Penalti fallado del JUGADOR
- En juego: **−20** (`PENALTIES.penaltiAlladoPlay`)
- En **tanda: 0** — desde jun-2026 la tanda **NO puntúa a jugadores** (ver "La TANDA de penaltis NO
  puntúa a JUGADORES" más arriba). La constante `penaltiAlladoShootout` (−10) sigue en
  `scoring-tables.ts` por histórico, pero el motor de jugadores la ignora. Las **selecciones** sí
  puntúan la tanda (Ganar Penaltis), eso no cambia.

### Penalizaciones no se multiplican por fase
Tarjeta roja, penalti cometido, penalti fallado, gol en propia: se aplican con `phaseMultiplier: 1` siempre. Son sanciones deportivas, no méritos. Esto está documentado con un comentario en `jugadores.ts`.

### BeSoccer es opcional y no bloquea nada
El sistema funciona al 100% sin el scraper: el admin carga eventos a mano. BeSoccer solo genera borradores (`is_confirmed: 0`) que el admin revisa y confirma. Desactivar con `BESOCCER_ENABLED=false` en `.env`.

### Scraper BeSoccer para fase KO — fundamentos (jun-2026, EN PROGRESO)
Objetivo del usuario: que la fase eliminatoria se puntúe desde BeSoccer (es.besoccer.com). Tras
ingeniería inversa contra datos reales del Mundial 2026:
- **BeSoccer NO tiene API JSON pública**, pero SÍ renderiza en el HTML: el **marcador** en el JSON-LD
  `SportsEvent` (campo `description`, "X - Y"), los **eventos** en bloques
  `popup_event_orderMin_{orden}_{minuto}_{idJugador}` (tipo en `<span class="t-up">`, lado
  `alt="local|visitor"`, jugador `/jugador/{slug}-{id}`) y las **alineaciones** en `panel-lineup`
  (titulares, ambos equipos en un mismo campo) / `panel-bench`.
- `services/besoccer/mapper.ts` (`parseScore`/`parseEvents`/`parseLineup`/`aggregateBesoccer`,
  reusa los tipos del mapper de FIFA) + `services/besoccer/client.ts` (descarga página + `/eventos`
  + `/alineaciones`). **Estado de validación:** el **marcador** parsea perfecto (Argelia 3-3 Austria);
  los **eventos** ~83% (faltaba 1 gol en el fixture, pendiente de afinar); la **separación de equipos
  en la alineación** y los penaltis/tanda/autogoles **aún no están validados** (BeSoccer pinta los 22
  titulares en un solo campo; faltan ejemplos reales en vivo de penaltis/tanda).
- `services/besoccer/sync.ts` (`syncBesoccerMatch`): orquesta descarga→parseo→conciliación→guardado
  **reusando `reconcileAndSaveTallies` de FIFA** (borradores `is_confirmed=0`, conciliación por nombre,
  intervalo en campo, minutos de gol) y escribe el marcador (en vivo: `minute`+`live_*_score`; final:
  `home/away_score`+`decided_by_penalties`). El once para conciliar cubre titulares + suplentes que
  entraron (nombre real vía `parsePlayerNames`). `parseLineup` validado en vivo (11 local + 11 visitante,
  el campo trae los 22 en orden). 186 tests (9 nuevos de BeSoccer).
- **Enrutado en el scheduler tras un flag:** `KO_SOURCE` (env, `'fifa'` por defecto o `'besoccer'`). Con
  `'besoccer'`, los partidos KO que tengan `matches.besoccer_url` (columna nueva) se scrapean de BeSoccer
  en vivo y al final, **con FIFA como fallback automático** si BeSoccer falla o no hay URL; la fase de
  grupos siempre usa FIFA. Por defecto (`'fifa'`) el enrutado está inerte y el KO sigue puntuando con FIFA.
- **Admin:** `POST /api/admin/besoccer/preview { url }` (SOLO LECTURA, valida el parser) y
  `POST /api/admin/besoccer/sync { matchId, url?, live?, confirm? }` (ESCRIBE: guarda eventos+marcador y
  recalcula; `url` se guarda en `besoccer_url`; fallback manual del scraper).
- ⚠️ **Antes de conmutar `KO_SOURCE=besoccer` en producción** hay que: (a) validar evento a evento contra
  un KO real los casos sin ejemplo aún (penaltis en juego/tanda, autogoles, paradas, `penalty_winner_id`
  de la tanda, el "gol que faltaba" 5/6); (b) cruzar el **marcador de BeSoccer con FIFA** (posible
  divergencia; BeSoccer etiquetó este KO como "Jornada 1"); (c) comprobar la conciliación de nombres.
  Mientras tanto FIFA sigue puntuando el KO (validado y en vivo).

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
