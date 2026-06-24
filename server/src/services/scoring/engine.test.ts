/**
 * Tests del motor de puntuación de la Porra Mundial 2026.
 * Cubren TODOS los criterios de las normas.
 */

import { calcularClasificacion } from './engine';
import { calcTeamScore } from './selecciones';
import { calcPlayerScore } from './jugadores';
import { getPhaseMultiplier, getPasaRondaMultiplier } from './multipliers';
import {
  calcDelanteroGoals,
  calcMedioGoals,
  calcMedioAssists,
} from './scoring-tables';
import {
  CalcInput,
  MatchPlayerEventRecord,
  MatchRecord,
  PlayerRecord,
  PorraFull,
  TeamPhaseResultRecord,
  TeamRecord,
} from '../../types';

// ─── Fixtures helpers ─────────────────────────────────────────────────────────

function makeTeam(id: string, category: TeamRecord['category'], name = id): TeamRecord {
  return { id, name, country_code: null, category };
}

function makePlayer(id: string, teamId: string, position: PlayerRecord['position'], name = id): PlayerRecord {
  return { id, name, team_id: teamId, position };
}

function makeMatch(
  id: string,
  homeId: string,
  awayId: string,
  phase: MatchRecord['phase'],
  homeScore: number,
  awayScore: number,
  penaltyWinnerId?: string,
): MatchRecord {
  return {
    id,
    phase,
    home_team_id: homeId,
    away_team_id: awayId,
    match_date: null,
    status: 'finished',
    home_score: homeScore,
    away_score: awayScore,
    decided_by_penalties: penaltyWinnerId ? 1 : 0,
    penalty_winner_id: penaltyWinnerId ?? null,
  };
}

function makeEvent(
  matchId: string,
  playerId: string,
  teamId: string,
  overrides: Partial<MatchPlayerEventRecord> = {},
): MatchPlayerEventRecord {
  return {
    id: `ev-${matchId}-${playerId}`,
    match_id: matchId,
    player_id: playerId,
    team_id: teamId,
    minutes_played: 90,
    goals_open_play: 0,
    goals_penalty_play: 0,
    goals_penalty_shootout: 0,
    assists: 0,
    penalty_saved_play: 0,
    penalty_saved_shootout: 0,
    red_card: 0,
    penalty_conceded: 0,
    penalty_missed_play: 0,
    penalty_missed_shootout: 0,
    own_goals: 0,
    is_improvised_goalkeeper: 0,
    source: 'manual',
    is_confirmed: 1,
    ...overrides,
  };
}

function makePhaseResult(
  teamId: string,
  phase: TeamPhaseResultRecord['phase'],
  result: TeamPhaseResultRecord['result'],
): TeamPhaseResultRecord {
  return { id: `pr-${teamId}-${phase}`, team_id: teamId, phase, result };
}

// ─── Tests de multiplicadores ─────────────────────────────────────────────────

describe('Multiplicadores de fase', () => {
  test('grupos → ×1',         () => expect(getPhaseMultiplier('grupos')).toBe(1));
  test('dieciseisavos → ×1',  () => expect(getPhaseMultiplier('dieciseisavos')).toBe(1));
  test('octavos → ×1',        () => expect(getPhaseMultiplier('octavos')).toBe(1));
  test('cuartos → ×1.5',      () => expect(getPhaseMultiplier('cuartos')).toBe(1.5));
  test('semifinales → ×2',    () => expect(getPhaseMultiplier('semifinales')).toBe(2));
  test('final → ×3',          () => expect(getPhaseMultiplier('final')).toBe(3));
});

describe('Multiplicador pasaRonda (fase a la que se accede)', () => {
  test('de grupos a dieciseisavos → ×1',      () => expect(getPasaRondaMultiplier('grupos')).toBe(1));
  test('de dieciseisavos a octavos → ×1',     () => expect(getPasaRondaMultiplier('dieciseisavos')).toBe(1));
  test('de octavos a cuartos → ×1.5',         () => expect(getPasaRondaMultiplier('octavos')).toBe(1.5));
  test('de cuartos a semifinales → ×2',       () => expect(getPasaRondaMultiplier('cuartos')).toBe(2));
  test('de semifinales a final → ×3',         () => expect(getPasaRondaMultiplier('semifinales')).toBe(3));
  test('de final (ganador) → ×0 (sin ronda)', () => expect(getPasaRondaMultiplier('final')).toBe(0));
});

// ─── Funciones especiales de goles y asistencias ──────────────────────────────

describe('Goles Delantero', () => {
  test('0 goles → 0',                     () => expect(calcDelanteroGoals(0)).toBe(0));
  test('1 gol → 20',                      () => expect(calcDelanteroGoals(1)).toBe(20));
  test('2 goles (doblete) → 50',          () => expect(calcDelanteroGoals(2)).toBe(50));
  test('3 goles (hat-trick) → 90',        () => expect(calcDelanteroGoals(3)).toBe(90));
  test('4 goles → 120',                   () => expect(calcDelanteroGoals(4)).toBe(120));
  test('5 goles → 150',                   () => expect(calcDelanteroGoals(5)).toBe(150));
});

describe('Goles Medio', () => {
  test('0 goles → 0',              () => expect(calcMedioGoals(0)).toBe(0));
  test('1 gol → 25',               () => expect(calcMedioGoals(1)).toBe(25));
  test('2 goles → 50 (lineal)',    () => expect(calcMedioGoals(2)).toBe(50));
  test('3 goles (hat-trick) → 90', () => expect(calcMedioGoals(3)).toBe(90));
  test('4 goles → 120',            () => expect(calcMedioGoals(4)).toBe(120));
});

describe('Asistencias Medio', () => {
  test('0 asist → 0',                  () => expect(calcMedioAssists(0)).toBe(0));
  test('1 asist → 15',                 () => expect(calcMedioAssists(1)).toBe(15));
  test('2 asist (doble) → 40',         () => expect(calcMedioAssists(2)).toBe(40));
  test('3 asist → 65 (40+25)',         () => expect(calcMedioAssists(3)).toBe(65));
  test('4 asist → 90 (40+25+25)',      () => expect(calcMedioAssists(4)).toBe(90));
});

// ─── Puntuación de selecciones ────────────────────────────────────────────────

describe('Resultados de partido por categoría', () => {
  test('Favorito victoria en grupos → 10', () => {
    const t = makeTeam('esp', 'favoritos');
    const m = makeMatch('m1', 'esp', 'bra', 'grupos', 2, 0);
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(10);
  });

  test('Favorito derrota en grupos → -20', () => {
    const t = makeTeam('esp', 'favoritos');
    const m = makeMatch('m1', 'esp', 'bra', 'grupos', 0, 2);
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(-20);
  });

  test('Favorito empate en grupos → 1', () => {
    const t = makeTeam('esp', 'favoritos');
    const m = makeMatch('m1', 'esp', 'bra', 'grupos', 1, 1);
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(1);
  });

  test('Sorpresa victoria en cuartos → 20×1.5 = 30', () => {
    const t = makeTeam('tur', 'sorpresas');
    const m = makeMatch('m1', 'tur', 'esp', 'cuartos', 1, 0);
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(30);
  });

  test('Petardazo victoria en semis → 30×2 = 60', () => {
    const t = makeTeam('arm', 'petardazos');
    const m = makeMatch('m1', 'arm', 'esp', 'semifinales', 1, 0);
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(60);
  });

  test('Caca de la Vaca victoria en final → 40×3 = 120', () => {
    const t = makeTeam('and', 'caca');
    const m = makeMatch('m1', 'and', 'esp', 'final', 1, 0);
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(120);
  });

  test('Caca de la Vaca derrota en grupos → 0', () => {
    const t = makeTeam('and', 'caca');
    const m = makeMatch('m1', 'and', 'esp', 'grupos', 0, 3);
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(0);
  });
});

describe('Penaltis como empate en selecciones', () => {
  test('Favorito gana tanda en grupos → empate(1) + ganarPenaltis(5) = 6', () => {
    const t = makeTeam('esp', 'favoritos');
    const m = makeMatch('m1', 'esp', 'bra', 'grupos', 1, 1, 'esp');
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(6);
  });

  test('Favorito pierde tanda en grupos → solo empate(1)', () => {
    const t = makeTeam('esp', 'favoritos');
    const m = makeMatch('m1', 'esp', 'bra', 'grupos', 1, 1, 'bra');
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(1);
  });

  test('Caca gana tanda en semis → (20+40)×2 = 120', () => {
    const t = makeTeam('and', 'caca');
    const m = makeMatch('m1', 'and', 'esp', 'semifinales', 0, 0, 'and');
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(120);
  });

  test('Sorpresa pierde tanda en octavos → empate(5)×1 = 5', () => {
    const t = makeTeam('tur', 'sorpresas');
    const m = makeMatch('m1', 'tur', 'esp', 'octavos', 0, 0, 'esp');
    const r = calcTeamScore(t, false, [m], []);
    expect(r.totalPoints).toBe(5);
  });
});

describe('Equipo Ganador (×2 en todo)', () => {
  test('Favorito ganador victoria en grupos → 10×1×2 = 20', () => {
    const t = makeTeam('esp', 'favoritos');
    const m = makeMatch('m1', 'esp', 'bra', 'grupos', 2, 0);
    const r = calcTeamScore(t, true, [m], []);
    expect(r.totalPoints).toBe(20);
  });

  test('Favorito ganador gana tanda en cuartos → (1+5)×1.5×2 = 18', () => {
    const t = makeTeam('esp', 'favoritos');
    const m = makeMatch('m1', 'esp', 'bra', 'cuartos', 1, 1, 'esp');
    const r = calcTeamScore(t, true, [m], []);
    expect(r.totalPoints).toBe(18);
  });

  test('Petardazo ganador gana Mundial → 200×1×2 = 400 (flat ×2)', () => {
    const t = makeTeam('arm', 'petardazos');
    const pr = makePhaseResult('arm', 'final', 'winner');
    const r = calcTeamScore(t, true, [], [pr]);
    expect(r.totalPoints).toBe(400);
  });

  test('Caca ganador pasa a cuartos → 80×1.5×2 = 240', () => {
    const t = makeTeam('and', 'caca');
    const pr = makePhaseResult('and', 'octavos', 'advanced');
    const r = calcTeamScore(t, true, [], [pr]);
    expect(r.totalPoints).toBe(240);
  });
});

describe('Pasar ronda (selecciones)', () => {
  test('Caca pasa a cuartos (desde octavos) → 80×1.5 = 120', () => {
    const t = makeTeam('and', 'caca');
    const pr = makePhaseResult('and', 'octavos', 'advanced');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(120);
  });

  test('Favorito pasa a semis (desde cuartos) → 10×2 = 20', () => {
    const t = makeTeam('esp', 'favoritos');
    const pr = makePhaseResult('esp', 'cuartos', 'advanced');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(20);
  });

  test('Petardazo pasa a final (desde semis) → 40×3 = 120', () => {
    const t = makeTeam('arm', 'petardazos');
    const pr = makePhaseResult('arm', 'semifinales', 'advanced');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(120);
  });
});

describe('No llegar a rondas (penalizaciones planas)', () => {
  test('Favorito eliminado en grupos → noDeciseisvos = -100', () => {
    const t = makeTeam('esp', 'favoritos');
    const pr = makePhaseResult('esp', 'grupos', 'eliminated');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(-100);
  });

  test('Favorito eliminado en dieciseisavos → noOctavos = -50', () => {
    const t = makeTeam('esp', 'favoritos');
    const pr = makePhaseResult('esp', 'dieciseisavos', 'eliminated');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(-50);
  });

  test('Sorpresa eliminada en grupos → -50', () => {
    const t = makeTeam('tur', 'sorpresas');
    const pr = makePhaseResult('tur', 'grupos', 'eliminated');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(-50);
  });

  test('Caca eliminada en grupos → -10', () => {
    const t = makeTeam('and', 'caca');
    const pr = makePhaseResult('and', 'grupos', 'eliminated');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(-10);
  });

  test('Caca eliminada en dieciseisavos → noOctavos = 0', () => {
    const t = makeTeam('and', 'caca');
    const pr = makePhaseResult('and', 'dieciseisavos', 'eliminated');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(0);
  });

  test('Eliminación en octavos o posterior → sin penalización extra', () => {
    const t = makeTeam('esp', 'favoritos');
    const pr = makePhaseResult('esp', 'octavos', 'eliminated');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(0);
  });
});

describe('Ganar Mundial (bonus plano, no se multiplica)', () => {
  test('Favorito gana Mundial → +50 plano', () => {
    const t = makeTeam('esp', 'favoritos');
    const pr = makePhaseResult('esp', 'final', 'winner');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(50);
  });

  test('Petardazo gana Mundial → +200', () => {
    const t = makeTeam('arm', 'petardazos');
    const pr = makePhaseResult('arm', 'final', 'winner');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(200);
  });

  test('Caca gana Mundial → +400', () => {
    const t = makeTeam('and', 'caca');
    const pr = makePhaseResult('and', 'final', 'winner');
    const r = calcTeamScore(t, false, [], [pr]);
    expect(r.totalPoints).toBe(400);
  });
});

// ─── Puntuación de jugadores ──────────────────────────────────────────────────

function singlePlayerScore(
  player: PlayerRecord,
  eventOverrides: Partial<MatchPlayerEventRecord>,
  phase: MatchRecord['phase'] = 'grupos',
  opts: { isCaptain?: boolean; role?: 'titular' | 'suplente'; isMvp?: boolean } = {},
) {
  const match = makeMatch('m1', player.team_id, 'opp', phase, 0, 0);
  const event = makeEvent('m1', player.id, player.team_id, eventOverrides);
  const evMap = new Map([['m1', event]]);
  return calcPlayerScore(
    player,
    opts.role ?? 'titular',
    player.position,
    opts.isCaptain ?? false,
    [],
    [match],
    evMap,
    [],
    opts.isMvp ?? false,
  );
}

describe('Por jugar', () => {
  // Usamos medio para aislar "por jugar" (sin portería a cero ni gol encajado)
  test('Medio juega 90 min en grupos → +5', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    expect(singlePlayerScore(p, { minutes_played: 90 }).totalPoints).toBe(5);
  });

  test('Medio juega en semifinales → 5×2 = 10', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    expect(singlePlayerScore(p, { minutes_played: 90 }, 'semifinales').totalPoints).toBe(10);
  });

  test('Medio juega en final → 5×3 = 15', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    expect(singlePlayerScore(p, { minutes_played: 90 }, 'final').totalPoints).toBe(15);
  });

  test('Jugador sin participación alguna (0 min, sin entrar) → no suma por jugar', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    expect(singlePlayerScore(p, { minutes_played: 0 }).totalPoints).toBe(0);
  });

  // BUG 1: un suplente que entra en la prórroga puede quedar con minutes_played=0
  // (su minuto se redondea al límite del partido) pero JUGÓ → debe recibir los 5.
  test('Suplente que entra en prórroga (minutes_played=0, minute_in>0) → +5', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { minutes_played: 0, minute_in: 120, minute_out: null }, 'octavos');
    expect(r.items.find(i => i.concept === 'porJugar')).toBeDefined();
    expect(r.totalPoints).toBe(5);
  });

  // BUG 1: aunque los minutos lleguen a 0, una acción de juego (gol, asistencia,
  // tarjeta…) prueba que el jugador pisó el campo → cobra "por jugar".
  test('Jugador con gol pero minutes_played=0 → recibe por jugar además del gol', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { minutes_played: 0, goals_open_play: 1 });
    expect(r.items.find(i => i.concept === 'porJugar')).toBeDefined();
    expect(r.totalPoints).toBe(30); // porJugar 5 + gol medio 25
  });

  test('Suplente que sale del campo (minute_out definido) cuenta como participante', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { minutes_played: 0, minute_in: 0, minute_out: 0 });
    expect(r.items.find(i => i.concept === 'porJugar')).toBeDefined();
  });
});

describe('Portería a cero', () => {
  test('Portero 60 min exactos, 0 goles → sí (+15)', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const m = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 0);
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 60 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    const pc = r.items.find(i => i.concept === 'porteriaCero');
    expect(pc).toBeDefined();
    expect(pc!.basePoints).toBe(15);
  });

  test('Portero 59 min, 0 goles → NO portería a cero', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const m = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 0);
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 59 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeUndefined();
  });

  test('Portero 90 min, 1 gol encajado → NO portería a cero', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const m = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 1);
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeUndefined();
  });

  test('Portero 90 min, 0-0 más tanda (0 goles en tiempo reglamentario) → SÍ portería a cero', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    // En tanda: el marcador de tiempo reglamentario sigue 0-0
    const m = makeMatch('m1', 'esp', 'opp', 'octavos', 0, 0, 'esp');
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeDefined();
  });

  test('Portero 90 min, 1-1 más tanda → NO portería a cero', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const m = makeMatch('m1', 'esp', 'opp', 'octavos', 1, 1, 'esp');
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeUndefined();
  });

  test('Defensa 60 min, 0 goles → portería a cero (+10)', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const m = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 0);
    const ev = makeEvent('m1', 'def', 'esp', { minutes_played: 60 });
    const r = calcPlayerScore(p, 'titular', 'defensa', false, [], [m], new Map([['m1', ev]]), [], false);
    const pc = r.items.find(i => i.concept === 'porteriaCero');
    expect(pc).toBeDefined();
    expect(pc!.basePoints).toBe(10);
  });

  test('Portería a cero en cuartos → 15×1.5 = 22.5', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const m = makeMatch('m1', 'esp', 'opp', 'cuartos', 0, 0);
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    const pc = r.items.find(i => i.concept === 'porteriaCero');
    expect(pc!.finalPoints).toBe(22.5);
  });
});

describe('Gol encajado', () => {
  test('Portero concede 3 goles en grupos → -5×3 = -15', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const m = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 3);
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    const ge = r.items.find(i => i.concept === 'golEncajado');
    expect(ge!.basePoints).toBe(-15);
  });

  test('Defensa concede 2 goles en cuartos → -5×2×1.5 = -15', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const m = makeMatch('m1', 'esp', 'opp', 'cuartos', 0, 2);
    const ev = makeEvent('m1', 'def', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'defensa', false, [], [m], new Map([['m1', ev]]), [], false);
    const ge = r.items.find(i => i.concept === 'golEncajado');
    expect(ge!.finalPoints).toBe(-15);
  });

  test('Medio no tiene gol encajado', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const m = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 5);
    const ev = makeEvent('m1', 'mid', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'medio', false, [], [m], new Map([['m1', ev]]), [], false);
    expect(r.items.find(i => i.concept === 'golEncajado')).toBeUndefined();
  });
});

describe('Portería a cero y gol encajado por intervalo en campo', () => {
  // El equipo local 'esp' encaja los goles del visitante (away_goal_minutes).
  test('Portero sale en el 70; el rival marca en el 85 → portería a cero (gol fuera de su intervalo)', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const m: MatchRecord = { ...makeMatch('m1', 'esp', 'opp', 'grupos', 0, 1), away_goal_minutes: [85] };
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 70, minute_in: 0, minute_out: 70 });
    const r = calcPlayerScore(p, 'titular', 'portero', false, [], [m], new Map([['m1', ev]]), [], false);
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeDefined();
    expect(r.items.find(i => i.concept === 'golEncajado')).toBeUndefined();
  });

  test('Defensa solo responde por el gol encajado en su intervalo', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    // Marcador final 0-2, pero el defensa estuvo [0, 60]: solo el gol del 30 cuenta.
    const m: MatchRecord = { ...makeMatch('m1', 'esp', 'opp', 'grupos', 0, 2), away_goal_minutes: [30, 80] };
    const ev = makeEvent('m1', 'def', 'esp', { minutes_played: 60, minute_in: 0, minute_out: 60 });
    const r = calcPlayerScore(p, 'titular', 'defensa', false, [], [m], new Map([['m1', ev]]), [], false);
    const ge = r.items.find(i => i.concept === 'golEncajado');
    expect(ge!.basePoints).toBe(-5); // -5 × 1 gol
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeUndefined();
  });

  test('Suplente que entra en el 75 no carga los goles previos', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const m: MatchRecord = { ...makeMatch('m1', 'esp', 'opp', 'grupos', 0, 2), away_goal_minutes: [20, 50] };
    const ev = makeEvent('m1', 'def', 'esp', { minutes_played: 15, minute_in: 75, minute_out: null });
    const r = calcPlayerScore(p, 'titular', 'defensa', false, [], [m], new Map([['m1', ev]]), [], false);
    // 0 goles en [75, fin] → sin penalización; y <60 min → sin portería a cero
    expect(r.items.find(i => i.concept === 'golEncajado')).toBeUndefined();
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeUndefined();
  });

  test('Sin datos de minutos de gol → fallback al marcador final', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    // Sale en el 30 pero NO hay away_goal_minutes → cuenta los 2 del marcador final.
    const m = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 2);
    const ev = makeEvent('m1', 'def', 'esp', { minutes_played: 30, minute_in: 0, minute_out: 30 });
    const r = calcPlayerScore(p, 'titular', 'defensa', false, [], [m], new Map([['m1', ev]]), [], false);
    expect(r.items.find(i => i.concept === 'golEncajado')!.basePoints).toBe(-10); // -5 × 2
  });
});

describe('Penalti parado', () => {
  test('Portero para 1 penalti en juego → +30', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { penalty_saved_play: 1 });
    const pp = r.items.find(i => i.concept === 'penaltiParado');
    expect(pp!.basePoints).toBe(30);
  });

  test('Portero para 1 penalti en tanda → +15', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { penalty_saved_shootout: 1 });
    const pp = r.items.find(i => i.concept === 'penaltiParadoTanda');
    expect(pp!.basePoints).toBe(15);
  });

  test('Portero para 2 penaltis en juego → +60', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { penalty_saved_play: 2 });
    const pp = r.items.find(i => i.concept === 'penaltiParado');
    expect(pp!.basePoints).toBe(60);
  });
});

describe('Penalti fallado', () => {
  test('Delantero falla penalti en juego → -20', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { penalty_missed_play: 1 });
    const pf = r.items.find(i => i.concept === 'penaltiFalladoJuego');
    expect(pf!.basePoints).toBe(-20);
  });

  test('Delantero falla penalti en tanda → -10', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { penalty_missed_shootout: 1 });
    const pf = r.items.find(i => i.concept === 'penaltiFalladoTanda');
    expect(pf!.basePoints).toBe(-10);
  });

  // BUG 2: el -20 del penalti fallado en juego se descuenta SIEMPRE del total
  // (no se multiplica por fase, ni siquiera en la final).
  test('Penalti fallado en juego descuenta -20 del total (90 min + fallo)', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { minutes_played: 90, penalty_missed_play: 1 }, 'final');
    const pf = r.items.find(i => i.concept === 'penaltiFalladoJuego');
    expect(pf!.finalPoints).toBe(-20); // ×1 aunque sea final
    expect(r.totalPoints).toBe(-5);    // porJugar 5×3=15 (final) − 20 = -5
  });
});

describe('Penalti cometido', () => {
  test('Defensa comete 1 penalti → -15', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const r = singlePlayerScore(p, { penalty_conceded: 1 });
    expect(r.items.find(i => i.concept === 'penaltiCometido')!.basePoints).toBe(-15);
  });
});

describe('Tarjeta roja', () => {
  test('Delantero recibe roja → -20', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { red_card: 1 });
    expect(r.items.find(i => i.concept === 'tarjetaRoja')!.basePoints).toBe(-20);
  });

  test('Portero recibe roja → -20', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { red_card: 1 });
    expect(r.items.find(i => i.concept === 'tarjetaRoja')!.basePoints).toBe(-20);
  });

  test('Tarjeta roja NO se multiplica por fase', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const match = makeMatch('m1', 'esp', 'opp', 'final', 0, 0);
    const ev = makeEvent('m1', 'fwd', 'esp', { red_card: 1, minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'delantero', false, [], [match], new Map([['m1', ev]]), [], false);
    const roja = r.items.find(i => i.concept === 'tarjetaRoja');
    expect(roja!.phaseMultiplier).toBe(1); // no se multiplica
    expect(roja!.basePoints).toBe(-20);
    expect(roja!.finalPoints).toBe(-20);
  });
});

describe('Gol en propia meta', () => {
  test('Defensa gol en propia → -15', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const r = singlePlayerScore(p, { own_goals: 1 });
    expect(r.items.find(i => i.concept === 'golEnPropiaMeta')!.basePoints).toBe(-15);
  });
});

describe('Goles por posición', () => {
  test('Portero 1 gol en grupos → +50', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { goals_open_play: 1 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(50);
  });

  test('Portero 1 gol en final → 50×3 = 150', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { goals_open_play: 1 }, 'final');
    expect(r.items.find(i => i.concept === 'goles')!.finalPoints).toBe(150);
  });

  test('Defensa 1 gol → +30', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const r = singlePlayerScore(p, { goals_open_play: 1 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(30);
  });

  test('Medio 1 gol → +25', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { goals_open_play: 1 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(25);
  });

  test('Medio 2 goles → +50 (lineal, sin doblete especial)', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { goals_open_play: 2 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(50);
  });

  test('Medio 3 goles (hat-trick) → +90', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { goals_open_play: 3 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(90);
  });

  test('Medio 4 goles → +120', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { goals_open_play: 4 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(120);
  });

  test('Delantero 1 gol → +20', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { goals_open_play: 1 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(20);
  });

  test('Delantero 2 goles (doblete) → +50 (no 40)', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { goals_open_play: 2 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(50);
  });

  test('Delantero 3 goles (hat-trick) → +90', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { goals_open_play: 3 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(90);
  });

  test('Delantero 4 goles → +120', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { goals_open_play: 4 });
    expect(r.items.find(i => i.concept === 'goles')!.basePoints).toBe(120);
  });
});

describe('Goles en tanda (mitad, no cuentan para doblete/hat-trick)', () => {
  test('Delantero 1 gol en tanda → 20/2 = 10', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { goals_penalty_shootout: 1 });
    expect(r.items.find(i => i.concept === 'golesTanda')!.basePoints).toBe(10);
  });

  test('Portero 1 gol en tanda → 50/2 = 25', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { goals_penalty_shootout: 1 });
    expect(r.items.find(i => i.concept === 'golesTanda')!.basePoints).toBe(25);
  });

  test('Delantero 2 goles en tanda NO activa doblete', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { goals_penalty_shootout: 2 });
    // 2 goles en tanda = 10+10 = 20, no 50 del doblete
    expect(r.items.find(i => i.concept === 'golesTanda')!.basePoints).toBe(20);
    expect(r.items.find(i => i.concept === 'goles')).toBeUndefined();
  });
});

describe('Asistencias por posición', () => {
  test('Portero 1 asist → +50', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const r = singlePlayerScore(p, { assists: 1 });
    expect(r.items.find(i => i.concept === 'asistencias')!.basePoints).toBe(50);
  });

  test('Defensa 1 asist → +20', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const r = singlePlayerScore(p, { assists: 1 });
    expect(r.items.find(i => i.concept === 'asistencias')!.basePoints).toBe(20);
  });

  test('Medio 1 asist → +15', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { assists: 1 });
    expect(r.items.find(i => i.concept === 'asistencias')!.basePoints).toBe(15);
  });

  test('Medio 2 asist (doble asistencia) → +40', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { assists: 2 });
    expect(r.items.find(i => i.concept === 'asistencias')!.basePoints).toBe(40);
  });

  test('Medio 3 asist → +65', () => {
    const p = makePlayer('mid', 'esp', 'medio');
    const r = singlePlayerScore(p, { assists: 3 });
    expect(r.items.find(i => i.concept === 'asistencias')!.basePoints).toBe(65);
  });

  test('Delantero 2 asist → +20 (lineal)', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { assists: 2 });
    expect(r.items.find(i => i.concept === 'asistencias')!.basePoints).toBe(20);
  });
});

describe('Capitán (×2 en todo)', () => {
  test('Delantero capitán 1 gol → (5+20)×2 = 50', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { goals_open_play: 1 }, 'grupos', { isCaptain: true });
    expect(r.totalPoints).toBe(50); // (porJugar:5 + goles:20) × 2
  });

  test('Portero capitán portería a cero (90 min) → (5+15)×2 = 40', () => {
    const p = makePlayer('gk', 'esp', 'portero');
    const match = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 0);
    const ev = makeEvent('m1', 'gk', 'esp', { minutes_played: 90 });
    const r = calcPlayerScore(p, 'titular', 'portero', true, [], [match], new Map([['m1', ev]]), [], false);
    expect(r.totalPoints).toBe(40);
  });

  test('Capitán con tarjeta roja: penalización también se duplica', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { red_card: 1 }, 'grupos', { isCaptain: true });
    const roja = r.items.find(i => i.concept === 'tarjetaRoja');
    expect(roja!.finalPoints).toBe(-40); // -20 × roleMultiplier(2)
  });
});

describe('Suplente (mitad mientras línea completa)', () => {
  // Usamos 'medio' para evitar portería a cero y gol encajado: solo puntúa "por jugar"
  test('Medio suplente, línea completa → por jugar ×0.5 = 2.5', () => {
    const p = makePlayer('sub-mid', 'tur', 'medio');
    const match = makeMatch('m1', 'tur', 'opp', 'grupos', 0, 0);
    const ev = makeEvent('m1', 'sub-mid', 'tur', { minutes_played: 90 });
    const r = calcPlayerScore(
      p, 'suplente', 'medio', false,
      ['esp', 'fra', 'por'], // starter team IDs (none eliminated)
      [match],
      new Map([['m1', ev]]),
      [], // no eliminations
      false,
    );
    expect(r.totalPoints).toBe(2.5); // 5 × 0.5
  });

  test('Medio suplente, un titular eliminado → por jugar completo = 5', () => {
    const p = makePlayer('sub-mid', 'tur', 'medio');
    const match = makeMatch('m1', 'tur', 'opp', 'dieciseisavos', 0, 0);
    const ev = makeEvent('m1', 'sub-mid', 'tur', { minutes_played: 90 });
    // esp eliminado en grupos (antes de dieciseisavos)
    const pr = makePhaseResult('esp', 'grupos', 'eliminated');
    const r = calcPlayerScore(
      p, 'suplente', 'medio', false,
      ['esp', 'fra', 'por'],
      [match],
      new Map([['m1', ev]]),
      [pr],
      false,
    );
    expect(r.totalPoints).toBe(5); // línea incompleta → 1x
  });
});

describe('Suplente que asciende a titular (puntos previos ×0.5, posteriores ×1)', () => {
  // Usamos 'delantero' para evitar portería a cero y gol encajado: solo puntúa "por jugar"
  test('Suplente: partido en grupos ×0.5, partido en octavos ×1 (eliminación en 16avos)', () => {
    const p = makePlayer('sub-fwd', 'tur', 'delantero');
    // Partido 1: grupos → suplente activo = 0.5
    const m1 = makeMatch('m1', 'tur', 'opp', 'grupos', 1, 0);
    // Partido 2: octavos → línea incompleta (titular caído en dieciseisavos)
    const m2 = makeMatch('m2', 'tur', 'opp2', 'octavos', 1, 0);
    const ev1 = makeEvent('m1', 'sub-fwd', 'tur', { minutes_played: 90 });
    const ev2 = makeEvent('m2', 'sub-fwd', 'tur', { minutes_played: 90 });
    // esp eliminado en dieciseisavos (entre m1-grupos y m2-octavos)
    const pr = makePhaseResult('esp', 'dieciseisavos', 'eliminated');
    const r = calcPlayerScore(
      p, 'suplente', 'delantero', false,
      ['esp'],
      [m1, m2],
      new Map([['m1', ev1], ['m2', ev2]]),
      [pr],
      false,
    );
    // m1 grupos: 5×1×0.5 = 2.5; m2 octavos: 5×1×1 = 5 → total 7.5
    expect(r.totalPoints).toBe(7.5);
  });
});

describe('Pasar ronda (jugador, +15 × multiplicador)', () => {
  test('Jugador pasa a cuartos → +15×1.5 = 22.5 (más por jugar)', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const match = makeMatch('m1', 'esp', 'opp', 'octavos', 1, 0);
    const ev = makeEvent('m1', 'fwd', 'esp');
    const pr = makePhaseResult('esp', 'octavos', 'advanced');
    const r = calcPlayerScore(p, 'titular', 'delantero', false, [], [match], new Map([['m1', ev]]), [pr], false);
    const pasaItem = r.items.find(i => i.concept === 'pasaRonda');
    expect(pasaItem!.finalPoints).toBe(22.5);
  });

  test('Jugador pasa a final → +15×3 = 45', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const match = makeMatch('m1', 'esp', 'opp', 'semifinales', 1, 0);
    const ev = makeEvent('m1', 'fwd', 'esp');
    const pr = makePhaseResult('esp', 'semifinales', 'advanced');
    const r = calcPlayerScore(p, 'titular', 'delantero', false, [], [match], new Map([['m1', ev]]), [pr], false);
    const pasaItem = r.items.find(i => i.concept === 'pasaRonda');
    expect(pasaItem!.finalPoints).toBe(45);
  });

  test('Jugador capitán pasa a cuartos → +15×1.5×2 = 45', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const match = makeMatch('m1', 'esp', 'opp', 'octavos', 1, 0);
    const ev = makeEvent('m1', 'fwd', 'esp');
    const pr = makePhaseResult('esp', 'octavos', 'advanced');
    const r = calcPlayerScore(p, 'titular', 'delantero', true, [], [match], new Map([['m1', ev]]), [pr], false);
    const pasaItem = r.items.find(i => i.concept === 'pasaRonda');
    expect(pasaItem!.finalPoints).toBe(45);
  });
});

describe('Portero improvisado', () => {
  test('Defensa como portero: +30 mérito + puntos defensa + puntos portero (portería a cero)', () => {
    const p = makePlayer('def', 'esp', 'defensa');
    const match = makeMatch('m1', 'esp', 'opp', 'grupos', 0, 0);
    const ev = makeEvent('m1', 'def', 'esp', { minutes_played: 90, is_improvised_goalkeeper: 1 });
    const r = calcPlayerScore(p, 'titular', 'defensa', false, [], [match], new Map([['m1', ev]]), [], false);

    expect(r.items.find(i => i.concept === 'porteroImprovicado')).toBeDefined();
    // portería a cero natural (defensa): +10
    expect(r.items.find(i => i.concept === 'porteriaCero')).toBeDefined();
    // portería a cero portero (extra): +15
    expect(r.items.find(i => i.concept === 'porteriaCero(portero)')).toBeDefined();
    // Total: 30(mérito) + 5(jugar defensa)+5(jugar portero) + 10(PC defensa) + 15(PC portero) = 65
    expect(r.totalPoints).toBe(65);
  });
});

describe('MVP del Mundial', () => {
  test('Delantero MVP → +50 plano', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { minutes_played: 0 }, 'grupos', { isMvp: true });
    const mvpItem = r.items.find(i => i.concept === 'mvpMundial');
    expect(mvpItem).toBeDefined();
    expect(mvpItem!.finalPoints).toBe(50);
  });

  test('Capitán MVP → 50×2 = 100', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { minutes_played: 0 }, 'grupos', { isCaptain: true, isMvp: true });
    const mvpItem = r.items.find(i => i.concept === 'mvpMundial');
    expect(mvpItem!.finalPoints).toBe(100);
  });

  test('MVP NO se multiplica por fase (siempre ×1)', () => {
    const p = makePlayer('fwd', 'esp', 'delantero');
    const r = singlePlayerScore(p, { minutes_played: 0 }, 'final', { isMvp: true });
    const mvpItem = r.items.find(i => i.concept === 'mvpMundial');
    expect(mvpItem!.phaseMultiplier).toBe(1);
    expect(mvpItem!.finalPoints).toBe(50);
  });
});

// ─── Tests de integración del motor completo ──────────────────────────────────

describe('calcularClasificacion (integración)', () => {
  test('Clasificación ordena de mayor a menor puntuación', () => {
    const teams = [makeTeam('esp', 'favoritos'), makeTeam('bra', 'sorpresas')];
    const players = [makePlayer('gk1', 'esp', 'portero'), makePlayer('gk2', 'bra', 'portero')];
    const matches = [makeMatch('m1', 'esp', 'opp', 'grupos', 2, 0)];

    const porras: PorraFull[] = [
      {
        porra: { id: 'p1', participant_id: 'u1', is_locked: 0, status: 'approved', submitted_email: null, submitted_data_json: null },
        participant: { id: 'u1', name: 'Alice', email: null },
        selections: [{ id: 's1', porra_id: 'p1', team_id: 'esp', is_winner: 0 }],
        lineup: [{ id: 'l1', porra_id: 'p1', player_id: 'gk1', role: 'titular', position_slot: 'portero', is_captain: 0 }],
      },
      {
        porra: { id: 'p2', participant_id: 'u2', is_locked: 0, status: 'approved', submitted_email: null, submitted_data_json: null },
        participant: { id: 'u2', name: 'Bob', email: null },
        selections: [{ id: 's2', porra_id: 'p2', team_id: 'bra', is_winner: 0 }],
        lineup: [{ id: 'l2', porra_id: 'p2', player_id: 'gk2', role: 'titular', position_slot: 'portero', is_captain: 0 }],
      },
    ];

    const events = [makeEvent('m1', 'gk1', 'esp')];
    const input: CalcInput = { matches, events, teamPhaseResults: [], porras, teams, players };
    const result = calcularClasificacion(input);

    // Alice tiene a España (10 victoria) + gk1 (5 por jugar) = 15
    // Bob no tiene eventos ni selecciones que puntúen
    expect(result[0].participantName).toBe('Alice');
    expect(result[0].position).toBe(1);
    expect(result[1].position).toBe(2);
  });

  test('Desglose completo accesible desde el resultado', () => {
    const teams = [makeTeam('esp', 'favoritos')];
    const players = [makePlayer('gk1', 'esp', 'portero')];
    const matches = [makeMatch('m1', 'esp', 'opp', 'grupos', 1, 0)];
    const events = [makeEvent('m1', 'gk1', 'esp', { goals_open_play: 1 })];

    const porras: PorraFull[] = [{
      porra: { id: 'p1', participant_id: 'u1', is_locked: 0, status: 'approved', submitted_email: null, submitted_data_json: null },
      participant: { id: 'u1', name: 'Alice', email: null },
      selections: [{ id: 's1', porra_id: 'p1', team_id: 'esp', is_winner: 0 }],
      lineup: [{ id: 'l1', porra_id: 'p1', player_id: 'gk1', role: 'titular', position_slot: 'portero', is_captain: 0 }],
    }];

    const result = calcularClasificacion({ matches, events, teamPhaseResults: [], porras, teams, players });
    expect(result[0].breakdown.selecciones).toHaveLength(1);
    expect(result[0].breakdown.jugadores).toHaveLength(1);
    expect(result[0].breakdown.selecciones[0].items.some(i => i.concept === 'victoria')).toBe(true);
    expect(result[0].breakdown.jugadores[0].items.some(i => i.concept === 'goles')).toBe(true);
  });

  test('Eventos no confirmados NO se cuentan', () => {
    const teams = [makeTeam('esp', 'favoritos')];
    const players = [makePlayer('gk1', 'esp', 'portero')];
    const matches = [makeMatch('m1', 'esp', 'opp', 'grupos', 2, 0)];
    const events = [makeEvent('m1', 'gk1', 'esp', { goals_open_play: 3, is_confirmed: 0 })];

    const porras: PorraFull[] = [{
      porra: { id: 'p1', participant_id: 'u1', is_locked: 0, status: 'approved', submitted_email: null, submitted_data_json: null },
      participant: { id: 'u1', name: 'Alice', email: null },
      selections: [{ id: 's1', porra_id: 'p1', team_id: 'esp', is_winner: 0 }],
      lineup: [{ id: 'l1', porra_id: 'p1', player_id: 'gk1', role: 'titular', position_slot: 'portero', is_captain: 0 }],
    }];

    const result = calcularClasificacion({ matches, events, teamPhaseResults: [], porras, teams, players });
    // gk1 no debe tener puntos de goles porque su evento no está confirmado
    const jugador = result[0].breakdown.jugadores[0];
    expect(jugador.items.find(i => i.concept === 'goles')).toBeUndefined();
    expect(jugador.totalPoints).toBe(0);
  });
});
