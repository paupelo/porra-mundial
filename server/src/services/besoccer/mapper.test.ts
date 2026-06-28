import {
  parseScore, parseEvents, parseLineup, aggregateBesoccer, BesoccerEvent,
} from './mapper';

// HTML sintético que reproduce la estructura REAL de BeSoccer verificada contra el
// Mundial 2026 (Argelia-Austria, Sudáfrica-Canadá).

describe('BeSoccer mapper — parseScore', () => {
  it('saca el marcador y los equipos del JSON-LD (description)', () => {
    const html = `<script type="application/ld+json">{"@type":"SportsEvent","description":"Partido de Mundial. 1/16: Sudáfrica 2 - 1 Canadá","homeTeam":{"name":"Sudáfrica"},"awayTeam":{"name":"Canadá"}}</script>`;
    expect(parseScore(html)).toMatchObject({
      homeScore: 2, awayScore: 1, homeTeamRaw: 'Sudáfrica', awayTeamRaw: 'Canadá', decidedByPenalties: false,
    });
  });
  it('0-0 si aún no hay goles', () => {
    const html = `<script type="application/ld+json">{"@type":"SportsEvent","description":"Jornada 1: Sudáfrica 0 - 0 Canadá"}</script>`;
    expect(parseScore(html)).toMatchObject({ homeScore: 0, awayScore: 0 });
  });
});

function popup(order: number, minute: number, playerId: string, type: string, side: 'local' | 'visitor', slug = 'x', extraIds: string[] = []): string {
  const extra = extraIds.map(id => `<a class="main-text" href="https://es.besoccer.com/jugador/y-${id}">Y</a>`).join('');
  return `<div id="popup_event_orderMin_${order}_${minute}_${playerId}" class="popup-box hidden"><div class="panel-head"><span class="t-up">${type}</span><img alt="${side}"></div><a class="main-text" href="https://es.besoccer.com/jugador/${slug}-${playerId}">Nombre</a>${extra}</div>`;
}

describe('BeSoccer mapper — parseEvents', () => {
  it('extrae minuto, tipo, lado y jugador de un popup', () => {
    const evs = parseEvents(popup(1, 60, '149354', 'Gol', 'local', 'r-mahrez'));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ minute: 60, type: 'Gol', side: 'local', playerId: '149354' });
  });
});

function lineupHtml(): string {
  const anchors = Array.from({ length: 22 }, (_, i) =>
    `<a href="https://es.besoccer.com/jugador/p${i}-${1000 + i}"><img alt="P${i}"></a>`).join('');
  return `<div class="panel panel-lineup">${anchors}</div>`;
}

describe('BeSoccer mapper — parseLineup', () => {
  it('separa los 22 titulares: primeros 11 local, siguientes 11 visitante', () => {
    const lu = parseLineup(lineupHtml());
    expect(lu).toHaveLength(22);
    expect(lu.filter(l => l.fifaTeamId === 'local')).toHaveLength(11);
    expect(lu.filter(l => l.fifaTeamId === 'visitor')).toHaveLength(11);
    expect(lu[0]).toMatchObject({ fifaPlayerId: '1000', fifaTeamId: 'local', isStarter: true });
    expect(lu[11]).toMatchObject({ fifaPlayerId: '1011', fifaTeamId: 'visitor' });
  });
});

describe('BeSoccer mapper — aggregateBesoccer', () => {
  const lineup = parseLineup(lineupHtml());
  const ev = (o: Partial<BesoccerEvent>): BesoccerEvent => ({
    minute: 10, type: 'Gol', side: 'local', playerId: '1000', playerName: 'P0', playerIds: ['1000'], shootout: false, ...o,
  });

  it('gol en juego → goals_open_play + goalEvent', () => {
    const { tallies, goalEvents } = aggregateBesoccer([ev({ minute: 60, playerId: '1000' })], lineup, 120);
    expect(tallies.get('1000')!.goals_open_play).toBe(1);
    expect(goalEvents).toEqual([{ fifaTeamId: 'local', minute: 60, isOwnGoal: false }]);
  });

  it('gol de penalti y gol en propia se clasifican por el texto del tipo', () => {
    const { tallies, goalEvents } = aggregateBesoccer([
      ev({ minute: 30, playerId: '1001', type: 'Gol de penalti' }),
      ev({ minute: 70, playerId: '1002', type: 'Gol en propia meta' }),
    ], lineup, 120);
    expect(tallies.get('1001')!.goals_penalty_play).toBe(1);
    expect(tallies.get('1002')!.own_goals).toBe(1);
    expect(goalEvents).toContainEqual({ fifaTeamId: 'local', minute: 70, isOwnGoal: true });
  });

  it('tarjeta roja directa y doble amarilla → red_card y salida del campo', () => {
    const { tallies } = aggregateBesoccer([
      ev({ minute: 40, playerId: '1003', type: 'Tarjeta roja' }),
      ev({ minute: 50, playerId: '1004', type: 'Tarjeta amarilla' }),
      ev({ minute: 75, playerId: '1004', type: 'Tarjeta amarilla' }),
    ], lineup, 120);
    expect(tallies.get('1003')!.red_card).toBe(1);
    expect(tallies.get('1003')!.minute_out).toBe(40);
    expect(tallies.get('1004')!.red_card).toBe(1); // segunda amarilla
  });

  it('cambio: el titular SALE, el suplente ENTRA y recibe minutos (por jugar)', () => {
    // El popup del cambio cita al titular (1005, en el once) y al que entra (9999).
    const { tallies } = aggregateBesoccer([
      ev({ minute: 70, type: 'Sustitución', side: 'local', playerId: '1005', playerIds: ['1005', '9999'] }),
    ], lineup, 120);
    expect(tallies.get('1005')!.minute_out).toBe(70);       // titular sustituido
    expect(tallies.get('9999')!.minute_in).toBe(70);        // suplente que entra
    expect(tallies.get('9999')!.minutes_played).toBe(50);   // 120 - 70
    expect(tallies.get('9999')!.fifaTeamId).toBe('local');
  });

  it('penalti fallado y parado en juego según el texto', () => {
    const { tallies } = aggregateBesoccer([
      ev({ minute: 20, playerId: '1006', type: 'Penalti fallado' }),
      ev({ minute: 25, playerId: '1017', side: 'visitor', type: 'Penalti parado' }),
    ], lineup, 120);
    expect(tallies.get('1006')!.penalty_missed_play).toBe(1);
    expect(tallies.get('1017')!.penalty_saved_play).toBe(1);
  });
});
