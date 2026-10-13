"""
CSV Match Importer and Normalizer.
Converts tabular player match statistics CSV into validated MatchDataPayload records.
Integrates with fixture allocation schedules (e.g. Premier League 2024-25 calendar).
Adheres strictly to Core-4 rules: Rule 8 (raw vs derived metrics), Rule 10 (player identity),
Rule 11 (match identity), and Rule 12 (API contracts).
"""

import io
import re
import random
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from backend.analysis.validation.event_generator import generate_squad_spatial_events
from backend.analysis.validation.schemas import (
    MatchDataPayload,
    MatchMetadata,
    TeamMatchMetrics,
    PlayerMatchStats,
    SpatialEvent,
    PositionGroup,
)

# Position mapping dictionary
POSITION_MAP: Dict[str, PositionGroup] = {
    "GK": "GK",
    "CB": "DF",
    "LB": "DF",
    "RB": "DF",
    "LWB": "DF",
    "RWB": "DF",
    "DF": "DF",
    "CM": "MF",
    "DM": "MF",
    "AM": "MF",
    "LM": "MF",
    "RM": "MF",
    "MF": "MF",
    "RW": "FW",
    "LW": "FW",
    "ST": "FW",
    "CF": "FW",
    "FW": "FW",
}

# Team name normalization / aliases for Premier League fixture matching
TEAM_ALIASES: Dict[str, str] = {
    "arsenal": "Arsenal",
    "aston villa": "Aston Villa",
    "bournemouth": "Bournemouth",
    "brentford": "Brentford",
    "brighton": "Brighton",
    "brighton & hove albion": "Brighton",
    "chelsea": "Chelsea",
    "crystal palace": "Crystal Palace",
    "everton": "Everton",
    "fulham": "Fulham",
    "ipswich": "Ipswich Town",
    "ipswich town": "Ipswich Town",
    "leicester": "Leicester City",
    "leicester city": "Leicester City",
    "liverpool": "Liverpool",
    "manchester city": "Manchester City",
    "man city": "Manchester City",
    "manchester united": "Manchester United",
    "man utd": "Manchester United",
    "newcastle": "Newcastle United",
    "newcastle united": "Newcastle United",
    "nottingham forest": "Nottingham Forest",
    "nottm forest": "Nottingham Forest",
    "southampton": "Southampton",
    "tottenham": "Tottenham Hotspur",
    "tottenham hotspur": "Tottenham Hotspur",
    "spurs": "Tottenham Hotspur",
    "west ham": "West Ham United",
    "west ham united": "West Ham United",
    "wolves": "Wolverhampton Wanderers",
    "wolverhampton": "Wolverhampton Wanderers",
    "wolverhampton wanderers": "Wolverhampton Wanderers",
}

import os
import sys

def get_default_fixtures_path() -> Path:
    env_path = os.environ.get("FIXTURES_CSV_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)
    filename = "Fictional_Premier_League_2024_25_Fixture_Allocation.csv"
    # Check current working directory
    p = Path(filename)
    if p.exists():
        return p
    # Check PyInstaller bundle
    if hasattr(sys, '_MEIPASS'):
        p = Path(sys._MEIPASS) / filename
        if p.exists():
            return p
    # Check next to executable or script
    p = Path(sys.executable).parent / filename
    if p.exists():
        return p
    p = Path(__file__).resolve().parent.parent.parent.parent / filename
    if p.exists():
        return p
    return Path(filename)

DEFAULT_FIXTURES_PATH = get_default_fixtures_path()


def normalize_team_name(name: str) -> str:
    """Normalizes team name using alias mapping or cleaned title case."""
    if not name:
        return ""
    cleaned = str(name).strip().lower()
    return TEAM_ALIASES.get(cleaned, str(name).strip())


import csv

def load_fixture_schedule(fixture_csv_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Loads fixture allocation calendar from CSV if available."""
    path = fixture_csv_path or DEFAULT_FIXTURES_PATH
    if not path.exists():
        return []

    try:
        fixtures = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                fixtures.append({
                    "fixture_id": int(row["Match_ID"]),
                    "matchweek": int(row["Matchweek"]),
                    "phase": str(row.get("Phase", "")),
                    "date": str(row["Date"]),
                    "match_in_matchweek": int(row.get("Match_in_Matchweek", 1)),
                    "home_team": normalize_team_name(str(row["Home_Team"])),
                    "away_team": normalize_team_name(str(row["Away_Team"])),
                })
        return fixtures
    except Exception as e:
        print(f"Warning: could not load fixtures from {path}: {e}")
        return []


def find_fixture_match(
    team_a: str,
    team_b: str,
    fixtures: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Finds matching fixture between two clubs regardless of home/away ordering."""
    norm_a = normalize_team_name(team_a)
    norm_b = normalize_team_name(team_b)

    for f in fixtures:
        h = f["home_team"]
        a = f["away_team"]
        if (norm_a == h and norm_b == a) or (norm_a == a and norm_b == h):
            return f
    return None


def extract_jersey_number(player_id: str, index: int) -> int:
    """Extracts numeric digits from player_id (e.g. P004 -> 4) or falls back to index."""
    nums = re.findall(r"\d+", player_id)
    if nums:
        num = int(nums[0])
        if 1 <= num <= 99:
            return num
    return min(99, index + 1)


def parse_player_stats_csv(
    csv_source: str,
    focus_team: Optional[str] = "Chelsea",
    default_season: str = "2024-2025",
    fixtures_path: Optional[Path] = None,
) -> List[MatchDataPayload]:
    """
    Parses CSV content or file path into a list of validated MatchDataPayload instances.
    Each match in the CSV is processed with aggregated team metrics, normalized player
    stats, and matched against the fixture allocation schedule where possible.
    """
    if "\n" in csv_source:
        f = io.StringIO(csv_source)
        raw_rows = list(csv.DictReader(f))
    else:
        file_path = Path(csv_source)
        if not file_path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_source}")
        with open(file_path, "r", encoding="utf-8") as f:
            raw_rows = list(csv.DictReader(f))

    if not raw_rows:
        return []

    # Clean and validate column headers
    first_row = raw_rows[0]
    col_map = {k: k.strip().lower() for k in first_row.keys()}
    normalized_rows = []
    for r in raw_rows:
        norm_r = {col_map[k]: (v.strip() if isinstance(v, str) else v) for k, v in r.items()}
        normalized_rows.append(norm_r)

    required_cols = {"match_id", "player_id", "team", "opponent", "position", "minutes"}
    present_cols = set(col_map.values())
    missing = required_cols - present_cols
    if missing:
        raise ValueError(f"CSV is missing required columns: {sorted(list(missing))}")

    # Load fixtures schedule
    fixtures = load_fixture_schedule(fixtures_path)

    payloads: List[MatchDataPayload] = []

    # Group by match_id
    matches_order = []
    grouped_rows: Dict[str, List[Dict[str, Any]]] = {}
    for r in normalized_rows:
        m_id = str(r["match_id"])
        if m_id not in grouped_rows:
            grouped_rows[m_id] = []
            matches_order.append(m_id)
        grouped_rows[m_id].append(r)

    for match_id in matches_order:
        group = grouped_rows[match_id]
        teams_in_match = list(dict.fromkeys(r["team"] for r in group))
        opponents_in_match = list(dict.fromkeys(r["opponent"] for r in group))
        all_match_teams = list(dict.fromkeys(teams_in_match + opponents_in_match))

        # Determine primary focus team for this match
        norm_focus = normalize_team_name(focus_team) if focus_team else ""
        team_selected = None
        for t in all_match_teams:
            if normalize_team_name(t) == norm_focus:
                team_selected = t
                break
        if not team_selected:
            team_selected = teams_in_match[0]

        other_teams = [t for t in all_match_teams if t != team_selected]
        opponent_selected = other_teams[0] if other_teams else opponents_in_match[0]

        matched_fixture = find_fixture_match(team_selected, opponent_selected, fixtures)
        norm_team_selected = normalize_team_name(team_selected)

        if matched_fixture:
            comp = "Premier League"
            date = matched_fixture["date"]
            matchday = matched_fixture["matchweek"]
            home_team_norm = matched_fixture["home_team"]
            home_away = "home" if norm_team_selected == home_team_norm else "away"
        else:
            comp = "Domestic League"
            date = "2024-10-15"
            matchday = None
            home_away = "home"

        team_players = [r for r in group if r["team"] == team_selected]
        opp_players = [r for r in group if r["team"] == opponent_selected]

        score_team = sum(int(r.get("goals", 0) or 0) for r in team_players)
        score_opp = sum(int(r.get("goals", 0) or 0) for r in opp_players)

        if score_team > score_opp:
            result = "W"
        elif score_team < score_opp:
            result = "L"
        else:
            result = "D"

        match_meta = MatchMetadata(
            match_id=str(match_id),
            date=date,
            competition=comp,
            season=default_season,
            matchday=matchday,
            team=team_selected,
            opponent=opponent_selected,
            home_away=home_away,
            result=result,
            score_team=score_team,
            score_opponent=score_opp,
            stadium=f"{team_selected if home_away == 'home' else opponent_selected} Stadium",
        )

        shots_val = sum(int(r.get("shots", 0) or 0) for r in team_players) if any("shots" in r for r in team_players) else score_team * 3
        shots_ot_val = max(score_team, round(shots_val * 0.4))
        passes_comp_val = sum(int(r.get("passes_completed", 0) or 0) for r in team_players) if any("passes_completed" in r for r in team_players) else 250
        passes_tot_val = round(passes_comp_val * 1.18) if passes_comp_val > 0 else 0
        xg_val = round(sum(float(r.get("xg", 0.0) or 0.0) for r in team_players), 2) if any("xg" in r for r in team_players) else round(score_team * 0.8, 2)
        yc_val = sum(int(r.get("yellow_cards", 0) or 0) for r in team_players)
        rc_val = sum(int(r.get("red_cards", 0) or 0) for r in team_players)
        fouls_val = yc_val * 3 + 6

        team_metrics = TeamMatchMetrics(
            possession_pct=52.0,
            shots=shots_val,
            shots_on_target=shots_ot_val,
            corners=max(1, round(shots_val * 0.3)),
            fouls=fouls_val,
            yellow_cards=yc_val,
            red_cards=rc_val,
            passes_total=passes_tot_val,
            passes_completed=passes_comp_val,
            pass_accuracy_pct=round((passes_comp_val / passes_tot_val * 100.0), 1) if passes_tot_val > 0 else 82.0,
            xg=xg_val,
        )

        target_players = team_players if team_players else group
        players_list: List[PlayerMatchStats] = []

        for idx, row in enumerate(target_players):
            pid = str(row["player_id"]).strip()
            raw_pos = str(row.get("position", "MF")).strip().upper()
            pos_group = POSITION_MAP.get(raw_pos, "MF")
            mins = int(row.get("minutes", 90) or 90)
            goals_val = int(row.get("goals", 0) or 0)
            assists_val = int(row.get("assists", 0) or 0)
            shots_val = int(row.get("shots", 0) or 0)
            shots_ot = min(shots_val, max(goals_val, round(shots_val * 0.5)))
            p_comp = int(row.get("passes_completed", 0) or 0)
            p_att = round(p_comp * 1.15) if p_comp > 0 else p_comp
            tackles_val = int(row.get("tackles", 0) or 0)
            tackles_att = tackles_val + 1 if tackles_val > 0 else 0
            inter_val = int(row.get("interceptions", 0) or 0)
            yc = int(row.get("yellow_cards", 0) or 0)
            rc = int(row.get("red_cards", 0) or 0)
            xg_p = round(float(row.get("xg", 0.0) or 0.0), 2)

            raw_name = str(row.get("player_name") or row.get("name") or row.get("player") or "").strip()
            p_name = raw_name if (raw_name and raw_name.lower() != "nan") else f"Player {pid}"

            jersey_raw = row.get("jersey_number") if "jersey_number" in row else row.get("jersey")
            try:
                p_jersey = int(jersey_raw) if jersey_raw is not None and str(jersey_raw).strip() != "" else extract_jersey_number(pid, idx)
            except (ValueError, TypeError):
                p_jersey = extract_jersey_number(pid, idx)

            player_stat = PlayerMatchStats(
                player_id=pid,
                player_name=p_name,
                jersey_number=p_jersey,
                primary_position=pos_group,
                detailed_position=raw_pos,
                is_starter=True if (mins >= 60 or len(target_players) <= 11) else False,
                minutes_played=mins,
                goals=goals_val,
                assists=assists_val,
                shots_total=shots_val,
                shots_on_target=shots_ot,
                passes_completed=p_comp,
                passes_attempted=p_att,
                tackles_won=tackles_val,
                tackles_attempted=tackles_att,
                interceptions=inter_val,
                yellow_cards=yc,
                red_cards=rc,
                xg=xg_p,
            )
            players_list.append(player_stat)

        # Generate tactical spatial events for the match (shots, passes, tackles, touches)
        shots_config: List[Dict[str, Any]] = []
        rng = random.Random(abs(hash(match_id)) % 10000)
        for p in players_list:
            for g in range(p.goals):
                shots_config.append({
                    "player_id": p.player_id,
                    "minute": rng.randint(8, 88),
                    "x": round(rng.uniform(84.0, 96.0), 1),
                    "y": round(rng.uniform(38.0, 62.0), 1),
                    "shot_result": "goal",
                    "xg": round(max(0.24, min(0.75, p.xg / max(1, p.shots_total) if p.xg > 0 else 0.35)), 2),
                    "body_part": "right_foot" if (g % 2 == 0) else "header",
                })
            other_shots = max(0, p.shots_total - p.goals)
            for s_idx in range(other_shots):
                is_on_target = s_idx < (p.shots_on_target - p.goals)
                res = "saved" if is_on_target else ("blocked" if s_idx % 2 == 0 else "miss")
                shots_config.append({
                    "player_id": p.player_id,
                    "minute": rng.randint(5, 90),
                    "x": round(rng.uniform(70.0, 93.0), 1),
                    "y": round(rng.uniform(22.0, 78.0), 1),
                    "shot_result": res,
                    "xg": round(min(0.32, max(0.04, p.xg / max(1, p.shots_total) if p.xg > 0 else 0.10)), 2),
                    "body_part": "right_foot" if (s_idx % 2 == 0) else "left_foot",
                })

        players_dict = [p.model_dump() for p in players_list]
        raw_events = generate_squad_spatial_events(
            match_id=match_meta.match_id,
            players=players_dict,
            shots_config=shots_config,
            seed=abs(hash(match_id)) % 10000,
        )

        spatial_events: List[SpatialEvent] = []
        for ev in raw_events:
            spatial_events.append(SpatialEvent(
                event_id=ev["event_id"],
                player_id=ev["player_id"],
                minute=ev["minute"],
                second=ev.get("second", 0),
                event_type=ev["event_type"],
                x=ev["x"],
                y=ev["y"],
                end_x=ev.get("end_x"),
                end_y=ev.get("end_y"),
                outcome=ev["outcome"],
                metadata=ev.get("metadata", {}),
            ))

        # Create MatchDataPayload with full telemetry
        payload = MatchDataPayload(
            match=match_meta,
            team_stats=team_metrics,
            players=players_list,
            events=spatial_events,
        )
        payloads.append(payload)

    return payloads
