"""
Pydantic schemas for football match data validation and normalization.
Distinguishes strictly between RAW (observed) statistics and DERIVED (calculated) metrics.
Follows Core-4 rules: Rule 8 (raw vs derived), Rule 10 (player ID), Rule 11 (match ID), Rule 12 (spatial 0-100 coordinates).
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


PositionGroup = Literal["GK", "DF", "MF", "FW"]
HomeAway = Literal["home", "away"]
MatchResult = Literal["W", "D", "L"]
EventOutcome = Literal["successful", "unsuccessful"]
EventType = Literal["shot", "pass", "tackle", "interception", "touch", "foul", "save", "clearance", "take_on", "recovery"]


class MatchMetadata(BaseModel):
    """Core identification and context for a single match."""
    match_id: str = Field(..., min_length=1, description="Stable unique identifier for the match")
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="ISO 8601 match date (YYYY-MM-DD)")
    competition: str = Field(..., min_length=1, description="Competition name (e.g. Premier League)")
    season: str = Field(..., description="Season label (e.g. 2024-2025)")
    matchday: Optional[int] = Field(None, ge=1, le=50, description="Matchday number")
    team: str = Field(..., min_length=1, description="Focus squad name (e.g. Chelsea)")
    opponent: str = Field(..., min_length=1, description="Opponent club name")
    home_away: HomeAway = Field(..., description="home or away fixture")
    result: MatchResult = Field(..., description="Result from focus squad perspective: W, D, or L")
    score_team: int = Field(..., ge=0, description="Goals scored by focus team")
    score_opponent: int = Field(..., ge=0, description="Goals scored by opponent")
    stadium: Optional[str] = Field(None, description="Venue name")
    referee: Optional[str] = Field(None, description="Match referee")

    @model_validator(mode="after")
    def verify_result_matches_scores(self) -> "MatchMetadata":
        if self.score_team > self.score_opponent and self.result != "W":
            raise ValueError(f"Result '{self.result}' does not match scores {self.score_team}-{self.score_opponent} (expected 'W')")
        elif self.score_team < self.score_opponent and self.result != "L":
            raise ValueError(f"Result '{self.result}' does not match scores {self.score_team}-{self.score_opponent} (expected 'L')")
        elif self.score_team == self.score_opponent and self.result != "D":
            raise ValueError(f"Result '{self.result}' does not match scores {self.score_team}-{self.score_opponent} (expected 'D')")
        return self


class TeamMatchMetrics(BaseModel):
    """
    Team-level statistics for the match.
    Raw observed counts are required; derived metrics can be computed or optionally supplied.
    """
    # Raw observed metrics
    possession_pct: float = Field(50.0, ge=0.0, le=100.0, description="Possession percentage (0-100)")
    shots: int = Field(0, ge=0, description="Total shots taken by focus team")
    shots_on_target: int = Field(0, ge=0, description="Shots on target")
    shots_off_target: Optional[int] = Field(None, ge=0)
    shots_blocked: Optional[int] = Field(None, ge=0)
    corners: int = Field(0, ge=0, description="Corner kicks awarded")
    fouls: int = Field(0, ge=0, description="Fouls committed")
    yellow_cards: int = Field(0, ge=0, description="Yellow cards")
    red_cards: int = Field(0, ge=0, description="Red cards")
    offsides: int = Field(0, ge=0, description="Offsides")
    passes_total: int = Field(0, ge=0, description="Total passes attempted")
    passes_completed: int = Field(0, ge=0, description="Passes completed")

    # Derived metrics (optional at ingestion, derived/verified transparently)
    pass_accuracy_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    xg: Optional[float] = Field(None, ge=0.0, description="Expected goals (xG)")

    @model_validator(mode="after")
    def verify_team_stats(self) -> "TeamMatchMetrics":
        if self.shots < self.shots_on_target:
            self.shots = self.shots_on_target
        if self.passes_total < self.passes_completed:
            self.passes_total = self.passes_completed
        # Auto-derive pass_accuracy_pct if missing
        if self.pass_accuracy_pct is None and self.passes_total > 0:
            self.pass_accuracy_pct = round((self.passes_completed / self.passes_total) * 100.0, 1)
        return self


class PlayerMatchStats(BaseModel):
    """
    Individual player match record.
    Separates raw stats from derived metrics.
    """
    # Identification
    player_id: str = Field(..., min_length=1, description="Stable unique player ID")
    player_name: str = Field(..., min_length=1, description="Full player name")
    jersey_number: int = Field(..., ge=1, le=99, description="Squad number")
    primary_position: PositionGroup = Field(..., description="Position group: GK, DF, MF, FW")
    detailed_position: Optional[str] = Field(None, description="Specific tactical role: CB, LB, RB, CM, DM, AM, RW, LW, ST")
    is_starter: bool = Field(..., description="True if started the match")
    minutes_played: int = Field(..., ge=0, le=130, description="Total minutes on pitch")
    subbed_in_minute: Optional[int] = Field(None, ge=0, le=130)
    subbed_out_minute: Optional[int] = Field(None, ge=0, le=130)

    # Raw Attacking & Scoring
    goals: int = Field(0, ge=0)
    assists: int = Field(0, ge=0)
    shots_total: int = Field(0, ge=0)
    shots_on_target: int = Field(0, ge=0)
    big_chances_created: int = Field(0, ge=0)
    big_chances_missed: int = Field(0, ge=0)

    # Raw Passing & Playmaking
    passes_attempted: int = Field(0, ge=0)
    passes_completed: int = Field(0, ge=0)
    key_passes: int = Field(0, ge=0)
    crosses_attempted: int = Field(0, ge=0)
    crosses_completed: int = Field(0, ge=0)
    progressive_passes: int = Field(0, ge=0)

    # Raw Defending
    tackles_attempted: int = Field(0, ge=0)
    tackles_won: int = Field(0, ge=0)
    interceptions: int = Field(0, ge=0)
    blocks: int = Field(0, ge=0)
    clearances: int = Field(0, ge=0)
    recoveries: int = Field(0, ge=0)
    duels_total: int = Field(0, ge=0)
    duels_won: int = Field(0, ge=0)
    aerial_duels_total: int = Field(0, ge=0)
    aerial_duels_won: int = Field(0, ge=0)

    # Raw Physical & Discipline
    fouls_committed: int = Field(0, ge=0)
    fouls_drawn: int = Field(0, ge=0)
    yellow_cards: int = Field(0, ge=0, le=2)
    red_cards: int = Field(0, ge=0, le=1)
    distance_covered_km: Optional[float] = Field(None, ge=0.0, le=20.0)
    sprints: Optional[int] = Field(None, ge=0)

    # Raw Goalkeeping
    saves: Optional[int] = Field(None, ge=0)
    goals_conceded: Optional[int] = Field(None, ge=0)
    clean_sheet: Optional[bool] = Field(None)
    penalties_saved: Optional[int] = Field(None, ge=0)

    # Derived metrics (optional in input, calculated transparently by analysis engine)
    xg: Optional[float] = Field(None, ge=0.0, description="Expected goals")
    xa: Optional[float] = Field(None, ge=0.0, description="Expected assists")
    pass_accuracy_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    tackle_success_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    duel_win_pct: Optional[float] = Field(None, ge=0.0, le=100.0)

    @model_validator(mode="after")
    def verify_consistency(self) -> "PlayerMatchStats":
        if self.shots_on_target > self.shots_total:
            raise ValueError(f"Player {self.player_name}: shots_on_target ({self.shots_on_target}) > shots_total ({self.shots_total})")
        if self.passes_completed > self.passes_attempted:
            raise ValueError(f"Player {self.player_name}: passes_completed ({self.passes_completed}) > passes_attempted ({self.passes_attempted})")
        if self.crosses_completed > self.crosses_attempted:
            raise ValueError(f"Player {self.player_name}: crosses_completed ({self.crosses_completed}) > crosses_attempted ({self.crosses_attempted})")
        if self.tackles_won > self.tackles_attempted:
            raise ValueError(f"Player {self.player_name}: tackles_won ({self.tackles_won}) > tackles_attempted ({self.tackles_attempted})")
        if self.duels_won > self.duels_total:
            raise ValueError(f"Player {self.player_name}: duels_won ({self.duels_won}) > duels_total ({self.duels_total})")
        if self.aerial_duels_won > self.aerial_duels_total:
            raise ValueError(f"Player {self.player_name}: aerial_duels_won ({self.aerial_duels_won}) > aerial_duels_total ({self.aerial_duels_total})")
        if not self.is_starter and self.minutes_played > 0 and self.subbed_in_minute is None:
            # Substitute played but no subbed_in_minute specified (warning/allowable or default)
            pass
        # Auto-compute derived percentages if absent
        if self.pass_accuracy_pct is None and self.passes_attempted > 0:
            self.pass_accuracy_pct = round((self.passes_completed / self.passes_attempted) * 100.0, 1)
        if self.tackle_success_pct is None and self.tackles_attempted > 0:
            self.tackle_success_pct = round((self.tackles_won / self.tackles_attempted) * 100.0, 1)
        if self.duel_win_pct is None and self.duels_total > 0:
            self.duel_win_pct = round((self.duels_won / self.duels_total) * 100.0, 1)
        return self


class SpatialEvent(BaseModel):
    """
    Spatial event information (touch, shot, pass, tackle, etc.).
    Coordinate Convention (Core-4 Rule 12):
    - Normalized 0-100 pitch coordinates.
    - x: 0.0 (defending goal line) to 100.0 (attacking goal line).
    - y: 0.0 (left touchline looking towards opponent goal) to 100.0 (right touchline).
    """
    event_id: str = Field(..., min_length=1, description="Unique event identifier")
    player_id: str = Field(..., min_length=1, description="Player responsible for event")
    minute: int = Field(..., ge=0, le=130, description="Match minute")
    second: Optional[int] = Field(None, ge=0, le=59, description="Match second")
    event_type: EventType = Field(..., description="Action category")
    x: float = Field(..., ge=0.0, le=100.0, description="Pitch X coordinate (0-100)")
    y: float = Field(..., ge=0.0, le=100.0, description="Pitch Y coordinate (0-100)")
    end_x: Optional[float] = Field(None, ge=0.0, le=100.0, description="Action end X coordinate (0-100)")
    end_y: Optional[float] = Field(None, ge=0.0, le=100.0, description="Action end Y coordinate (0-100)")
    outcome: EventOutcome = Field(..., description="successful or unsuccessful")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Event specifics (e.g. shot result, xg value)")


class MatchDataPayload(BaseModel):
    """
    Complete imported match data document.
    Enforces squad completeness, starter count, and internal consistency.
    """
    match: MatchMetadata
    team_stats: TeamMatchMetrics
    players: List[PlayerMatchStats] = Field(..., min_length=1)
    events: List[SpatialEvent] = Field(default_factory=list)

    @model_validator(mode="after")
    def verify_squad_consistency(self) -> "MatchDataPayload":
        # Check unique player IDs
        player_ids = [p.player_id for p in self.players]
        if len(player_ids) != len(set(player_ids)):
            duplicates = [pid for pid in player_ids if player_ids.count(pid) > 1]
            raise ValueError(f"Duplicate player_id detected: {set(duplicates)}")

        # Check starter count
        starters = [p for p in self.players if p.is_starter]
        if len(self.players) >= 11 and len(starters) != 11:
            raise ValueError(f"Squad must have exactly 11 starters, but found {len(starters)}")
        elif len(starters) > 11:
            raise ValueError(f"Squad cannot have more than 11 starters, but found {len(starters)}")

        # Check goalkeeper count in starters
        gk_starters = [p for p in starters if p.primary_position == "GK"]
        if len(self.players) >= 11 and len(gk_starters) != 1:
            raise ValueError(f"Squad must have exactly 1 starting Goalkeeper, but found {len(gk_starters)}")
        elif len(gk_starters) > 1:
            raise ValueError(f"Squad cannot have more than 1 starting Goalkeeper, but found {len(gk_starters)}")

        # Check player goals vs match score (team goals)
        total_player_goals = sum(p.goals for p in self.players)
        if total_player_goals > self.match.score_team:
            raise ValueError(
                f"Sum of player goals ({total_player_goals}) cannot exceed team score ({self.match.score_team})"
            )

        # Ensure spatial events reference valid squad players
        player_id_set = set(player_ids)
        for ev in self.events:
            if ev.player_id not in player_id_set:
                raise ValueError(f"Spatial event '{ev.event_id}' references unknown player_id '{ev.player_id}'")

        return self
