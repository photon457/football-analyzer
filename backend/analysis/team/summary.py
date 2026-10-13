"""
Team-level match summary and differential analytics.
Computes performance indicators, shot efficiency, and tactical profile.
"""

from typing import Dict, Any


def calculate_team_summary(match_metadata: Dict[str, Any], team_stats: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes derived team performance indicators and differentials.
    """
    score_for = match_metadata.get("score_team", 0)
    score_against = match_metadata.get("score_opponent", 0)
    goal_diff = score_for - score_against

    shots = team_stats.get("shots", 0)
    shots_ot = team_stats.get("shots_on_target", 0)
    passes_total = team_stats.get("passes_total", 0)
    passes_comp = team_stats.get("passes_completed", 0)

    # Transparent derived formulas per Core-4 Rule 8 & 10
    shot_accuracy = round((shots_ot / shots * 100.0), 1) if shots > 0 else 0.0
    shot_conversion = round((score_for / shots * 100.0), 1) if shots > 0 else 0.0
    pass_accuracy = round((passes_comp / passes_total * 100.0), 1) if passes_total > 0 else 0.0

    return {
        "score_differential": goal_diff,
        "is_clean_sheet": score_against == 0,
        "shot_accuracy_pct": shot_accuracy,
        "shot_conversion_pct": shot_conversion,
        "pass_accuracy_pct": pass_accuracy,
        "possession_pct": team_stats.get("possession_pct", 0.0),
        "xg": team_stats.get("xg", 0.0),
        "total_fouls": team_stats.get("fouls", 0),
        "corners": team_stats.get("corners", 0),
        "cards_total": team_stats.get("yellow_cards", 0) + team_stats.get("red_cards", 0),
    }
