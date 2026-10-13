"""
Squad season aggregation ("My Team" view).

Aggregates every stored appearance of each registered player within a single
season into season totals, per-90 rates, ratio metrics, and a chronological
match log.

Metric definitions (all derived from raw per-match values; no composite scores):

- appearances       : number of matches with a match_players record (any minutes).
- starts            : appearances where is_starter is true.
- minutes           : sum of minutes_played.
- totals.<m>        : sum of raw per-match values of counting metric <m>.
- per_90.<m>        : totals.<m> / minutes * 90 (0.0 when minutes == 0).
- rates.pass_accuracy_pct   : sum(passes_completed) / sum(passes_attempted) * 100.
- rates.tackle_success_pct  : sum(tackles_won) / sum(tackles_attempted) * 100.
- rates.duel_win_pct        : sum(duels_won) / sum(duels_total) * 100.
- rates.shot_accuracy_pct   : sum(shots_on_target) / sum(shots_total) * 100.
  Ratios are computed from season totals (volume-weighted), never by
  averaging per-match percentages. A ratio is null when its denominator is 0.
- low_sample        : true when minutes < LOW_SAMPLE_MINUTES. Per-90 values
  for low-sample players are shown but flagged as unreliable (Rule 10).
- goalkeeping       : only for players whose primary position is GK.
  save_pct = saves / (saves + goals_conceded) * 100.
"""

from typing import Any, Dict, List, Optional

LOW_SAMPLE_MINUTES = 270  # Three full matches

COUNTING_METRICS = [
    "goals", "assists", "shots_total", "shots_on_target", "xg", "xa",
    "big_chances_created", "key_passes", "passes_attempted", "passes_completed",
    "progressive_passes", "crosses_attempted", "crosses_completed",
    "tackles_attempted", "tackles_won", "interceptions", "blocks", "clearances",
    "recoveries", "duels_total", "duels_won", "fouls_committed", "fouls_drawn",
    "yellow_cards", "red_cards",
]

PER_90_METRICS = [
    "goals", "assists", "xg", "xa", "shots_total", "key_passes",
    "progressive_passes", "tackles_won", "interceptions", "recoveries", "duels_won",
]

GK_METRICS = ["saves", "goals_conceded"]

POSITION_ORDER = {"GK": 0, "DF": 1, "MF": 2, "FW": 3}


def _ratio(num: float, den: float) -> Optional[float]:
    return round(num / den * 100.0, 1) if den > 0 else None


def _per_90(total: float, minutes: int) -> float:
    return round(total / minutes * 90.0, 2) if minutes > 0 else 0.0


def _metric(metrics: Dict[str, Any], name: str) -> float:
    value = metrics.get(name)
    return float(value) if value is not None else 0.0


def _build_match_log_entry(app: Dict[str, Any]) -> Dict[str, Any]:
    m = app.get("metrics", {})
    attempted = _metric(m, "passes_attempted")
    return {
        "match_id": app["match_id"],
        "date": app["date"],
        "opponent": app["opponent"],
        "competition": app["competition"],
        "home_away": app["home_away"],
        "result": app["result"],
        "score_team": app["score_team"],
        "score_opponent": app["score_opponent"],
        "position": app["position"],
        "is_starter": bool(app["is_starter"]),
        "minutes_played": int(app["minutes_played"]),
        "goals": int(_metric(m, "goals")),
        "assists": int(_metric(m, "assists")),
        "shots_total": int(_metric(m, "shots_total")),
        "key_passes": int(_metric(m, "key_passes")),
        "tackles_won": int(_metric(m, "tackles_won")),
        "interceptions": int(_metric(m, "interceptions")),
        "xg": round(_metric(m, "xg"), 2),
        "pass_accuracy_pct": _ratio(_metric(m, "passes_completed"), attempted),
        "yellow_cards": int(_metric(m, "yellow_cards")),
        "red_cards": int(_metric(m, "red_cards")),
    }


def aggregate_player_season(player: Dict[str, Any], appearances: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregates one player's appearances (already filtered to a single season)."""
    appearances = sorted(appearances, key=lambda a: (a["date"], a["match_id"]))
    minutes = sum(int(a["minutes_played"]) for a in appearances)
    totals = {name: 0.0 for name in COUNTING_METRICS}
    gk_totals = {name: 0.0 for name in GK_METRICS}

    for app in appearances:
        m = app.get("metrics", {})
        for name in COUNTING_METRICS:
            totals[name] += _metric(m, name)
        for name in GK_METRICS:
            gk_totals[name] += _metric(m, name)

    rounded_totals = {
        k: (round(v, 2) if k in ("xg", "xa") else int(round(v)))
        for k, v in totals.items()
    }

    goalkeeping = None
    if player.get("primary_position") == "GK":
        saves = gk_totals["saves"]
        conceded = gk_totals["goals_conceded"]
        goalkeeping = {
            "saves": int(saves),
            "goals_conceded": int(conceded),
            "save_pct": _ratio(saves, saves + conceded),
            "saves_per_90": _per_90(saves, minutes),
            "goals_conceded_per_90": _per_90(conceded, minutes),
        }

    return {
        "player_id": player["id"],
        "player_name": player["name"],
        "primary_position": player["primary_position"],
        "detailed_position": player.get("secondary_position"),
        "squad_number": player.get("squad_number"),
        "appearances": len(appearances),
        "starts": sum(1 for a in appearances if a["is_starter"]),
        "minutes": minutes,
        "low_sample": minutes < LOW_SAMPLE_MINUTES,
        "totals": rounded_totals,
        "per_90": {name: _per_90(totals[name], minutes) for name in PER_90_METRICS},
        "rates": {
            "pass_accuracy_pct": _ratio(totals["passes_completed"], totals["passes_attempted"]),
            "tackle_success_pct": _ratio(totals["tackles_won"], totals["tackles_attempted"]),
            "duel_win_pct": _ratio(totals["duels_won"], totals["duels_total"]),
            "shot_accuracy_pct": _ratio(totals["shots_on_target"], totals["shots_total"]),
        },
        "goalkeeping": goalkeeping,
        "match_log": [_build_match_log_entry(a) for a in appearances],
    }


def aggregate_squad_season(
    season: str,
    available_seasons: List[str],
    players: List[Dict[str, Any]],
    appearances: List[Dict[str, Any]],
    managed_team: Optional[str] = None,
    team_matches: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Builds the full squad-season response. Every registered player is listed;
    players without appearances in the season are returned with zero totals.
    If managed_team is provided, prioritizes the managed team name, season record,
    match log, and longitudinal team averages.
    """
    matches: Dict[str, Dict[str, Any]] = {}
    for app in appearances:
        matches.setdefault(app["match_id"], app)
    match_rows = list(matches.values())

    teams = sorted({m["team"] for m in match_rows if m.get("team")})

    if not season and not match_rows:
        by_player: Dict[str, List[Dict[str, Any]]] = {}
        squad = [aggregate_player_season(p, []) for p in players]
        return {
            "season": None,
            "available_seasons": available_seasons,
            "team": None,
            "record": {
                "played": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "goals_for": 0,
                "goals_against": 0,
                "goal_difference": 0,
                "points": 0,
                "points_per_match": 0.0,
                "win_rate_pct": 0.0,
                "clean_sheets": 0,
                "clean_sheet_pct": 0.0,
                "form": [],
            },
            "low_sample_minutes": LOW_SAMPLE_MINUTES,
            "players": squad,
            "matches": [],
            "team_averages": None,
        }

    # Filter match record and appearances to managed team if specified
    managed_matches = [
        m for m in match_rows
        if m.get("team") == managed_team or m.get("opponent") == managed_team
    ] if managed_team else []

    if managed_matches:
        record_matches = managed_matches
        display_team = managed_team
        managed_match_ids = {m["match_id"] for m in managed_matches}
        active_apps = [a for a in appearances if a.get("match_id") in managed_match_ids]
    elif managed_team:
        display_team = managed_team
        record_matches = []
        active_apps = appearances
    else:
        record_matches = match_rows
        display_team = teams[0] if len(teams) == 1 else (", ".join(teams) if teams else None)
        active_apps = appearances

    by_player = {}
    for app in active_apps:
        by_player.setdefault(app["player_id"], []).append(app)

    squad = [aggregate_player_season(p, by_player.get(p["id"], [])) for p in players]
    squad.sort(key=lambda s: (
        POSITION_ORDER.get(s["primary_position"], 9),
        s["squad_number"] if s["squad_number"] is not None else 999,
        s["player_name"],
    ))

    played = len(record_matches)
    wins = sum(1 for m in record_matches if m.get("result") == "W")
    draws = sum(1 for m in record_matches if m.get("result") == "D")
    losses = sum(1 for m in record_matches if m.get("result") == "L")
    gf = sum(int(m.get("score_team", 0)) for m in record_matches)
    ga = sum(int(m.get("score_opponent", 0)) for m in record_matches)
    points = (wins * 3) + (draws * 1)
    ppm = round(points / played, 2) if played > 0 else 0.0
    win_rate = round((wins / played) * 100.0, 1) if played > 0 else 0.0
    clean_sheets = sum(1 for m in record_matches if int(m.get("score_opponent", 1)) == 0)
    clean_sheet_pct = round((clean_sheets / played) * 100.0, 1) if played > 0 else 0.0
    form = [m.get("result", "") for m in record_matches[-5:]]

    record = {
        "played": played,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "goals_for": gf,
        "goals_against": ga,
        "goal_difference": gf - ga,
        "points": points,
        "points_per_match": ppm,
        "win_rate_pct": win_rate,
        "clean_sheets": clean_sheets,
        "clean_sheet_pct": clean_sheet_pct,
        "form": form,
    }

    # Calculate comprehensive longitudinal team averages across fixtures
    active_team_matches = team_matches if team_matches is not None else []
    shots_list = [m["shots"] for m in active_team_matches if m.get("shots") is not None]
    sot_list = [m["shots_on_target"] for m in active_team_matches if m.get("shots_on_target") is not None]
    xg_list = [m["xg"] for m in active_team_matches if m.get("xg") is not None]
    poss_list = [m["possession_pct"] for m in active_team_matches if m.get("possession_pct") is not None]
    pass_acc_list = [m["pass_accuracy_pct"] for m in active_team_matches if m.get("pass_accuracy_pct") is not None]
    passes_tot_list = [m["passes_total"] for m in active_team_matches if m.get("passes_total") is not None]
    passes_cmp_list = [m["passes_completed"] for m in active_team_matches if m.get("passes_completed") is not None]
    corners_list = [m["corners"] for m in active_team_matches if m.get("corners") is not None]
    fouls_list = [m["fouls"] for m in active_team_matches if m.get("fouls") is not None]
    yc_list = [m["yellow_cards"] for m in active_team_matches if m.get("yellow_cards") is not None]
    rc_list = [m["red_cards"] for m in active_team_matches if m.get("red_cards") is not None]

    home_matches = [m for m in active_team_matches if m.get("home_away") == "home"]
    away_matches = [m for m in active_team_matches if m.get("home_away") == "away"]

    home_record = {
        "played": len(home_matches),
        "wins": sum(1 for m in home_matches if m.get("result") == "W"),
        "draws": sum(1 for m in home_matches if m.get("result") == "D"),
        "losses": sum(1 for m in home_matches if m.get("result") == "L"),
        "goals_for": sum(m.get("score_team", 0) for m in home_matches),
        "goals_against": sum(m.get("score_opponent", 0) for m in home_matches),
    }

    away_record = {
        "played": len(away_matches),
        "wins": sum(1 for m in away_matches if m.get("result") == "W"),
        "draws": sum(1 for m in away_matches if m.get("result") == "D"),
        "losses": sum(1 for m in away_matches if m.get("result") == "L"),
        "goals_for": sum(m.get("score_team", 0) for m in away_matches),
        "goals_against": sum(m.get("score_opponent", 0) for m in away_matches),
    }

    tot_shots = sum(shots_list)
    tot_sot = sum(sot_list)

    team_averages = {
        "goals_scored_per_match": round(gf / played, 2) if played > 0 else 0.0,
        "goals_conceded_per_match": round(ga / played, 2) if played > 0 else 0.0,
        "xg_per_match": round(sum(xg_list) / len(xg_list), 2) if xg_list else 0.0,
        "shots_per_match": round(tot_shots / len(shots_list), 1) if shots_list else 0.0,
        "shots_on_target_per_match": round(tot_sot / len(sot_list), 1) if sot_list else 0.0,
        "shot_accuracy_pct": round((tot_sot / tot_shots) * 100.0, 1) if tot_shots > 0 else None,
        "avg_possession_pct": round(sum(poss_list) / len(poss_list), 1) if poss_list else None,
        "avg_pass_accuracy_pct": round(sum(pass_acc_list) / len(pass_acc_list), 1) if pass_acc_list else None,
        "total_shots": tot_shots,
        "total_shots_on_target": tot_sot,
        "total_xg": round(sum(xg_list), 2) if xg_list else 0.0,
        "total_passes": sum(passes_tot_list),
        "total_passes_completed": sum(passes_cmp_list),
        "total_corners": sum(corners_list),
        "total_fouls": sum(fouls_list),
        "yellow_cards": sum(yc_list),
        "red_cards": sum(rc_list),
        "home_record": home_record,
        "away_record": away_record,
    }

    return {
        "season": season,
        "available_seasons": available_seasons,
        "team": display_team,
        "record": record,
        "low_sample_minutes": LOW_SAMPLE_MINUTES,
        "players": squad,
        "matches": active_team_matches,
        "team_averages": team_averages,
    }
