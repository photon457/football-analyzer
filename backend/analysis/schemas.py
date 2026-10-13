"""
Analysis response schemas for the football manager API.
Provides typed contracts for dashboard consumption.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class TeamSummary(BaseModel):
    score_differential: int
    is_clean_sheet: bool
    shot_accuracy_pct: float
    shot_conversion_pct: float
    pass_accuracy_pct: float
    possession_pct: float
    xg: float
    total_fouls: int
    corners: int
    cards_total: int


class PlayerAnalysis(BaseModel):
    player_id: str
    player_name: str
    jersey_number: int
    primary_position: str
    detailed_position: Optional[str] = None
    is_starter: bool
    minutes_played: int
    goals: int
    assists: int
    shots_total: int
    passes_completed: int
    passes_attempted: int
    tackles_won: int
    interceptions: int
    per_90: Dict[str, float]
    rates: Dict[str, float]
    radar_profile: Dict[str, float]
    metrics: Dict[str, Any] = {}


class MatchAnalysisResponse(BaseModel):
    match_id: str
    match: Dict[str, Any]
    team_summary: TeamSummary
    team_stats: Dict[str, Any]
    players: List[PlayerAnalysis]
    events: List[Dict[str, Any]]
    manager_insights: List[str]


class SeasonMatchLogEntry(BaseModel):
    match_id: str
    date: str
    opponent: str
    competition: str
    home_away: str
    result: str
    score_team: int
    score_opponent: int
    position: str
    is_starter: bool
    minutes_played: int
    goals: int
    assists: int
    shots_total: int
    key_passes: int
    tackles_won: int
    interceptions: int
    xg: float
    pass_accuracy_pct: Optional[float] = None
    yellow_cards: int
    red_cards: int


class SeasonRates(BaseModel):
    pass_accuracy_pct: Optional[float] = None
    tackle_success_pct: Optional[float] = None
    duel_win_pct: Optional[float] = None
    shot_accuracy_pct: Optional[float] = None


class SeasonGoalkeeping(BaseModel):
    saves: int
    goals_conceded: int
    save_pct: Optional[float] = None
    saves_per_90: float
    goals_conceded_per_90: float


class SquadPlayerSeason(BaseModel):
    player_id: str
    player_name: str
    primary_position: str
    detailed_position: Optional[str] = None
    squad_number: Optional[int] = None
    appearances: int
    starts: int
    minutes: int
    low_sample: bool
    totals: Dict[str, float]
    per_90: Dict[str, float]
    rates: SeasonRates
    goalkeeping: Optional[SeasonGoalkeeping] = None
    match_log: List[SeasonMatchLogEntry]


class TeamSeasonMatch(BaseModel):
    match_id: str
    date: str
    team: str
    opponent: str
    competition: str
    home_away: str
    result: str
    score_team: int
    score_opponent: int
    points_cumulative: int = 0
    possession_pct: Optional[float] = None
    pass_accuracy_pct: Optional[float] = None
    passes_completed: Optional[int] = None
    passes_total: Optional[int] = None
    shots: Optional[int] = None
    shots_on_target: Optional[int] = None
    xg: Optional[float] = None
    fouls: Optional[int] = None
    corners: Optional[int] = None
    yellow_cards: Optional[int] = None
    red_cards: Optional[int] = None


class SeasonRecord(BaseModel):
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    goal_difference: int = 0
    points: int = 0
    points_per_match: float = 0.0
    win_rate_pct: float = 0.0
    clean_sheets: int = 0
    clean_sheet_pct: float = 0.0
    form: List[str] = []


class TeamSeasonAverages(BaseModel):
    goals_scored_per_match: float = 0.0
    goals_conceded_per_match: float = 0.0
    xg_per_match: float = 0.0
    shots_per_match: float = 0.0
    shots_on_target_per_match: float = 0.0
    shot_accuracy_pct: Optional[float] = None
    avg_possession_pct: Optional[float] = None
    avg_pass_accuracy_pct: Optional[float] = None
    total_shots: int = 0
    total_shots_on_target: int = 0
    total_xg: float = 0.0
    total_passes: int = 0
    total_passes_completed: int = 0
    total_corners: int = 0
    total_fouls: int = 0
    yellow_cards: int = 0
    red_cards: int = 0
    home_record: Dict[str, Any] = {}
    away_record: Dict[str, Any] = {}


class SquadSeasonResponse(BaseModel):
    season: Optional[str] = None
    available_seasons: List[str]
    team: Optional[str] = None
    record: SeasonRecord
    low_sample_minutes: int
    players: List[SquadPlayerSeason]
    matches: List[TeamSeasonMatch] = []
    team_averages: Optional[TeamSeasonAverages] = None

