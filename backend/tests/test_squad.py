import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.api.main import app, db
from backend.analysis.player.season import aggregate_player_season, LOW_SAMPLE_MINUTES

SAMPLES = [
    "data/samples/match_01_chelsea_vs_brighton.json",
    "data/samples/match_02_chelsea_vs_forest.json",
]


@pytest.fixture(autouse=True)
def clean_db_for_test(tmp_path):
    db.db_path = tmp_path / "test_squad.db"
    db._init_local_db()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def _load(path):
    with open(Path(path), "r", encoding="utf-8") as f:
        return json.load(f)


def _appearance(match_id, date, minutes, metrics, starter=True):
    return {
        "player_id": "p1", "position": "CM", "minutes_played": minutes, "is_starter": starter,
        "match_id": match_id, "date": date, "team": "T", "opponent": "O", "competition": "C",
        "home_away": "home", "result": "W", "score_team": 1, "score_opponent": 0,
        "metrics": metrics,
    }


def test_squad_empty_database(client):
    resp = client.get("/api/squad")
    assert resp.status_code == 200
    data = resp.json()
    assert data["season"] is None
    assert data["players"] == []
    assert data["record"]["played"] == 0


def test_squad_unknown_season_returns_404(client):
    client.post("/api/matches/import", json=_load(SAMPLES[0]))
    resp = client.get("/api/squad", params={"season": "1999-2000"})
    assert resp.status_code == 404


def test_squad_season_aggregates_across_matches(client):
    payloads = [_load(p) for p in SAMPLES]
    for p in payloads:
        assert client.post("/api/matches/import", json=p).status_code == 201

    resp = client.get("/api/squad")
    assert resp.status_code == 200
    data = resp.json()
    assert data["season"] == payloads[0]["match"]["season"]
    assert data["record"]["played"] == 2

    palmer = next(p for p in data["players"] if p["player_id"] == "p_cole_palmer")
    expected_goals = sum(
        pl["goals"] for p in payloads for pl in p["players"] if pl["player_id"] == "p_cole_palmer"
    )
    expected_minutes = sum(
        pl["minutes_played"] for p in payloads for pl in p["players"] if pl["player_id"] == "p_cole_palmer"
    )
    assert palmer["totals"]["goals"] == expected_goals
    assert palmer["minutes"] == expected_minutes
    assert len(palmer["match_log"]) == palmer["appearances"]
    dates = [m["date"] for m in palmer["match_log"]]
    assert dates == sorted(dates)

    # Players are grouped GK -> DF -> MF -> FW
    order = {"GK": 0, "DF": 1, "MF": 2, "FW": 3}
    positions = [order[p["primary_position"]] for p in data["players"]]
    assert positions == sorted(positions)


def test_rates_are_volume_weighted_not_averaged():
    player = {"id": "p1", "name": "Test", "primary_position": "MF"}
    apps = [
        _appearance("m1", "2024-01-01", 90, {"passes_attempted": 10, "passes_completed": 10}),
        _appearance("m2", "2024-01-08", 90, {"passes_attempted": 90, "passes_completed": 45}),
    ]
    result = aggregate_player_season(player, apps)
    # 55 / 100 = 55%, not the mean of 100% and 50% (75%)
    assert result["rates"]["pass_accuracy_pct"] == 55.0


def test_zero_minutes_and_missing_metrics():
    player = {"id": "p1", "name": "Test", "primary_position": "DF"}
    result = aggregate_player_season(player, [])
    assert result["appearances"] == 0
    assert result["minutes"] == 0
    assert result["per_90"]["goals"] == 0.0
    assert result["rates"]["pass_accuracy_pct"] is None
    assert result["low_sample"] is True
    assert result["goalkeeping"] is None


def test_per_90_and_low_sample_flag():
    player = {"id": "p1", "name": "Test", "primary_position": "FW"}
    apps = [
        _appearance("m1", "2024-01-01", 45, {"goals": 1}, starter=False),
        _appearance("m2", "2024-01-08", 90, {"goals": 2}),
    ]
    result = aggregate_player_season(player, apps)
    assert result["per_90"]["goals"] == 2.0  # 3 goals / 135 min * 90
    assert result["starts"] == 1
    assert result["low_sample"] is (135 < LOW_SAMPLE_MINUTES)


def test_goalkeeper_save_pct():
    player = {"id": "gk", "name": "Keeper", "primary_position": "GK"}
    apps = [_appearance("m1", "2024-01-01", 90, {"saves": 3, "goals_conceded": 1})]
    result = aggregate_player_season(player, apps)
    assert result["goalkeeping"]["save_pct"] == 75.0


def test_squad_managed_team_display_and_record(client):
    # Import Chelsea matches
    for p in SAMPLES:
        assert client.post("/api/matches/import", json=_load(p)).status_code == 201

    # Verify default managed team Chelsea
    resp = client.get("/api/squad")
    assert resp.status_code == 200
    data = resp.json()
    assert data["team"] == "Chelsea"
    assert data["record"]["played"] == 2
    assert "matches" in data
    assert len(data["matches"]) == 2
    assert data["matches"][0]["points_cumulative"] > 0
    assert data["record"]["points"] >= 3
    assert data["record"]["form"] == ["W", "D"] or len(data["record"]["form"]) == 2
    assert data["team_averages"] is not None
    assert "goals_scored_per_match" in data["team_averages"]

    # Query with explicit team
    resp_arsenal = client.get("/api/squad", params={"team": "Arsenal"})
    assert resp_arsenal.status_code == 200
    data_arsenal = resp_arsenal.json()
    assert data_arsenal["team"] == "Arsenal"


