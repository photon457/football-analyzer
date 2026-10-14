"""
Database Service Layer.
Handles transactional persistence, duplicate match detection, relational storage
of players, matches, match_players, metrics, and spatial events.
Works seamlessly with both Supabase and embedded SQLite relational storage.
"""

import json
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from backend.analysis.validation.schemas import MatchDataPayload, PlayerMatchStats
from backend.database.client import get_supabase_client, is_supabase_configured

import os
import sys

def get_default_db_path() -> Path:
    env_path = os.environ.get("FOOTBALL_DB_PATH")
    if env_path:
        return Path(env_path)
    base = Path(__file__).resolve().parent.parent.parent
    local_db = base / "data" / "football_analyzer.db"
    if local_db.exists():
        return local_db
    return Path("data/football_analyzer.db")

DEFAULT_DB_PATH = get_default_db_path()


class DatabaseService:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or get_default_db_path()
        self.supabase = get_supabase_client()
        self._init_local_db()

    def _init_local_db(self):
        """Initializes local relational tables matching PostgreSQL schema."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA foreign_keys = ON;")
            cursor = conn.cursor()

            # Players table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                primary_position TEXT NOT NULL,
                secondary_position TEXT,
                squad_number INTEGER,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Matches table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                competition TEXT NOT NULL,
                season TEXT NOT NULL,
                matchday INTEGER,
                team TEXT NOT NULL,
                opponent TEXT NOT NULL,
                home_away TEXT NOT NULL,
                result TEXT NOT NULL,
                score_team INTEGER NOT NULL,
                score_opponent INTEGER NOT NULL,
                stadium TEXT,
                referee TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Match Players junction table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS match_players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                position TEXT NOT NULL,
                minutes_played INTEGER NOT NULL,
                is_starter BOOLEAN NOT NULL,
                subbed_in_minute INTEGER,
                subbed_out_minute INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (match_id, player_id)
            );
            """)

            # Player Match Metrics table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS player_match_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                metric_category TEXT NOT NULL,
                metric_name TEXT NOT NULL,
                is_raw BOOLEAN NOT NULL DEFAULT 1,
                raw_value REAL,
                per_90_value REAL,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (match_id, player_id, metric_name)
            );
            """)

            # Team Match Metrics table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS team_match_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                metric_name TEXT NOT NULL,
                raw_value REAL NOT NULL,
                is_raw BOOLEAN NOT NULL DEFAULT 1,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (match_id, metric_name)
            );
            """)

            # Spatial Events table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS match_events (
                id TEXT PRIMARY KEY,
                match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                minute INTEGER NOT NULL,
                second INTEGER,
                event_type TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                end_x REAL,
                end_y REAL,
                outcome TEXT NOT NULL,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Fixtures Table (Season Calendar)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS fixtures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fixture_id INTEGER UNIQUE,
                season TEXT NOT NULL,
                matchweek INTEGER NOT NULL,
                phase TEXT,
                date TEXT NOT NULL,
                match_in_matchweek INTEGER,
                home_team TEXT NOT NULL,
                away_team TEXT NOT NULL,
                match_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
            );
            """)

            # App Settings Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_metrics_player ON player_match_metrics(player_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_match ON match_events(match_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_fixtures_teams ON fixtures(home_team, away_team);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_fixtures_season ON fixtures(season);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_fixtures_date ON fixtures(date);")
            conn.commit()

        self.seed_fixtures_from_csv()

    def check_duplicate_match(self, match_id: str) -> bool:
        """Returns True if a match with the given match_id already exists."""
        if self.supabase:
            res = self.supabase.table("matches").select("id").eq("id", match_id).execute()
            return len(res.data) > 0
        else:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 FROM matches WHERE id = ?", (match_id,))
                return cursor.fetchone() is not None

    def delete_match(self, match_id: str) -> bool:
        """Deletes all records associated with a match."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA foreign_keys = ON;")
            cursor = conn.cursor()
            cursor.execute("DELETE FROM match_events WHERE match_id = ?", (match_id,))
            cursor.execute("DELETE FROM player_match_metrics WHERE match_id = ?", (match_id,))
            cursor.execute("DELETE FROM team_match_metrics WHERE match_id = ?", (match_id,))
            cursor.execute("DELETE FROM match_players WHERE match_id = ?", (match_id,))
            cursor.execute("DELETE FROM matches WHERE id = ?", (match_id,))
            cursor.execute("UPDATE fixtures SET match_id = NULL WHERE match_id = ?", (match_id,))
            conn.commit()
            return cursor.rowcount > 0

    def save_match(self, payload: MatchDataPayload, allow_overwrite: bool = False) -> Tuple[bool, str]:
        """
        Transactionally saves match metadata, players, metrics, and spatial events.
        Enforces duplicate detection and rollbacks on error.
        If allow_overwrite is True, removes existing records for this match ID first.
        """
        match = payload.match
        if self.check_duplicate_match(match.match_id):
            if allow_overwrite:
                self.delete_match(match.match_id)
            else:
                return False, f"Duplicate match detected: Match with ID '{match.match_id}' already exists"

        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("PRAGMA foreign_keys = ON;")
                cursor = conn.cursor()

                # 1. Insert Match
                cursor.execute("""
                    INSERT INTO matches (
                        id, date, competition, season, matchday, team, opponent,
                        home_away, result, score_team, score_opponent, stadium, referee, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    match.match_id, match.date, match.competition, match.season,
                    match.matchday, match.team, match.opponent, match.home_away,
                    match.result, match.score_team, match.score_opponent,
                    match.stadium, match.referee, json.dumps({})
                ))

                # 2. Upsert Players & Insert Match Players
                for p in payload.players:
                    cursor.execute("""
                        INSERT INTO players (id, name, primary_position, secondary_position, squad_number, metadata)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            name=excluded.name,
                            primary_position=excluded.primary_position,
                            secondary_position=excluded.secondary_position,
                            squad_number=excluded.squad_number
                    """, (
                        p.player_id, p.player_name, p.primary_position,
                        p.detailed_position, p.jersey_number, json.dumps({})
                    ))

                    cursor.execute("""
                        INSERT INTO match_players (
                            match_id, player_id, position, minutes_played,
                            is_starter, subbed_in_minute, subbed_out_minute
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        match.match_id, p.player_id, p.detailed_position or p.primary_position,
                        p.minutes_played, p.is_starter, p.subbed_in_minute, p.subbed_out_minute
                    ))

                    # 3. Insert Player Metrics
                    metrics_to_insert = self._extract_player_metrics(p)
                    for cat, name, is_raw, raw_val, p90_val in metrics_to_insert:
                        cursor.execute("""
                            INSERT INTO player_match_metrics (
                                match_id, player_id, metric_category, metric_name, is_raw, raw_value, per_90_value
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (match.match_id, p.player_id, cat, name, is_raw, raw_val, p90_val))

                # 4. Insert Team Match Metrics
                team = payload.team_stats
                team_metrics = [
                    ("possession_pct", team.possession_pct, True),
                    ("shots", float(team.shots), True),
                    ("shots_on_target", float(team.shots_on_target), True),
                    ("corners", float(team.corners), True),
                    ("fouls", float(team.fouls), True),
                    ("yellow_cards", float(team.yellow_cards), True),
                    ("red_cards", float(team.red_cards), True),
                    ("offsides", float(team.offsides), True),
                    ("passes_total", float(team.passes_total), True),
                    ("passes_completed", float(team.passes_completed), True),
                    ("pass_accuracy_pct", team.pass_accuracy_pct or 0.0, False),
                    ("xg", team.xg or 0.0, False),
                ]
                for m_name, val, is_raw in team_metrics:
                    cursor.execute("""
                        INSERT INTO team_match_metrics (match_id, metric_name, raw_value, is_raw)
                        VALUES (?, ?, ?, ?)
                    """, (match.match_id, m_name, val, is_raw))

                # 5. Insert Spatial Events
                for ev in payload.events:
                    cursor.execute("""
                        INSERT INTO match_events (
                            id, match_id, player_id, minute, second, event_type,
                            x, y, end_x, end_y, outcome, metadata
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        ev.event_id, match.match_id, ev.player_id, ev.minute, ev.second,
                        ev.event_type, ev.x, ev.y, ev.end_x, ev.end_y, ev.outcome,
                        json.dumps(ev.metadata or {})
                    ))

                # 6. Link to fixture schedule if matching
                cursor.execute("""
                    UPDATE fixtures
                    SET match_id = ?
                    WHERE (
                        (home_team = ? AND away_team = ?) OR
                        (home_team = ? AND away_team = ?)
                    ) AND (date = ? OR matchweek = ?)
                """, (match.match_id, match.team, match.opponent, match.opponent, match.team, match.date, match.matchday))

                conn.commit()

            # If Supabase is configured, sync to remote Supabase as well
            if self.supabase:
                try:
                    self._sync_to_supabase(payload)
                except Exception as ex:
                    print(f"Notice: Supabase sync skipped or failed ({ex}), persisted locally.")

            return True, "Match successfully saved and persisted"

        except Exception as e:
            return False, f"Failed to persist match: {str(e)}"

    def _extract_player_metrics(self, p: PlayerMatchStats) -> List[Tuple[str, str, bool, float, Optional[float]]]:
        """Extracts player metrics with per-90 normalization where applicable."""
        mins = p.minutes_played
        p90_factor = (90.0 / mins) if mins > 0 else 0.0

        def calc_p90(val: float) -> Optional[float]:
            return round(val * p90_factor, 2) if mins > 0 else None

        records = [
            # Attacking
            ("attacking", "goals", True, float(p.goals), calc_p90(p.goals)),
            ("attacking", "assists", True, float(p.assists), calc_p90(p.assists)),
            ("attacking", "shots_total", True, float(p.shots_total), calc_p90(p.shots_total)),
            ("attacking", "shots_on_target", True, float(p.shots_on_target), calc_p90(p.shots_on_target)),
            ("attacking", "big_chances_created", True, float(p.big_chances_created), calc_p90(p.big_chances_created)),
            ("attacking", "big_chances_missed", True, float(p.big_chances_missed), calc_p90(p.big_chances_missed)),
            ("attacking", "xg", False, p.xg or 0.0, calc_p90(p.xg or 0.0)),
            ("attacking", "xa", False, p.xa or 0.0, calc_p90(p.xa or 0.0)),
            # Passing
            ("passing", "passes_attempted", True, float(p.passes_attempted), calc_p90(p.passes_attempted)),
            ("passing", "passes_completed", True, float(p.passes_completed), calc_p90(p.passes_completed)),
            ("passing", "key_passes", True, float(p.key_passes), calc_p90(p.key_passes)),
            ("passing", "crosses_attempted", True, float(p.crosses_attempted), calc_p90(p.crosses_attempted)),
            ("passing", "crosses_completed", True, float(p.crosses_completed), calc_p90(p.crosses_completed)),
            ("passing", "progressive_passes", True, float(p.progressive_passes), calc_p90(p.progressive_passes)),
            ("passing", "pass_accuracy_pct", False, p.pass_accuracy_pct or 0.0, None),
            # Defending
            ("defending", "tackles_attempted", True, float(p.tackles_attempted), calc_p90(p.tackles_attempted)),
            ("defending", "tackles_won", True, float(p.tackles_won), calc_p90(p.tackles_won)),
            ("defending", "interceptions", True, float(p.interceptions), calc_p90(p.interceptions)),
            ("defending", "blocks", True, float(p.blocks), calc_p90(p.blocks)),
            ("defending", "clearances", True, float(p.clearances), calc_p90(p.clearances)),
            ("defending", "recoveries", True, float(p.recoveries), calc_p90(p.recoveries)),
            ("defending", "duels_total", True, float(p.duels_total), calc_p90(p.duels_total)),
            ("defending", "duels_won", True, float(p.duels_won), calc_p90(p.duels_won)),
            ("defending", "tackle_success_pct", False, p.tackle_success_pct or 0.0, None),
            ("defending", "duel_win_pct", False, p.duel_win_pct or 0.0, None),
            # Physical & Discipline
            ("physical", "minutes_played", True, float(p.minutes_played), None),
            ("physical", "fouls_committed", True, float(p.fouls_committed), calc_p90(p.fouls_committed)),
            ("physical", "fouls_drawn", True, float(p.fouls_drawn), calc_p90(p.fouls_drawn)),
            ("physical", "yellow_cards", True, float(p.yellow_cards), None),
            ("physical", "red_cards", True, float(p.red_cards), None),
        ]

        if p.distance_covered_km is not None:
            records.append(("physical", "distance_covered_km", True, float(p.distance_covered_km), None))
        if p.sprints is not None:
            records.append(("physical", "sprints", True, float(p.sprints), calc_p90(p.sprints)))

        # Goalkeeping (if GK)
        if p.primary_position == "GK":
            if p.saves is not None:
                records.append(("goalkeeping", "saves", True, float(p.saves), calc_p90(p.saves)))
            if p.goals_conceded is not None:
                records.append(("goalkeeping", "goals_conceded", True, float(p.goals_conceded), calc_p90(p.goals_conceded)))

        return records

    def _sync_to_supabase(self, payload: MatchDataPayload):
        """Optional synchronization to remote Supabase if connected."""
        pass

    def list_matches(self) -> List[Dict[str, Any]]:
        """Returns all matches sorted by date descending."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM matches ORDER BY date DESC")
            return [dict(row) for row in cursor.fetchall()]

    def get_match(self, match_id: str) -> Optional[Dict[str, Any]]:
        """Returns match metadata, team stats, squad players with metrics, and spatial events."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Match info
            cursor.execute("SELECT * FROM matches WHERE id = ?", (match_id,))
            match_row = cursor.fetchone()
            if not match_row:
                return None
            match_data = dict(match_row)

            # Team stats
            cursor.execute("SELECT metric_name, raw_value FROM team_match_metrics WHERE match_id = ?", (match_id,))
            team_stats = {row["metric_name"]: row["raw_value"] for row in cursor.fetchall()}

            # Players with match appearance
            cursor.execute("""
                SELECT p.id as player_id, p.name as player_name, p.primary_position, p.squad_number as jersey_number,
                       mp.position as detailed_position, mp.minutes_played, mp.is_starter,
                       mp.subbed_in_minute, mp.subbed_out_minute
                FROM match_players mp
                JOIN players p ON mp.player_id = p.id
                WHERE mp.match_id = ?
                ORDER BY mp.is_starter DESC, mp.minutes_played DESC
            """, (match_id,))
            player_rows = [dict(row) for row in cursor.fetchall()]

            # Fetch metrics for all players in this match
            cursor.execute("""
                SELECT player_id, metric_category, metric_name, raw_value, per_90_value
                FROM player_match_metrics
                WHERE match_id = ?
            """, (match_id,))
            metrics_rows = cursor.fetchall()
            metrics_by_player: Dict[str, Dict[str, Any]] = {}
            for row in metrics_rows:
                pid = row["player_id"]
                if pid not in metrics_by_player:
                    metrics_by_player[pid] = {}
                metrics_by_player[pid][row["metric_name"]] = row["raw_value"]
                if row["per_90_value"] is not None:
                    metrics_by_player[pid][f"{row['metric_name']}_per_90"] = row["per_90_value"]

            # Merge metrics into player dicts
            for p in player_rows:
                p["metrics"] = metrics_by_player.get(p["player_id"], {})
                # Lift top stats to root of player dict for convenient rendering
                for k, v in p["metrics"].items():
                    if k not in p:
                        p[k] = v

            # Spatial events
            cursor.execute("SELECT * FROM match_events WHERE match_id = ? ORDER BY minute ASC, second ASC", (match_id,))
            events = []
            for row in cursor.fetchall():
                ev = dict(row)
                ev["metadata"] = json.loads(ev["metadata"]) if ev.get("metadata") else {}
                events.append(ev)

            return {
                "match": match_data,
                "team_stats": team_stats,
                "players": player_rows,
                "events": events,
            }

    def get_player_match_history(self, player_id: str) -> List[Dict[str, Any]]:
        """Returns the timeline of matches and metrics for a specific player."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT m.id as match_id, m.date, m.opponent, m.home_away, m.result,
                       m.score_team, m.score_opponent,
                       mp.position, mp.minutes_played, mp.is_starter
                FROM match_players mp
                JOIN matches m ON mp.match_id = m.id
                WHERE mp.player_id = ?
                ORDER BY m.date ASC
            """, (player_id,))
            history_rows = [dict(row) for row in cursor.fetchall()]

            for item in history_rows:
                cursor.execute("""
                    SELECT metric_name, raw_value, per_90_value
                    FROM player_match_metrics
                    WHERE match_id = ? AND player_id = ?
                """, (item["match_id"], player_id))
                item["metrics"] = {
                    row["metric_name"]: row["raw_value"]
                    for row in cursor.fetchall()
                }

            return history_rows

    def get_all_players(self) -> List[Dict[str, Any]]:
        """Returns all registered players."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM players ORDER BY squad_number ASC, name ASC")
            players = []
            for row in cursor.fetchall():
                d = dict(row)
                d["position"] = d.get("primary_position") or "MF"
                players.append(d)
            return players

    def list_seasons(self) -> List[str]:
        """Returns distinct seasons that have stored matches, most recent first."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT season FROM matches ORDER BY season DESC")
            return [row[0] for row in cursor.fetchall()]

    def get_season_appearances(self, season: str) -> List[Dict[str, Any]]:
        """
        Returns every player appearance in the given season, joined with match
        context and the raw per-match metric values, ordered chronologically.
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT mp.player_id, mp.position, mp.minutes_played, mp.is_starter,
                       m.id AS match_id, m.date, m.team, m.opponent, m.competition,
                       m.home_away, m.result, m.score_team, m.score_opponent
                FROM match_players mp
                JOIN matches m ON mp.match_id = m.id
                WHERE m.season = ?
                ORDER BY m.date ASC, m.id ASC
            """, (season,))
            appearances = [dict(row) for row in cursor.fetchall()]

            cursor.execute("""
                SELECT pmm.match_id, pmm.player_id, pmm.metric_name, pmm.raw_value
                FROM player_match_metrics pmm
                JOIN matches m ON pmm.match_id = m.id
                WHERE m.season = ?
            """, (season,))
            metrics: Dict[Tuple[str, str], Dict[str, float]] = {}
            for row in cursor.fetchall():
                key = (row["match_id"], row["player_id"])
                metrics.setdefault(key, {})[row["metric_name"]] = row["raw_value"]

            for app_row in appearances:
                app_row["is_starter"] = bool(app_row["is_starter"])
                app_row["metrics"] = metrics.get((app_row["match_id"], app_row["player_id"]), {})

            return appearances

    def get_team_season_matches(self, season: str, team: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns all matches for a specific team in a season (or all matches if team is None),
        joined with team match metrics, ordered chronologically.
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if team:
                cursor.execute("""
                    SELECT m.id, m.date, m.team, m.opponent, m.competition, m.home_away,
                           m.result, m.score_team, m.score_opponent
                    FROM matches m
                    WHERE m.season = ? AND (m.team = ? OR m.opponent = ?)
                    ORDER BY m.date ASC
                """, (season, team, team))
            else:
                cursor.execute("""
                    SELECT m.id, m.date, m.team, m.opponent, m.competition, m.home_away,
                           m.result, m.score_team, m.score_opponent
                    FROM matches m
                    WHERE m.season = ?
                    ORDER BY m.date ASC
                """, (season,))
            match_rows = [dict(r) for r in cursor.fetchall()]

            if not match_rows:
                return []

            match_ids = [m["id"] for m in match_rows]
            placeholders = ",".join("?" for _ in match_ids)
            cursor.execute(f"""
                SELECT match_id, metric_name, raw_value
                FROM team_match_metrics
                WHERE match_id IN ({placeholders})
            """, match_ids)

            metrics_by_match: Dict[str, Dict[str, float]] = {}
            for r in cursor.fetchall():
                metrics_by_match.setdefault(r["match_id"], {})[r["metric_name"]] = r["raw_value"]

            results = []
            cumulative_points = 0
            for m in match_rows:
                mid = m["id"]
                mets = metrics_by_match.get(mid, {})
                res = m["result"]
                pts = 3 if res == "W" else (1 if res == "D" else 0)
                cumulative_points += pts
                entry = {
                    "match_id": mid,
                    "date": m["date"],
                    "team": m["team"],
                    "opponent": m["opponent"],
                    "competition": m["competition"],
                    "home_away": m["home_away"],
                    "result": res,
                    "score_team": int(m["score_team"]),
                    "score_opponent": int(m["score_opponent"]),
                    "points_cumulative": cumulative_points,
                    "possession_pct": round(float(mets["possession_pct"]), 1) if "possession_pct" in mets else None,
                    "pass_accuracy_pct": round(float(mets["pass_accuracy_pct"]), 1) if "pass_accuracy_pct" in mets else None,
                    "passes_completed": int(mets["passes_completed"]) if "passes_completed" in mets else None,
                    "passes_total": int(mets["passes_total"]) if "passes_total" in mets else None,
                    "shots": int(mets["shots"]) if "shots" in mets else None,
                    "shots_on_target": int(mets["shots_on_target"]) if "shots_on_target" in mets else None,
                    "xg": round(float(mets["xg"]), 2) if "xg" in mets else None,
                    "fouls": int(mets["fouls"]) if "fouls" in mets else None,
                    "corners": int(mets["corners"]) if "corners" in mets else None,
                    "yellow_cards": int(mets["yellow_cards"]) if "yellow_cards" in mets else None,
                    "red_cards": int(mets["red_cards"]) if "red_cards" in mets else None,
                }
                results.append(entry)

            return results

    def seed_fixtures_from_csv(self, csv_path: Optional[Path] = None):
        """Seeds the fixtures schedule from CSV if the fixtures table is empty."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM fixtures")
                if cursor.fetchone()[0] > 0:
                    return

                target_path = csv_path or Path("Fictional_Premier_League_2024_25_Fixture_Allocation.csv")
                if not target_path.exists():
                    return

                import csv
                with open(target_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        cursor.execute("""
                            INSERT OR IGNORE INTO fixtures (
                                fixture_id, season, matchweek, phase, date, match_in_matchweek, home_team, away_team
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            int(row["Match_ID"]),
                            "2024-2025",
                            int(row["Matchweek"]),
                            str(row.get("Phase", "")),
                            str(row["Date"]),
                            int(row.get("Match_in_Matchweek", 1)),
                            str(row["Home_Team"]).strip(),
                            str(row["Away_Team"]).strip(),
                        ))
                conn.commit()
        except Exception as e:
            print(f"Notice: Fixtures seeding skipped ({e})")

    def list_fixtures(
        self,
        team: Optional[str] = None,
        season: Optional[str] = None,
        matchweek: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns fixture schedule. If team is provided, filters for that club's fixtures.
        Joins with matches table to indicate played vs scheduled status and scores.
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = """
                SELECT f.fixture_id, f.season, f.matchweek, f.phase, f.date,
                       f.match_in_matchweek, f.home_team, f.away_team,
                       f.match_id,
                       m.result, m.score_team, m.score_opponent, m.team as match_focus_team
                FROM fixtures f
                LEFT JOIN matches m ON f.match_id = m.id
                WHERE 1=1
            """
            params: List[Any] = []

            if season:
                query += " AND f.season = ?"
                params.append(season)

            if matchweek is not None:
                query += " AND f.matchweek = ?"
                params.append(matchweek)

            if team:
                query += " AND (f.home_team = ? OR f.away_team = ?)"
                params.extend([team, team])

            query += " ORDER BY f.matchweek ASC, f.match_in_matchweek ASC"

            cursor.execute(query, params)
            rows = [dict(r) for r in cursor.fetchall()]

            for item in rows:
                if item["match_id"]:
                    item["status"] = "played"
                    # Determine score for home and away from match result
                    if item.get("match_focus_team") == item["home_team"]:
                        item["score_home"] = item["score_team"]
                        item["score_away"] = item["score_opponent"]
                    elif item.get("match_focus_team") == item["away_team"]:
                        item["score_home"] = item["score_opponent"]
                        item["score_away"] = item["score_team"]
                    else:
                        item["score_home"] = item.get("score_team")
                        item["score_away"] = item.get("score_opponent")
                else:
                    item["status"] = "scheduled"
                    item["score_home"] = None
                    item["score_away"] = None

            return rows

    def get_fixture(self, fixture_id: int) -> Optional[Dict[str, Any]]:
        """Returns single fixture row by fixture_id with status and score if played."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT f.fixture_id, f.season, f.matchweek, f.phase, f.date,
                       f.match_in_matchweek, f.home_team, f.away_team,
                       f.match_id,
                       m.result, m.score_team, m.score_opponent, m.team as match_focus_team
                FROM fixtures f
                LEFT JOIN matches m ON f.match_id = m.id
                WHERE f.fixture_id = ?
            """, (fixture_id,))
            row = cursor.fetchone()
            if not row:
                return None
            item = dict(row)
            if item["match_id"]:
                item["status"] = "played"
                if item.get("match_focus_team") == item["home_team"]:
                    item["score_home"] = item["score_team"]
                    item["score_away"] = item["score_opponent"]
                elif item.get("match_focus_team") == item["away_team"]:
                    item["score_home"] = item["score_opponent"]
                    item["score_away"] = item["score_team"]
                else:
                    item["score_home"] = item.get("score_team")
                    item["score_away"] = item.get("score_opponent")
            else:
                item["status"] = "scheduled"
                item["score_home"] = None
                item["score_away"] = None
            return item

    def link_fixture_match(self, fixture_id: int, match_id: str) -> bool:
        """Links a fixture to a match_id."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE fixtures SET match_id = ? WHERE fixture_id = ?", (match_id, fixture_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Retrieves an application configuration value."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row[0] if row else default

    def set_setting(self, key: str, value: str):
        """Sets an application configuration value."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
            """, (key, value))
            conn.commit()

    def reset_database(self, seed_fixtures: bool = True):
        """Wipes all local database tables cleanly and re-initializes schema and fixtures."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            tables = [
                "match_events", "player_match_metrics", "team_match_metrics",
                "match_players", "matches", "players", "fixtures", "app_settings"
            ]
            for t in tables:
                cursor.execute(f"DROP TABLE IF EXISTS {t};")
            conn.commit()

        self._init_local_db()
        if seed_fixtures:
            self.seed_fixtures_from_csv()
            self.seed_sample_json_matches()

    def seed_sample_json_matches(self):
        """Seeds rich sample matches from data/samples/ containing comprehensive tactical telemetry."""
        from pathlib import Path
        import json
        from backend.analysis.validation.schemas import MatchDataPayload
        samples_dir = Path("data/samples")
        if not samples_dir.exists():
            return
        for json_path in sorted(samples_dir.glob("match_0*.json")):
            try:
                data = json.loads(json_path.read_text(encoding="utf-8"))
                payload = MatchDataPayload(**data)
                self.save_match(payload)
            except Exception as e:
                print(f"Notice: Could not seed {json_path.name}: {e}")

    def import_csv_matches(
        self,
        csv_source: str,
        focus_team: Optional[str] = "Chelsea",
        default_match_id: Optional[str] = None,
        default_team: Optional[str] = None,
        default_opponent: Optional[str] = None,
        allow_overwrite: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Parses and imports matches from player match stats CSV.
        Transactionally saves each match and links to fixtures where appropriate.
        Supports default match IDs, teams, opponents, and overwrite mode.
        """
        from backend.analysis.validation.csv_importer import parse_player_stats_csv
        payloads = parse_player_stats_csv(
            csv_source,
            focus_team=focus_team,
            default_match_id=default_match_id,
            default_team=default_team,
            default_opponent=default_opponent,
        )
        imported_summaries = []

        for p in payloads:
            success, msg = self.save_match(p, allow_overwrite=allow_overwrite)
            if success:
                imported_summaries.append({
                    "match_id": p.match.match_id,
                    "team": p.match.team,
                    "opponent": p.match.opponent,
                    "score": f"{p.match.score_team}-{p.match.score_opponent}",
                    "result": p.match.result,
                    "date": p.match.date,
                    "competition": p.match.competition,
                    "players_count": len(p.players),
                })
            else:
                print(f"Notice: Match '{p.match.match_id}' import note: {msg}")

        return imported_summaries
