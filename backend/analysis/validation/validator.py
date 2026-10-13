"""
Validation service for match data payloads.
Validates input against Pydantic schemas and produces structured diagnostic results.
"""

from typing import Tuple, List, Dict, Any, Optional
from pydantic import ValidationError
from backend.analysis.validation.schemas import MatchDataPayload


# Explicit field dictionaries distinguishing Raw vs Derived metrics per Core-4 Rule 8
RAW_FIELDS: Dict[str, List[str]] = {
    "team": [
        "possession_pct",
        "shots",
        "shots_on_target",
        "shots_off_target",
        "shots_blocked",
        "corners",
        "fouls",
        "yellow_cards",
        "red_cards",
        "offsides",
        "passes_total",
        "passes_completed",
    ],
    "player_attacking": [
        "goals",
        "assists",
        "shots_total",
        "shots_on_target",
        "big_chances_created",
        "big_chances_missed",
    ],
    "player_passing": [
        "passes_attempted",
        "passes_completed",
        "key_passes",
        "crosses_attempted",
        "crosses_completed",
        "progressive_passes",
    ],
    "player_defending": [
        "tackles_attempted",
        "tackles_won",
        "interceptions",
        "blocks",
        "clearances",
        "recoveries",
        "duels_total",
        "duels_won",
        "aerial_duels_total",
        "aerial_duels_won",
    ],
    "player_physical_discipline": [
        "minutes_played",
        "fouls_committed",
        "fouls_drawn",
        "yellow_cards",
        "red_cards",
        "distance_covered_km",
        "sprints",
    ],
    "player_goalkeeping": [
        "saves",
        "goals_conceded",
        "clean_sheet",
        "penalties_saved",
    ],
}

DERIVED_METRICS: Dict[str, Dict[str, str]] = {
    "pass_accuracy_pct": {
        "formula": "(passes_completed / passes_attempted) * 100",
        "description": "Percentage of attempted passes successfully completed",
    },
    "tackle_success_pct": {
        "formula": "(tackles_won / tackles_attempted) * 100",
        "description": "Percentage of attempted tackles successfully won",
    },
    "duel_win_pct": {
        "formula": "(duels_won / duels_total) * 100",
        "description": "Percentage of total duels won",
    },
    "aerial_duel_win_pct": {
        "formula": "(aerial_duels_won / aerial_duels_total) * 100",
        "description": "Percentage of aerial duels won",
    },
    "shot_accuracy_pct": {
        "formula": "(shots_on_target / shots_total) * 100",
        "description": "Percentage of total shots that were on target",
    },
    "goals_per_90": {
        "formula": "(goals / minutes_played) * 90",
        "description": "Goals scored normalized to 90 minutes",
    },
    "assists_per_90": {
        "formula": "(assists / minutes_played) * 90",
        "description": "Assists delivered normalized to 90 minutes",
    },
    "tackles_per_90": {
        "formula": "(tackles_won / minutes_played) * 90",
        "description": "Tackles won normalized to 90 minutes",
    },
    "interceptions_per_90": {
        "formula": "(interceptions / minutes_played) * 90",
        "description": "Interceptions normalized to 90 minutes",
    },
    "xg": {
        "formula": "Model-estimated statistical probability of shot resulting in goal",
        "description": "Expected goals based on shot location, angle, body part",
    },
    "xa": {
        "formula": "Model-estimated statistical probability of completed pass resulting in goal",
        "description": "Expected assists based on end pass location and shot probability",
    },
}


class ValidationResult:
    def __init__(self, is_valid: bool, payload: Optional[MatchDataPayload] = None, errors: Optional[List[str]] = None):
        self.is_valid = is_valid
        self.payload = payload
        self.errors = errors or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "errors": self.errors,
            "match_id": self.payload.match.match_id if self.payload else None,
            "player_count": len(self.payload.players) if self.payload else 0,
            "event_count": len(self.payload.events) if self.payload else 0,
        }


def validate_match_data(raw_data: Any) -> ValidationResult:
    """
    Validates a raw dictionary/JSON payload against MatchDataPayload schema.
    Returns ValidationResult with structured error messages if invalid.
    """
    if not isinstance(raw_data, dict):
        return ValidationResult(is_valid=False, errors=["Input payload must be a JSON object"])

    try:
        payload = MatchDataPayload.model_validate(raw_data)
        return ValidationResult(is_valid=True, payload=payload)
    except ValidationError as e:
        error_msgs = []
        for err in e.errors():
            loc = " -> ".join(str(item) for item in err["loc"])
            msg = err["msg"]
            error_msgs.append(f"[{loc}] {msg}")
        return ValidationResult(is_valid=False, errors=error_msgs)
    except Exception as e:
        return ValidationResult(is_valid=False, errors=[str(e)])
