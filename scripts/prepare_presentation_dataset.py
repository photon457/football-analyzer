import sys
import csv
import json
import sqlite3
from pathlib import Path

# Add project root
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from backend.database.service import DatabaseService

# 1. Canonical Mapping Definitions
PLAYER_ID_MAP = {
    "P001": "p_robert_sanchez",
    "P002": "p_malo_gusto",
    "P003": "p_wesley_fofana",
    "P004": "p_levi_colwill",
    "P005": "p_marc_cucurella",
    "P006": "p_moises_caicedo",
    "P007": "p_enzo_fernandez",
    "P008": "p_cole_palmer",
    "P009": "p_noni_madueke",
    "P010": "p_jadon_sancho",
    "P011": "p_nicolas_jackson",
    "P012": "p_pedro_neto",
    "P013": "p_christopher_nkunku",
    "P014": "p_romeo_lavia",
    "P015": "p_joao_felix",
    "P016": "p_axel_disasi",
    "P017": "p_mykhailo_mudryk",
    "P018": "p_renato_veiga",
    # Opponents
    "P101": "p_erling_haaland",
    "P102": "p_mateo_kovacic",
    "P103": "p_kevin_de_bruyne",
    "P104": "p_bernardo_silva",
    "P105": "p_ruben_dias",
    "P106": "p_matheus_cunha",
    "P107": "p_jorgen_strand_larsen",
    "P108": "p_mario_lemina",
    "P109": "p_rayan_ait_nouri",
    "P110": "p_eberechi_eze",
    "P111": "p_jean_philippe_mateta",
    "P112": "p_adam_wharton",
    "P113": "p_marc_guehi",
    "P114": "p_antoine_semenyo",
    "P115": "p_evanilson",
    "P116": "p_marcus_tavernier",
    "P117": "p_lewis_cook",
    "P118": "p_jarrod_bowen",
    "P119": "p_mohammed_kudus",
    "P120": "p_lucas_paqueta",
    "P121": "p_edson_alvarez",
    "P122": "p_danny_welbeck",
    "P123": "p_georginio_rutter",
    "P124": "p_carlos_baleba",
    "P125": "p_kaoru_mitoma",
    "P126": "p_lewis_dunk",
    "P127": "p_chris_wood",
    "P128": "p_morgan_gibbs_white",
    "P129": "p_callum_hudson_odoi",
    "P130": "p_murillo",
    "P131": "p_mohamed_salah",
    "P132": "p_curtis_jones",
    "P133": "p_cody_gakpo",
    "P134": "p_ryan_gravenberch",
    "P135": "p_virgil_van_dijk",
}

MATCH_ID_MAP = {
    "M1001": "match_20240818_che_mci",
    "M1002": "match_20240825_wol_che",
    "M1003": "match_20240901_che_cry",
    "M1004": "match_20240914_bou_che",
    "M1005": "match_20240921_whu_che",
    "M1006": "match_20240928_che_bha",
    "M1007": "match_20241006_che_nfo",
    "M1008": "match_20241020_liv_che",
}

def generate_canonical_csvs():
    input_csv = root / "players.csv"
    with open(input_csv, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    updated_rows = []
    for r in rows:
        item = dict(r)
        item["match_id"] = MATCH_ID_MAP.get(item["match_id"], item["match_id"])
        item["player_id"] = PLAYER_ID_MAP.get(item["player_id"], item["player_id"])
        updated_rows.append(item)

    fieldnames = list(updated_rows[0].keys())

    # Write to players.csv
    with open(root / "players.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)
    print(f"Updated {root / 'players.csv'} ({len(updated_rows)} rows)")

    # Write identical canonical dataset to football_player_match_stats_sample.csv
    with open(root / "football_player_match_stats_sample.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)
    print(f"Updated {root / 'football_player_match_stats_sample.csv'} ({len(updated_rows)} rows)")

def seed_database(db_path: Path):
    print(f"\n--- Seeding Database: {db_path} ---")
    if db_path.exists():
        db_path.unlink()

    db = DatabaseService(db_path)
    db.reset_database(seed_fixtures=True)

    # Import the 5 additional league fixtures from canonical CSV
    sample_csv = root / "football_player_match_stats_sample.csv"
    imported = db.import_csv_matches(str(sample_csv), focus_team="Chelsea")
    print(f"Imported CSV matches: {len(imported)}")

    # Ensure fixture links are fully synchronized
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        # Direct fixture updates for the 8 Chelsea matches
        fixture_links = [
            (17, "match_20240818_che_mci"),
            (78, "match_20240825_wol_che"),
            (50, "match_20240901_che_cry"),
            (69, "match_20240914_bou_che"),
            (174, "match_20240921_whu_che"),
            (60, "match_20240928_che_bha"),
            (96, "match_20241006_che_nfo"),
            (114, "match_20241020_liv_che"),
        ]
        for fix_id, m_id in fixture_links:
            cursor.execute("UPDATE fixtures SET match_id = ? WHERE fixture_id = ?", (m_id, fix_id))
        conn.commit()

        # Stats verify
        cursor.execute("SELECT COUNT(*) FROM players")
        player_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM matches")
        match_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM match_events")
        event_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM fixtures WHERE match_id IS NOT NULL")
        played_fixtures = cursor.fetchone()[0]

        print(f"Summary for {db_path.name}:")
        print(f"  Players registered: {player_count}")
        print(f"  Matches stored: {match_count}")
        print(f"  Tactical events: {event_count}")
        print(f"  Played fixtures linked: {played_fixtures}")

if __name__ == "__main__":
    generate_canonical_csvs()
    # 1. Seed workspace database
    workspace_db = root / "data" / "football_analyzer.db"
    seed_database(workspace_db)

    # 2. Seed AppData database if present
    import os
    appdata = os.environ.get("APPDATA")
    if appdata:
        appdata_db = Path(appdata) / "football-analyzer" / "data" / "football_analyzer.db"
        if appdata_db.parent.exists():
            seed_database(appdata_db)
