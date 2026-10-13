import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Activity,
  BarChart2,
  MapPin,
  Grid,
  CircleDot,
  AlertCircle,
  Box,
} from 'lucide-react';
import {
  MatchSummary,
  MatchAnalysis,
  PlayerStats,
  fetchMatches,
  fetchMatchAnalysis,
} from '../../services/api';
import { BarChart, BarChartItem } from '../visualizations/BarChart';
import { HeatMap } from '../visualizations/HeatMap';
import { ShotMap } from '../visualizations/ShotMap';
import { Treemap } from '../visualizations/Treemap';
import { PackedBubble } from '../visualizations/PackedBubble';
import { RadarChart } from '../visualizations/RadarChart';
import { PassingNetwork } from '../visualizations/PassingNetwork';
import { ScatterPlot } from '../visualizations/ScatterPlot';
import { DataTable } from '../visualizations/DataTable';
import { MatchTimeline } from '../visualizations/MatchTimeline';
import { VoronoiPitchControl } from '../visualizations/VoronoiPitchControl';
import { ThreeDShotTrajectory } from '../visualizations/ThreeDShotTrajectory';

interface ManagerDashboardProps {
  initialMatchId?: string | null;
  onNavigateToUpload?: () => void;
  onNavigateToHistory?: () => void;
}

// ── DESIGN TOKENS ───────────────────────────────────────────────────────────
const TOKENS = {
  bgCard: 'linear-gradient(180deg, #161C26 0%, #10151D 100%)',
  bgCardFlat: '#131922',
  bgInset: '#1B212B',
  track: '#262B33',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F2F4F7',
  textSecondary: '#A8AFB9',
  textMuted: '#6F7885',
  gold: '#D2AE5E',
  goldDim: 'rgba(210, 174, 94, 0.35)',
  blue: '#8FC8EE',
  green: '#5FD068',
  red: '#D9232D',
  yellowCard: '#F5C518',
  scoreGold: '#E8C97A',
};

// ── DOUBLE CONCENTRIC DONUT GAUGE ──────────────────────────────────────────
interface DoubleDonutProps {
  value: string;
  label: string;
  sublabel?: string;
  pct?: number; // 0 to 1
  type: 'gold' | 'blue' | 'twotone';
  centerColor?: string;
}

const DoubleConcentricGauge: React.FC<DoubleDonutProps> = ({
  value,
  label,
  sublabel,
  pct = 0.65,
  type,
  centerColor = '#E8C97A',
}) => {
  const size = 96;
  const strokeWidth = 5;
  const rOuter = 42;
  const rInner = 33;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;

  const sweep = Math.min(0.95, Math.max(0.1, pct));
  const outerFill = cOuter * sweep;
  const innerFill = cInner * sweep;

  const strokeColor = type === 'blue' ? TOKENS.blue : TOKENS.gold;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Dark tracks */}
          <circle cx={size / 2} cy={size / 2} r={rOuter} fill="none" stroke={TOKENS.track} strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={rInner} fill="none" stroke={TOKENS.track} strokeWidth={strokeWidth} />

          {/* Outer arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={rOuter}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${outerFill} ${cOuter - outerFill}`}
            strokeLinecap="round"
          />

          {/* Inner arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={rInner}
            fill="none"
            stroke={type === 'twotone' ? TOKENS.blue : strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${innerFill} ${cInner - innerFill}`}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: value.length > 4 ? '18px' : '21px',
            fontWeight: 700,
            color: centerColor,
            letterSpacing: '-0.02em',
            userSelect: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {value}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>{label}</div>
        {sublabel && <div style={{ fontSize: '10.5px', color: TOKENS.textMuted }}>{sublabel}</div>}
      </div>
    </div>
  );
};

// ── MAIN COMPONENT: ManagerDashboard ───────────────────────────────────────
export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  initialMatchId,
  onNavigateToUpload,
  onNavigateToHistory: _onNavigateToHistory,
}) => {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(initialMatchId || null);
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active visualization view tab
  type DashboardTab = 'squad_metrics' | 'spatial_analytics' | 'threed_analytics' | 'structure_distribution' | 'data_table';
  const [activeTab, setActiveTab] = useState<DashboardTab>('squad_metrics');

  // Selected player for deep tactical drill-down
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Bar chart metric selection
  type BarMetricKey = 'goals' | 'assists' | 'shots_total' | 'passes_completed' | 'tackles_won' | 'minutes_played';
  const [barMetric, setBarMetric] = useState<BarMetricKey>('goals');

  // Treemap metric selection
  const [treemapMetric, setTreemapMetric] = useState<'minutes_played' | 'passes_completed' | 'tackles_won'>('minutes_played');

  // Bubble metric selection
  const [bubbleMetric, setBubbleMetric] = useState<'passes_completed' | 'minutes_played' | 'tackles_won'>('passes_completed');

  // Spatial analytics sub-mode: passing network vs territorial Voronoi
  const [spatialMode, setSpatialMode] = useState<'network' | 'voronoi'>('network');

  // 1. Load matches list on mount
  useEffect(() => {
    let isMounted = true;
    fetchMatches()
      .then((data) => {
        if (!isMounted) return;
        setMatches(data);
        if (data.length > 0) {
          const matchToSelect = initialMatchId && data.some((m) => m.id === initialMatchId)
            ? initialMatchId
            : data[0].id;
          setCurrentMatchId(matchToSelect);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load fixtures');
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [initialMatchId]);

  // 2. Load match analysis when currentMatchId changes
  useEffect(() => {
    if (!currentMatchId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchMatchAnalysis(currentMatchId)
      .then((res) => {
        if (!isMounted) return;
        setAnalysis(res);
        // Default select first player with most minutes or goals
        if (res.players.length > 0) {
          const topPlayer = [...res.players].sort((a, b) => b.goals - a.goals || b.minutes_played - a.minutes_played)[0];
          setSelectedPlayerId(topPlayer.player_id);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load analysis for fixture');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentMatchId]);

  // Current selected player object
  const selectedPlayer: PlayerStats | null = useMemo(() => {
    if (!analysis || !selectedPlayerId) return null;
    return analysis.players.find((p) => p.player_id === selectedPlayerId) || analysis.players[0] || null;
  }, [analysis, selectedPlayerId]);

  // Bar chart data items
  const barChartData: BarChartItem[] = useMemo(() => {
    if (!analysis) return [];
    return analysis.players.map((p) => ({
      id: p.player_id,
      label: p.player_name.split(' ').pop() || p.player_name,
      value: (p as any)[barMetric] || 0,
      secondaryValue: p.minutes_played,
      category: p.primary_position,
    })).sort((a, b) => b.value - a.value);
  }, [analysis, barMetric]);

  // If no match data in database, show clean empty state
  if (!loading && matches.length === 0) {
    return (
      <div style={{ padding: '60px 40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            background: TOKENS.bgCard,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: '10px',
            padding: '48px 32px',
          }}
        >
          <div style={{ marginBottom: '16px', color: TOKENS.gold }}>
            <Activity size={48} style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
            No match records found
          </h2>
          <p style={{ fontSize: '13.5px', color: TOKENS.textSecondary, marginBottom: '24px', lineHeight: 1.5 }}>
            To inspect tactical telemetry and manager dashboards, import your first match dataset from the Import Match tab.
          </p>
          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              style={{
                background: 'rgba(200, 150, 62, 0.2)',
                border: '1px solid rgba(200, 150, 62, 0.5)',
                color: TOKENS.gold,
                borderRadius: '6px',
                padding: '10px 24px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to Match Upload
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !analysis) {
    return (
      <div style={{ padding: '80px 40px', textAlign: 'center', color: TOKENS.textSecondary }}>
        <div style={{ fontSize: '15px', fontWeight: 500 }}>Loading match analysis and tactical telemetry...</div>
      </div>
    );
  }

  // Error state
  if (error && !analysis) {
    return (
      <div style={{ padding: '60px 40px', maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ background: '#1c1315', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontWeight: 600 }}>
            <AlertCircle size={20} />
            <span>Analysis Service Error</span>
          </div>
          <div style={{ marginTop: '10px', fontSize: '13px', color: '#cbd5e1' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const match = analysis.match;
  const teamSum = analysis.team_summary;
  const teamStats = analysis.team_stats;

  return (
    <div
      style={{
        padding: '20px 33px 40px 33px',
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        color: TOKENS.textPrimary,
        fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif',
      }}
    >
      {/* ── TOP FIXTURE BAR & MATCH PICKER ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: `1px solid ${TOKENS.border}`,
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              {match.team} {match.score_team} - {match.score_opponent} {match.opponent}
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor:
                  match.result === 'W'
                    ? 'rgba(95, 208, 104, 0.18)'
                    : match.result === 'D'
                    ? 'rgba(245, 197, 24, 0.18)'
                    : 'rgba(217, 35, 45, 0.18)',
                color:
                  match.result === 'W'
                    ? TOKENS.green
                    : match.result === 'D'
                    ? TOKENS.yellowCard
                    : TOKENS.red,
                border: `1px solid ${
                  match.result === 'W'
                    ? 'rgba(95, 208, 104, 0.4)'
                    : match.result === 'D'
                    ? 'rgba(245, 197, 24, 0.4)'
                    : 'rgba(217, 35, 45, 0.4)'
                }`,
              }}
            >
              {match.result === 'W' ? 'VICTORY' : match.result === 'D' ? 'DRAW' : 'DEFEAT'}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: TOKENS.textSecondary, display: 'flex', gap: '14px' }}>
            <span>{match.competition} (Matchday {match.matchday || 1})</span>
            <span>Dated: {match.date}</span>
            {match.stadium && <span>Venue: {match.stadium}</span>}
            {match.referee && <span>Ref: {match.referee}</span>}
          </div>
        </div>

        {/* Fixture Selector Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: TOKENS.textMuted, fontWeight: 500 }}>Select Fixture:</span>
          <div style={{ position: 'relative' }}>
            <select
              value={currentMatchId || ''}
              onChange={(e) => setCurrentMatchId(e.target.value)}
              style={{
                background: '#161C26',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '8px 32px 8px 12px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  vs {m.opponent} ({m.result} {m.score_team}-{m.score_opponent}, {m.date})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: TOKENS.textMuted,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── ROW 1: MATCH KPIS & SUMMARY CARDS ──────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)',
          gap: '18px',
          alignItems: 'stretch',
        }}
      >
        {/* Card A: Tactical Match Scoreboard */}
        <div
          style={{
            background: TOKENS.bgCard,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF', marginBottom: '16px' }}>
            Tactical Match Summary
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '16px 0',
              borderTop: `1px solid ${TOKENS.border}`,
              borderBottom: `1px solid ${TOKENS.border}`,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF' }}>{match.team}</div>
              <div style={{ fontSize: '11.5px', color: TOKENS.textMuted }}>{match.home_away === 'home' ? 'Home' : 'Away'}</div>
            </div>

            <div
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                backgroundColor: '#1F2430',
                border: `1px solid ${TOKENS.goldDim}`,
                fontSize: '30px',
                fontWeight: 700,
                color: TOKENS.scoreGold,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {match.score_team} - {match.score_opponent}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: TOKENS.blue }}>{match.opponent}</div>
              <div style={{ fontSize: '11.5px', color: TOKENS.textMuted }}>{match.home_away === 'home' ? 'Away' : 'Home'}</div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginTop: '16px',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>Differential</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: teamSum.score_differential >= 0 ? TOKENS.green : TOKENS.red, fontFamily: 'var(--font-mono)' }}>
                {teamSum.score_differential > 0 ? `+${teamSum.score_differential}` : teamSum.score_differential}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>Clean Sheet</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: teamSum.is_clean_sheet ? TOKENS.green : TOKENS.textSecondary }}>
                {teamSum.is_clean_sheet ? 'YES' : 'NO'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>Total Fouls</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                {teamSum.total_fouls || teamStats.fouls || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Key Performance Indicators (KPIs) */}
        <div
          style={{
            background: TOKENS.bgCard,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF', marginBottom: '14px' }}>
            Key Performance Indicators (KPIs)
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              justifyItems: 'center',
              alignItems: 'center',
            }}
          >
            <DoubleConcentricGauge
              value={`${teamSum.possession_pct}%`}
              label="Possession"
              sublabel={`${(100 - teamSum.possession_pct).toFixed(1)}% Opp`}
              pct={teamSum.possession_pct / 100}
              type="gold"
              centerColor="#E8C97A"
            />
            <DoubleConcentricGauge
              value={`${teamStats.shots || 0}`}
              label="Total Shots"
              sublabel={`${teamStats.shots_on_target || 0} on target`}
              pct={Math.min(1, (teamStats.shots || 0) / 25)}
              type="blue"
              centerColor="#8FC8EE"
            />
            <DoubleConcentricGauge
              value={`${teamSum.xg.toFixed(2)}`}
              label="Expected Goals"
              sublabel="Cumulative xG"
              pct={Math.min(1, teamSum.xg / 4)}
              type="twotone"
              centerColor="#E8C97A"
            />
            <DoubleConcentricGauge
              value={`${teamSum.pass_accuracy_pct}%`}
              label="Pass Accuracy"
              sublabel={`${teamStats.passes_completed || 0} completed`}
              pct={teamSum.pass_accuracy_pct / 100}
              type="gold"
              centerColor="#5FD068"
            />
          </div>

          {/* Tactical Progress Bars */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px 24px',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: `1px solid ${TOKENS.border}`,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: TOKENS.gold }}>Shot Conversion: {teamSum.shot_conversion_pct}%</span>
                <span style={{ color: TOKENS.textMuted }}>{match.score_team} goals from {teamStats.shots || 0} shots</span>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: TOKENS.track, borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, teamSum.shot_conversion_pct * 3)}%`, height: '100%', backgroundColor: TOKENS.gold }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: TOKENS.blue }}>Shot Accuracy: {teamSum.shot_accuracy_pct}%</span>
                <span style={{ color: TOKENS.textMuted }}>{teamStats.shots_on_target || 0} on target</span>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: TOKENS.track, borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, teamSum.shot_accuracy_pct)}%`, height: '100%', backgroundColor: TOKENS.blue }} />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ── MATCH CHRONOLOGY & EVENT STREAM (D3) ─────────────────────────── */}
      <div
        style={{
          background: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '10px',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Match Chronology &amp; Event Stream (D3 Timeline)</div>
            <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>
              Minute-by-minute timeline (0' - 90'+) of goals, shots, fouls, and defensive interventions
            </div>
          </div>
        </div>
        <MatchTimeline
          events={analysis.events}
          players={analysis.players}
          height={165}
          onSelectPlayer={(pid) => setSelectedPlayerId(pid)}
        />
      </div>

      {/* ── VISUALIZATIONS SUITE NAVIGATION TABS ───────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${TOKENS.border}`, gap: '8px' }}>
        {[
          { key: 'squad_metrics', label: 'Squad Metrics (Bar & Radar)', icon: BarChart2 },
          { key: 'spatial_analytics', label: 'Pitch & Spatial (Heat & Shots)', icon: MapPin },
          { key: 'threed_analytics', label: '3D Analytics & Feature Space', icon: Box },
          { key: 'structure_distribution', label: 'Hierarchy & Clusters (Treemap & Bubble)', icon: Grid },
          { key: 'data_table', label: 'Statistical Matrix (Table)', icon: CircleDot },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as DashboardTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: isActive ? 'rgba(210, 174, 94, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${TOKENS.gold}` : '2px solid transparent',
                color: isActive ? '#FFFFFF' : TOKENS.textSecondary,
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              <Icon size={15} color={isActive ? TOKENS.gold : TOKENS.textMuted} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: SQUAD METRICS (D3 Bar Chart & D3 Radar Chart Profile) ────── */}
      {activeTab === 'squad_metrics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start', width: '100%' }}>
          {/* Bar Chart Section */}
          <div
            style={{
              background: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>Squad Comparison (D3 Bar Chart)</div>
                <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>Click any bar to inspect player tactical profile</div>
              </div>

              {/* Metric Pickers */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { key: 'goals', label: 'Goals' },
                  { key: 'assists', label: 'Assists' },
                  { key: 'shots_total', label: 'Shots' },
                  { key: 'passes_completed', label: 'Passes' },
                  { key: 'tackles_won', label: 'Tackles' },
                  { key: 'minutes_played', label: 'Minutes' },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setBarMetric(m.key as BarMetricKey)}
                    style={{
                      background: barMetric === m.key ? 'rgba(210, 174, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${barMetric === m.key ? TOKENS.gold : 'rgba(255, 255, 255, 0.1)'}`,
                      color: barMetric === m.key ? TOKENS.gold : TOKENS.textSecondary,
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <BarChart
              data={barChartData}
              metricLabel={barMetric.replace('_', ' ')}
              xLabel="Squad Member"
              yLabel={barMetric.replace('_', ' ').toUpperCase()}
              height={320}
              onSelect={(pid) => setSelectedPlayerId(pid)}
              selectedId={selectedPlayerId}
            />
          </div>

          {/* Tactical Player Profile Card (Radar Chart) */}
          {selectedPlayer ? (
            <div
              style={{
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>
                    #{selectedPlayer.jersey_number} {selectedPlayer.player_name}
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.gold, fontWeight: 500 }}>
                    {selectedPlayer.detailed_position || selectedPlayer.primary_position} &bull; {selectedPlayer.minutes_played} Minutes
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: TOKENS.bgInset,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: selectedPlayer.is_starter ? TOKENS.green : TOKENS.blue,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {selectedPlayer.is_starter ? 'Starter' : 'Substitute'}
                </div>
              </div>

              {/* D3 Radar Chart */}
              <div style={{ textAlign: 'center', margin: '4px 0' }}>
                <RadarChart
                  data={selectedPlayer.radar_profile}
                  playerName={selectedPlayer.player_name}
                  size={260}
                  color={TOKENS.gold}
                />
              </div>

              {/* Core Stats Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  backgroundColor: '#0f141d',
                  borderRadius: '6px',
                  padding: '10px',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '10.5px', color: TOKENS.textMuted }}>Goals / Assists</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {selectedPlayer.goals} / {selectedPlayer.assists}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10.5px', color: TOKENS.textMuted }}>Pass Accuracy</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: TOKENS.gold, fontFamily: 'var(--font-mono)' }}>
                    {selectedPlayer.rates?.pass_accuracy_pct || 0}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10.5px', color: TOKENS.textMuted }}>Tackles Won</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: TOKENS.blue, fontFamily: 'var(--font-mono)' }}>
                    {selectedPlayer.tackles_won}
                  </div>
                </div>
              </div>

              {/* Per-90 Normalization Highlights */}
              <div style={{ fontSize: '11.5px', color: TOKENS.textSecondary, borderTop: `1px solid ${TOKENS.border}`, paddingTop: '10px' }}>
                <span style={{ fontWeight: 600, color: '#FFFFFF' }}>Per-90 Baseline: </span>
                <span>{selectedPlayer.per_90?.shots_per_90 || 0} shots/90 &bull; </span>
                <span>{selectedPlayer.per_90?.passes_completed_per_90 || 0} passes/90 &bull; </span>
                <span>{selectedPlayer.per_90?.tackles_won_per_90 || 0} tackles/90</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: TOKENS.textMuted }}>
              Select a player to view their tactical radar profile.
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: PITCH & SPATIAL ANALYTICS (HeatMap, ShotMap, PassingNetwork) */}
      {activeTab === 'spatial_analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Row A: Heatmap & Shotmap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px' }}>
            {/* Heat Map Card */}
            <div
              style={{
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>Pitch Activity Heatmap (D3)</div>
                <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>
                  Thermal touch &amp; event density across pitch coordinates (0-100 normalized)
                </div>
              </div>
              <HeatMap
                events={analysis.events}
                players={analysis.players}
                height={350}
              />
            </div>

            {/* Shot Map Card */}
            <div
              style={{
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>Attacking Half Shot Map (D3)</div>
                <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>
                  Shot locations with Expected Goals (xG) bubble diameter and outcome tags
                </div>
              </div>
              <ShotMap
                events={analysis.events}
                height={350}
              />
            </div>
          </div>

          {/* Row B: Tactical Passing Network & Territorial Voronoi Pitch Control */}
          <div
            style={{
              background: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>
                  {spatialMode === 'network' ? 'Tactical Passing Network (D3)' : 'Territorial Voronoi Pitch Control (D3)'}
                </div>
                <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>
                  {spatialMode === 'network'
                    ? 'Average player event positions and passing connection links weighted by frequency'
                    : 'Territorial Voronoi tessellation mapping each player\'s pitch influence and spatial dominance zone'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Spatial Mode Selector */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '4px' }}>
                  <button
                    onClick={() => setSpatialMode('network')}
                    style={{
                      background: spatialMode === 'network' ? 'rgba(210, 174, 94, 0.25)' : 'transparent',
                      border: `1px solid ${spatialMode === 'network' ? TOKENS.gold : 'transparent'}`,
                      color: spatialMode === 'network' ? TOKENS.gold : TOKENS.textSecondary,
                      padding: '3px 10px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Passing Network
                  </button>
                  <button
                    onClick={() => setSpatialMode('voronoi')}
                    style={{
                      background: spatialMode === 'voronoi' ? 'rgba(210, 174, 94, 0.25)' : 'transparent',
                      border: `1px solid ${spatialMode === 'voronoi' ? TOKENS.gold : 'transparent'}`,
                      color: spatialMode === 'voronoi' ? TOKENS.gold : TOKENS.textSecondary,
                      padding: '3px 10px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Voronoi Pitch Control
                  </button>
                </div>

                {selectedPlayerId && (
                  <button
                    onClick={() => setSelectedPlayerId(null)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: TOKENS.textSecondary,
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            {spatialMode === 'network' ? (
              <PassingNetwork
                events={analysis.events}
                players={analysis.players}
                height={360}
                onSelectPlayer={(pid) => setSelectedPlayerId(pid)}
                selectedPlayerId={selectedPlayerId}
              />
            ) : (
              <VoronoiPitchControl
                events={analysis.events}
                players={analysis.players}
                height={360}
                onSelectPlayer={(pid) => setSelectedPlayerId(pid)}
                selectedPlayerId={selectedPlayerId}
              />
            )}
          </div>
        </div>
      )}

      {/* ── TAB: 3D DATA SCIENCE ANALYTICS & FEATURE SPACE ─────────────────── */}
      {activeTab === 'threed_analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sub-mode navigation for 3D Visualizations */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              background: 'linear-gradient(180deg, #161c26 0%, #10151d 100%)',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              padding: '12px 16px',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Box size={18} color={TOKENS.gold} />
                <span>3D Tactical Shot Arcs &amp; Trajectories (Three.js WebGL)</span>
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                3D spatial ball trajectories with goal frame net wireframe, apex heights, and interactive outcome raycasting.
              </div>
            </div>
          </div>

          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '10px', padding: '18px' }}>
            <ThreeDShotTrajectory events={analysis.events} players={analysis.players} height={520} />
          </div>
        </div>
      )}

      {/* ── TAB 3: STRUCTURE & DISTRIBUTION (Treemap, PackedBubble, ScatterPlot) */}
      {activeTab === 'structure_distribution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Row A: Treemap & Packed Bubble */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
            {/* Treemap Card */}
            <div
              style={{
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>Squad Contribution Treemap (D3)</div>
                  <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>Overall game contribution share across squad members</div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { key: 'minutes_played', label: 'Minutes' },
                    { key: 'passes_completed', label: 'Passes' },
                    { key: 'tackles_won', label: 'Tackles' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setTreemapMetric(m.key as any)}
                      style={{
                        background: treemapMetric === m.key ? 'rgba(210, 174, 94, 0.2)' : 'transparent',
                        border: `1px solid ${treemapMetric === m.key ? TOKENS.gold : 'rgba(255, 255, 255, 0.1)'}`,
                        color: treemapMetric === m.key ? TOKENS.gold : TOKENS.textSecondary,
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <Treemap
                players={analysis.players}
                metricKey={treemapMetric}
                height={320}
                onSelectPlayer={(pid) => setSelectedPlayerId(pid)}
                selectedPlayerId={selectedPlayerId}
              />
            </div>

            {/* Packed Bubble Card */}
            <div
              style={{
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>Squad Volume Packed Bubble (D3)</div>
                  <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>Cluster sizes mapped to player output metrics</div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { key: 'passes_completed', label: 'Passes' },
                    { key: 'minutes_played', label: 'Minutes' },
                    { key: 'tackles_won', label: 'Tackles' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setBubbleMetric(m.key as any)}
                      style={{
                        background: bubbleMetric === m.key ? 'rgba(210, 174, 94, 0.2)' : 'transparent',
                        border: `1px solid ${bubbleMetric === m.key ? TOKENS.gold : 'rgba(255, 255, 255, 0.1)'}`,
                        color: bubbleMetric === m.key ? TOKENS.gold : TOKENS.textSecondary,
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <PackedBubble
                players={analysis.players}
                metricKey={bubbleMetric}
                height={320}
                onSelectPlayer={(pid) => setSelectedPlayerId(pid)}
                selectedPlayerId={selectedPlayerId}
              />
            </div>
          </div>

          {/* Row B: Tactical Scatter Plot */}
          <div
            style={{
              background: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>Metric Correlation Scatter Plot (D3)</div>
              <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>
                Quadrant scatter analysis comparing two configurable analytical metrics across squad players
              </div>
            </div>
            <ScatterPlot
              players={analysis.players}
              height={340}
              onSelectPlayer={(pid) => setSelectedPlayerId(pid)}
              selectedPlayerId={selectedPlayerId}
            />
          </div>
        </div>
      )}

      {/* ── TAB 4: PLAYER STATISTICS MATRIX (DataTable) ────────────────────── */}
      {activeTab === 'data_table' && (
        <div
          style={{
            background: TOKENS.bgCard,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: '10px',
            padding: '18px',
          }}
        >
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>Full Match Performance Matrix</div>
            <div style={{ fontSize: '11.5px', color: TOKENS.textMuted }}>
              Sortable, searchable player data table with Per-90 baseline normalizations (Rule 10 standard)
            </div>
          </div>
          <DataTable
            players={analysis.players}
            onSelectPlayer={(pid) => setSelectedPlayerId(pid)}
            selectedPlayerId={selectedPlayerId}
          />
        </div>
      )}
    </div>
  );
};
