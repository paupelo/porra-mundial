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
  `34` autogol, `41` penalti fallado, `60` penalti parado y `Period=11` (tanda) quedan por verificar
  cuando ocurran; hay respaldo por texto de la descripción y todo entra como borrador.
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
  los partidos cuyo día (hora local del usuario) es hoy, ordenados En vivo → Próximos por hora →
  Finalizados. Reutiliza el MISMO componente de tarjeta (`MatchCard`) que el listado general
  (extraído sin cambios visuales); estado vacío discreto "No hay partidos hoy". El calendario
  completo sigue intacto debajo. Clases `cal-today-*` en `Calendario.css`.

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
posiciones ha subido o bajado respecto a la "jornada anterior" (último snapshot de ranking guardado).
NO altera puntos ni scoring; es puramente informativo y aditivo.
- **Tabla nueva** `ranking_snapshots` (`schema.sql`, `CREATE TABLE IF NOT EXISTS`, idempotente, se
  crea sola en el arranque): `id, porra_id, position, points, snapshot_type` (libre: 'jornada_1',
  'octavos'…), `created_at`. Índice `idx_ranking_snapshots_created`. Es una proyección histórica:
  no toca ninguna tabla existente.
- **Repo** `repositories/snapshots.repo.ts`: `save(snapshotType, entries)` inserta todas las filas
  del lote en UNA sentencia (mismo `created_at` vía NOW() constante por sentencia) y
  `latestPositions()` devuelve el Map porra_id→position del snapshot más reciente.
- **Helper compartido** `services/ranking.ts` (`computeRankingEntries`): el orden del ranking
  (puntos desc, empate alfabético, porras sin puntuar a 0) extraído sin cambios de `/clasificacion`;
  lo usan tanto el endpoint público como el snapshot para garantizar el MISMO orden.
- **Endpoint público:** `GET /api/clasificacion` ahora añade `position_change: number|null` a cada
  entrada (= posición_snapshot − posición_actual; positivo sube, negativo baja, 0 igual, null si no
  hay snapshot para esa porra). El resto de la respuesta es idéntico.
- **Endpoint admin:** `POST /api/admin/ranking-snapshot` con `{ snapshot_type }` guarda la foto del
  ranking actual de las porras aprobadas. Devuelve `{ ok, snapshot_type, count }`.
- **Frontend Clasificación** (`Clasificacion.js`): componente `PosChange` que pinta `↑N` (verde
  #16a34a) / `↓N` (rojo #dc2626) tras el badge de puesto; null o 0 → no renderiza nada. Sin cambios
  en el resto de la fila.
- **Admin** (`AdminDashboard.js`): banner "Guardar snapshot de ranking" con input de texto libre
  para el `snapshot_type` y botón 📸, junto al de Recalcular. El admin lo pulsa antes de empezar
  cada jornada/ronda para fijar la referencia del indicador.

### Subsecciones de Clasificación (junio 2026)

La pestaña Clasificación (`/clasificacion`) tiene un selector interno de tres vistas:
- **🏆 Clasificación** — el ranking de siempre (sin cambios).
- **⚖️ Comparador de porras** (`ComparadorPorras.js/.css`) — hasta 4 porras lado a lado:
  selecciones por categoría (con ⭐ Ganador) y once por posición (⭐CAP / supl.). Las
  coincidencias entre las porras comparadas se resaltan con 🤝 y fondo ámbar. Datos de los
  endpoints públicos existentes (`/api/clasificacion` + `/api/porras/:id`). Scroll horizontal en móvil.
- **📊 Resumen de elegidos** (`ResumenElegidos.js/.css`) — todas las selecciones y los jugadores
  elegidos ordenados por popularidad, con acordeón por equipo/jugador mostrando quiénes los
  eligieron (⭐ GANADOR / ⭐CAP / supl.) y barra de popularidad relativa. Se alimenta del nuevo
  endpoint público `GET /api/resumen-elegidos` (agrega `PorrasRepo.findAllFull()` —solo aprobadas—
  en servidor, una petición).

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
