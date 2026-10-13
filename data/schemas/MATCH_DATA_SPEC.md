# Football Match Data Specification

## Overview

This document specifies the format, field dictionaries, validation constraints, and coordinate conventions for match data imported into the Football Analysis platform.

It adheres to:
- **Core-4 Rule 8**: Strict separation of Raw vs. Derived fields.
- **Core-4 Rule 10**: Stable player identifiers (`player_id`).
- **Core-4 Rule 11**: Match metadata requirements (`match_id`, `date`, `opponent`, `home_away`, `competition`).
- **Core-4 Rule 12**: Spatial coordinate system convention.

---

## 1. Top-Level Structure

Every imported match file is a JSON object with four sections:

```json
{
  "match": { ... },
  "team_stats": { ... },
  "players": [ ... ],
  "events": [ ... ]
}
```

---

## 2. Match Metadata (`match`)

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `match_id` | `string` | Yes | Unique stable identifier for the match | `"match_20241020_che_liv"` |
| `date` | `string` | Yes | ISO 8601 calendar date (`YYYY-MM-DD`) | `"2024-10-20"` |
| `competition` | `string` | Yes | League / Cup competition | `"Premier League"` |
| `season` | `string` | Yes | Season representation | `"2024-2025"` |
| `matchday` | `integer` | No | Round or fixture week number | `8` |
| `team` | `string` | Yes | Focus team name | `"Chelsea"` |
| `opponent` | `string` | Yes | Opponent team name | `"Liverpool"` |
| `home_away` | `string` | Yes | `"home"` or `"away"` | `"away"` |
| `result` | `string` | Yes | Result from focus squad POV: `"W"`, `"D"`, `"L"` | `"L"` |
| `score_team` | `integer` | Yes | Goals scored by focus team | `1` |
| `score_opponent` | `integer` | Yes | Goals scored by opponent | `2` |
| `stadium` | `string` | No | Venue name | `"Anfield"` |
| `referee` | `string` | No | Match official name | `"John Brooks"` |

---

## 3. Team Statistics (`team_stats`)

### Raw Observed Metrics
- `possession_pct` (float, 0–100): Ball possession percentage.
- `shots` (int, >= 0): Total shots taken.
- `shots_on_target` (int, >= 0): Shots on target (must not exceed `shots`).
- `shots_off_target` (int, optional): Shots off target.
- `shots_blocked` (int, optional): Shots blocked by opponent.
- `corners` (int, >= 0): Corner kicks awarded.
- `fouls` (int, >= 0): Fouls committed.
- `yellow_cards` (int, >= 0): Yellow cards shown.
- `red_cards` (int, >= 0): Red cards shown.
- `offsides` (int, >= 0): Offside infractions.
- `passes_total` (int, >= 0): Total passes attempted.
- `passes_completed` (int, >= 0): Passes successfully completed (must not exceed `passes_total`).

### Derived Metrics (Optional in source, calculated transparently)
- `pass_accuracy_pct` (float): `(passes_completed / passes_total) * 100`
- `xg` (float): Expected goals aggregated for the team.

---

## 4. Player Statistics (`players`)

Each entry in the `players` array represents one squad member involved in the match (starters and used/unused substitutes).

### Identification
- `player_id` (string, required): Stable unique identifier (e.g. `"p_cole_palmer"`).
- `player_name` (string, required): Player full name.
- `jersey_number` (int, 1–99): Squad kit number.
- `primary_position` (string, required): One of `"GK"`, `"DF"`, `"MF"`, `"FW"`.
- `detailed_position` (string, optional): Specific role (e.g. `"AM"`, `"RW"`, `"CB"`, `"DM"`, `"ST"`).
- `is_starter` (boolean, required): Whether the player started the match.
- `minutes_played` (int, 0–130): Time on pitch.
- `subbed_in_minute` (int, optional): Minute entered pitch.
- `subbed_out_minute` (int, optional): Minute left pitch.

### Raw Statistics vs Derived Metrics

| Metric | Category | Formula / Definition |
|---|---|---|
| `goals` | Raw | Direct count of goals scored |
| `assists` | Raw | Direct count of goal assists |
| `shots_total` | Raw | Total shots taken |
| `shots_on_target` | Raw | Shots hitting goal target |
| `big_chances_created` | Raw | Passes/actions creating clear scoring opportunities |
| `big_chances_missed` | Raw | Clear scoring chances not converted |
| `passes_attempted` | Raw | Passes initiated |
| `passes_completed` | Raw | Passes successfully received by teammate |
| `key_passes` | Raw | Passes directly leading to teammate shot |
| `crosses_attempted` | Raw | Crosses into penalty area attempted |
| `crosses_completed` | Raw | Crosses successfully reaching teammate |
| `progressive_passes` | Raw | Passes moving ball >= 10m towards opponent goal |
| `tackles_attempted` | Raw | Tackles engaged |
| `tackles_won` | Raw | Tackles resulting in possession gain or ball out |
| `interceptions` | Raw | Passes intercepted |
| `blocks` | Raw | Shots or crosses blocked |
| `clearances` | Raw | Defensive clearance kicks/headers |
| `recoveries` | Raw | Loose balls retrieved |
| `duels_total` | Raw | Total ground and aerial duels contested |
| `duels_won` | Raw | Total duels won |
| `aerial_duels_total` | Raw | Aerial duels contested |
| `aerial_duels_won` | Raw | Aerial duels won |
| `fouls_committed` | Raw | Fouls committed |
| `fouls_drawn` | Raw | Fouls suffered from opponent |
| `yellow_cards` | Raw | Yellow cards (0, 1, 2) |
| `red_cards` | Raw | Red cards (0, 1) |
| `distance_covered_km`| Raw | Running distance in kilometers |
| `sprints` | Raw | High-intensity sprint actions |
| `saves` | Raw (GK) | Shots stopped by goalkeeper |
| `goals_conceded` | Raw (GK) | Goals conceded while on pitch |
| `clean_sheet` | Raw (GK) | True if 0 goals conceded and >= 60 min |
| `penalties_saved` | Raw (GK) | Penalties saved |
| `pass_accuracy_pct` | Derived | `(passes_completed / passes_attempted) * 100` |
| `tackle_success_pct`| Derived | `(tackles_won / tackles_attempted) * 100` |
| `duel_win_pct` | Derived | `(duels_won / duels_total) * 100` |
| `shot_accuracy_pct` | Derived | `(shots_on_target / shots_total) * 100` |
| `per_90_metrics` | Derived | `(metric_raw / minutes_played) * 90` |
| `xg` | Derived | Expected goals based on shot characteristics |
| `xa` | Derived | Expected assists based on pass outcome |

---

## 5. Spatial Events (`events`)

Spatial events capture discrete actions on the pitch for Heat Maps, Shot Maps, and pitch location analysis.

### Pitch Coordinate System (Core-4 Rule 12)
- **Scale**: Normalized `0.0` to `100.0`.
- **X-axis**:
  - `0.0`: Defending goal line (own goal).
  - `100.0`: Attacking goal line (opponent goal).
- **Y-axis**:
  - `0.0`: Left touchline (looking from defending goal to attacking goal).
  - `100.0`: Right touchline.
- **Center Spot**: `(50.0, 50.0)`
- **Penalty Spot (Attacking)**: `(88.5, 50.0)`

### Event Fields
- `event_id` (string): Unique identifier.
- `player_id` (string): ID of player performing the action.
- `minute` (int, 0–130): Minute of action.
- `second` (int, 0–59, optional): Second of action.
- `event_type` (string): `"shot"`, `"pass"`, `"tackle"`, `"interception"`, `"touch"`, `"foul"`, `"save"`, `"clearance"`, `"take_on"`.
- `x` (float, 0–100): Start X coordinate.
- `y` (float, 0–100): Start Y coordinate.
- `end_x` (float, 0–100, optional): End X coordinate.
- `end_y` (float, 0–100, optional): End Y coordinate.
- `outcome` (string): `"successful"` or `"unsuccessful"`.
- `metadata` (object, optional):
  - Shots: `{"shot_result": "goal" | "saved" | "blocked" | "miss", "xg": 0.35, "body_part": "right_foot" | "left_foot" | "header"}`

---

## 6. Validation Rules

1. Exactly 11 starters (`is_starter == true`).
2. Exactly 1 starting Goalkeeper (`primary_position == "GK"`).
3. All player IDs must be unique within the squad.
4. Total player goals must not exceed `match.score_team`.
5. Individual raw bounds: `passes_completed <= passes_attempted`, `tackles_won <= tackles_attempted`, `shots_on_target <= shots_total`, `duels_won <= duels_total`.
6. Spatial coordinates strictly between `0.0` and `100.0`.
7. All spatial event `player_id` values must correspond to players in the squad list.
