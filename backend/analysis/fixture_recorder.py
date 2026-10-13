"""
Fixture Match Recorder and Telemetry Generator Service.
Enables managers to record or upload match data for any upcoming fixture:
1. Ingest custom JSON match telemetry payload
2. Ingest CSV player match stats sheet
3. Quick Match Result recorder: computes valid tactical stats, player ratings,
   shots, xG, and 80+ spatial pitch events matching the official fixture context.
"""

from typing import Dict, Any, Optional, List
import random
import time
from backend.database.service import DatabaseService
from backend.analysis.validation import validate_match_data
from backend.analysis.validation.event_generator import generate_squad_spatial_events


# Standard tactical role blueprints for Premier League squads (4-3-3 Holding)
STANDARD_ROLES = [
    {"detailed": "GK", "pos": "GK", "starter": True, "mins": 90},
    {"detailed": "RB", "pos": "DF", "starter": True, "mins": 90},
    {"detailed": "CB", "pos": "DF", "starter": True, "mins": 90},
    {"detailed": "CB", "pos": "DF", "starter": True, "mins": 90},
    {"detailed": "LB", "pos": "DF", "starter": True, "mins": 90},
    {"detailed": "DM", "pos": "MF", "starter": True, "mins": 90},
    {"detailed": "CM", "pos": "MF", "starter": True, "mins": 82, "sub_out": 82},
    {"detailed": "AM", "pos": "MF", "starter": True, "mins": 86, "sub_out": 86},
    {"detailed": "RW", "pos": "FW", "starter": True, "mins": 74, "sub_out": 74},
    {"detailed": "ST", "pos": "FW", "starter": True, "mins": 90},
    {"detailed": "LW", "pos": "FW", "starter": True, "mins": 68, "sub_out": 68},
    # Substitutes
    {"detailed": "LW", "pos": "FW", "starter": False, "mins": 22, "sub_in": 68},
    {"detailed": "RW", "pos": "FW", "starter": False, "mins": 16, "sub_in": 74},
    {"detailed": "CM", "pos": "MF", "starter": False, "mins": 8, "sub_in": 82},
    {"detailed": "AM", "pos": "MF", "starter": False, "mins": 4, "sub_in": 86},
]


def record_fixture_match(
    db: DatabaseService,
    fixture_id: int,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Records or generates match data for an upcoming fixture in the schedule.
    Supports custom JSON, CSV content, or quick scorecard result generation.
    """
    fixture = db.get_fixture(fixture_id)
    if not fixture:
        raise ValueError(f"Fixture #{fixture_id} not found in schedule")

    managed_team = data.get("focus_team") or db.get_setting("focus_team", "Chelsea")

    # 1. Handle Custom JSON Payload
    if "custom_payload" in data and data["custom_payload"]:
        payload = data["custom_payload"]
        val_result = validate_match_data(payload)
        if not val_result.is_valid:
            raise ValueError(f"Validation failed: {', '.join(val_result.errors)}")

        match_payload = val_result.payload
        success, msg = db.save_match(match_payload)
        if not success:
            raise ValueError(msg)

        db.link_fixture_match(fixture_id, match_payload.match.match_id)
        return {
            "status": "success",
            "message": "Custom match telemetry imported successfully",
            "match_id": match_payload.match.match_id,
            "fixture_id": fixture_id,
            "score": f"{match_payload.match.score_team}-{match_payload.match.score_opponent}",
            "result": match_payload.match.result
        }

    # 2. Handle CSV content
    if "csv_content" in data and data["csv_content"]:
        imported = db.import_csv_matches(data["csv_content"], focus_team=managed_team)
        if not imported:
            raise ValueError("No matches could be imported from provided CSV")
        # Link the first imported match to this fixture
        match_id = imported[0]["match_id"]
        db.link_fixture_match(fixture_id, match_id)
        return {
            "status": "success",
            "message": f"Successfully imported {len(imported)} match(es) from CSV",
            "match_id": match_id,
            "fixture_id": fixture_id,
            "score": imported[0]["score"],
            "result": imported[0]["result"]
        }

    # 3. Quick Match Result & Telemetry Generator
    score_home = int(data.get("score_home", 0))
    score_away = int(data.get("score_away", 0))
    possession_pct = float(data.get("possession_pct", 53.5))

    is_home = (fixture["home_team"] == managed_team)
    home_away = "home" if is_home else "away"
    opponent = fixture["away_team"] if is_home else fixture["home_team"]
    score_team = score_home if is_home else score_away
    score_opponent = score_away if is_home else score_home

    if score_team > score_opponent:
        result = "W"
    elif score_team < score_opponent:
        result = "L"
    else:
        result = "D"

    # Unique match ID
    season_clean = fixture["season"].replace("-", "")
    h_slug = "".join(c for c in fixture["home_team"].lower() if c.isalnum())[:3]
    a_slug = "".join(c for c in fixture["away_team"].lower() if c.isalnum())[:3]
    mw = fixture["matchweek"]
    match_id = f"match_{season_clean}_mw{mw:02d}_{h_slug}_vs_{a_slug}"
    if db.check_duplicate_match(match_id):
        match_id = f"{match_id}_{int(time.time())}"

    # Squad selection
    all_players = db.get_all_players()
    # Prefer players from the database
    chosen_players: List[Dict[str, Any]] = []
    rng = random.Random(fixture_id * 17 + score_team * 31 + score_opponent * 7)

    # Pick or generate player list
    used_numbers = set()
    for idx, role_spec in enumerate(STANDARD_ROLES):
        if idx < len(all_players):
            db_p = all_players[idx]
            p_id = db_p["id"]
            p_name = db_p["name"]
            p_num = db_p.get("squad_number", idx + 1)
        else:
            p_id = f"p_squad_{idx+1:02d}"
            p_name = f"Squad Player {idx+1}"
            p_num = idx + 1

        if p_num in used_numbers:
            p_num = max(used_numbers) + 1
        used_numbers.add(p_num)

        chosen_players.append({
            "player_id": p_id,
            "player_name": p_name,
            "jersey_number": p_num,
            "primary_position": role_spec["pos"],
            "detailed_position": role_spec["detailed"],
            "is_starter": role_spec["starter"],
            "minutes_played": role_spec["mins"],
            "subbed_in_minute": role_spec.get("sub_in"),
            "subbed_out_minute": role_spec.get("sub_out"),
        })

    # Distribute team goals among attackers and midfielders
    attacking_players = [p for p in chosen_players if p["detailed_position"] in ["ST", "RW", "LW", "AM", "CM"]]
    goals_remaining = score_team
    assists_remaining = max(0, score_team - rng.randint(0, 1))

    # Assign goals
    goals_map: Dict[str, int] = {}
    while goals_remaining > 0 and attacking_players:
        scorer = rng.choice(attacking_players)
        goals_map[scorer["player_id"]] = goals_map.get(scorer["player_id"], 0) + 1
        goals_remaining -= 1

    # Assign assists
    assists_map: Dict[str, int] = {}
    while assists_remaining > 0 and attacking_players:
        assister = rng.choice(attacking_players)
        assists_map[assister["player_id"]] = assists_map.get(assister["player_id"], 0) + 1
        assists_remaining -= 1

    # Build shots config for spatial generator
    shots_config: List[Dict[str, Any]] = []
    shot_counter = 1

    # Add goal shots first
    for pid, gcount in goals_map.items():
        for _ in range(gcount):
            min_at = rng.randint(5, 88)
            shots_config.append({
                "player_id": pid,
                "minute": min_at,
                "x": round(rng.uniform(84.0, 94.0), 1),
                "y": round(rng.uniform(38.0, 62.0), 1),
                "shot_result": "goal",
                "xg": round(rng.uniform(0.35, 0.78), 2),
                "body_part": rng.choice(["right_foot", "left_foot", "header"])
            })

    # Add non-goal shots
    total_shots = max(score_team + 4, int(data.get("shots_home" if is_home else "shots_away", 12)))
    non_goal_shots = max(0, total_shots - score_team)
    for _ in range(non_goal_shots):
        p = rng.choice(attacking_players)
        shots_config.append({
            "player_id": p["player_id"],
            "minute": rng.randint(4, 90),
            "x": round(rng.uniform(72.0, 93.0), 1),
            "y": round(rng.uniform(25.0, 75.0), 1),
            "shot_result": rng.choice(["miss", "saved", "blocked"]),
            "xg": round(rng.uniform(0.04, 0.22), 2),
            "body_part": rng.choice(["right_foot", "left_foot", "header"])
        })

    # Build final player stats records
    final_players: List[Dict[str, Any]] = []
    total_passes_completed = 0
    total_passes_attempted = 0
    total_shots_on_target = score_team

    for p in chosen_players:
        pid = p["player_id"]
        role = p["detailed_position"]
        mins = p["minutes_played"]
        scale = mins / 90.0

        p_goals = goals_map.get(pid, 0)
        p_assists = assists_map.get(pid, 0)
        p_shots_list = [s for s in shots_config if s["player_id"] == pid]
        p_shots = len(p_shots_list)
        p_shots_ot = p_goals + sum(1 for s in p_shots_list if s["shot_result"] == "saved")
        total_shots_on_target += (p_shots_ot - p_goals)

        # Realistic passes and defending based on role
        if role == "GK":
            p_att = int(scale * rng.randint(28, 36))
            p_comp = int(p_att * rng.uniform(0.72, 0.82))
            t_att = 0
            t_won = 0
            interc = 0
        elif role in ["CB", "RB", "LB"]:
            p_att = int(scale * rng.randint(45, 62))
            p_comp = int(p_att * rng.uniform(0.86, 0.94))
            t_att = int(scale * rng.randint(3, 5))
            t_won = int(t_att * rng.uniform(0.65, 0.85))
            interc = int(scale * rng.randint(2, 4))
        elif role in ["DM", "CM"]:
            p_att = int(scale * rng.randint(52, 70))
            p_comp = int(p_att * rng.uniform(0.85, 0.92))
            t_att = int(scale * rng.randint(3, 6))
            t_won = int(t_att * rng.uniform(0.60, 0.80))
            interc = int(scale * rng.randint(1, 3))
        else: # AM, RW, LW, ST
            p_att = int(scale * rng.randint(24, 40))
            p_comp = int(p_att * rng.uniform(0.75, 0.85))
            t_att = int(scale * rng.randint(1, 3))
            t_won = int(t_att * rng.uniform(0.50, 0.70))
            interc = int(scale * rng.randint(0, 2))

        # Enforce consistency rules
        p_comp = min(p_comp, p_att)
        t_won = min(t_won, t_att)
        p_shots_ot = min(p_shots_ot, p_shots)

        total_passes_attempted += p_att
        total_passes_completed += p_comp

        duels_tot = t_att + rng.randint(2, 6)
        duels_w = t_won + rng.randint(1, 3)
        duels_w = min(duels_w, duels_tot)

        player_record = {
            "player_id": pid,
            "player_name": p["player_name"],
            "jersey_number": p["jersey_number"],
            "primary_position": p["primary_position"],
            "detailed_position": role,
            "is_starter": p["is_starter"],
            "minutes_played": mins,
            "subbed_in_minute": p.get("subbed_in_minute"),
            "subbed_out_minute": p.get("subbed_out_minute"),
            "goals": p_goals,
            "assists": p_assists,
            "shots_total": p_shots,
            "shots_on_target": p_shots_ot,
            "big_chances_created": p_assists + (1 if rng.random() > 0.6 else 0),
            "big_chances_missed": 1 if (p_shots > p_goals and rng.random() > 0.7) else 0,
            "passes_attempted": p_att,
            "passes_completed": p_comp,
            "key_passes": p_assists + rng.randint(0, 2),
            "crosses_attempted": int(scale * rng.randint(1, 4)) if role in ["RB", "LB", "RW", "LW"] else 0,
            "crosses_completed": int(scale * rng.randint(0, 2)) if role in ["RB", "LB", "RW", "LW"] else 0,
            "progressive_passes": int(scale * rng.randint(2, 6)),
            "tackles_attempted": t_att,
            "tackles_won": t_won,
            "interceptions": interc,
            "blocks": int(scale * rng.randint(0, 2)),
            "clearances": int(scale * rng.randint(1, 4)) if role in ["CB", "RB", "LB"] else 0,
            "recoveries": int(scale * rng.randint(3, 8)),
            "duels_total": duels_tot,
            "duels_won": duels_w,
            "aerial_duels_total": rng.randint(1, 4),
            "aerial_duels_won": rng.randint(0, 2),
            "fouls_committed": rng.randint(0, 2),
            "fouls_drawn": rng.randint(0, 3),
            "yellow_cards": 1 if rng.random() > 0.85 else 0,
            "red_cards": 0,
            "distance_covered_km": round(scale * rng.uniform(7.8, 11.2), 1) if mins > 45 else None,
            "sprints": int(scale * rng.randint(10, 26)) if mins > 45 else None,
            "xg": round(sum(s.get("xg", 0.0) for s in p_shots_list), 2),
            "xa": round(p_assists * 0.35 + rng.uniform(0.05, 0.20), 2)
        }

        # Cross consistency
        if player_record["crosses_completed"] > player_record["crosses_attempted"]:
            player_record["crosses_completed"] = player_record["crosses_attempted"]

        # Aerial duels consistency
        if player_record["aerial_duels_won"] > player_record["aerial_duels_total"]:
            player_record["aerial_duels_won"] = player_record["aerial_duels_total"]

        if role == "GK":
            player_record["saves"] = max(2, int(data.get("shots_opponent", 4)) - score_opponent)
            player_record["goals_conceded"] = score_opponent
            player_record["clean_sheet"] = (score_opponent == 0)

        final_players.append(player_record)

    # 4. Generate Spatial Events
    events = generate_squad_spatial_events(
        match_id=match_id,
        players=final_players,
        shots_config=shots_config,
        seed=fixture_id + mw
    )

    # 5. Build Team Stats
    total_xg = round(sum(s.get("xg", 0.1) for s in shots_config), 2)
    team_stats = {
        "possession_pct": round(possession_pct, 1),
        "shots": max(len(shots_config), total_shots_on_target),
        "shots_on_target": total_shots_on_target,
        "corners": rng.randint(4, 9),
        "fouls": rng.randint(8, 14),
        "yellow_cards": sum(p["yellow_cards"] for p in final_players),
        "red_cards": 0,
        "offsides": rng.randint(1, 4),
        "passes_total": total_passes_attempted,
        "passes_completed": total_passes_completed,
        "pass_accuracy_pct": round((total_passes_completed / max(1, total_passes_attempted)) * 100.0, 1),
        "xg": total_xg
    }

    match_payload_dict = {
        "match": {
            "match_id": match_id,
            "date": fixture["date"],
            "competition": "Premier League",
            "season": fixture["season"],
            "matchday": mw,
            "team": managed_team,
            "opponent": opponent,
            "home_away": home_away,
            "result": result,
            "score_team": score_team,
            "score_opponent": score_opponent,
            "stadium": f"{fixture['home_team']} Stadium",
            "referee": "Premier League Official",
        },
        "team_stats": team_stats,
        "players": final_players,
        "events": events
    }

    # Validate against strict Core-4 schemas
    val = validate_match_data(match_payload_dict)
    if not val.is_valid:
        raise ValueError(f"Generated telemetry validation failed: {', '.join(val.errors)}")

    # Save to database
    success, msg = db.save_match(val.payload)
    if not success:
        raise ValueError(f"Failed to persist generated match: {msg}")

    # Explicitly link fixture to match
    db.link_fixture_match(fixture_id, match_id)

    return {
        "status": "success",
        "message": f"Match recorded successfully: {managed_team} {score_team}-{score_opponent} {opponent}",
        "match_id": match_id,
        "fixture_id": fixture_id,
        "team": managed_team,
        "opponent": opponent,
        "score": f"{score_team}-{score_opponent}",
        "result": result,
        "players_count": len(final_players),
        "events_count": len(events),
    }
