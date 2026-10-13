import json
import pytest
from pathlib import Path
from backend.analysis.validation import (
    validate_match_data,
    MatchDataPayload,
    RAW_FIELDS,
    DERIVED_METRICS,
)


SAMPLES_DIR = Path("data/samples")


def test_sample_matches_valid():
    """All 3 realistic sample matches must pass schema validation without error."""
    for filename in [
        "match_01_chelsea_vs_brighton.json",
        "match_02_chelsea_vs_forest.json",
        "match_03_liverpool_vs_chelsea.json",
    ]:
        filepath = SAMPLES_DIR / filename
        assert filepath.exists(), f"Sample file {filename} does not exist"
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        result = validate_match_data(data)
        assert result.is_valid, f"{filename} failed validation: {result.errors}"
        assert result.payload is not None
        assert result.payload.match.match_id != ""
        assert len(result.payload.players) >= 11
        # Exactly 11 starters
        starters = [p for p in result.payload.players if p.is_starter]
        assert len(starters) == 11
        # Exactly 1 GK starter
        assert sum(1 for p in starters if p.primary_position == "GK") == 1


def test_invalid_match_rejected():
    """Invalid fixture must be rejected with descriptive errors."""
    filepath = SAMPLES_DIR / "match_invalid_sample.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = validate_match_data(data)
    assert not result.is_valid
    assert len(result.errors) > 0
    # Verify errors identify multiple failures
    error_text = " ".join(result.errors)
    assert "players" in error_text or "possession_pct" in error_text or "shots" in error_text


def test_starter_count_validation():
    """Validation must fail if starters != 11."""
    filepath = SAMPLES_DIR / "match_01_chelsea_vs_brighton.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Change one starter to substitute (making 10 starters)
    data["players"][1]["is_starter"] = False
    result = validate_match_data(data)
    assert not result.is_valid
    assert any("Squad must have exactly 11 starters" in err for err in result.errors)


def test_duplicate_player_id_rejection():
    """Validation must fail if duplicate player IDs exist."""
    filepath = SAMPLES_DIR / "match_01_chelsea_vs_brighton.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Duplicate the first player's id onto the second player
    data["players"][1]["player_id"] = data["players"][0]["player_id"]
    result = validate_match_data(data)
    assert not result.is_valid
    assert any("Duplicate player_id detected" in err for err in result.errors)


def test_passes_completed_greater_than_attempted():
    """Validation must fail if completed passes exceed attempted passes."""
    filepath = SAMPLES_DIR / "match_01_chelsea_vs_brighton.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["players"][0]["passes_completed"] = 50
    data["players"][0]["passes_attempted"] = 20
    result = validate_match_data(data)
    assert not result.is_valid
    assert any("passes_completed" in err and "passes_attempted" in err for err in result.errors)


def test_spatial_coordinates_bounds():
    """Coordinates outside 0-100 must be rejected per Core-4 Rule 12."""
    filepath = SAMPLES_DIR / "match_01_chelsea_vs_brighton.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["events"][0]["x"] = 105.0  # Above 100
    result = validate_match_data(data)
    assert not result.is_valid
    assert any("x" in err for err in result.errors)


def test_spatial_unknown_player_rejection():
    """Spatial events must reference players in the squad."""
    filepath = SAMPLES_DIR / "match_01_chelsea_vs_brighton.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["events"][0]["player_id"] = "p_non_existent_player"
    result = validate_match_data(data)
    assert not result.is_valid
    assert any("references unknown player_id" in err for err in result.errors)


def test_result_score_consistency():
    """Result W/D/L must align with score_team vs score_opponent."""
    filepath = SAMPLES_DIR / "match_01_chelsea_vs_brighton.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["match"]["result"] = "L"  # Actual score is 4-2
    result = validate_match_data(data)
    assert not result.is_valid
    assert any("Result 'L' does not match scores" in err for err in result.errors)


def test_auto_derived_metrics():
    """Auto-computation of derived metrics when not explicitly provided."""
    filepath = SAMPLES_DIR / "match_01_chelsea_vs_brighton.json"
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Clear pre-calculated pass accuracy on a player
    p = data["players"][1]
    p.pop("pass_accuracy_pct", None)
    result = validate_match_data(data)
    assert result.is_valid
    player = next(x for x in result.payload.players if x.player_id == p["player_id"])
    expected_acc = round((player.passes_completed / player.passes_attempted) * 100.0, 1)
    assert player.pass_accuracy_pct == expected_acc


def test_field_dictionaries():
    """Verify raw vs derived dictionaries are populated with essential metrics."""
    assert "possession_pct" in RAW_FIELDS["team"]
    assert "goals" in RAW_FIELDS["player_attacking"]
    assert "passes_completed" in RAW_FIELDS["player_passing"]
    assert "tackles_won" in RAW_FIELDS["player_defending"]
    assert "pass_accuracy_pct" in DERIVED_METRICS
    assert "tackles_per_90" in DERIVED_METRICS
    assert "formula" in DERIVED_METRICS["pass_accuracy_pct"]
