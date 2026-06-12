import { buildLiveInput, applyLiveOverlay } from './live';
import { calcularClasificacion } from './engine';
import {
  CalcInput,
  ClasificacionResult,
  MatchPlayerEventRecord,
  MatchRecord,
  PorraFull,
} from '../../types';

// ─── Fixtures mínimos ─────────────────────────────────────────────────────────

function makeMatch(over: Partial<MatchRecord>): MatchRecord {
  return {
    id: 'm1', phase: 'grupos', home_team_id: 'esp', away_team_id: 'bra',
    match_date: null, status: 'pending', home_score: null, away_score: null,
    decided_by_penalties: 0, penalty_winner_id: null, ...over,
  };
}

function makeEvent(over: Partial<MatchPlayerEventRecord>): MatchPlayerEventRecord {
  return {
    id: 'e1', match_id: 'm1', player_id: 'p1', team_id: 'esp',
    minutes_played: 45, goals_open_play: 0, goals_penalty_play: 0, goals_penalty_shootout: 0,
    assists: 0, penalty_saved_play: 0, penalty_saved_shootout: 0, red_card: 0,
    penalty_conceded: 0, penalty_missed_play: 0, penalty_missed_shootout: 0, own_goals: 0,
    is_improvised_goalkeeper: 0, source: 'fifa_draft', is_confirmed: 0, is_live: 0, ...over,
  };
}

// ─── buildLiveInput ───────────────────────────────────────────────────────────

describe('buildLiveInput', () => {
  it('congela el partido en vivo como finished con el marcador provisional', () => {
    const live = makeMatch({ status: 'live', live_home_score: 2, live_away_score: 1, decided_by_penalties: 0 });
    const { matches, liveIds } = buildLiveInput([live], []);
    expect(liveIds.has('m1')).toBe(true);
    expect(matches[0].status).toBe('finished');
    expect(matches[0].home_score).toBe(2);
    expect(matches[0].away_score).toBe(1);
    expect(matches[0].decided_by_penalties).toBe(0);
  });

  it('sin marcador en vivo todavía → 0-0 provisional', () => {
    const live = makeMatch({ status: 'live' });
    const { matches } = buildLiveInput([live], []);
    expect(matches[0].home_score).toBe(0);
    expect(matches[0].away_score).toBe(0);
  });

  it('no toca partidos pending ni finished', () => {
    const pending = makeMatch({ id: 'm2', status: 'pending' });
    const finished = makeMatch({ id: 'm3', status: 'finished', home_score: 1, away_score: 0 });
    const { matches, liveIds } = buildLiveInput([pending, finished], []);
    expect(liveIds.size).toBe(0);
    expect(matches[0]).toBe(pending);
    expect(matches[1]).toBe(finished);
  });

  it('los eventos is_live=1 cuentan solo si su partido está en vivo', () => {
    const live = makeMatch({ id: 'mLive', status: 'live' });
    const finished = makeMatch({ id: 'mFin', status: 'finished', home_score: 1, away_score: 0 });
    const evLive = makeEvent({ id: 'a', match_id: 'mLive', is_live: 1, is_confirmed: 0 });
    const evLeftover = makeEvent({ id: 'b', match_id: 'mFin', is_live: 1, is_confirmed: 0 });
    const evDraft = makeEvent({ id: 'c', match_id: 'mFin', is_live: 0, is_confirmed: 0 });
    const evConfirmed = makeEvent({ id: 'd', match_id: 'mFin', is_live: 0, is_confirmed: 1 });

    const { events } = buildLiveInput([live, finished], [evLive, evLeftover, evDraft, evConfirmed]);
    expect(events.find(e => e.id === 'a')!.is_confirmed).toBe(1); // provisional activo
    expect(events.find(e => e.id === 'b')!.is_confirmed).toBe(0); // resto: sin cambios
    expect(events.find(e => e.id === 'c')!.is_confirmed).toBe(0);
    expect(events.find(e => e.id === 'd')!.is_confirmed).toBe(1);
  });
});

// ─── applyLiveOverlay ─────────────────────────────────────────────────────────

function makeResult(items: Array<{ concept: string; matchId?: string; finalPoints: number }>): ClasificacionResult[] {
  return [{
    position: 1, porraId: 'p1', participantId: 'u1', participantName: 'Alice',
    totalPoints: items.reduce((s, i) => s + i.finalPoints, 0),
    breakdown: {
      selecciones: [],
      jugadores: [{
        playerId: 'j1', playerName: 'GK', position: 'portero', teamId: 'esp',
        role: 'titular', positionSlot: 'portero', isCaptain: false,
        totalPoints: items.reduce((s, i) => s + i.finalPoints, 0),
        items: items.map(i => ({
          concept: i.concept, matchId: i.matchId, phase: 'grupos' as const,
          basePoints: i.finalPoints, phaseMultiplier: 1, winnerMultiplier: 1,
          roleMultiplier: 1, finalPoints: i.finalPoints,
        })),
      }],
    },
  }];
}

describe('applyLiveOverlay', () => {
  it('marca isLive los ítems de partidos en vivo y deja el resto intacto', () => {
    const results = makeResult([
      { concept: 'porJugar', matchId: 'mLive', finalPoints: 5 },
      { concept: 'porJugar', matchId: 'mFin', finalPoints: 5 },
    ]);
    const out = applyLiveOverlay(results, new Set(['mLive']));
    const items = out[0].breakdown.jugadores[0].items;
    expect(items.find(i => i.matchId === 'mLive')!.isLive).toBe(true);
    expect(items.find(i => i.matchId === 'mFin')!.isLive).toBeUndefined();
  });

  it('elimina la portería a cero SOLO en partidos en vivo y recalcula totales', () => {
    const results = makeResult([
      { concept: 'porteriaCero', matchId: 'mLive', finalPoints: 15 },
      { concept: 'porJugar', matchId: 'mLive', finalPoints: 5 },
      { concept: 'porteriaCero', matchId: 'mFin', finalPoints: 15 },
    ]);
    const out = applyLiveOverlay(results, new Set(['mLive']));
    const jug = out[0].breakdown.jugadores[0];
    expect(jug.items.map(i => i.concept)).toEqual(['porJugar', 'porteriaCero']);
    expect(jug.totalPoints).toBe(20);
    expect(out[0].totalPoints).toBe(20);
  });

  it('reordena posiciones tras recalcular y es no-op sin partidos en vivo', () => {
    const results = makeResult([{ concept: 'porJugar', matchId: 'mFin', finalPoints: 5 }]);
    expect(applyLiveOverlay(results, new Set())).toBe(results);
    const out = applyLiveOverlay(results, new Set(['otro']));
    expect(out[0].position).toBe(1);
  });
});

// ─── Integración: overlay + motor real ───────────────────────────────────────

describe('puntuación en vivo de extremo a extremo', () => {
  it('un partido en vivo 1-0 da victoria provisional y goles en vivo, sin portería a cero', () => {
    const teams = [
      { id: 'esp', name: 'España', country_code: 'ESP', category: 'favoritos' as const },
      { id: 'bra', name: 'Brasil', country_code: 'BRA', category: 'favoritos' as const },
    ];
    const players = [{ id: 'gk1', name: 'Unai Simon', team_id: 'esp', position: 'portero' as const }];
    const liveMatch = makeMatch({ status: 'live', live_home_score: 1, live_away_score: 0, minute: 70 });
    const liveEvent = makeEvent({ player_id: 'gk1', team_id: 'esp', minutes_played: 70, is_live: 1, is_confirmed: 0 });

    const porras: PorraFull[] = [{
      porra: { id: 'po1', participant_id: 'u1', is_locked: 0, status: 'approved', submitted_email: null, submitted_data_json: null },
      participant: { id: 'u1', name: 'Alice', email: null },
      selections: [{ id: 's1', porra_id: 'po1', team_id: 'esp', is_winner: 0 }],
      lineup: [{ id: 'l1', porra_id: 'po1', player_id: 'gk1', role: 'titular', position_slot: 'portero', is_captain: 0 }],
    }];

    const { matches, events, liveIds } = buildLiveInput([liveMatch], [liveEvent]);
    const input: CalcInput = { matches, events, teamPhaseResults: [], porras, teams, players };
    const out = applyLiveOverlay(calcularClasificacion(input), liveIds);

    const esp = out[0].breakdown.selecciones[0];
    const victoria = esp.items.find(i => i.concept === 'victoria');
    expect(victoria).toBeDefined();
    expect(victoria!.isLive).toBe(true);
    expect(victoria!.finalPoints).toBe(10); // favorito, grupos ×1, provisional

    const gk = out[0].breakdown.jugadores[0];
    expect(gk.items.find(i => i.concept === 'porJugar')!.isLive).toBe(true);
    // portería a cero NO puntúa en vivo aunque vaya 1-0 con 70 min
    expect(gk.items.find(i => i.concept === 'porteriaCero')).toBeUndefined();
    expect(gk.totalPoints).toBe(5);
    expect(out[0].totalPoints).toBe(15);
  });
});
