import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.api.main import app, db


@pytest.fixture(autouse=True)
def clean_db_for_test(tmp_path):
    """Ensure tests run against a fresh isolated SQLite database."""
    test_db_path = tmp_path / "test_api.db"
    db.db_path = test_db_path
    db._init_local_db()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_match_data():
    path = Path("data/samples/match_01_chelsea_vs_brighton.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def invalid_match_data():
    path = Path("data/samples/match_invalid_sample.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_import_invalid_match(client, invalid_match_data):
    response = client.post("/api/matches/import", json=invalid_match_data)
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert "errors" in data["detail"]
    assert len(data["detail"]["errors"]) > 0


def test_import_valid_match_and_duplicate_handling(client, sample_match_data):
    # 1. First import should succeed with 201
    resp1 = client.post("/api/matches/import", json=sample_match_data)
    assert resp1.status_code == 201
    data1 = resp1.json()
    assert data1["status"] == "success"
    assert data1["match_id"] == "match_20240928_che_bha"

    # 2. Duplicate import should be rejected with 409
    resp2 = client.post("/api/matches/import", json=sample_match_data)
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"]


def test_match_list_and_analysis_endpoint(client, sample_match_data):
    # Import match
    client.post("/api/matches/import", json=sample_match_data)

    # List matches
    matches_resp = client.get("/api/matches")
    assert matches_resp.status_code == 200
    matches = matches_resp.json()
    assert len(matches) == 1
    assert matches[0]["id"] == "match_20240928_che_bha"

    # Get analysis
    analysis_resp = client.get("/api/analysis/match_20240928_che_bha")
    assert analysis_resp.status_code == 200
    analysis = analysis_resp.json()
    assert analysis["match_id"] == "match_20240928_che_bha"
    assert analysis["team_summary"]["score_differential"] == 2
    assert analysis["team_summary"]["pass_accuracy_pct"] == 85.5
    assert len(analysis["players"]) >= 11

    # Check Palmer analytics
    palmer = next(p for p in analysis["players"] if p["player_id"] == "p_cole_palmer")
    assert palmer["goals"] == 4
    assert palmer["per_90"]["goals_per_90"] == 4.0
    assert "radar_profile" in palmer
    assert palmer["radar_profile"]["Attacking"] > 50.0


def test_player_history_endpoint(client, sample_match_data):
    # Import match
    client.post("/api/matches/import", json=sample_match_data)

    resp = client.get("/api/analysis/player/p_cole_palmer/history")
    assert resp.status_code == 200
    history = resp.json()
    assert history["total_matches"] == 1
    assert history["totals"]["goals"] == 4
    assert len(history["timeline"]) == 1


def test_get_all_players(client, sample_match_data):
    # Import match
    client.post("/api/matches/import", json=sample_match_data)

    resp = client.get("/api/players")
    assert resp.status_code == 200
    players = resp.json()
    assert len(players) > 0
    assert any(p["name"] == "Cole Palmer" for p in players)


def test_record_fixture_match_endpoint(client):
    fixtures_resp = client.get("/api/fixtures?team=Chelsea")
    assert fixtures_resp.status_code == 200
    fixtures = fixtures_resp.json()
    assert len(fixtures) > 0
    target_fixture = fixtures[0]
    fid = target_fixture["fixture_id"]

    # Record match for this fixture
    rec_resp = client.post(f"/api/fixtures/{fid}/record-match", json={
        "score_home": 2,
        "score_away": 1,
        "possession_pct": 58.0,
        "focus_team": "Chelsea"
    })
    assert rec_resp.status_code == 201
    rec_data = rec_resp.json()
    assert rec_data["status"] == "success"
    assert rec_data["fixture_id"] == fid
    match_id = rec_data["match_id"]

    # Verify analysis is available for this match
    analysis_resp = client.get(f"/api/analysis/{match_id}")
    assert analysis_resp.status_code == 200
    analysis = analysis_resp.json()
    assert analysis["match_id"] == match_id
    assert len(analysis["players"]) == 15
    assert len(analysis["events"]) > 20
