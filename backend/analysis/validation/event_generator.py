"""
Tactical Spatial Event Generator.
Produces rich, realistic spatial event datasets (100-150 events per match)
modeling authentic positional roles, team possession phases, defensive actions,
passing sequences, and shots with accurate xG on a 0-100 pitch grid.
"""

from typing import List, Dict, Any
import random


def generate_squad_spatial_events(
    match_id: str,
    players: List[Dict[str, Any]],
    shots_config: List[Dict[str, Any]],
    seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Generates a full match dataset of tactical spatial events:
    - Shots with outcome, body part, and xG
    - Passes (short, progressive, through ball, cross)
    - Tackles, interceptions, clearances, recoveries
    - Goalkeeper saves and distributions
    """
    rng = random.Random(seed)
    events: List[Dict[str, Any]] = []
    event_counter = 1

    # 1. Add all configured team shots first
    for s in shots_config:
        events.append({
            "event_id": f"ev_{match_id}_{event_counter:03d}_shot",
            "player_id": s["player_id"],
            "minute": s["minute"],
            "second": s.get("second", rng.randint(0, 59)),
            "event_type": "shot",
            "x": round(s["x"], 1),
            "y": round(s["y"], 1),
            "outcome": "successful" if s.get("shot_result") == "goal" else "unsuccessful",
            "metadata": {
                "shot_result": s.get("shot_result", "miss"),
                "xg": s.get("xg", 0.12),
                "body_part": s.get("body_part", "right_foot")
            }
        })
        event_counter += 1

    # 2. Add realistic positional actions for each player according to minutes and role
    for p in players:
        pid = p["player_id"]
        mins = p.get("minutes_played", 0)
        pos = p.get("primary_position", "MF")
        role = p.get("detailed_position", pos)

        # Scale action count proportional to minutes played
        action_count = max(2, int((mins / 90.0) * rng.randint(9, 14)))

        for i in range(action_count):
            minute = rng.randint(1, min(90, max(1, mins)))
            second = rng.randint(0, 59)

            if role == "GK":
                x = round(rng.uniform(4.0, 18.0), 1)
                y = round(rng.uniform(32.0, 68.0), 1)
                ev_type = rng.choice(["pass", "touch", "save", "clearance"])
                outcome = "successful" if rng.random() > 0.15 else "unsuccessful"
                meta = {"action": "goalkeeper_distribution"}
            elif role in ["CB"]:
                x = round(rng.uniform(18.0, 48.0), 1)
                y = round(rng.uniform(22.0, 78.0), 1)
                ev_type = rng.choice(["pass", "tackle", "interception", "clearance", "touch"])
                outcome = "successful" if rng.random() > 0.12 else "unsuccessful"
                meta = {"zone": "defensive_third"}
            elif role in ["RB"]:
                x = round(rng.uniform(28.0, 85.0), 1)
                y = round(rng.uniform(68.0, 96.0), 1)  # Right flank
                ev_type = rng.choice(["pass", "tackle", "touch", "interception", "touch"])
                outcome = "successful" if rng.random() > 0.15 else "unsuccessful"
                meta = {"flank": "right"}
            elif role in ["LB"]:
                x = round(rng.uniform(28.0, 85.0), 1)
                y = round(rng.uniform(4.0, 32.0), 1)   # Left flank
                ev_type = rng.choice(["pass", "tackle", "touch", "interception", "touch"])
                outcome = "successful" if rng.random() > 0.15 else "unsuccessful"
                meta = {"flank": "left"}
            elif role in ["DM"]:
                x = round(rng.uniform(32.0, 68.0), 1)
                y = round(rng.uniform(25.0, 75.0), 1)  # Central midfield anchor
                ev_type = rng.choice(["tackle", "interception", "pass", "recovery", "touch"])
                outcome = "successful" if rng.random() > 0.14 else "unsuccessful"
                meta = {"role": "midfield_anchor"}
            elif role in ["CM"]:
                x = round(rng.uniform(40.0, 78.0), 1)
                y = round(rng.uniform(20.0, 80.0), 1)
                ev_type = rng.choice(["pass", "progressive_pass", "touch", "tackle", "recovery"])
                outcome = "successful" if rng.random() > 0.15 else "unsuccessful"
                meta = {"role": "box_to_box"}
            elif role in ["AM"]:
                x = round(rng.uniform(55.0, 90.0), 1)
                y = round(rng.uniform(22.0, 78.0), 1)  # Attacking half-spaces
                ev_type = rng.choice(["pass", "touch", "take_on", "pass"])
                outcome = "successful" if rng.random() > 0.18 else "unsuccessful"
                meta = {"zone": "final_third_creative"}
            elif role in ["RW"]:
                x = round(rng.uniform(55.0, 94.0), 1)
                y = round(rng.uniform(65.0, 96.0), 1)  # Right attacking wing
                ev_type = rng.choice(["touch", "take_on", "pass", "cross"])
                outcome = "successful" if rng.random() > 0.22 else "unsuccessful"
                meta = {"flank": "right_wing"}
            elif role in ["LW"]:
                x = round(rng.uniform(55.0, 94.0), 1)
                y = round(rng.uniform(4.0, 35.0), 1)   # Left attacking wing
                ev_type = rng.choice(["touch", "take_on", "pass", "cross"])
                outcome = "successful" if rng.random() > 0.22 else "unsuccessful"
                meta = {"flank": "left_wing"}
            else:  # ST
                x = round(rng.uniform(70.0, 96.0), 1)
                y = round(rng.uniform(26.0, 74.0), 1)  # Central attacking box
                ev_type = rng.choice(["touch", "pass", "take_on", "touch"])
                outcome = "successful" if rng.random() > 0.20 else "unsuccessful"
                meta = {"target": "striker_channel"}

            end_x = None
            end_y = None
            if ev_type in ["pass", "progressive_pass", "cross"]:
                end_x = min(98.0, max(2.0, round(x + rng.uniform(-8.0, 22.0), 1)))
                end_y = min(98.0, max(2.0, round(y + rng.uniform(-18.0, 18.0), 1)))

            events.append({
                "event_id": f"ev_{match_id}_{event_counter:03d}_{ev_type}",
                "player_id": pid,
                "minute": minute,
                "second": second,
                "event_type": "pass" if ev_type in ["progressive_pass", "cross"] else ev_type,
                "x": x,
                "y": y,
                "end_x": end_x,
                "end_y": end_y,
                "outcome": outcome,
                "metadata": meta
            })
            event_counter += 1

    # Sort chronologically by minute and second
    events.sort(key=lambda e: (e["minute"], e.get("second", 0)))
    return events
