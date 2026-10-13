-- Football Analysis Platform: Relational Database Schema
-- Compatible with PostgreSQL / Supabase
-- Implements Phase 2 Requirements from docs/architecture.md & docs/rules.md

-- Extensions (UUID generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Players Table
CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    primary_position VARCHAR(4) NOT NULL CHECK (primary_position IN ('GK', 'DF', 'MF', 'FW')),
    secondary_position VARCHAR(16),
    squad_number INTEGER CHECK (squad_number BETWEEN 1 AND 99),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL,
    competition VARCHAR(128) NOT NULL,
    season VARCHAR(32) NOT NULL,
    matchday INTEGER,
    team VARCHAR(128) NOT NULL,
    opponent VARCHAR(128) NOT NULL,
    home_away VARCHAR(4) NOT NULL CHECK (home_away IN ('home', 'away')),
    result VARCHAR(1) NOT NULL CHECK (result IN ('W', 'D', 'L')),
    score_team INTEGER NOT NULL CHECK (score_team >= 0),
    score_opponent INTEGER NOT NULL CHECK (score_opponent >= 0),
    stadium VARCHAR(128),
    referee VARCHAR(128),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Match Players Table (Relational junction between match and player)
CREATE TABLE IF NOT EXISTS match_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    position VARCHAR(16) NOT NULL,
    minutes_played INTEGER NOT NULL CHECK (minutes_played >= 0 AND minutes_played <= 130),
    is_starter BOOLEAN NOT NULL DEFAULT FALSE,
    subbed_in_minute INTEGER CHECK (subbed_in_minute >= 0 AND subbed_in_minute <= 130),
    subbed_out_minute INTEGER CHECK (subbed_out_minute >= 0 AND subbed_out_minute <= 130),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_match_player UNIQUE (match_id, player_id)
);

-- 4. Player Match Metrics (Granular typed storage separating raw from derived)
CREATE TABLE IF NOT EXISTS player_match_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    metric_category VARCHAR(32) NOT NULL CHECK (metric_category IN ('attacking', 'passing', 'defending', 'physical', 'goalkeeping', 'general')),
    metric_name VARCHAR(64) NOT NULL,
    is_raw BOOLEAN NOT NULL DEFAULT TRUE,
    raw_value NUMERIC(10, 2),
    per_90_value NUMERIC(10, 2),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_player_match_metric UNIQUE (match_id, player_id, metric_name)
);

-- 5. Team Match Metrics
CREATE TABLE IF NOT EXISTS team_match_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    metric_name VARCHAR(64) NOT NULL,
    raw_value NUMERIC(10, 2) NOT NULL,
    is_raw BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_team_match_metric UNIQUE (match_id, metric_name)
);

-- 6. Spatial Match Events (Shots, Passes, Tackles with 0-100 pitch coordinates)
CREATE TABLE IF NOT EXISTS match_events (
    id VARCHAR(64) PRIMARY KEY,
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    minute INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 130),
    second INTEGER CHECK (second >= 0 AND second <= 59),
    event_type VARCHAR(32) NOT NULL,
    x NUMERIC(5, 2) NOT NULL CHECK (x >= 0.0 AND x <= 100.0),
    y NUMERIC(5, 2) NOT NULL CHECK (y >= 0.0 AND y <= 100.0),
    end_x NUMERIC(5, 2) CHECK (end_x >= 0.0 AND end_x <= 100.0),
    end_y NUMERIC(5, 2) CHECK (end_y >= 0.0 AND end_y <= 100.0),
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('successful', 'unsuccessful')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_opponent ON matches(opponent);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_metrics_player_match ON player_match_metrics(player_id, match_id);
CREATE INDEX IF NOT EXISTS idx_metrics_category ON player_match_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_events_match ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_events_player ON match_events(player_id);
