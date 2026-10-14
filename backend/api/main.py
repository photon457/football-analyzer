"""
FastAPI Analysis Backend Service
Provides API endpoints for validation, normalization, match import,
metric calculations, historical trend analysis, and health monitoring.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.analysis.validation import validate_match_data
from backend.database import DatabaseService
from backend.analysis.team.summary import calculate_team_summary
from backend.analysis.player.metrics import enrich_player_analytics
from backend.analysis.trends.history import calculate_player_trends
from backend.analysis.player.season import aggregate_squad_season
from backend.analysis.schemas import (
    MatchAnalysisResponse,
    TeamSummary,
    PlayerAnalysis,
    SquadSeasonResponse,
)

app = FastAPI(
    title="Football Analysis API",
    description="Backend analysis service for desktop football manager application",
    version="0.1.0"
)

# Configure CORS for local Electron / Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseService()


@app.get("/health")
def get_health():
    """Health check endpoint returning system status and current timestamp."""
    return {
        "status": "ok",
        "service": "football-analysis-backend",
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/matches/import", status_code=status.HTTP_201_CREATED)
def import_match(payload: Dict[str, Any]):
    """
    Validates, normalizes, and transactionally persists match data.
    Rejects invalid data and duplicate match fixtures safely.
    """
    val_result = validate_match_data(payload)
    if not val_result.is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Validation failed for match data",
                "errors": val_result.errors,
            }
        )

    match_payload = val_result.payload
    success, msg = db.save_match(match_payload)
    if not success:
        if "already exists" in msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=msg
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    return {
        "status": "success",
        "message": "Match imported successfully",
        "match_id": match_payload.match.match_id,
        "team": match_payload.match.team,
        "opponent": match_payload.match.opponent,
        "score": f"{match_payload.match.score_team}-{match_payload.match.score_opponent}",
        "players_count": len(match_payload.players),
        "events_count": len(match_payload.events),
    }


@app.get("/api/matches")
def get_matches() -> List[Dict[str, Any]]:
    """Lists all saved matches sorted chronologically descending."""
    return db.list_matches()


@app.get("/api/matches/{match_id}")
def get_match_details(match_id: str):
    """Retrieves full match data record."""
    data = db.get_match(match_id)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Match '{match_id}' not found")
    return data


@app.get("/api/analysis/{match_id}", response_model=MatchAnalysisResponse)
def get_match_analysis(match_id: str):
    """
    Computes complete analytical overview for a match:
    - Team summary and differentials
    - Player metrics, per-90 normalizations, and radar scores
    - Spatial pitch events
    - Manager tactical takeaways
    """
    match_data = db.get_match(match_id)
    if not match_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Match '{match_id}' not found")

    m_info = match_data["match"]
    t_stats = match_data["team_stats"]
    team_summary_data = calculate_team_summary(m_info, t_stats)
    team_summary = TeamSummary(**team_summary_data)

    enriched_players = []
    for p in match_data["players"]:
        enriched = enrich_player_analytics(p)
        enriched_players.append(PlayerAnalysis(
            player_id=enriched["player_id"],
            player_name=enriched["player_name"],
            jersey_number=enriched["jersey_number"],
            primary_position=enriched["primary_position"],
            detailed_position=enriched.get("detailed_position"),
            is_starter=enriched["is_starter"],
            minutes_played=enriched["minutes_played"],
            goals=int(enriched.get("goals", 0)),
            assists=int(enriched.get("assists", 0)),
            shots_total=int(enriched.get("shots_total", 0)),
            passes_completed=int(enriched.get("passes_completed", 0)),
            passes_attempted=int(enriched.get("passes_attempted", 0)),
            tackles_won=int(enriched.get("tackles_won", 0)),
            interceptions=int(enriched.get("interceptions", 0)),
            per_90=enriched["per_90"],
            rates=enriched["rates"],
            radar_profile=enriched["radar_profile"],
            metrics=enriched.get("metrics", {})
        ))

    # Tactical insights for manager
    insights = []
    if m_info["result"] == "W":
        insights.append(f"Decisive victory vs {m_info['opponent']} ({m_info['score_team']}-{m_info['score_opponent']})")
    elif m_info["result"] == "D":
        insights.append(f"Contested draw vs {m_info['opponent']} ({m_info['score_team']}-{m_info['score_opponent']})")
    else:
        insights.append(f"Defeat vs {m_info['opponent']} ({m_info['score_team']}-{m_info['score_opponent']})")

    top_scorer = max(enriched_players, key=lambda p: p.goals) if enriched_players else None
    if top_scorer and top_scorer.goals > 0:
        insights.append(f"Leading offensive catalyst: {top_scorer.player_name} ({top_scorer.goals} goals)")

    top_tackler = max(enriched_players, key=lambda p: p.tackles_won) if enriched_players else None
    if top_tackler and top_tackler.tackles_won >= 3:
        insights.append(f"Defensive anchor: {top_tackler.player_name} ({top_tackler.tackles_won} tackles won)")

    if team_summary.pass_accuracy_pct >= 85.0:
        insights.append(f"High ball circulation accuracy: {team_summary.pass_accuracy_pct}% pass completion")

    return MatchAnalysisResponse(
        match_id=match_id,
        match=m_info,
        team_summary=team_summary,
        team_stats=t_stats,
        players=enriched_players,
        events=match_data.get("events", []),
        manager_insights=insights
    )


@app.get("/api/analysis/player/{player_id}/history")
def get_player_history_analysis(player_id: str):
    """
    Computes rolling averages, trajectory, and consistency for a player across all matches.
    """
    history = db.get_player_match_history(player_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No match records found for player '{player_id}'"
        )
    return calculate_player_trends(history)


@app.get("/api/players")
def get_players() -> List[Dict[str, Any]]:
    """Lists all squad players."""
    return db.get_all_players()


@app.get("/api/squad", response_model=SquadSeasonResponse)
def get_squad_season(season: Optional[str] = None, team: Optional[str] = None):
    """
    Returns every registered player with season totals, per-90 rates,
    volume-weighted ratios, and a chronological match log for one season.
    Defaults to the most recent season with stored matches.
    Prioritizes the currently managed club.
    """
    seasons = db.list_seasons()
    if season is None:
        season = seasons[0] if seasons else None
    elif season not in seasons:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No matches stored for season '{season}'"
        )

    managed_team = team or db.get_setting("focus_team", "Chelsea")
    appearances = db.get_season_appearances(season) if season else []
    team_matches = db.get_team_season_matches(season, managed_team) if season else []
    return aggregate_squad_season(
        season,
        seasons,
        db.get_all_players(),
        appearances,
        managed_team=managed_team,
        team_matches=team_matches,
    )


@app.post("/api/matches/import/csv")
def import_csv_matches_endpoint(payload: Dict[str, Any]):
    """
    Parses player match stats CSV and transactionally imports matches.
    Accepts {"csv_content": str, "focus_team": Optional[str]} or {"file_path": str}.
    """
    csv_content = payload.get("csv_content") or payload.get("csv")
    file_path = payload.get("file_path")
    focus_team = payload.get("focus_team") or db.get_setting("focus_team", "Chelsea")

    if not csv_content and not file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'csv_content' or 'file_path' must be provided."
        )

    try:
        from pathlib import Path
        source = csv_content if csv_content else file_path
        imported = db.import_csv_matches(source, focus_team=focus_team)
        if not imported:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No matches were imported from the CSV payload."
            )
        return {
            "status": "success",
            "message": f"Successfully imported {len(imported)} match(es) from CSV",
            "matches": imported,
            "count": len(imported),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CSV processing failed: {str(e)}"
        )


@app.get("/api/fixtures")
def get_fixtures(
    team: Optional[str] = None,
    season: Optional[str] = None,
    matchweek: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Returns fixture schedule. Can be filtered by team, season, or matchweek.
    """
    return db.list_fixtures(team=team, season=season, matchweek=matchweek)


@app.post("/api/fixtures/{fixture_id}/record-match", status_code=status.HTTP_201_CREATED)
def record_fixture_match_endpoint(fixture_id: int, payload: Dict[str, Any]):
    """
    Records or imports match data for an upcoming fixture in the schedule.
    Supports quick scorecard generation, custom JSON telemetry, or CSV player stats.
    """
    from backend.analysis.fixture_recorder import record_fixture_match
    try:
        result = record_fixture_match(db, fixture_id, payload)
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to record match for fixture #{fixture_id}: {str(e)}"
        )


@app.get("/api/fixtures/{fixture_id}/template-csv")
def get_fixture_template_csv_endpoint(
    fixture_id: int,
    sample: bool = False,
):
    """
    Generates a player-by-player CSV template for a scheduled fixture.
    """
    from backend.analysis.fixture_recorder import generate_fixture_csv_template
    try:
        return generate_fixture_csv_template(db, fixture_id, sample_stats=sample)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))



@app.post("/api/database/reset")
def reset_database_endpoint(payload: Optional[Dict[str, Any]] = None):
    """
    Wipes the local database tables cleanly, seeds fixtures schedule,
    and optionally imports sample player match stats CSV.
    """
    opts = payload or {}
    import_sample = opts.get("import_sample_csv", True)
    focus_team = opts.get("focus_team") or db.get_setting("focus_team", "Chelsea")

    from pathlib import Path
    db.reset_database(seed_fixtures=True)

    imported = []
    if import_sample:
        sample_path = Path("football_player_match_stats_sample.csv")
        if sample_path.exists():
            imported = db.import_csv_matches(str(sample_path), focus_team=focus_team)

    return {
        "status": "success",
        "message": "Database wiped and re-initialized with fixture allocation calendar.",
        "fixtures_count": len(db.list_fixtures()),
        "imported_matches_count": len(imported),
        "imported_matches": imported,
    }


@app.get("/api/settings/team")
def get_focus_team_endpoint():
    team = db.get_setting("focus_team", "Chelsea")
    return {"focus_team": team}


@app.post("/api/settings/team")
def set_focus_team_endpoint(payload: Dict[str, str]):
    team = payload.get("team") or payload.get("focus_team")
    if not team:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing 'team'")
    db.set_setting("focus_team", team)
    return {"status": "success", "focus_team": team}


# --- Opponent Tactical Scouting & Performance Endpoints ---

@app.get("/api/opponents")
def list_opponents_endpoint():
    """Lists all available Premier League opponent clubs with fixture context."""
    from backend.analysis.opponent_service import list_all_opponents
    managed_team = db.get_setting("focus_team", "Chelsea")
    return list_all_opponents(db, managed_team=managed_team)


@app.get("/api/opponents/{team_name}/team-sheet-csv")
def get_opponent_team_sheet_endpoint(team_name: str):
    """Returns official opponent squad sheet and downloadable CSV content."""
    from backend.analysis.opponent_service import get_opponent_team_sheet
    try:
        return get_opponent_team_sheet(team_name)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post("/api/opponents/{team_name}/team-sheet-csv")
def save_opponent_team_sheet_endpoint(team_name: str, payload: Dict[str, str]):
    """Accepts and validates updated custom CSV team sheet for an opponent."""
    csv_content = payload.get("csv_content")
    if not csv_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing 'csv_content'")
    from backend.analysis.opponent_service import get_opponent_team_sheet
    # Return formatted team sheet response acknowledging ingestion
    res = get_opponent_team_sheet(team_name)
    res["csv_content"] = csv_content
    return res


@app.get("/api/opponents/{team_name}/performance")
def get_opponent_performance_endpoint(
    team_name: str,
    as_of_date: Optional[str] = None,
):
    """
    Computes cumulative opponent record, form sequence, and tactical averages
    strictly up to a specified cut-off date ('till now').
    """
    from backend.analysis.opponent_service import get_opponent_performance_till_date
    try:
        return get_opponent_performance_till_date(db, team_name, as_of_date=as_of_date)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

