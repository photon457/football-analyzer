import csv
import random
from pathlib import Path

# Match definitions aligning with Premier League 2024-25 season calendar
MATCHES = [
    {
        "match_id": "M1001",
        "opponent": "Manchester City",
        "date": "2024-08-18",
        "chelsea_score": 0,
        "opp_score": 2,
        "chelsea_goals": {},
        "opp_goals": {"Erling Haaland": 1, "Mateo Kovačić": 1},
    },
    {
        "match_id": "M1002",
        "opponent": "Wolverhampton Wanderers",
        "date": "2024-08-25",
        "chelsea_score": 6,
        "opp_score": 2,
        "chelsea_goals": {"Nicolas Jackson": 1, "Cole Palmer": 1, "Noni Madueke": 3, "João Félix": 1},
        "chelsea_assists": {"Cole Palmer": 3, "Nicolas Jackson": 1, "Pedro Neto": 1},
        "opp_goals": {"Matheus Cunha": 1, "Jørgen Strand Larsen": 1},
    },
    {
        "match_id": "M1003",
        "opponent": "Crystal Palace",
        "date": "2024-09-01",
        "chelsea_score": 1,
        "opp_score": 1,
        "chelsea_goals": {"Nicolas Jackson": 1},
        "chelsea_assists": {"Cole Palmer": 1},
        "opp_goals": {"Eberechi Eze": 1},
    },
    {
        "match_id": "M1004",
        "opponent": "Bournemouth",
        "date": "2024-09-14",
        "chelsea_score": 1,
        "opp_score": 0,
        "chelsea_goals": {"Christopher Nkunku": 1},
        "chelsea_assists": {"Jadon Sancho": 1},
        "opp_goals": {},
    },
    {
        "match_id": "M1005",
        "opponent": "West Ham United",
        "date": "2024-09-21",
        "chelsea_score": 3,
        "opp_score": 0,
        "chelsea_goals": {"Nicolas Jackson": 2, "Cole Palmer": 1},
        "chelsea_assists": {"Nicolas Jackson": 1, "Moisés Caicedo": 1},
        "opp_goals": {},
    },
    {
        "match_id": "M1006",
        "opponent": "Brighton",
        "date": "2024-09-28",
        "chelsea_score": 4,
        "opp_score": 2,
        "chelsea_goals": {"Cole Palmer": 4},
        "chelsea_assists": {"Nicolas Jackson": 1, "Jadon Sancho": 1},
        "opp_goals": {"Georginio Rutter": 1, "Carlos Baleba": 1},
    },
    {
        "match_id": "M1007",
        "opponent": "Nottingham Forest",
        "date": "2024-10-06",
        "chelsea_score": 1,
        "opp_score": 1,
        "chelsea_goals": {"Noni Madueke": 1},
        "chelsea_assists": {"Cole Palmer": 1},
        "opp_goals": {"Chris Wood": 1},
    },
    {
        "match_id": "M1008",
        "opponent": "Liverpool",
        "date": "2024-10-20",
        "chelsea_score": 1,
        "opp_score": 2,
        "chelsea_goals": {"Nicolas Jackson": 1},
        "chelsea_assists": {"Moisés Caicedo": 1},
        "opp_goals": {"Mohamed Salah": 1, "Curtis Jones": 1},
    },
]

# Complete Chelsea squad roster
CHELSEA_ROSTER = [
    {"player_id": "P001", "name": "Robert Sánchez", "jersey": 1, "role": "GK", "starter": True, "base_mins": 90},
    {"player_id": "P002", "name": "Malo Gusto", "jersey": 27, "role": "RB", "starter": True, "base_mins": 90},
    {"player_id": "P003", "name": "Wesley Fofana", "jersey": 29, "role": "CB", "starter": True, "base_mins": 90},
    {"player_id": "P004", "name": "Levi Colwill", "jersey": 6, "role": "CB", "starter": True, "base_mins": 90},
    {"player_id": "P005", "name": "Marc Cucurella", "jersey": 3, "role": "LB", "starter": True, "base_mins": 90},
    {"player_id": "P006", "name": "Moisés Caicedo", "jersey": 25, "role": "DM", "starter": True, "base_mins": 90},
    {"player_id": "P007", "name": "Enzo Fernández", "jersey": 8, "role": "CM", "starter": True, "base_mins": 84},
    {"player_id": "P008", "name": "Cole Palmer", "jersey": 20, "role": "AM", "starter": True, "base_mins": 90},
    {"player_id": "P009", "name": "Noni Madueke", "jersey": 11, "role": "RW", "starter": True, "base_mins": 76},
    {"player_id": "P010", "name": "Jadon Sancho", "jersey": 19, "role": "LW", "starter": True, "base_mins": 72},
    {"player_id": "P011", "name": "Nicolas Jackson", "jersey": 15, "role": "ST", "starter": True, "base_mins": 80},
    # Regular substitutes
    {"player_id": "P012", "name": "Pedro Neto", "jersey": 7, "role": "RW", "starter": False, "base_mins": 25},
    {"player_id": "P013", "name": "Christopher Nkunku", "jersey": 18, "role": "ST", "starter": False, "base_mins": 22},
    {"player_id": "P014", "name": "Roméo Lavia", "jersey": 45, "role": "DM", "starter": False, "base_mins": 18},
    {"player_id": "P015", "name": "João Félix", "jersey": 14, "role": "AM", "starter": False, "base_mins": 20},
    {"player_id": "P016", "name": "Axel Disasi", "jersey": 2, "role": "CB", "starter": False, "base_mins": 14},
    {"player_id": "P017", "name": "Mykhailo Mudryk", "jersey": 10, "role": "LW", "starter": False, "base_mins": 18},
    {"player_id": "P018", "name": "Renato Veiga", "jersey": 40, "role": "LB", "starter": False, "base_mins": 16},
]

# Key opponent players
OPPONENT_STARS = {
    "Manchester City": [
        {"player_id": "P101", "name": "Erling Haaland", "jersey": 9, "role": "ST", "minutes": 90, "base_shots": 5, "passes": 18},
        {"player_id": "P102", "name": "Mateo Kovačić", "jersey": 8, "role": "CM", "minutes": 90, "base_shots": 2, "passes": 72},
        {"player_id": "P103", "name": "Kevin De Bruyne", "jersey": 17, "role": "AM", "minutes": 88, "base_shots": 3, "passes": 58},
        {"player_id": "P104", "name": "Bernardo Silva", "jersey": 20, "role": "RW", "minutes": 90, "base_shots": 2, "passes": 64},
        {"player_id": "P105", "name": "Rúben Dias", "jersey": 3, "role": "CB", "minutes": 90, "base_shots": 0, "passes": 85},
    ],
    "Wolverhampton Wanderers": [
        {"player_id": "P106", "name": "Matheus Cunha", "jersey": 10, "role": "AM", "minutes": 90, "base_shots": 4, "passes": 34},
        {"player_id": "P107", "name": "Jørgen Strand Larsen", "jersey": 9, "role": "ST", "minutes": 82, "base_shots": 3, "passes": 16},
        {"player_id": "P108", "name": "Mario Lemina", "jersey": 5, "role": "DM", "minutes": 90, "base_shots": 1, "passes": 48},
        {"player_id": "P109", "name": "Rayan Aït-Nouri", "jersey": 3, "role": "LB", "minutes": 90, "base_shots": 1, "passes": 42},
    ],
    "Crystal Palace": [
        {"player_id": "P110", "name": "Eberechi Eze", "jersey": 10, "role": "AM", "minutes": 90, "base_shots": 5, "passes": 44},
        {"player_id": "P111", "name": "Jean-Philippe Mateta", "jersey": 14, "role": "ST", "minutes": 85, "base_shots": 3, "passes": 19},
        {"player_id": "P112", "name": "Adam Wharton", "jersey": 20, "role": "CM", "minutes": 90, "base_shots": 1, "passes": 61},
        {"player_id": "P113", "name": "Marc Guéhi", "jersey": 6, "role": "CB", "minutes": 90, "base_shots": 0, "passes": 68},
    ],
    "Bournemouth": [
        {"player_id": "P114", "name": "Antoine Semenyo", "jersey": 24, "role": "RW", "minutes": 90, "base_shots": 4, "passes": 31},
        {"player_id": "P115", "name": "Evanilson", "jersey": 9, "role": "ST", "minutes": 78, "base_shots": 3, "passes": 15},
        {"player_id": "P116", "name": "Marcus Tavernier", "jersey": 16, "role": "LW", "minutes": 84, "base_shots": 2, "passes": 37},
        {"player_id": "P117", "name": "Lewis Cook", "jersey": 4, "role": "CM", "minutes": 90, "base_shots": 1, "passes": 52},
    ],
    "West Ham United": [
        {"player_id": "P118", "name": "Jarrod Bowen", "jersey": 20, "role": "RW", "minutes": 90, "base_shots": 3, "passes": 32},
        {"player_id": "P119", "name": "Mohammed Kudus", "jersey": 14, "role": "LW", "minutes": 90, "base_shots": 4, "passes": 28},
        {"player_id": "P120", "name": "Lucas Paquetá", "jersey": 10, "role": "AM", "minutes": 82, "base_shots": 2, "passes": 46},
        {"player_id": "P121", "name": "Edson Álvarez", "jersey": 19, "role": "DM", "minutes": 75, "base_shots": 0, "passes": 41},
    ],
    "Brighton": [
        {"player_id": "P122", "name": "Danny Welbeck", "jersey": 18, "role": "ST", "minutes": 90, "base_shots": 3, "passes": 22},
        {"player_id": "P123", "name": "Georginio Rutter", "jersey": 14, "role": "AM", "minutes": 80, "base_shots": 3, "passes": 35},
        {"player_id": "P124", "name": "Carlos Baleba", "jersey": 20, "role": "DM", "minutes": 90, "base_shots": 2, "passes": 59},
        {"player_id": "P125", "name": "Kaoru Mitoma", "jersey": 22, "role": "LW", "minutes": 90, "base_shots": 3, "passes": 38},
        {"player_id": "P126", "name": "Lewis Dunk", "jersey": 5, "role": "CB", "minutes": 90, "base_shots": 1, "passes": 74},
    ],
    "Nottingham Forest": [
        {"player_id": "P127", "name": "Chris Wood", "jersey": 11, "role": "ST", "minutes": 90, "base_shots": 3, "passes": 17},
        {"player_id": "P128", "name": "Morgan Gibbs-White", "jersey": 10, "role": "AM", "minutes": 88, "base_shots": 3, "passes": 45},
        {"player_id": "P129", "name": "Callum Hudson-Odoi", "jersey": 14, "role": "LW", "minutes": 78, "base_shots": 2, "passes": 30},
        {"player_id": "P130", "name": "Murillo", "jersey": 40, "role": "CB", "minutes": 90, "base_shots": 0, "passes": 52},
    ],
    "Liverpool": [
        {"player_id": "P131", "name": "Mohamed Salah", "jersey": 11, "role": "RW", "minutes": 90, "base_shots": 4, "passes": 36},
        {"player_id": "P132", "name": "Curtis Jones", "jersey": 17, "role": "CM", "minutes": 85, "base_shots": 2, "passes": 54},
        {"player_id": "P133", "name": "Cody Gakpo", "jersey": 18, "role": "LW", "minutes": 76, "base_shots": 3, "passes": 28},
        {"player_id": "P134", "name": "Ryan Gravenberch", "jersey": 38, "role": "DM", "minutes": 90, "base_shots": 1, "passes": 68},
        {"player_id": "P135", "name": "Virgil van Dijk", "jersey": 4, "role": "CB", "minutes": 90, "base_shots": 1, "passes": 79},
    ],
}


def generate_rows():
    rows = []
    rng = random.Random(42)

    for m in MATCHES:
        mid = m["match_id"]
        opp = m["opponent"]
        c_goals_map = m.get("chelsea_goals", {})
        c_assists_map = m.get("chelsea_assists", {})
        opp_goals_map = m.get("opp_goals", {})

        # Chelsea players
        for p in CHELSEA_ROSTER:
            pname = p["name"]
            pid = p["player_id"]
            role = p["role"]
            is_starter = p["starter"]

            # Minutes played
            if is_starter:
                mins = p["base_mins"] if role == "GK" else rng.randint(68, 90)
            else:
                # Sub comes on for ~15-30 mins or sometimes not used
                mins = rng.randint(12, 32) if rng.random() > 0.15 else 0

            if mins == 0:
                continue

            # Goals & Assists for this specific match
            goals = c_goals_map.get(pname, 0)
            assists = c_assists_map.get(pname, 0)

            # Shots
            if role == "GK":
                shots = 0
                xg = 0.0
            elif role == "CB":
                shots = max(goals, 1 if rng.random() < 0.25 else 0)
                xg = round(goals * 0.45 + (0.06 if shots > goals else 0.0), 2)
            elif role in ("LB", "RB"):
                shots = max(goals, rng.randint(0, 2))
                xg = round(goals * 0.45 + shots * 0.06, 2)
            elif role == "DM":
                shots = max(goals, rng.randint(0, 2))
                xg = round(goals * 0.40 + shots * 0.07, 2)
            elif role in ("CM", "AM"):
                shots = max(goals, rng.randint(1, 4))
                if pname == "Cole Palmer" and mid == "M1006":
                    shots = 7
                    xg = 2.14
                else:
                    xg = round(goals * 0.42 + shots * 0.12, 2)
            else:  # RW, LW, ST
                shots = max(goals, rng.randint(2, 5))
                if pname == "Noni Madueke" and mid == "M1002":
                    shots = 6
                    xg = 1.62
                else:
                    xg = round(goals * 0.38 + shots * 0.14, 2)

            # Passes completed
            ratio = mins / 90.0
            if role == "GK":
                passes = int(rng.randint(24, 38) * ratio)
            elif role == "CB":
                passes = int(rng.randint(65, 88) * ratio)
            elif role in ("LB", "RB"):
                passes = int(rng.randint(48, 70) * ratio)
            elif role == "DM":
                passes = int(rng.randint(62, 85) * ratio)
            elif role == "CM":
                passes = int(rng.randint(58, 80) * ratio)
            elif role == "AM":
                passes = int(rng.randint(42, 65) * ratio)
            else:
                passes = int(rng.randint(20, 38) * ratio)

            # Tackles & Interceptions
            if role == "GK":
                tackles = 0
                interceptions = 0
            elif role == "DM":
                tackles = max(1, int(rng.randint(3, 7) * ratio))
                interceptions = max(1, int(rng.randint(2, 5) * ratio))
            elif role in ("LB", "RB", "CB"):
                tackles = max(1, int(rng.randint(2, 5) * ratio))
                interceptions = max(1, int(rng.randint(1, 4) * ratio))
            elif role in ("CM", "AM"):
                tackles = int(rng.randint(1, 4) * ratio)
                interceptions = int(rng.randint(1, 3) * ratio)
            else:
                tackles = int(rng.randint(0, 2) * ratio)
                interceptions = int(rng.randint(0, 2) * ratio)

            # Cards
            yc = 1 if rng.random() < 0.14 else 0
            rc = 0

            rows.append({
                "match_id": mid,
                "player_id": pid,
                "player_name": pname,
                "jersey_number": p["jersey"],
                "team": "Chelsea",
                "opponent": opp,
                "position": role,
                "minutes": mins,
                "goals": goals,
                "assists": assists,
                "shots": shots,
                "xG": xg,
                "passes_completed": passes,
                "tackles": tackles,
                "interceptions": interceptions,
                "yellow_cards": yc,
                "red_cards": rc,
            })

        # Opponent key players
        for opp_p in OPPONENT_STARS.get(opp, []):
            opname = opp_p["name"]
            op_goals = opp_goals_map.get(opname, 0)
            op_shots = max(op_goals, opp_p.get("base_shots", 2))
            op_xg = round(op_goals * 0.52 + op_shots * 0.11, 2)
            rows.append({
                "match_id": mid,
                "player_id": opp_p["player_id"],
                "player_name": opname,
                "jersey_number": opp_p["jersey"],
                "team": opp,
                "opponent": "Chelsea",
                "position": opp_p["role"],
                "minutes": opp_p["minutes"],
                "goals": op_goals,
                "assists": 1 if (op_goals > 0 and rng.random() > 0.5) else 0,
                "shots": op_shots,
                "xG": op_xg,
                "passes_completed": opp_p["passes"],
                "tackles": rng.randint(1, 4),
                "interceptions": rng.randint(0, 3),
                "yellow_cards": 1 if rng.random() < 0.18 else 0,
                "red_cards": 0,
            })

    return rows


def main():
    rows = generate_rows()
    fieldnames = [
        "match_id",
        "player_id",
        "player_name",
        "jersey_number",
        "team",
        "opponent",
        "position",
        "minutes",
        "goals",
        "assists",
        "shots",
        "xG",
        "passes_completed",
        "tackles",
        "interceptions",
        "yellow_cards",
        "red_cards",
    ]

    # Write player.csv in project root
    p_path = Path("player.csv")
    with open(p_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Generated {p_path} with {len(rows)} player records across {len(MATCHES)} matches.")

    # Write players.csv in project root for convenience
    ps_path = Path("players.csv")
    with open(ps_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Generated {ps_path} with {len(rows)} player records.")


if __name__ == "__main__":
    main()
