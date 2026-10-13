import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SquadSeasonResponse,
  TeamSeasonMatch,
  fetchSquadSeason,
} from '../../services/api';
import { LineChart, LineChartPoint } from '../visualizations/LineChart';
import { BarChart, BarChartItem } from '../visualizations/BarChart';
import { BorderGlow } from '../BorderGlow/BorderGlow';
import { Calendar, TrendingUp, Shield, Activity, ArrowRight, Search } from 'lucide-react';
import './MyTeam.css';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface MyTeamProps {
  onSelectMatch: (matchId: string) => void;
  onNavigateToUpload: () => void;
  managedTeam?: string;
}

type TeamTrendMetric = 'points' | 'goals' | 'xg' | 'possession' | 'shots';

interface TrendMetricOption {
  key: TeamTrendMetric;
  label: string;
  unit: string;
}

const TREND_METRICS: TrendMetricOption[] = [
  { key: 'points', label: 'Points Progression', unit: 'pts' },
  { key: 'goals', label: 'Goals For vs Against', unit: 'goals' },
  { key: 'xg', label: 'Expected Goals (xG)', unit: 'xG' },
  { key: 'possession', label: 'Possession %', unit: '%' },
  { key: 'shots', label: 'Shots & Accuracy', unit: 'shots' },
];

const resultClass = (r: string) =>
  r === 'W' ? 'score-pill score-pill-win' : r === 'D' ? 'score-pill score-pill-draw' : 'score-pill score-pill-loss';

export const MyTeam: React.FC<MyTeamProps> = ({ onSelectMatch, onNavigateToUpload, managedTeam }) => {
  const [data, setData] = useState<SquadSeasonResponse | null>(null);
  const [season, setSeason] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [trendMetric, setTrendMetric] = useState<TeamTrendMetric>('points');

  const load = useCallback((requestedSeason?: string) => {
    setLoading(true);
    setError(null);
    fetchSquadSeason(requestedSeason, managedTeam)
      .then((res) => {
        setData(res);
      })
      .catch((e: Error) => {
        setError(e.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [managedTeam]);

  useEffect(() => {
    load(season);
  }, [season, load]);

  const matches: TeamSeasonMatch[] = useMemo(() => {
    return data?.matches || [];
  }, [data]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    const q = search.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) =>
        m.opponent.toLowerCase().includes(q) ||
        m.competition.toLowerCase().includes(q) ||
        m.home_away.toLowerCase().includes(q) ||
        m.result.toLowerCase().includes(q)
    );
  }, [matches, search]);

  // D3 Line Chart data points for selected trend metric
  const lineChartData: LineChartPoint[] = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    return matches.map((m) => {
      const shortOpp = m.opponent.split(' ')[0];
      const label = `${m.date.slice(5)} ${shortOpp}`;

      if (trendMetric === 'points') {
        return {
          label,
          value: m.points_cumulative,
          date: m.date,
          opponent: m.opponent,
        };
      }
      if (trendMetric === 'goals') {
        return {
          label,
          value: m.score_team,
          secondaryValue: m.score_opponent,
          date: m.date,
          opponent: m.opponent,
        };
      }
      if (trendMetric === 'xg') {
        return {
          label,
          value: m.xg ?? 0,
          date: m.date,
          opponent: m.opponent,
        };
      }
      if (trendMetric === 'possession') {
        return {
          label,
          value: m.possession_pct ?? 0,
          date: m.date,
          opponent: m.opponent,
        };
      }
      // 'shots'
      return {
        label,
        value: m.shots ?? 0,
        secondaryValue: m.shots_on_target ?? 0,
        date: m.date,
        opponent: m.opponent,
      };
    });
  }, [matches, trendMetric]);

  // D3 Bar Chart items for match outcomes / goals
  const barChartData: BarChartItem[] = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    return matches.map((m) => {
      const shortOpp = m.opponent.split(' ')[0];
      return {
        id: m.match_id,
        label: `${m.date.slice(5)} ${shortOpp}`,
        value: m.score_team,
        secondaryValue: m.score_opponent,
        category: m.result,
      };
    });
  }, [matches]);

  if (loading && !data) {
    return (
      <div className="my-team">
        <div className="surface-panel my-team-state">
          Loading overall season team record and historical performance...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-team">
        <div className="surface-panel my-team-state">
          <div style={{ color: '#f87171', marginBottom: '6px' }}>Could not load team season data</div>
          <div>{error}. Check that the Python analysis engine is running.</div>
          <button id="my-team-retry" className="my-team-btn" onClick={() => load(season)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.season || matches.length === 0) {
    return (
      <div className="my-team">
        <div className="page-header my-team-header">
          <div>
            <h1 className="page-title">My Team</h1>
            <p className="page-description">
              Overall historic team record, longitudinal match progression, and season performance.
            </p>
          </div>
        </div>
        <div className="surface-panel my-team-state">
          No matches stored for {managedTeam || data?.team || 'your club'} in season {data?.season || 'current'}. Import a match to build your season record.
          <div style={{ marginTop: '14px' }}>
            <button id="my-team-import" className="my-team-btn" onClick={onNavigateToUpload}>
              Import match
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { record, team_averages } = data;
  const teamName = managedTeam || data.team || 'Squad';

  return (
    <div className="my-team">
      {/* Page Header */}
      <div className="page-header my-team-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>My Team</h1>
            <span
              style={{
                fontSize: '12.5px',
                padding: '3px 10px',
                background: '#161d28',
                border: '1px solid rgba(198, 135, 21, 0.4)',
                color: 'var(--accent-gold)',
                borderRadius: '4px',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              {teamName}
            </span>
          </div>
          <p className="page-description">
            Overall historic season record, longitudinal team performance, and historical match progression across {data.season}.
          </p>
        </div>

        <label className="my-team-season-control" htmlFor="my-team-season">
          Season
          <select
            id="my-team-season"
            className="form-select"
            value={data.season}
            onChange={(e) => setSeason(e.target.value)}
          >
            {data.available_seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Primary Season Record Banner */}
      <section className="my-team-record" aria-label="Season record banner">
        <div className="my-team-record-cell">
          <span className="my-team-record-label">Season {data.season}</span>
          <span className="my-team-record-team">{teamName}</span>
        </div>

        <div className="my-team-record-cell">
          <span className="my-team-record-label">Record (W-D-L)</span>
          <span className="my-team-record-value">
            {record.wins}-{record.draws}-{record.losses}
          </span>
          <span className="my-team-record-sub">{record.played} matches played</span>
        </div>

        <div className="my-team-record-cell">
          <span className="my-team-record-label">Points</span>
          <span className="my-team-record-value" style={{ color: 'var(--accent-gold)' }}>
            {record.points ?? 0} pts
          </span>
          <span className="my-team-record-sub">{record.points_per_match ?? 0} per match</span>
        </div>

        <div className="my-team-record-cell">
          <span className="my-team-record-label">Goals (F - A)</span>
          <span className="my-team-record-value">
            {record.goals_for} - {record.goals_against}
          </span>
          <span className="my-team-record-sub">
            GD: {(record.goal_difference ?? 0) > 0 ? `+${record.goal_difference}` : (record.goal_difference ?? 0)}
          </span>
        </div>

        <div className="my-team-record-cell">
          <span className="my-team-record-label">Win Rate</span>
          <span className="my-team-record-value">
            {record.win_rate_pct ?? (record.played ? Math.round((record.wins / record.played) * 100) : 0)}%
          </span>
          <span className="my-team-record-sub">{record.clean_sheets ?? 0} clean sheets</span>
        </div>

        <div className="my-team-record-cell">
          <span className="my-team-record-label">Recent Form</span>
          <div style={{ display: 'flex', gap: '5px', marginTop: '6px', alignItems: 'center' }}>
            {(record.form && record.form.length > 0 ? record.form : matches.slice(-5).map((m) => m.result)).map(
              (r, idx) => (
                <span
                  key={idx}
                  className={resultClass(r)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 7px',
                    fontWeight: 700,
                  }}
                  title={`Result: ${r}`}
                >
                  {r}
                </span>
              )
            )}
          </div>
          <span className="my-team-record-sub">Last {Math.min(5, matches.length)} matches</span>
        </div>
      </section>

      {/* Team Aggregated Statistical Pillars */}
      {team_averages && (
        <section className="team-pillars-grid" aria-label="Team statistical pillars">
          {/* Attacking Pillar */}
          <div className="surface-panel pillar-panel">
            <div className="pillar-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="var(--accent-gold)" />
                <span className="pillar-title">Attacking &amp; Chance Creation</span>
              </div>
            </div>
            <div className="pillar-stats-grid">
              <div className="pillar-stat">
                <span className="pillar-stat-label">Goals / Match</span>
                <span className="pillar-stat-val">{team_averages.goals_scored_per_match}</span>
                <span className="pillar-stat-note">{record.goals_for} total scored</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Expected Goals (xG)</span>
                <span className="pillar-stat-val">{team_averages.xg_per_match}</span>
                <span className="pillar-stat-note">{team_averages.total_xg} season xG</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Shots / Match</span>
                <span className="pillar-stat-val">{team_averages.shots_per_match}</span>
                <span className="pillar-stat-note">{team_averages.total_shots} total shots</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Shot Accuracy</span>
                <span className="pillar-stat-val">
                  {team_averages.shot_accuracy_pct !== null ? `${team_averages.shot_accuracy_pct}%` : 'n/a'}
                </span>
                <span className="pillar-stat-note">{team_averages.total_shots_on_target} on target</span>
              </div>
            </div>
          </div>

          {/* Possession & Circulation Pillar */}
          <div className="surface-panel pillar-panel">
            <div className="pillar-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="var(--accent-gold)" />
                <span className="pillar-title">Possession &amp; Circulation</span>
              </div>
            </div>
            <div className="pillar-stats-grid">
              <div className="pillar-stat">
                <span className="pillar-stat-label">Avg Possession</span>
                <span className="pillar-stat-val">
                  {team_averages.avg_possession_pct !== null ? `${team_averages.avg_possession_pct}%` : 'n/a'}
                </span>
                <span className="pillar-stat-note">Per-match control</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Pass Accuracy</span>
                <span className="pillar-stat-val">
                  {team_averages.avg_pass_accuracy_pct !== null ? `${team_averages.avg_pass_accuracy_pct}%` : 'n/a'}
                </span>
                <span className="pillar-stat-note">Circulation efficiency</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Total Passes</span>
                <span className="pillar-stat-val">{team_averages.total_passes_completed}</span>
                <span className="pillar-stat-note">{team_averages.total_passes} attempted</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Corners Won</span>
                <span className="pillar-stat-val">{team_averages.total_corners}</span>
                <span className="pillar-stat-note">
                  {record.played ? (team_averages.total_corners / record.played).toFixed(1) : 0} per match
                </span>
              </div>
            </div>
          </div>

          {/* Defensive & Venue Pillar */}
          <div className="surface-panel pillar-panel">
            <div className="pillar-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="var(--accent-gold)" />
                <span className="pillar-title">Defense &amp; Venue Split</span>
              </div>
            </div>
            <div className="pillar-stats-grid">
              <div className="pillar-stat">
                <span className="pillar-stat-label">Conceded / Match</span>
                <span className="pillar-stat-val">{team_averages.goals_conceded_per_match}</span>
                <span className="pillar-stat-note">{record.goals_against} total conceded</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Clean Sheet %</span>
                <span className="pillar-stat-val">{record.clean_sheet_pct ?? 0}%</span>
                <span className="pillar-stat-note">{record.clean_sheets ?? 0} matches</span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Home Record</span>
                <span className="pillar-stat-val">
                  {team_averages.home_record.wins}W-{team_averages.home_record.draws}D-{team_averages.home_record.losses}L
                </span>
                <span className="pillar-stat-note">
                  {team_averages.home_record.goals_for} GF, {team_averages.home_record.goals_against} GA
                </span>
              </div>
              <div className="pillar-stat">
                <span className="pillar-stat-label">Away Record</span>
                <span className="pillar-stat-val">
                  {team_averages.away_record.wins}W-{team_averages.away_record.draws}D-{team_averages.away_record.losses}L
                </span>
                <span className="pillar-stat-note">
                  {team_averages.away_record.goals_for} GF, {team_averages.away_record.goals_against} GA
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Longitudinal Team Trends (D3 Line Chart & D3 Bar Chart) */}
      <BorderGlow
        backgroundColor="#121722"
        borderRadius={10}
        colors={['#c8963e', '#38bdf8', '#c084fc']}
      >
        <section style={{ padding: '20px 22px' }} aria-label="Team progression charts">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '14px',
            }}
          >
            <div>
              <div className="surface-panel-title">Longitudinal Team Performance Across Season</div>
              <div className="surface-panel-caption">
                Track progression, consistency, and metric trajectories fixture-by-fixture.
              </div>
            </div>

            {/* Metric Switcher Controls */}
            <JellyRadio
              size="sm"
              items={TREND_METRICS.map((opt) => ({ value: opt.key, label: opt.label }))}
              value={trendMetric}
              onChange={(val) => setTrendMetric(val as TeamTrendMetric)}
            />
          </div>

          {/* Chart View */}
          <div style={{ minHeight: '300px' }}>
            {trendMetric === 'goals' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', fontSize: '12px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>■ Goals Scored</span>
                  <span style={{ color: '#ef4444' }}>■ Goals Conceded</span>
                </div>
                <BarChart
                  data={barChartData}
                  metricLabel="Goals"
                  xLabel="Fixture Progression"
                  yLabel="Goals"
                  height={300}
                  barColor="var(--accent-gold)"
                  onSelect={(id) => onSelectMatch(id)}
                />
              </div>
            ) : (
              <LineChart
                data={lineChartData}
                metricLabel={TREND_METRICS.find((m) => m.key === trendMetric)?.label || 'Value'}
                xLabel="Fixture Progression"
                yLabel={TREND_METRICS.find((m) => m.key === trendMetric)?.unit || ''}
                height={300}
                lineColor="var(--accent-gold)"
              />
            )}
          </div>
        </section>
      </BorderGlow>

      {/* Historical Season Matches Log Table */}
      <section className="surface-panel" style={{ padding: '20px 22px' }} aria-label="Season matches log">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div className="surface-panel-title">Season Fixtures &amp; Match Results ({matches.length})</div>
            <div className="surface-panel-caption">
              Chronological match records. Click Inspect to explore full telemetry in Matches view.
            </div>
          </div>

          <div style={{ position: 'relative', width: '260px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="squad-search"
              placeholder="Search opponent or venue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ margin: 0, paddingLeft: '32px' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="match-log-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th style={{ textAlign: 'left' }}>Opponent</th>
                <th style={{ textAlign: 'center' }}>Venue</th>
                <th style={{ textAlign: 'left' }}>Competition</th>
                <th style={{ textAlign: 'center' }}>Result</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th>Shots</th>
                <th>Possession</th>
                <th>xG</th>
                <th>Pass %</th>
                <th style={{ textAlign: 'center' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No matches found matching "{search}".
                  </td>
                </tr>
              ) : (
                filteredMatches.map((m) => (
                  <tr
                    key={m.match_id}
                    onClick={() => onSelectMatch(m.match_id)}
                    title={`View match telemetry for ${teamName} vs ${m.opponent}`}
                  >
                    <td style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} color="var(--text-muted)" />
                        {m.date}
                      </div>
                    </td>
                    <td style={{ textAlign: 'left', fontWeight: 600, color: '#ffffff' }}>
                      {m.opponent}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: m.home_away === 'home' ? 'rgba(198, 135, 21, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: m.home_away === 'home' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                          border: `1px solid ${m.home_away === 'home' ? 'rgba(198, 135, 21, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                        }}
                      >
                        {m.home_away}
                      </span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {m.competition}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={resultClass(m.result)} style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                        {m.result}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', color: '#ffffff' }}>
                      {m.score_team} - {m.score_opponent}
                    </td>
                    <td>{m.shots !== null ? `${m.shots} (${m.shots_on_target ?? 0})` : '-'}</td>
                    <td>{m.possession_pct !== null ? `${m.possession_pct}%` : '-'}</td>
                    <td style={{ color: 'var(--accent-gold)' }}>{m.xg !== null ? m.xg.toFixed(2) : '-'}</td>
                    <td>{m.pass_accuracy_pct !== null ? `${m.pass_accuracy_pct}%` : '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="inspect-match-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMatch(m.match_id);
                        }}
                      >
                        Inspect <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {matches.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'left', color: 'var(--accent-gold)' }}>
                    Season Total ({matches.length} Matches)
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--accent-gold)' }}>
                    {record.goals_for} - {record.goals_against}
                  </td>
                  <td>{team_averages?.total_shots ?? '-'}</td>
                  <td>{team_averages?.avg_possession_pct ? `${team_averages.avg_possession_pct}%` : '-'}</td>
                  <td>{team_averages?.total_xg ? team_averages.total_xg.toFixed(2) : '-'}</td>
                  <td>{team_averages?.avg_pass_accuracy_pct ? `${team_averages.avg_pass_accuracy_pct}%` : '-'}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};
