/**
 * Conciliación de nombres: dado un nombre crudo de BeSoccer,
 * sugiere el jugador/equipo más probable del catálogo.
 */

import { PlayerRecord, TeamRecord } from '../../types';

export interface Suggestion<T> {
  item: T;
  score: number;  // 0-1, mayor = más probable
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar acentos
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Jaccard sobre trigramas
  const triA = new Set(trigrams(na));
  const triB = new Set(trigrams(nb));
  const inter = [...triA].filter(t => triB.has(t)).length;
  const union = triA.size + triB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function trigrams(s: string): string[] {
  const result: string[] = [];
  for (let i = 0; i <= s.length - 3; i++) result.push(s.slice(i, i + 3));
  return result;
}

export function suggestPlayer(rawName: string, players: PlayerRecord[]): Suggestion<PlayerRecord>[] {
  return players
    .map(p => ({ item: p, score: similarity(rawName, p.name) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function suggestTeam(rawName: string, teams: TeamRecord[]): Suggestion<TeamRecord>[] {
  return teams
    .map(t => ({ item: t, score: similarity(rawName, t.name) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
