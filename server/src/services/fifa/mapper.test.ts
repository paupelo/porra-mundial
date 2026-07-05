import {
  aggregateTimeline,
  classifyEvent,
  extractLineup,
  isShootoutEvent,
  localized,
  mapCalendarMatch,
  mapStageToPhase,
  mapStatus,
  parseMinute,
} from './mapper';

describe('FIFA mapper — localized', () => {
  it('extrae la primera Description', () => {
    expect(localized([{ Locale: 'es-ES', Description: 'Fase de grupos' }])).toBe('Fase de grupos');
  });
  it('acepta strings directos y tolera valores raros', () => {
    expect(localized('Final')).toBe('Final');
    expect(localized(undefined)).toBe('');
    expect(localized([])).toBe('');
    expect(localized([{ foo: 1 }])).toBe('');
  });
});

describe('FIFA mapper — parseMinute', () => {
  it('parsea minutos simples y con descuento', () => {
    expect(parseMinute("67'")).toBe(67);
    expect(parseMinute("90'+4")).toBe(94);
    expect(parseMinute("45+2'")).toBe(47);
  });
  it('devuelve null si no hay minuto', () => {
    expect(parseMinute(null)).toBeNull();
    expect(parseMinute('')).toBeNull();
  });
});

describe('FIFA mapper — mapStageToPhase', () => {
  it('mapea las fases en español e inglés', () => {
    expect(mapStageToPhase('Fase de grupos')).toBe('grupos');
    expect(mapStageToPhase('Group Stage')).toBe('grupos');
    expect(mapStageToPhase('Primera fase')).toBe('grupos'); // nombre real en el calendario 2026
    expect(mapStageToPhase('Dieciseisavos de final')).toBe('dieciseisavos');
    expect(mapStageToPhase('Round of 32')).toBe('dieciseisavos');
    expect(mapStageToPhase('Octavos de final')).toBe('octavos');
    expect(mapStageToPhase('Round of 16')).toBe('octavos');
    expect(mapStageToPhase('Cuartos de final')).toBe('cuartos');
    expect(mapStageToPhase('Quarter-finals')).toBe('cuartos');
    expect(mapStageToPhase('Semifinales')).toBe('semifinales');
    expect(mapStageToPhase('Semi-finals')).toBe('semifinales');
    expect(mapStageToPhase('Final')).toBe('final');
  });
  it('descarta el tercer puesto (la porra no lo puntúa)', () => {
    expect(mapStageToPhase('Partido por el tercer puesto')).toBeNull();
    expect(mapStageToPhase('Play-off for third place')).toBeNull();
  });
});

describe('FIFA mapper — mapStatus', () => {
  it('0 = finalizado, 3 = en juego, resto = pendiente', () => {
    expect(mapStatus(0)).toBe('finished');
    expect(mapStatus(3)).toBe('live');
    expect(mapStatus(1)).toBe('pending');
    expect(mapStatus(undefined)).toBe('pending');
  });
});

describe('FIFA mapper — mapCalendarMatch', () => {
  const base = {
    IdMatch: '400123456',
    IdStage: '285063',
    StageName: [{ Locale: 'es-ES', Description: 'Fase de grupos' }],
    GroupName: [{ Locale: 'es-ES', Description: 'Grupo A' }],
    Stadium: { Name: [{ Locale: 'es-ES', Description: 'Estadio Azteca' }] },
    Date: '2026-06-11T20:00:00Z',
    MatchStatus: 0,
    ResultType: 1,
    Home: { IdCountry: 'MEX', TeamName: [{ Description: 'México' }], Score: 2 },
    Away: { IdCountry: 'RSA', TeamName: [{ Description: 'Sudáfrica' }], Score: 0 },
  };

  it('mapea un partido de grupos finalizado', () => {
    const d = mapCalendarMatch(base)!;
    expect(d.fifaMatchId).toBe('400123456');
    expect(d.phase).toBe('grupos');
    expect(d.status).toBe('finished');
    expect(d.homeCode).toBe('MEX');
    expect(d.awayCode).toBe('RSA');
    expect(d.homeScore).toBe(2);
    expect(d.awayScore).toBe(0);
    expect(d.decidedByPenalties).toBe(false);
    expect(d.groupName).toBe('Grupo A');
    expect(d.venue).toBe('Estadio Azteca');
  });

  it('detecta tanda de penaltis y su ganador (ResultType=2 + marcador de tanda, datos reales)', () => {
    const d = mapCalendarMatch({
      ...base,
      ResultType: 2,
      Home: { ...base.Home, Score: 1 },
      Away: { ...base.Away, Score: 1 },
      HomeTeamPenaltyScore: 3,
      AwayTeamPenaltyScore: 4,
    })!;
    expect(d.decidedByPenalties).toBe(true);
    expect(d.penaltyWinnerCode).toBe('RSA');
  });

  it('NO marca penaltis en un partido resuelto en la prórroga (ResultType=3 sin tanda, datos reales)', () => {
    // Argentina 3-2 Cabo Verde (16avos, Mundial 2026): ResultType=3 = prórroga,
    // sin PenaltyScore. El bug marcaba decided_by_penalties=1 con ganador null.
    const d = mapCalendarMatch({
      ...base,
      ResultType: 3,
      Home: { ...base.Home, Score: 3 },
      Away: { ...base.Away, Score: 2 },
      HomeTeamPenaltyScore: null,
      AwayTeamPenaltyScore: null,
    })!;
    expect(d.decidedByPenalties).toBe(false);
    expect(d.penaltyWinnerCode).toBeNull();
  });

  it('devuelve null sin IdMatch y tolera marcadores ausentes', () => {
    expect(mapCalendarMatch({})).toBeNull();
    const d = mapCalendarMatch({ ...base, MatchStatus: 1, Home: { IdCountry: 'MEX' }, Away: { IdCountry: 'RSA' } })!;
    expect(d.homeScore).toBeNull();
    expect(d.status).toBe('pending');
  });
});

describe('FIFA mapper — classifyEvent', () => {
  it('clasifica por código numérico', () => {
    expect(classifyEvent(0, '')).toBe('goal');
    expect(classifyEvent(0, 'Gol de penalti de Mbappé')).toBe('penalty_goal');
    expect(classifyEvent(1, 'Asistencia de Erik Lira')).toBe('assist');
    expect(classifyEvent(3, '')).toBe('red_card');
    expect(classifyEvent(4, '')).toBe('red_card');
    expect(classifyEvent(5, '')).toBe('substitution');
    expect(classifyEvent(34, '')).toBe('own_goal');
    expect(classifyEvent(41, '')).toBe('penalty_missed');
    expect(classifyEvent(60, '')).toBe('penalty_saved');
  });
  it('resuelve los códigos 41/60 por la descripción (penalti convertido vs fallado/parado)', () => {
    // Caso real Mundial 2026: Type 41 con "convierte el penal" es un GOL, no un fallo.
    expect(classifyEvent(41, '¡KANE (Inglaterra) convierte el penal!')).toBe('penalty_goal');
    expect(classifyEvent(41, 'Penalti fallado por Kane')).toBe('penalty_missed');
    expect(classifyEvent(60, 'El portero para el penalti')).toBe('penalty_saved');
    expect(classifyEvent(60, 'Penalti convertido')).toBe('penalty_goal');
    // Sin pistas en el texto → se mantiene el supuesto inicial por código.
    expect(classifyEvent(41, 'Penalti')).toBe('penalty_missed');
    expect(classifyEvent(60, 'Penalti')).toBe('penalty_saved');
  });
  it('BUG 2: un penalti fallado en juego NO se confunde con un gol', () => {
    // Type 0 (gol) cuyo texto es un fallo de penalti → penalti fallado, no gol.
    expect(classifyEvent(0, 'Messi falla el penalti')).toBe('penalty_missed');
    expect(classifyEvent(0, 'Lionel Messi (Argentina) no marca el penal')).toBe('penalty_missed');
    expect(classifyEvent(0, 'Penalti, sin gol, lo manda fuera')).toBe('penalty_missed');
    // Type 41/60 con verbo de gol NEGADO → fallo (antes se leía como gol).
    expect(classifyEvent(41, 'Messi no convierte el penal')).toBe('penalty_missed');
    expect(classifyEvent(999, 'El delantero no anota el penalti')).toBe('penalty_missed');
    // Pero un penalti REALMENTE convertido sigue siendo gol.
    expect(classifyEvent(0, 'Gol de penalti de Messi')).toBe('penalty_goal');
    expect(classifyEvent(41, 'Messi convierte el penal')).toBe('penalty_goal');
  });
  it('Type 6 = lanzamiento de penalti (desenlace resuelto aparte)', () => {
    expect(classifyEvent(6, '')).toBe('penalty_attempt');
  });
  it('ignora en silencio el ruido del timeline (faltas, remates, córners…)', () => {
    expect(classifyEvent(2, 'Tarjeta amarilla')).toBe('ignore');
    expect(classifyEvent(12, 'Remate de Brian Gutiérrez')).toBe('ignore');
    expect(classifyEvent(18, 'Modiba comete una falta')).toBe('ignore');
    expect(classifyEvent(57, 'El arquero ataja el remate')).toBe('ignore');
    expect(classifyEvent(71, 'VAR')).toBe('ignore');
  });
  it('usa la descripción como respaldo si el código es desconocido', () => {
    expect(classifyEvent(999, 'Autogol de Pérez')).toBe('own_goal');
    expect(classifyEvent(999, 'Penalti fallado por Kane')).toBe('penalty_missed');
    expect(classifyEvent(999, 'Penalti parado por el guardameta')).toBe('penalty_saved');
    expect(classifyEvent(999, 'Tarjeta roja directa')).toBe('red_card');
    expect(classifyEvent(999, 'Gol de Vinicius')).toBe('goal');
    expect(classifyEvent(999, 'Saque de esquina')).toBeNull();
  });
});

describe('FIFA mapper — isShootoutEvent', () => {
  it('Period 11 o descripción de tanda', () => {
    expect(isShootoutEvent({ Period: 11 })).toBe(true);
    expect(isShootoutEvent({ Period: 5, EventDescription: [{ Description: 'Gol en la tanda de penaltis' }] })).toBe(true);
    expect(isShootoutEvent({ Period: 5 })).toBe(false);
  });
});

describe('FIFA mapper — aggregateTimeline', () => {
  const lineup = [
    { fifaPlayerId: 'p1', fifaTeamId: 't1', name: 'Messi', isStarter: true },
    { fifaPlayerId: 'p2', fifaTeamId: 't1', name: 'Alvarez', isStarter: true },
    { fifaPlayerId: 'p3', fifaTeamId: 't1', name: 'Lo Celso', isStarter: false },
    { fifaPlayerId: 'p4', fifaTeamId: 't2', name: 'Portero Rival', isStarter: true },
  ];

  it('agrega goles, asistencias, tarjetas y minutos', () => {
    const events = [
      { Type: 0, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "23'", Period: 3, EventDescription: [{ Description: 'Gol de Messi' }] },
      { Type: 1, IdPlayer: 'p2', IdTeam: 't1', MatchMinute: "23'", Period: 3, EventDescription: [{ Description: 'Asistencia de Alvarez' }] },
      { Type: 0, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "55'", Period: 5, EventDescription: [{ Description: 'Gol de penalti de Messi' }] },
      { Type: 3, IdPlayer: 'p4', IdTeam: 't2', MatchMinute: "70'", Period: 5, EventDescription: [{ Description: 'Tarjeta roja' }] },
      { Type: 5, IdPlayer: 'p3', IdSubPlayer: 'p2', IdTeam: 't1', MatchMinute: "60'", Period: 5, EventDescription: [{ Description: 'Cambio' }] },
      { Type: 18, IdPlayer: 'p4', IdTeam: 't2', MatchMinute: "30'", Period: 3, EventDescription: [{ Description: 'Falta de Portero Rival' }] },
    ];
    const { tallies, unmappedTypes } = aggregateTimeline(events, lineup, 90);
    expect(unmappedTypes).toHaveLength(0);

    const messi = tallies.get('p1')!;
    expect(messi.goals_open_play).toBe(1);
    expect(messi.goals_penalty_play).toBe(1);
    expect(messi.minutes_played).toBe(90);

    const alvarez = tallies.get('p2')!;
    expect(alvarez.assists).toBe(1);
    expect(alvarez.minutes_played).toBe(60); // sustituido en el 60

    const loCelso = tallies.get('p3')!;
    expect(loCelso.minutes_played).toBe(30); // entró en el 60

    expect(tallies.get('p4')!.red_card).toBe(1);
  });

  it('captura el intervalo en campo (minute_in/minute_out) y los minutos de gol', () => {
    const events = [
      { Type: 0, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "23'", Period: 3, EventDescription: [{ Description: 'Gol de Messi' }] },
      { Type: 0, IdPlayer: 'p4', IdTeam: 't2', MatchMinute: "65'", Period: 5, EventDescription: [{ Description: 'Gol de Portero Rival' }] },
      { Type: 34, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "78'", Period: 5, EventDescription: [{ Description: 'Autogol' }] },
      { Type: 3, IdPlayer: 'p4', IdTeam: 't2', MatchMinute: "70'", Period: 5, EventDescription: [{ Description: 'Tarjeta roja' }] },
      { Type: 5, IdPlayer: 'p3', IdSubPlayer: 'p2', IdTeam: 't1', MatchMinute: "60'", Period: 5, EventDescription: [{ Description: 'Cambio' }] },
      { Type: 0, IdPlayer: 'p1', IdTeam: 't1', Period: 11, EventDescription: [{ Description: 'Gol en la tanda' }] },
    ];
    const { tallies, goalEvents } = aggregateTimeline(events, lineup, 90);

    // Titular sin salir → [0, null]
    expect(tallies.get('p1')!).toMatchObject({ minute_in: 0, minute_out: null });
    // Sustituido en el 60 → sale en el 60
    expect(tallies.get('p2')!).toMatchObject({ minute_in: 0, minute_out: 60 });
    // Entró en el 60 → minute_in 60, sin salir
    expect(tallies.get('p3')!).toMatchObject({ minute_in: 60, minute_out: null });
    // Expulsado en el 70 → la roja cuenta como salida
    expect(tallies.get('p4')!).toMatchObject({ minute_in: 0, minute_out: 70 });

    // Goles en tiempo reglamentario (la tanda NO entra); el autogol queda marcado.
    expect(goalEvents).toEqual([
      { fifaTeamId: 't1', minute: 23, isOwnGoal: false },
      { fifaTeamId: 't2', minute: 65, isOwnGoal: false },
      { fifaTeamId: 't1', minute: 78, isOwnGoal: true },
    ]);
  });

  it('separa los penaltis de la tanda de los de juego', () => {
    const events = [
      { Type: 0, IdPlayer: 'p1', IdTeam: 't1', Period: 11, EventDescription: [{ Description: 'Gol en la tanda' }] },
      { Type: 41, IdPlayer: 'p2', IdTeam: 't1', Period: 11, EventDescription: [{ Description: 'Penalti fallado' }] },
      { Type: 60, IdPlayer: 'p4', IdTeam: 't2', Period: 11, EventDescription: [{ Description: 'Penalti parado' }] },
      { Type: 41, IdPlayer: 'p2', IdTeam: 't1', MatchMinute: "80'", Period: 5, EventDescription: [{ Description: 'Penalti fallado' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 120);
    expect(tallies.get('p1')!.goals_penalty_shootout).toBe(1);
    expect(tallies.get('p2')!.penalty_missed_shootout).toBe(1);
    expect(tallies.get('p2')!.penalty_missed_play).toBe(1);
    expect(tallies.get('p4')!.penalty_saved_shootout).toBe(1);
    // las asistencias no se cuentan en la tanda
    expect(tallies.get('p1')!.assists).toBe(0);
  });

  it('un penalti fallado que se manda repetir y acaba en gol cuenta solo como gol', () => {
    // Kane (p1) falla un penalti en el 55' pero el árbitro lo manda repetir y lo
    // marca en el mismo minuto: no debe contar como fallo.
    const events = [
      { Type: 41, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "55'", Period: 5, EventDescription: [{ Description: 'Penalti fallado' }] },
      { Type: 0,  IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "55'", Period: 5, EventDescription: [{ Description: 'Gol de penalti' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    const kane = tallies.get('p1')!;
    expect(kane.goals_penalty_play).toBe(1);
    expect(kane.penalty_missed_play).toBe(0);

    // Lo mismo si el penalti fue PARADO y luego se repite y marca.
    const events2 = [
      { Type: 60, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "55'", Period: 5, EventDescription: [{ Description: 'Penalti parado' }] },
      { Type: 0,  IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "55'", Period: 5, EventDescription: [{ Description: 'Gol de penalti' }] },
    ];
    const t2 = aggregateTimeline(events2, lineup, 90).tallies.get('p1')!;
    expect(t2.goals_penalty_play).toBe(1);
    expect(t2.penalty_saved_play).toBe(0);

    // La repetición puede llegar como gol NORMAL (sin "penalti" en la descripción):
    // también debe anular el fallo.
    const events3 = [
      { Type: 41, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "55'", Period: 5, EventDescription: [{ Description: 'Penalti fallado' }] },
      { Type: 0,  IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "56'", Period: 5, EventDescription: [{ Description: 'Gol de Kane' }] },
    ];
    const t3 = aggregateTimeline(events3, lineup, 90).tallies.get('p1')!;
    expect(t3.goals_open_play).toBe(1);
    expect(t3.penalty_missed_play).toBe(0);

    // Un penalti fallado SIN repetición (sin gol en ese minuto) sí cuenta.
    const events4 = [
      { Type: 41, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "55'", Period: 5, EventDescription: [{ Description: 'Penalti fallado' }] },
      { Type: 0,  IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "80'", Period: 5, EventDescription: [{ Description: 'Gol de penalti' }] },
    ];
    const t4 = aggregateTimeline(events4, lineup, 90).tallies.get('p1')!;
    expect(t4.goals_penalty_play).toBe(1);
    expect(t4.penalty_missed_play).toBe(1);
  });

  it('BUG 2 (datos reales): penalti fallado = Type 6 sin gol del lanzador (Messi)', () => {
    // Estructura real ARG-AUT: "Penal concedido" (71) + Type 6 (vacío) del lanzador,
    // sin evento de desenlace. Messi marca DOS goles en otros minutos (38 y 90+5),
    // y el penalti del 9' fue fallado → penalty_missed_play, NO un tercer gol.
    const events = [
      { Type: 18, Period: 3, MatchMinute: "4'", IdPlayer: 'p4', IdTeam: 't2', EventDescription: [{ Description: 'Posch (Austria) comete una falta.' }] },
      { Type: 71, Period: 3, MatchMinute: "6'", EventDescription: [{ Description: 'Penal concedido' }] },
      { Type: 6,  Period: 3, MatchMinute: "9'",  IdPlayer: 'p1', IdTeam: 't1', EventDescription: [] },
      { Type: 0,  Period: 3, MatchMinute: "38'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: '¡Goool de Lionel MESSI!' }] },
      { Type: 0,  Period: 5, MatchMinute: "90'+5'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: '¡Goool de Lionel MESSI!' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    const messi = tallies.get('p1')!;
    expect(messi.penalty_missed_play).toBe(1); // el penalti del 9' fallado → -20
    expect(messi.goals_open_play).toBe(2);     // los dos goles reales
    expect(messi.goals_penalty_play).toBe(0);
    // El causante de la falta previa del equipo defensor recibe el penalti cometido.
    expect(tallies.get('p4')!.penalty_conceded).toBe(1);
  });

  it('Type 6 + gol del lanzador en el mismo minuto = penalti convertido (Kane), no fallo', () => {
    // Estructura real ENG-CRO: Type 6 (vacío) + Type 41 "convierte el penal" en el 12'.
    const events = [
      { Type: 6,  Period: 3, MatchMinute: "12'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [] },
      { Type: 41, Period: 3, MatchMinute: "12'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: '¡Harry KANE convierte el penal!' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    const kane = tallies.get('p1')!;
    expect(kane.goals_penalty_play).toBe(1);
    expect(kane.penalty_missed_play).toBe(0);
  });

  it('BUG 3 (datos reales): cambio al descanso (sin minuto) cuenta como minuto 45', () => {
    // Estructura real PAN-CRO: Type 5 con MatchMinute vacío y "antes de que empiece
    // la segunda parte" → Gvardiol (titular) sale en el 45, no juega los 90.
    const events = [
      { Type: 5, Period: 5, MatchMinute: '', IdPlayer: 'p3', IdSubPlayer: 'p2', IdTeam: 't1',
        EventDescription: [{ Description: 'Cambio: antes de que empiece la segunda parte, KRAMARIC entra en lugar de GVARDIOL (Croacia)' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    // p2 (Gvardiol, titular) sale en el 45 → 45 min, NO portería a cero (necesita 60).
    expect(tallies.get('p2')!).toMatchObject({ minute_in: 0, minute_out: 45, minutes_played: 45 });
    // p3 (Kramaric) entra en el 45 → juega la 2ª parte.
    expect(tallies.get('p3')!).toMatchObject({ minute_in: 45, minutes_played: 45 });
  });

  it('BUG 2: agrega un penalti fallado en juego (Messi vs Austria) como fallo', () => {
    // FIFA loguea el lanzamiento de Messi como Type 0 con texto de fallo: debe
    // contar como penalty_missed_play (−20 en el motor), nunca como gol.
    const events = [
      { Type: 0, IdPlayer: 'p1', IdTeam: 't1', MatchMinute: "35'", Period: 3, EventDescription: [{ Description: 'Messi no marca el penalti' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    const messi = tallies.get('p1')!;
    expect(messi.penalty_missed_play).toBe(1);
    expect(messi.goals_penalty_play).toBe(0);
    expect(messi.goals_open_play).toBe(0);
  });

  it('penalti PARADO (datos reales NOR-FRA): Type 6 sin gol + Type 57 del portero rival = +parada al portero, -fallo al lanzador', () => {
    // Estructura real: Strand Larsen (p1, t1) lanza un penalti en el 50' (Type 6,
    // Period 5) y NO marca; Maignan (p4, portero de t2) lo ataja (Type 57, mismo
    // minuto). Hay paradas normales (Type 57) en otros minutos que NO deben contar.
    const events = [
      { Type: 18, Period: 5, MatchMinute: "49'", IdPlayer: 'p2', IdTeam: 't2', EventDescription: [{ Description: 'Theo Hernandez comete una falta.' }] },
      { Type: 6,  Period: 5, MatchMinute: "50'", IdPlayer: 'p1', IdTeam: 't1', IdSubPlayer: 'p4', EventDescription: [{ Description: 'Penal señalado' }] },
      { Type: 57, Period: 5, MatchMinute: "50'", IdPlayer: 'p4', IdTeam: 't2', EventDescription: [{ Description: 'El arquero de Francia ataja el balón.' }] },
      // Parada normal en otro minuto: no coincide con ningún penalti → no puntúa.
      { Type: 57, Period: 5, MatchMinute: "63'", IdPlayer: 'p4', IdTeam: 't2', EventDescription: [{ Description: 'El arquero de Francia ataja el balón.' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    expect(tallies.get('p4')!.penalty_saved_play).toBe(1);      // Maignan: +30 en el motor
    expect(tallies.get('p4')!.penalty_saved_shootout).toBe(0);
    expect(tallies.get('p1')!.penalty_missed_play).toBe(1);     // Strand Larsen: -20
    expect(tallies.get('p2')!.penalty_conceded).toBe(1);        // Theo Hernandez: -15
  });

  it('penalti FALLADO a las nubes (sin parada): solo -fallo al lanzador, sin parada para nadie', () => {
    // Type 6 sin gol y SIN Type 57 (el balón se fue fuera): nadie suma parada.
    const events = [
      { Type: 6, Period: 5, MatchMinute: "50'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: 'Penal señalado' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    expect(tallies.get('p1')!.penalty_missed_play).toBe(1);
    expect(tallies.get('p4')!.penalty_saved_play).toBe(0);
  });

  it('una parada normal (Type 57) sin penalti en el minuto no suma penalti parado', () => {
    const events = [
      { Type: 57, Period: 3, MatchMinute: "30'", IdPlayer: 'p4', IdTeam: 't2', EventDescription: [{ Description: 'El arquero ataja el balón.' }] },
      { Type: 0,  Period: 3, MatchMinute: "55'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: 'Gol de Messi' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    expect(tallies.get('p4')?.penalty_saved_play ?? 0).toBe(0);
  });

  it('penalti CONVERTIDO con el portero involucrado no cuenta parada (el lanzador marcó)', () => {
    // Type 6 + gol en el mismo minuto: convertido. Aunque hubiera un Type 57 cerca,
    // al haber gol no es ni fallo ni parada.
    const events = [
      { Type: 6, Period: 5, MatchMinute: "50'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: 'Penal señalado' }] },
      { Type: 0, Period: 5, MatchMinute: "50'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: '¡Gol de penalti!' }] },
      { Type: 57, Period: 5, MatchMinute: "50'", IdPlayer: 'p4', IdTeam: 't2', EventDescription: [{ Description: 'El arquero ataja el balón.' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    expect(tallies.get('p1')!.goals_penalty_play).toBe(1);
    expect(tallies.get('p1')!.penalty_missed_play).toBe(0);
    expect(tallies.get('p4')!.penalty_saved_play).toBe(0);
  });

  it('deduce el penalti cometido de la falta previa del equipo defensor', () => {
    // Caso real: Modrić (Croacia) comete falta en el 9' y Kane (Inglaterra)
    // convierte el penalti en el 12'. La penalización es para Modrić, no para
    // las demás faltas (otro equipo o fuera de la ventana de tiempo).
    const events = [
      { Type: 18, Period: 3, MatchMinute: "9'",  IdPlayer: 'p2', IdTeam: 't1', EventDescription: [{ Description: 'MODRIĆ comete una falta.' }] },
      { Type: 41, Period: 3, MatchMinute: "12'", IdPlayer: 'p4', IdTeam: 't2', EventDescription: [{ Description: '¡KANE convierte el penal!' }] },
      { Type: 18, Period: 3, MatchMinute: "20'", IdPlayer: 'p1', IdTeam: 't2', EventDescription: [{ Description: 'Rice comete una falta.' }] },
      { Type: 18, Period: 3, MatchMinute: "80'", IdPlayer: 'p3', IdTeam: 't1', EventDescription: [{ Description: 'Lo Celso comete una falta.' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    expect(tallies.get('p2')!.penalty_conceded).toBe(1); // Modrić
    expect(tallies.get('p4')!.penalty_conceded).toBe(0); // lanzador
    expect(tallies.get('p1')!.penalty_conceded).toBe(0); // del equipo atacante
    expect(tallies.get('p3')!.penalty_conceded).toBe(0); // falta lejana en el tiempo
    // El penalti marcado se cuenta como gol; la falta no añade puntos extra.
    expect(tallies.get('p4')!.goals_penalty_play).toBe(1);
  });

  it('una falta normal sin penalti cercano no penaliza', () => {
    const events = [
      { Type: 18, Period: 3, MatchMinute: "30'", IdPlayer: 'p2', IdTeam: 't1', EventDescription: [{ Description: 'Falta de Alvarez' }] },
      { Type: 0,  Period: 3, MatchMinute: "55'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: 'Gol de Messi' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    expect(tallies.get('p2')!.penalty_conceded).toBe(0);
  });

  it('un penalti repetido solo penaliza una vez al causante', () => {
    // El portero para el penalti (defensor t1) y el lanzador t2 lo repite y marca.
    const events = [
      { Type: 18, Period: 3, MatchMinute: "40'", IdPlayer: 'p2', IdTeam: 't1', EventDescription: [{ Description: 'Alvarez comete una falta.' }] },
      { Type: 60, Period: 3, MatchMinute: "42'", IdPlayer: 'p1', IdTeam: 't1', EventDescription: [{ Description: 'El portero para el penalti' }] },
      { Type: 0,  Period: 3, MatchMinute: "43'", IdPlayer: 'p4', IdTeam: 't2', EventDescription: [{ Description: 'Gol de penalti' }] },
    ];
    const { tallies } = aggregateTimeline(events, lineup, 90);
    expect(tallies.get('p2')!.penalty_conceded).toBe(1);
  });

  it('reporta tipos de evento desconocidos sin romperse', () => {
    const events = [{ Type: 777, IdPlayer: 'p1', EventDescription: [{ Description: 'VAR en revisión' }] }];
    const { unmappedTypes } = aggregateTimeline(events, lineup, 90);
    expect(unmappedTypes).toEqual([{ type: 777, description: 'VAR en revisión' }]);
  });
});

describe('FIFA mapper — extractLineup', () => {
  it('extrae titulares y suplentes de ambos equipos', () => {
    const live = {
      HomeTeam: {
        IdTeam: '43922',
        Players: [
          { IdPlayer: 'p1', PlayerName: [{ Description: 'MESSI' }], Status: 1 },
          { IdPlayer: 'p3', PlayerName: [{ Description: 'LO CELSO' }], Status: 2 },
        ],
      },
      AwayTeam: {
        IdTeam: '43911',
        Players: [{ IdPlayer: 'p4', PlayerName: [{ Description: 'COURTOIS' }], Status: 1 }],
      },
    };
    const lineup = extractLineup(live);
    expect(lineup).toHaveLength(3);
    expect(lineup[0]).toEqual({ fifaPlayerId: 'p1', fifaTeamId: '43922', name: 'MESSI', isStarter: true });
    expect(lineup[1].isStarter).toBe(false);
    expect(lineup[2].fifaTeamId).toBe('43911');
  });
  it('tolera datos vacíos', () => {
    expect(extractLineup(null)).toEqual([]);
    expect(extractLineup({})).toEqual([]);
  });
});
