import { PlayerStats } from '../../services/api';

const DEFAULT_STARTING_XI_TEMPLATE = [
  { id: 'p_gk', name: 'Robert Sánchez', pos: 'GK' as const, detailed: 'GK', jersey: 1 },
  { id: 'p_rb', name: 'Malo Gusto', pos: 'DF' as const, detailed: 'RB', jersey: 27 },
  { id: 'p_cb1', name: 'Wesley Fofana', pos: 'DF' as const, detailed: 'CB', jersey: 29 },
  { id: 'p_cb2', name: 'Levi Colwill', pos: 'DF' as const, detailed: 'CB', jersey: 6 },
  { id: 'p_lb', name: 'Marc Cucurella', pos: 'DF' as const, detailed: 'LB', jersey: 3 },
  { id: 'p_dm', name: 'Moisés Caicedo', pos: 'MF' as const, detailed: 'DM', jersey: 25 },
  { id: 'p_cm', name: 'Enzo Fernández', pos: 'MF' as const, detailed: 'CM', jersey: 8 },
  { id: 'p_am', name: 'Cole Palmer', pos: 'MF' as const, detailed: 'AM', jersey: 20 },
  { id: 'p_rw', name: 'Noni Madueke', pos: 'FW' as const, detailed: 'RW', jersey: 11 },
  { id: 'p_lw', name: 'Jadon Sancho', pos: 'FW' as const, detailed: 'LW', jersey: 19 },
  { id: 'p_st', name: 'Nicolas Jackson', pos: 'FW' as const, detailed: 'ST', jersey: 15 },
];

function createDefaultPlayer(
  id: string,
  name: string,
  pos: 'GK' | 'DF' | 'MF' | 'FW',
  detailed: string,
  jersey: number
): PlayerStats {
  const isFw = pos === 'FW';
  const isMf = pos === 'MF';
  const isDf = pos === 'DF';

  return {
    player_id: id,
    player_name: name,
    jersey_number: jersey,
    primary_position: pos,
    detailed_position: detailed,
    is_starter: true,
    minutes_played: 90,
    goals: 0,
    assists: 0,
    shots_total: isFw ? 2 : isMf ? 1 : 0,
    passes_completed: isMf ? 54 : isDf ? 48 : pos === 'GK' ? 28 : 22,
    passes_attempted: isMf ? 62 : isDf ? 55 : pos === 'GK' ? 34 : 28,
    tackles_won: isDf ? 3 : isMf ? 2 : 1,
    interceptions: isDf ? 2 : isMf ? 2 : 0,
    per_90: {
      goals_per_90: 0,
      assists_per_90: 0,
      shots_per_90: isFw ? 2 : 0.5,
      key_passes_per_90: isMf ? 1.5 : 0.5,
      passes_completed_per_90: isMf ? 54 : 45,
      tackles_won_per_90: isDf ? 3 : 1.5,
      interceptions_per_90: isDf ? 2 : 1,
      recoveries_per_90: 4,
      duels_won_per_90: 4,
    },
    rates: {
      pass_accuracy_pct: 85,
      tackle_success_pct: 75,
      duel_win_pct: 60,
      shot_accuracy_pct: 50,
    },
    radar_profile: {
      Attacking: isFw ? 75 : isMf ? 65 : 40,
      Passing: isMf ? 82 : 68,
      Defending: isDf ? 80 : isMf ? 65 : 35,
      Duels: 70,
      Workrate: 75,
    },
    metrics: {
      contribution_score: isFw ? 5.2 : isMf ? 6.5 : isDf ? 5.8 : 4.0,
      key_passes: isMf ? 2 : isFw ? 1 : 0,
      xg: isFw ? 0.18 : isMf ? 0.08 : 0.0,
    },
  };
}

/**
 * Ensures that a squad list always contains at least all 11 starting players
 * on the pitch, even if a sample dataset or imported CSV only tracked a subset of players.
 */
export function ensureElevenPlayers(inputPlayers: PlayerStats[]): PlayerStats[] {
  if (!inputPlayers || inputPlayers.length === 0) return [];
  if (inputPlayers.length >= 11) return inputPlayers;

  const existingIds = new Set(inputPlayers.map((p) => p.player_id.toLowerCase()));
  const existingDetailedPositions = new Set(
    inputPlayers.map((p) => (p.detailed_position || p.primary_position).toUpperCase())
  );

  const result: PlayerStats[] = [...inputPlayers];

  for (const t of DEFAULT_STARTING_XI_TEMPLATE) {
    if (result.length >= 11) break;
    const posTaken = existingDetailedPositions.has(t.detailed.toUpperCase());
    const idTaken = existingIds.has(t.id.toLowerCase());
    if (posTaken || idTaken) continue;

    result.push(createDefaultPlayer(t.id, t.name, t.pos, t.detailed, t.jersey));
    existingIds.add(t.id.toLowerCase());
    existingDetailedPositions.add(t.detailed.toUpperCase());
  }

  let padIdx = 1;
  while (result.length < 11) {
    const padId = `p_starter_${padIdx}`;
    if (!existingIds.has(padId)) {
      result.push(
        createDefaultPlayer(padId, `Starter ${padIdx}`, 'MF', 'CM', 10 + padIdx)
      );
      existingIds.add(padId);
    }
    padIdx++;
  }

  return result;
}
