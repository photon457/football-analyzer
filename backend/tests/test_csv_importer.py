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

    # Match 1 should be Chelsea vs Manchester City
    m1 = next(p for p in payloads if p.match.match_id == "match_20240818_che_mci")
    assert m1.match.team == "Chelsea"
    assert m1.match.opponent == "Manchester City"
    assert m1.match.score_team == 0
    assert m1.match.score_opponent == 2
    assert m1.match.result == "L"
    assert m1.match.competition == "Premier League"
    assert len(m1.players) == 18

    # Player stats check
    palmer = next(p for p in m1.players if p.player_id == "p_cole_palmer")
    assert palmer.jersey_number == 20
    assert palmer.primary_position == "MF"


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
    assert data["imported_matches_count"] in [5, 8]


def test_fixture_template_csv_endpoint(client):
    db.seed_fixtures_from_csv()
    # Test blank template
    res = client.get("/api/fixtures/6/template-csv")
    assert res.status_code == 200
    data = res.json()
    assert "csv_content" in data
    assert "p_cole_palmer" in data["csv_content"]
    assert "Robert Sánchez" in data["csv_content"]

    # Test sample pre-filled template
    res_sample = client.get("/api/fixtures/6/template-csv?sample=true")
    assert res_sample.status_code == 200
    sample_data = res_sample.json()
    assert "match_id" in sample_data["csv_content"]


def test_record_fixture_with_csv(client):
    db.seed_fixtures_from_csv()
    template_res = client.get("/api/fixtures/6/template-csv?sample=true")
    csv_text = template_res.json()["csv_content"]

    # Post CSV to record the upcoming fixture
    rec_res = client.post("/api/fixtures/6/record-match", json={
        "csv_content": csv_text,
        "focus_team": "Chelsea"
    })
    assert rec_res.status_code == 201
    rec_data = rec_res.json()
    assert rec_data["status"] == "success"
    assert "match_id" in rec_data
    assert rec_data["fixture_id"] == 6

    # Verify fixture status is now played
    fix = db.get_fixture(6)
    assert fix["status"] == "played"
    assert fix["match_id"] == rec_data["match_id"]
