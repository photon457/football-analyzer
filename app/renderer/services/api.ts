/**
 * API Service for communicating with Python FastAPI analysis backend.
 * Provides typed contracts for match data, team metrics, player metrics,
 * per-90 normalizations, D3 visualization inputs, and manager insights.
 */

const API_BASE_URL = 'http://127.0.0.1:8000';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface MatchSummary {
  id: string;
  date: string;
  competition: string;
  season: string;
  matchday?: number;
  team: string;
  opponent: string;
  home_away: 'home' | 'away';
  result: 'W' | 'D' | 'L';
  score_team: number;
  score_opponent: number;
  stadium?: string;
  referee?: string;
}

export interface TeamSummaryStats {
  score_differential: number;
  is_clean_sheet: boolean;
  shot_accuracy_pct: number;
  shot_conversion_pct: number;
  pass_accuracy_pct: number;
  possession_pct: number;
  xg: number;
  total_fouls: number;
  corners: number;
  cards_total: number;
}

export interface PlayerStats {
  player_id: string;
  player_name: string;
  jersey_number: number;
  primary_position: 'GK' | 'DF' | 'MF' | 'FW';
  detailed_position?: string;
  is_starter: boolean;
  minutes_played: number;
  goals: number;
  assists: number;
  shots_total: number;
  passes_completed: number;
  passes_attempted: number;
  tackles_won: number;
  interceptions: number;
  per_90: {
    goals_per_90: number;
    assists_per_90: number;
    shots_per_90: number;
    key_passes_per_90: number;
    passes_completed_per_90: number;
    tackles_won_per_90: number;
    interceptions_per_90: number;
    recoveries_per_90: number;
    duels_won_per_90: number;
  };
  rates: {
    pass_accuracy_pct: number;
    tackle_success_pct: number;
    duel_win_pct: number;
    shot_accuracy_pct: number;
  };
  radar_profile: {
    Attacking: number;
    Passing: number;
    Defending: number;
    Duels: number;
    Workrate: number;
  };
  metrics?: Record<string, any>;
}

export interface SpatialEvent {
  id?: string;
  event_id?: string;
  player_id: string;
  minute: number;
  second?: number;
  event_type: 'shot' | 'pass' | 'tackle' | 'interception' | 'touch' | 'foul' | 'save' | 'clearance' | 'take_on';
  x: number;
  y: number;
  end_x?: number;
  end_y?: number;
  outcome: 'successful' | 'unsuccessful';
  metadata?: Record<string, any>;
}

export interface MatchAnalysis {
  match_id: string;
  match: MatchSummary;
  team_summary: TeamSummaryStats;
  team_stats: Record<string, number>;
  players: PlayerStats[];
  events: SpatialEvent[];
  manager_insights: string[];
}

export interface PlayerTrendAnalysis {
  total_matches: number;
  total_minutes: number;
  average_minutes: number;
  trajectory: 'improving' | 'declining' | 'stable';
  consistency_std: number;
  totals: {
    goals: number;
    assists: number;
    shots: number;
    key_passes: number;
    tackles_won: number;
    interceptions: number;
    passes_completed?: number;
    passes_attempted?: number;
    pass_accuracy_pct?: number;
    starts?: number;
    sub_appearances?: number;
    xg?: number;
  };
  averages_per_90: {
    goals_per_90: number;
    assists_per_90: number;
    tackles_per_90: number;
    shots_per_90?: number;
    key_passes_per_90?: number;
    passes_completed_per_90?: number;
    interceptions_per_90?: number;
  };
  radar_profile?: {
    Attacking: number;
    Passing: number;
    Defending: number;
    Duels: number;
    Workrate: number;
  };
  timeline: Array<{
    match_id: string;
    date: string;
    opponent: string;
    home_away?: 'home' | 'away';
    result?: 'W' | 'D' | 'L';
    score_team?: number;
    score_opponent?: number;
    position?: string;
    is_starter?: boolean;
    minutes_played: number;
    goals: number;
    assists: number;
    shots: number;
    key_passes: number;
    tackles_won: number;
    interceptions: number;
    passes_completed?: number;
    passes_attempted?: number;
    pass_accuracy_pct?: number;
    xg?: number;
    contribution_score: number;
  }>;
  insights: string[];
}

export interface ImportSuccessResponse {
  status: string;
  message: string;
  match_id: string;
  team: string;
  opponent: string;
  score: string;
  players_count: number;
  events_count: number;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Backend health check failed: ${response.statusText}`);
  }
  return response.json();
}

export async function importMatchData(payload: any): Promise<ImportSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/matches/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.detail?.errors
      ? data.detail.errors.join('\n')
      : (data.detail || 'Failed to import match data');
    throw new Error(errorMsg);
  }
  return data;
}

export async function fetchMatches(): Promise<MatchSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/matches`);
  if (!response.ok) {
    throw new Error('Failed to load matches');
  }
  return response.json();
}

export async function fetchMatchAnalysis(matchId: string): Promise<MatchAnalysis> {
  const response = await fetch(`${API_BASE_URL}/api/analysis/${matchId}`);
  if (!response.ok) {
    throw new Error(`Failed to load analysis for match ${matchId}`);
  }
  return response.json();
}

export async function fetchPlayerHistory(playerId: string): Promise<PlayerTrendAnalysis> {
  const response = await fetch(`${API_BASE_URL}/api/analysis/player/${playerId}/history`);
  if (!response.ok) {
    throw new Error(`Failed to load history for player ${playerId}`);
  }
  return response.json();
}

export interface PlayerSummary {
  id: string;
  name: string;
  position: string;
  primary_position?: string;
  squad_number?: number;
  team?: string;
}

export async function fetchPlayers(): Promise<PlayerSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/players`);
  if (!response.ok) {
    throw new Error('Failed to load squad players');
  }
  return response.json();
}

export interface SeasonMatchLogEntry {
  match_id: string;
  date: string;
  opponent: string;
  competition: string;
  home_away: 'home' | 'away';
  result: 'W' | 'D' | 'L';
  score_team: number;
  score_opponent: number;
  position: string;
  is_starter: boolean;
  minutes_played: number;
  goals: number;
  assists: number;
  shots_total: number;
  key_passes: number;
  tackles_won: number;
  interceptions: number;
  xg: number;
  pass_accuracy_pct: number | null;
  yellow_cards: number;
  red_cards: number;
}

export interface SquadPlayerSeason {
  player_id: string;
  player_name: string;
  primary_position: 'GK' | 'DF' | 'MF' | 'FW';
  detailed_position: string | null;
  squad_number: number | null;
  appearances: number;
  starts: number;
  minutes: number;
  low_sample: boolean;
  totals: Record<string, number>;
  per_90: Record<string, number>;
  rates: {
    pass_accuracy_pct: number | null;
    tackle_success_pct: number | null;
    duel_win_pct: number | null;
    shot_accuracy_pct: number | null;
  };
  goalkeeping: {
    saves: number;
    goals_conceded: number;
    save_pct: number | null;
    saves_per_90: number;
    goals_conceded_per_90: number;
  } | null;
  match_log: SeasonMatchLogEntry[];
}

export interface TeamSeasonMatch {
  match_id: string;
  date: string;
  team: string;
  opponent: string;
  competition: string;
  home_away: 'home' | 'away' | string;
  result: 'W' | 'D' | 'L' | string;
  score_team: number;
  score_opponent: number;
  points_cumulative: number;
  possession_pct: number | null;
  pass_accuracy_pct: number | null;
  passes_completed: number | null;
  passes_total: number | null;
  shots: number | null;
  shots_on_target: number | null;
  xg: number | null;
  fouls: number | null;
  corners: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
}

export interface TeamSeasonAverages {
  goals_scored_per_match: number;
  goals_conceded_per_match: number;
  xg_per_match: number;
  shots_per_match: number;
  shots_on_target_per_match: number;
  shot_accuracy_pct: number | null;
  avg_possession_pct: number | null;
  avg_pass_accuracy_pct: number | null;
  total_shots: number;
  total_shots_on_target: number;
  total_xg: number;
  total_passes: number;
  total_passes_completed: number;
  total_corners: number;
  total_fouls: number;
  yellow_cards: number;
  red_cards: number;
  home_record: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
  };
  away_record: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
  };
}

export interface SquadSeasonResponse {
  season: string | null;
  available_seasons: string[];
  team: string | null;
  record: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    goal_difference?: number;
    points?: number;
    points_per_match?: number;
    win_rate_pct?: number;
    clean_sheets?: number;
    clean_sheet_pct?: number;
    form?: string[];
  };
  low_sample_minutes: number;
  players: SquadPlayerSeason[];
  matches?: TeamSeasonMatch[];
  team_averages?: TeamSeasonAverages;
}

export async function fetchSquadSeason(season?: string, team?: string): Promise<SquadSeasonResponse> {
  const params = new URLSearchParams();
  if (season) params.append('season', season);
  if (team) params.append('team', team);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/api/squad${query}`);
  if (!response.ok) {
    throw new Error(`Failed to load squad season data${season ? ` for ${season}` : ''}`);
  }
  return response.json();
}

export interface FixtureItem {
  fixture_id: number;
  season: string;
  matchweek: number;
  phase: string;
  date: string;
  match_in_matchweek: number;
  home_team: string;
  away_team: string;
  match_id: string | null;
  status: 'played' | 'scheduled';
  result?: 'W' | 'D' | 'L' | null;
  score_home?: number | null;
  score_away?: number | null;
  score_team?: number;
  score_opponent?: number;
  match_focus_team?: string;
}

export async function fetchFixtures(team?: string, season?: string, matchweek?: number): Promise<FixtureItem[]> {
  const params = new URLSearchParams();
  if (team) params.append('team', team);
  if (season) params.append('season', season);
  if (matchweek) params.append('matchweek', String(matchweek));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/api/fixtures${query}`);
  if (!response.ok) {
    throw new Error('Failed to load fixtures schedule');
  }
  return response.json();
}

export interface CsvImportResponse {
  status: string;
  message: string;
  count: number;
  matches: Array<{
    match_id: string;
    team: string;
    opponent: string;
    score: string;
    result: string;
    date: string;
    competition: string;
    players_count: number;
  }>;
}

export async function importCsvMatchData(payload: {
  csv_content?: string;
  file_path?: string;
  focus_team?: string;
}): Promise<CsvImportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/matches/import/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to import CSV match data');
  }
  return data;
}

export async function resetDatabase(
  importSampleCsv: boolean = true,
  focusTeam: string = 'Chelsea'
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/database/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ import_sample_csv: importSampleCsv, focus_team: focusTeam }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to reset database');
  }
  return data;
}

export async function fetchFocusTeam(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/settings/team`);
  if (!response.ok) return 'Chelsea';
  const data = await response.json();
  return data.focus_team || 'Chelsea';
}

export async function setFocusTeam(team: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/settings/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team }),
  });
}

export interface RecordFixtureMatchPayload {
  score_home?: number;
  score_away?: number;
  possession_pct?: number;
  shots_home?: number;
  shots_away?: number;
  focus_team?: string;
  custom_payload?: any;
  csv_content?: string;
}

export interface RecordFixtureMatchResponse {
  status: string;
  message: string;
  match_id: string;
  fixture_id: number;
  team: string;
  opponent: string;
  score: string;
  result: 'W' | 'D' | 'L';
  players_count?: number;
  events_count?: number;
}

export async function recordFixtureMatch(
  fixtureId: number,
  payload: RecordFixtureMatchPayload
): Promise<RecordFixtureMatchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/fixtures/${fixtureId}/record-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || `Failed to record match for fixture #${fixtureId}`);
  }
  return data;
}
