from pathlib import Path
from backend.analysis.validation.csv_importer import parse_player_stats_csv
from backend.database.service import DatabaseService

def test():
    csv_file = Path("player.csv")
    assert csv_file.exists(), "player.csv does not exist"
    
    payloads = parse_player_stats_csv(str(csv_file), focus_team="Chelsea")
    print(f"Successfully parsed {len(payloads)} MatchDataPayload objects from player.csv!")
    
    for p in payloads:
        print(f"  Match {p.match.match_id}: {p.match.team} {p.match.score_team} - {p.match.score_opponent} {p.match.opponent} | Players: {len(p.players)} | Events: {len(p.events)}")
        # Check first player
        first_p = p.players[0]
        assert first_p.player_name != f"Player {first_p.player_id}", f"Expected real name, got {first_p.player_name}"

    # Test saving to a temporary test db
    test_db = DatabaseService(db_path=Path("scratch/test_player_import.db"))
    test_db.reset_database(seed_fixtures=False)
    imported = test_db.import_csv_matches(str(csv_file), focus_team="Chelsea")
    print(f"Successfully imported {len(imported)} matches into database!")
    
    # Check squad
    squad_players = test_db.get_all_players()
    print(f"Total registered squad players in database: {len(squad_players)}")
    for sp in squad_players[:5]:
        print(f"    - #{sp['squad_number']} {sp['name']} ({sp['primary_position']})")

if __name__ == "__main__":
    test()
