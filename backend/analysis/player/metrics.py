"""
Player-level analytics and normalization calculator.
Calculates per-90 metrics, position-specific indices, and performance categories.
Transparent, reproducible calculations adhering to Core-4 Rule 8 & 10.
"""

from typing import Dict, Any, List


def calculate_per_90(metric_value: float, minutes_played: int) -> float:
    """Normalizes an accumulated raw count to per-90 minutes."""
    if minutes_played <= 0:
        return 0.0
    return round((metric_value / minutes_played) * 90.0, 2)


def enrich_player_analytics(player_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes per-90 metrics, contribution scores, and radar axes for a player.
    """
    mins = player_data.get("minutes_played", 0)
    pos = player_data.get("primary_position", "MF")

    goals = player_data.get("goals", 0)
    assists = player_data.get("assists", 0)
    shots = player_data.get("shots_total", 0)
    shots_ot = player_data.get("shots_on_target", 0)
    key_passes = player_data.get("key_passes", 0)
    passes_comp = player_data.get("passes_completed", 0)
    passes_att = player_data.get("passes_attempted", 0)
    tackles_won = player_data.get("tackles_won", 0)
    tackles_att = player_data.get("tackles_attempted", 0)
    interceptions = player_data.get("interceptions", 0)
    clearances = player_data.get("clearances", 0)
    blocks = player_data.get("blocks", 0)
    recoveries = player_data.get("recoveries", 0)
    duels_won = player_data.get("duels_won", 0)
    duels_tot = player_data.get("duels_total", 0)

    # Per-90 standard metrics
    p90 = {
        "goals_per_90": calculate_per_90(goals, mins),
        "assists_per_90": calculate_per_90(assists, mins),
        "shots_per_90": calculate_per_90(shots, mins),
        "key_passes_per_90": calculate_per_90(key_passes, mins),
        "passes_completed_per_90": calculate_per_90(passes_comp, mins),
        "tackles_won_per_90": calculate_per_90(tackles_won, mins),
        "interceptions_per_90": calculate_per_90(interceptions, mins),
        "recoveries_per_90": calculate_per_90(recoveries, mins),
        "duels_won_per_90": calculate_per_90(duels_won, mins),
    }

    # Rates and percentages
    rates = {
        "pass_accuracy_pct": round((passes_comp / passes_att * 100.0), 1) if passes_att > 0 else 0.0,
        "tackle_success_pct": round((tackles_won / tackles_att * 100.0), 1) if tackles_att > 0 else 0.0,
        "duel_win_pct": round((duels_won / duels_tot * 100.0), 1) if duels_tot > 0 else 0.0,
        "shot_accuracy_pct": round((shots_ot / shots * 100.0), 1) if shots > 0 else 0.0,
    }

    # Category performance scores (scaled 0-100 for radar and dashboard visualizations)
    # 1. Attacking index
    attack_raw = (goals * 25.0) + (assists * 18.0) + (shots_ot * 8.0) + (key_passes * 6.0)
    attacking_score = min(100.0, round(attack_raw, 1))

    # 2. Passing & Distribution index
    passing_raw = (rates["pass_accuracy_pct"] * 0.5) + (min(50.0, passes_comp * 0.8)) + (key_passes * 5.0)
    passing_score = min(100.0, round(passing_raw, 1))

    # 3. Defensive security index
    def_raw = (tackles_won * 10.0) + (interceptions * 8.0) + (blocks * 6.0) + (clearances * 4.0) + (recoveries * 3.0)
    defending_score = min(100.0, round(def_raw, 1))

    # 4. Physical / Duels index
    phys_raw = (rates["duel_win_pct"] * 0.6) + (duels_won * 3.0)
    physical_score = min(100.0, round(phys_raw, 1))

    radar_profile = {
        "Attacking": attacking_score,
        "Passing": passing_score,
        "Defending": defending_score,
        "Duels": physical_score,
        "Workrate": min(100.0, round(mins * 1.1, 1)),
    }

    return {
        **player_data,
        "per_90": p90,
        "rates": rates,
        "radar_profile": radar_profile,
    }
