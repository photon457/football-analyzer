"""
Tests for Opponent Tactical Scouting & Performance Service.
"""

import pytest
from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)


def test_list_opponents():
    response = client.get("/api/opponents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 19
    names = [c["name"] for c in data]
    assert "Manchester City" in names
    assert "Arsenal" in names
    assert "Liverpool" in names
    assert "Manchester United" in names


def test_get_opponent_team_sheet_csv():
    response = client.get("/api/opponents/Manchester%20City/team-sheet-csv")
    assert response.status_code == 200
    data = response.json()
    assert data["team"] == "Manchester City"
    assert "manchester_city_team_sheet_2024_25.csv" in data["filename"]
    assert "csv_content" in data
    assert "Erling Haaland" in data["csv_content"]
    assert len(data["players"]) == 15


def test_opponent_performance_till_date_filtering():
    # As of September 28: 6 games
    r_sep = client.get("/api/opponents/Manchester%20City/performance?as_of_date=2024-09-28")
    assert r_sep.status_code == 200
    d_sep = r_sep.json()
    assert d_sep["record"]["played"] == 6
    assert d_sep["record"]["points"] == 14
    assert len(d_sep["form_timeline"]) == 6

    # As of October 26: 9 games
    r_oct = client.get("/api/opponents/Manchester%20City/performance?as_of_date=2024-10-26")
    assert r_oct.status_code == 200
    d_oct = r_oct.json()
    assert d_oct["record"]["played"] == 9
    assert d_oct["record"]["points"] == 23

    # Check tactical profile and radar
    assert "tactical_profile" in d_oct
    assert d_oct["tactical_profile"]["formation"] == "4-3-3 Holding"
    assert "radar" in d_oct
    assert "Attacking" in d_oct["radar"]
    assert d_oct["top_performers"]["top_scorer"]["name"] == "Erling Haaland"
