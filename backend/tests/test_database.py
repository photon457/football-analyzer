import json
import pytest
from pathlib import Path
from backend.analysis.validation import validate_match_data
from backend.database import DatabaseService


@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "test_football.db"
    return DatabaseService(db_path=db_file)


@pytest.fixture
def sample_matches():
    matches = []
    for filename in [
        "match_01_chelsea_vs_brighton.json",
        "match_02_chelsea_vs_forest.json",
        "match_03_liverpool_vs_chelsea.json",
    ]:
        path = Path("data/samples") / filename
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        val = validate_match_data(data)
        assert val.is_valid
        matches.append(val.payload)
    return matches


def test_transactional_insert_match(temp_db, sample_matches):
    """Test that a match payload is saved transactionally with all relations."""
    payload = sample_matches[0]
    success, msg = temp_db.save_match(payload)
    assert success, f"Failed to save match: {msg}"

    # Verify match retrieved
    retrieved = temp_db.get_match(payload.match.match_id)
    assert retrieved is not None
    assert retrieved["match"]["id"] == payload.match.match_id
    assert retrieved["match"]["opponent"] == "Brighton & Hove Albion"
    assert retrieved["match"]["score_team"] == 4
    assert retrieved["match"]["score_opponent"] == 2
    assert len(retrieved["players"]) >= 11
    assert len(retrieved["events"]) > 0

    # Verify team stats
    assert retrieved["team_stats"]["shots"] == 15
    assert retrieved["team_stats"]["possession_pct"] == 53.4

    # Verify player metrics were stored and mapped
    palmer = next(p for p in retrieved["players"] if p["player_id"] == "p_cole_palmer")
    assert palmer["goals"] == 4
    assert palmer["metrics"]["goals"] == 4
    assert palmer["metrics"]["goals_per_90"] == 4.0


def test_duplicate_match_rejection(temp_db, sample_matches):
    """Saving the same match twice must reject the second attempt without duplicating data."""
    payload = sample_matches[0]
    success1, msg1 = temp_db.save_match(payload)
    assert success1

    # Second attempt
    success2, msg2 = temp_db.save_match(payload)
    assert not success2
    assert "already exists" in msg2

    # Check match count is still 1
    matches = temp_db.list_matches()
    assert len(matches) == 1


def test_player_continuity_across_matches(temp_db, sample_matches):
    """Verify that multiple matches update player records and provide accurate historical timelines."""
    for payload in sample_matches:
        success, msg = temp_db.save_match(payload)
        assert success, f"Failed to save {payload.match.match_id}: {msg}"

    matches = temp_db.list_matches()
    assert len(matches) == 3

    # Check Cole Palmer history across all 3 matches
    palmer_history = temp_db.get_player_match_history("p_cole_palmer")
    assert len(palmer_history) == 3
    # Check match dates in chronological order
    dates = [m["date"] for m in palmer_history]
    assert dates == sorted(dates)
    # Check goals recorded per match: match 1 = 4, match 2 = 0, match 3 = 0
    goals = [m["metrics"].get("goals", 0) for m in palmer_history]
    assert goals == [4, 0, 0]


def test_all_players_query(temp_db, sample_matches):
    """All registered players can be listed with their latest information."""
    temp_db.save_match(sample_matches[0])
    players = temp_db.get_all_players()
    assert len(players) >= 15
    player_ids = [p["id"] for p in players]
    assert "p_robert_sanchez" in player_ids
    assert "p_cole_palmer" in player_ids
    assert "p_moises_caicedo" in player_ids
