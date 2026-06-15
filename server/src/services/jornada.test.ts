import {
  deriveGroupMatchdays,
  currentRound,
  roundKey,
  roundLabel,
  computeProgresoJornada,
} from './jornada';
import { MatchRecord, MatchStatus, Phase, PlayerRecord, PorraFull } from '../types';

function m(
  id: string,
  phase: Phase,
  home: string,
  away: string,
  date: string | null,
  status: MatchStatus = 'pending',
  group: string | null = null,
): MatchRecord {
  return {
    id, phase, home_team_id: home, away_team_id: away, match_date: date, status,
    home_score: null, away_score: null, decided_by_penalties: 0, penalty_winner_id: null,
    group_name: group,
  };
}

function player(id: string, teamId: string): PlayerRecord {
  return { id, name: id, team_id: teamId, position: 'medio' };
}

function porra(id: string, teamIds: string[], playerIds: string[]): PorraFull {
  return {
    porra: { id, participant_id: `p-${id}`, is_locked: 1, status: 'approved', submitted_email: null, submitted_data_json: null },
    participant: { id: `p-${id}`, name: `Part ${id}`, email: null },
    selections: teamIds.map((t, i) => ({ id: `${id}-s${i}`, porra_id: id, team_id: t, is_winner: 0 as const })),
    lineup: playerIds.map((pl, i) => ({ id: `${id}-l${i}`, porra_id: id, player_id: pl, role: 'titular' as const, position_slot: 'medio' as const, is_captain: 0 as const })),
  };
}

// Grupo A con 6 partidos (4 equipos), 2 por jornada, en orden de fecha.
function groupA(): MatchRecord[] {
  return [
    m('a1', 'grupos', 't1', 't2', '2026-06-11T18:00:00Z', 'finished', 'Group A'),
    m('a2', 'grupos', 't3', 't4', '2026-06-11T21:00:00Z', 'finished', 'Group A'),
    m('a3', 'grupos', 't1', 't3', '2026-06-15T18:00:00Z', 'pending', 'Group A'),
    m('a4', 'grupos', 't2', 't4', '2026-06-15T21:00:00Z', 'pending', 'Group A'),
    m('a5', 'grupos', 't1', 't4', '2026-06-19T18:00:00Z', 'pending', 'Group A'),
    m('a6', 'grupos', 't2', 't3', '2026-06-19T21:00:00Z', 'pending', 'Group A'),
  ];
}

describe('jornada — deriveGroupMatchdays', () => {
  it('reparte los 6 partidos del grupo en jornadas 1/2/3 por fecha', () => {
    const md = deriveGroupMatchdays(groupA());
    expect([md.get('a1'), md.get('a2')]).toEqual([1, 1]);
    expect([md.get('a3'), md.get('a4')]).toEqual([2, 2]);
    expect([md.get('a5'), md.get('a6')]).toEqual([3, 3]);
  });

  it('no asigna jornada a partidos de eliminatorias', () => {
    const md = deriveGroupMatchdays([m('k1', 'octavos', 't1', 't2', '2026-07-01T18:00:00Z')]);
    expect(md.size).toBe(0);
  });
});

describe('jornada — currentRound', () => {
  it('Jornada 1 mientras quede algún partido de J1 sin finalizar', () => {
    const ms = groupA().map(x => (x.id === 'a1' ? { ...x, status: 'live' as const } : x));
    const r = currentRound(ms, deriveGroupMatchdays(ms));
    expect(roundKey(r)).toBe('grupos-1');
    expect(roundLabel(r)).toBe('Jornada 1 · Fase de grupos');
  });

  it('se reinicia a Jornada 2 cuando toda la J1 ha terminado', () => {
    // a1 y a2 finished (J1 completa); resto pending
    const r = currentRound(groupA(), deriveGroupMatchdays(groupA()));
    expect(roundKey(r)).toBe('grupos-2');
  });

  it('en eliminatorias la ronda en curso es la de menor índice no finalizada', () => {
    const ms = [
      m('o1', 'octavos', 't1', 't2', '2026-07-01', 'finished'),
      m('o2', 'octavos', 't3', 't4', '2026-07-02', 'pending'),
      m('c1', 'cuartos', 't1', 't3', '2026-07-05', 'pending'),
    ];
    expect(roundKey(currentRound(ms, deriveGroupMatchdays(ms)))).toBe('octavos');
  });

  it('si todo está finalizado devuelve la ronda más avanzada', () => {
    const ms = [
      m('s1', 'semifinales', 't1', 't2', '2026-07-10', 'finished'),
      m('f1', 'final', 't1', 't3', '2026-07-15', 'finished'),
    ];
    expect(roundKey(currentRound(ms, deriveGroupMatchdays(ms)))).toBe('final');
  });
});

describe('jornada — computeProgresoJornada', () => {
  it('cuenta selecciones y jugadores disputados sobre los programados en la ronda', () => {
    // Ronda en curso = J1 (a1 live, a2 pending). Equipos en J1: t1,t2 (a1) y t3,t4 (a2).
    const ms = groupA().map(x =>
      x.id === 'a1' ? { ...x, status: 'live' as const } : x.id === 'a2' ? { ...x, status: 'pending' as const } : x,
    );
    const players = [player('pl1', 't1'), player('pl2', 't3'), player('pl3', 't5')];
    // Selecciones: t1 (juega J1, empezado), t5 (no juega J1). Jugadores: pl1(t1 empezado), pl2(t3 no empezado), pl3(t5 fuera).
    const pf = porra('x', ['t1', 't5'], ['pl1', 'pl2', 'pl3']);
    const res = computeProgresoJornada(ms, [pf], players);
    expect(res.jornada.key).toBe('grupos-1');
    const p = res.participantes[0];
    expect(p.selecciones).toEqual({ disputadas: 1, total: 1 }); // solo t1 está en J1, y ya empezó
    expect(p.jugadores).toEqual({ disputados: 1, total: 2 });   // pl1 empezó, pl2 programado sin empezar, pl3 fuera
  });

  it('muestra 0/Y cuando la ronda aún no ha empezado', () => {
    const ms = groupA(); // J1 a1,a2 finished → ronda actual J2 (a3,a4 pending), nada empezado
    const players = [player('pl1', 't1'), player('pl2', 't2')];
    const pf = porra('x', ['t1', 't2'], ['pl1', 'pl2']);
    const res = computeProgresoJornada(ms, [pf], players);
    expect(res.jornada.key).toBe('grupos-2');
    expect(res.participantes[0].selecciones).toEqual({ disputadas: 0, total: 2 });
    expect(res.participantes[0].jugadores).toEqual({ disputados: 0, total: 2 });
  });
});
