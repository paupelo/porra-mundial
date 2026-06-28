/**
 * Bonus de FIN DE FASE DE GRUPOS (clasificación a 16avos / eliminación).
 *
 * En esta porra los bonus de equipo y jugador NO son eventos: el motor los DERIVA
 * de `team_phase_results`. Esta tabla estaba vacía, así que ningún equipo tenía
 * aplicado el "Pasar Ronda" (+10/+20/+40/+80 ×1) ni la penalización "No llegar a
 * 16avos" (-100/-50/-25/-10), y ningún jugador su +15 de pasar ronda.
 *
 * Quién avanza se DERIVA del cuadro de dieciseisavos ya programado: los 32 equipos
 * que aparecen en algún partido de `dieciseisavos` avanzan; los que jugaron la fase
 * de grupos y no están en ese cuadro quedan eliminados. Es determinista y aditivo:
 * escribe filas en `team_phase_results` (upsert idempotente) y NUNCA toca eventos
 * ya aprobados de la fase de grupos.
 *
 * dry_run=true por defecto: solo calcula y muestra qué se aplicaría.
 */

import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { PorrasRepo } from '../repositories/porras.repo';
import { getPasaRondaMultiplier } from './scoring/multipliers';
import { TEAM_SCORING } from './scoring/scoring-tables';
import { Category } from '../types';

export interface GroupBonusTeam {
  teamId: string;
  name: string;
  category: Category;
  /** Puntos de equipo que genera el bonus/penalización (×1, la fase de grupos no multiplica el pasaRonda de 16avos). */
  teamPoints: number;
}

export interface GroupBonusPreview {
  dryRun: boolean;
  applied: boolean;
  /** Multiplicador del bonus pasaRonda al pasar de grupos a 16avos (=×1). */
  pasaRondaMultiplier: number;
  advancing: GroupBonusTeam[];
  eliminated: GroupBonusTeam[];
  /** Jugadores de selecciones que avanzan presentes en alguna alineación: cada uno suma +15 ×rol. */
  playerBonus: { distinctPlayers: number; totalAwardsAcrossPorras: number; pointsPerAwardBase: number };
  totals: { advancing: number; eliminated: number; teamBonusSum: number; teamPenaltySum: number };
  warnings: string[];
}

const PASA_RONDA_JUGADOR = 15;

export async function computeGroupBonuses(apply: boolean): Promise<GroupBonusPreview> {
  const [teams, matches, players, porras] = await Promise.all([
    TeamsRepo.findAll(),
    MatchesRepo.findAll(),
    PlayersRepo.findAll(),
    PorrasRepo.findAllFull(),
  ]);
  const teamById = new Map(teams.map(t => [t.id, t]));
  const warnings: string[] = [];

  // Equipos que AVANZAN = los que aparecen en algún partido de dieciseisavos.
  const advancingIds = new Set<string>();
  const r16 = matches.filter(m => m.phase === 'dieciseisavos');
  for (const m of r16) { advancingIds.add(m.home_team_id); advancingIds.add(m.away_team_id); }

  // Equipos que jugaron la fase de grupos (para derivar los eliminados).
  const groupTeamIds = new Set<string>();
  for (const m of matches.filter(x => x.phase === 'grupos')) {
    groupTeamIds.add(m.home_team_id); groupTeamIds.add(m.away_team_id);
  }

  if (r16.length === 0) warnings.push('No hay partidos de dieciseisavos en la BD: imposible derivar quién avanza.');
  if (advancingIds.size !== 32) warnings.push(`Se esperaban 32 equipos en dieciseisavos; encontrados ${advancingIds.size}. No se aplicará hasta que el cuadro esté completo.`);

  const pasaMult = getPasaRondaMultiplier('grupos'); // ×1

  const cat = (id: string): Category => (teamById.get(id)?.category ?? 'favoritos') as Category;
  const advancing: GroupBonusTeam[] = [...advancingIds].map(id => ({
    teamId: id, name: teamById.get(id)?.name ?? id, category: cat(id),
    teamPoints: TEAM_SCORING[cat(id)].pasaRonda * pasaMult,
  })).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const eliminated: GroupBonusTeam[] = [...groupTeamIds].filter(id => !advancingIds.has(id)).map(id => ({
    teamId: id, name: teamById.get(id)?.name ?? id, category: cat(id),
    teamPoints: TEAM_SCORING[cat(id)].noDeciseisvos,
  })).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // Jugadores de selecciones que avanzan presentes en alguna alineación (informativo).
  const playerTeam = new Map(players.map(p => [p.id, p.team_id]));
  const distinctPlayers = new Set<string>();
  let totalAwards = 0;
  for (const pf of porras) for (const lu of pf.lineup) {
    const tid = playerTeam.get(lu.player_id);
    if (tid && advancingIds.has(tid)) { totalAwards++; distinctPlayers.add(lu.player_id); }
  }

  // Aplicación: solo si apply Y el cuadro está completo (32 avanzan). Aditivo e idempotente.
  let applied = false;
  const canApply = apply && r16.length > 0 && advancingIds.size === 32;
  if (apply && !canApply) {
    warnings.push('Aplicación abortada: el cuadro de dieciseisavos no está completo (se requieren exactamente 32 equipos).');
  }
  if (canApply) {
    for (const t of advancing) await PhaseResultsRepo.upsert(t.teamId, 'grupos', 'advanced');
    for (const t of eliminated) await PhaseResultsRepo.upsert(t.teamId, 'grupos', 'eliminated');
    applied = true;
  }

  const preview: GroupBonusPreview = {
    dryRun: !apply,
    applied,
    pasaRondaMultiplier: pasaMult,
    advancing,
    eliminated,
    playerBonus: { distinctPlayers: distinctPlayers.size, totalAwardsAcrossPorras: totalAwards, pointsPerAwardBase: PASA_RONDA_JUGADOR },
    totals: {
      advancing: advancing.length,
      eliminated: eliminated.length,
      teamBonusSum: advancing.reduce((s, t) => s + t.teamPoints, 0),
      teamPenaltySum: eliminated.reduce((s, t) => s + t.teamPoints, 0),
    },
    warnings,
  };

  logPreview(preview);
  return preview;
}

function logPreview(p: GroupBonusPreview): void {
  const tag = p.applied ? 'APLICADO' : 'DRY-RUN';
  console.log(`\n[group-bonuses] ${tag} — pasaRonda ×${p.pasaRondaMultiplier}`);
  console.log(`[group-bonuses] AVANZAN (${p.advancing.length}) → +${p.totals.teamBonusSum} pts de equipo:`);
  for (const t of p.advancing) console.log(`  ✓ ${t.name} [${t.category}] +${t.teamPoints} (equipo) + jugadores +15 ×rol`);
  console.log(`[group-bonuses] ELIMINADOS (${p.eliminated.length}) → ${p.totals.teamPenaltySum} pts de equipo:`);
  for (const t of p.eliminated) console.log(`  ✗ ${t.name} [${t.category}] ${t.teamPoints} (equipo)`);
  console.log(`[group-bonuses] jugadores de selecciones que avanzan en alineaciones: ${p.playerBonus.distinctPlayers} distintos · ${p.playerBonus.totalAwardsAcrossPorras} bonus +15 (×rol) en total`);
  if (p.warnings.length) console.log('[group-bonuses] ⚠️ ' + p.warnings.join(' | '));
}
