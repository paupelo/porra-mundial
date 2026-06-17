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

  it('detecta tanda de penaltis y su ganador', () => {
    const d = mapCalendarMatch({
      ...base,
      ResultType: 3,
      Home: { ...base.Home, Score: 1 },
      Away: { ...base.Away, Score: 1 },
      HomeTeamPenaltyScore: 3,
      AwayTeamPenaltyScore: 4,
    })!;
    expect(d.decidedByPenalties).toBe(true);
    expect(d.penaltyWinnerCode).toBe('RSA');
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
