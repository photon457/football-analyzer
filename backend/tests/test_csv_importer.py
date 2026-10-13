import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.api.main import app, db
from backend.analysis.validation.csv_importer import (
    parse_player_stats_csv,
    normalize_team_name,
    find_fixture_match,
    load_fixture_schedule,
)


@pytest.fixture(autouse=True)
def clean_db_for_test(tmp_path):
    test_db_path = tmp_path / "test_csv.db"
    db.db_path = test_db_path
    db._init_local_db()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_team_normalization():
    assert normalize_team_name("tottenham") == "Tottenham Hotspur"
    assert normalize_team_name("Tottenham Hotspur") == "Tottenham Hotspur"
    assert normalize_team_name("newcastle") == "Newcastle United"
    assert normalize_team_name("chelsea") == "Chelsea"
    assert normalize_team_name("Arsenal") == "Arsenal"


def test_fixture_schedule_loading():
    fixtures = load_fixture_schedule()
    assert len(fixtures) == 380
    f1 = fixtures[0]
    assert f1["matchweek"] == 1
    assert f1["home_team"] == "Arsenal"
    assert f1["away_team"] == "Wolverhampton Wanderers"


def test_find_fixture_match():
    fixtures = load_fixture_schedule()
    match = find_fixture_match("Arsenal", "Chelsea", fixtures)
    assert match is not None
    assert match["matchweek"] in [15, 34]


def test_parse_player_stats_csv_sample():
    csv_path = Path("football_player_match_stats_sample.csv")
    payloads = parse_player_stats_csv(str(csv_path), focus_team="Chelsea")
    assert len(payloads) == 8

    # Match M1001 should be Chelsea vs Arsenal
    m1001 = next(p for p in payloads if p.match.match_id == "M1001")
    assert m1001.match.team == "Chelsea"
    assert m1001.match.opponent == "Arsenal"
    assert m1001.match.score_team == 1
    assert m1001.match.score_opponent == 2
    assert m1001.match.result == "L"
    assert m1001.match.competition == "Premier League"
    assert len(m1001.players) == 2

    # Player stats check
    p4 = next(p for p in m1001.players if p.player_id == "P004")
    assert p4.goals == 1
    assert p4.shots_total == 4
    assert p4.primary_position == "FW"


def test_api_import_csv_endpoint(client):
    csv_text = """match_id,player_id,team,opponent,position,minutes,goals,assists,shots,xG,passes_completed,tackles,interceptions,yellow_cards,red_cards
M9999,P901,Chelsea,Arsenal,ST,90,2,0,5,1.20,25,1,0,0,0
M9999,P902,Chelsea,Arsenal,CM,90,0,1,1,0.15,60,3,2,0,0
M9999,P903,Arsenal,Chelsea,LW,90,1,0,3,0.60,30,2,1,1,0
"""
    res = client.post("/api/matches/import/csv", json={"csv_content": csv_text, "focus_team": "Chelsea"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["count"] == 1
    assert data["matches"][0]["match_id"] == "M9999"
    assert data["matches"][0]["score"] == "2-1"


def test_api_fixtures_endpoint(client):
    res = client.get("/api/fixtures", params={"team": "Chelsea"})
    assert res.status_code == 200
    fixtures = res.json()
    assert len(fixtures) == 38
    assert all("status" in f for f in fixtures)


def test_api_database_reset_endpoint(client):
    res = client.post("/api/database/reset", json={"import_sample_csv": True, "focus_team": "Chelsea"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["fixtures_count"] == 380
    assert data["imported_matches_count"] == 8
