import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Activity,
  MapPin,
  Grid,
  CircleDot,
  AlertCircle,
  Box,
  Calendar,
  Clock,
  Shield,
  ArrowRight,
  Search,
  Upload,
  LayoutGrid,
} from 'lucide-react';
import {
  MatchSummary,
  MatchAnalysis,
  FixtureItem,
  fetchMatches,
  fetchMatchAnalysis,
  fetchFixtures,
  fetchFocusTeam,
} from '../../services/api';
import { HeatMap } from '../visualizations/HeatMap';
import { ShotMap } from '../visualizations/ShotMap';
import { RadarChart } from '../visualizations/RadarChart';
import { PassingNetwork } from '../visualizations/PassingNetwork';
import { MatchTimeline } from '../visualizations/MatchTimeline';
import { VoronoiPitchControl } from '../visualizations/VoronoiPitchControl';
import { ThreeDShotTrajectory } from '../visualizations/ThreeDShotTrajectory';
import { Treemap } from '../visualizations/Treemap';
import { PackedBubble } from '../visualizations/PackedBubble';
import { BorderGlow } from '../BorderGlow/BorderGlow';
import { FixtureUploadModal } from './FixtureUploadModal';
import { JellyRadio } from '../JellyRadio/JellyRadio';
import { getActiveTactic, TacticConfiguration } from '../../services/tacticService';
import playerHeads from '../../assets/player-heads.jpg';

// Photographic player headshots sprite map
const PLAYER_AVATAR_COORDS: Record<string, { x: number; y: number }> = {
  p_cole_palmer: { x: 50, y: 0 },
  p_nicolas_jackson: { x: 0, y: 0 },
  p_moises_caicedo: { x: 50, y: 50 },
  p_enzo_fernandez: { x: 0, y: 50 },
  p_levi_colwill: { x: 50, y: 100 },
  p_malo_gusto: { x: 100, y: 50 },
  p_robert_sanchez: { x: 100, y: 100 },
};

const getPlayerAvatarStyle = (playerId: string): React.CSSProperties => {
  const coords = PLAYER_AVATAR_COORDS[playerId] || {
    x: (Math.abs(playerId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 3) * 50,
    y: (Math.abs(playerId.length) % 3) * 50,
  };
  return {
    backgroundImage: `url(${playerHeads})`,
    backgroundSize: '300% 300%',
    backgroundPosition: `${coords.x}% ${coords.y}%`,
    backgroundRepeat: 'no-repeat',
  };
};

interface ManagerDashboardProps {
  initialMatchId?: string | null;
  managedTeam?: string;
  onNavigateToUpload?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToTactics?: () => void;
  onNavigateToOpponents?: (opponentName?: string) => void;
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
  const size = 104;
  const strokeWidth = 5.5;
  const rOuter = 45;
  const rInner = 35;
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
            fontSize: value.length > 4 ? '19px' : '23px',
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
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#FFFFFF' }}>{label}</div>
        {sublabel && <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>{sublabel}</div>}
      </div>
    </div>
  );
};

// ── MAIN COMPONENT: ManagerDashboard ───────────────────────────────────────
export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  initialMatchId,
  managedTeam: propManagedTeam,
  onNavigateToUpload,
  onNavigateToHistory,
  onNavigateToTactics,
}) => {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(initialMatchId || null);
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active matchday tactic state
  const [activeTactic, setActiveTactic] = useState<TacticConfiguration>(() => getActiveTactic());

  useEffect(() => {
    const handleTacticUpdate = (e: any) => {
      if (e.detail) setActiveTactic(e.detail);
    };
    window.addEventListener('tactic-updated', handleTacticUpdate);
    return () => window.removeEventListener('tactic-updated', handleTacticUpdate);
  }, []);

  // Fixtures and upcoming matches state
  const [fixtures, setFixtures] = useState<FixtureItem[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState<boolean>(true);
  const [managedTeam, setManagedTeam] = useState<string>(propManagedTeam || 'Chelsea');
  const [activeView, setActiveView] = useState<'upcoming' | 'analysis'>(initialMatchId ? 'analysis' : 'upcoming');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'First Half' | 'Second Half'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fixture upload / result recording modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadTargetFixture, setUploadTargetFixture] = useState<FixtureItem | null>(null);

  // Active whole-team visualization view tab (Strictly whole-team stats in Matches tab)
  type DashboardTab = 'team_profile' | 'spatial_analytics' | 'threed_analytics' | 'squad_contribution' | 'structure_distribution' | 'team_matrix';
  const [activeTab, setActiveTab] = useState<DashboardTab>('team_profile');
  const [squadVizMode, setSquadVizMode] = useState<'treemap' | 'bubble'>('treemap');
  const [selectedDashboardPlayerId, setSelectedDashboardPlayerId] = useState<string | null>(null);

  // Spatial analytics sub-mode: passing network vs territorial Voronoi
  const [spatialMode, setSpatialMode] = useState<'network' | 'voronoi'>('network');

  // Keep managed team in sync
  useEffect(() => {
    if (propManagedTeam) {
      setManagedTeam(propManagedTeam);
    } else {
      fetchFocusTeam().then(setManagedTeam).catch(() => {});
    }
  }, [propManagedTeam]);

  // Load official season fixtures for managed club
  useEffect(() => {
    let isMounted = true;
    setLoadingFixtures(true);
    fetchFixtures(managedTeam)
      .then((data) => {
        if (!isMounted) return;
        setFixtures(data);
        setLoadingFixtures(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoadingFixtures(false);
      });
    return () => {
      isMounted = false;
    };
  }, [managedTeam]);

  // Handle external match selection navigation
  useEffect(() => {
    if (initialMatchId) {
      setCurrentMatchId(initialMatchId);
      setActiveView('analysis');
    } else {
      setActiveView('upcoming');
    }
  }, [initialMatchId]);

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

  const upcomingFixtures = useMemo(() => {
    return fixtures.filter((f) => f.status === 'scheduled');
  }, [fixtures]);

  const filteredUpcomingFixtures = useMemo(() => {
    return upcomingFixtures.filter((f) => {
      const matchPhase = phaseFilter === 'all' || f.phase === phaseFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        f.home_team.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.away_team.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(f.matchweek).includes(searchQuery);
      return matchPhase && matchSearch;
    });
  }, [upcomingFixtures, phaseFilter, searchQuery]);

  const nextFixture = useMemo(() => {
    return upcomingFixtures.length > 0 ? upcomingFixtures[0] : null;
  }, [upcomingFixtures]);

  const homeUpcomingCount = useMemo(() => {
    return upcomingFixtures.filter((f) => f.home_team === managedTeam).length;
  }, [upcomingFixtures, managedTeam]);

  const awayUpcomingCount = useMemo(() => {
    return upcomingFixtures.filter((f) => f.away_team === managedTeam).length;
  }, [upcomingFixtures, managedTeam]);

  // Sub-render: Empty Played Matches State
  const renderEmptyPlayedMatches = () => (
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
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            onClick={() => setActiveView('upcoming')}
            style={{
              background: 'transparent',
              border: `1px solid ${TOKENS.border}`,
              color: '#ffffff',
              borderRadius: '6px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View Upcoming Matches
          </button>
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
    </div>
  );

  // Sub-render: Upcoming Matches View
  const renderUpcomingView = () => {
    const isHome = nextFixture ? nextFixture.home_team === managedTeam : false;
    const nextOpponent = nextFixture ? (isHome ? nextFixture.away_team : nextFixture.home_team) : 'None';
    const venueLabel = isHome ? `${managedTeam} Stadium (Home)` : `${nextOpponent} Stadium (Away)`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Header Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: TOKENS.gold,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  background: 'rgba(210, 174, 94, 0.12)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(210, 174, 94, 0.3)',
                }}
              >
                Manager Tactical Portal
              </span>
              <span style={{ fontSize: '13px', color: TOKENS.textMuted }}>Season 2024-25</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px 0' }}>
              Upcoming Fixtures &amp; Match Preparation
            </h1>
            <p style={{ fontSize: '13.5px', color: TOKENS.textSecondary, margin: 0 }}>
              Tactical preparation schedule, opposition scouting blueprints, and upcoming matchweeks for {managedTeam}.
            </p>
          </div>

          {/* KPI Chips */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ background: '#121721', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Next Opponent</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: TOKENS.gold }}>{nextOpponent}</div>
            </div>
            <div style={{ background: '#121721', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Scheduled</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{upcomingFixtures.length}</div>
            </div>
            <div style={{ background: '#121721', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Home / Away</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: TOKENS.blue, fontFamily: 'var(--font-mono)' }}>{homeUpcomingCount}H / {awayUpcomingCount}A</div>
            </div>
          </div>
        </div>

        {/* Hero Card: Next Match Spotlight */}
        {nextFixture && (
          <div
            style={{
              background: TOKENS.bgCard,
              border: `1px solid rgba(210, 174, 94, 0.35)`,
              borderRadius: '12px',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: `1px solid ${TOKENS.border}`, paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    background: 'rgba(210, 174, 94, 0.2)',
                    color: TOKENS.gold,
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  NEXT MATCH SPOTLIGHT
                </span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                  Matchweek {nextFixture.matchweek} &bull; {nextFixture.phase}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: TOKENS.textSecondary, fontSize: '13px' }}>
                <Clock size={14} color={TOKENS.gold} />
                <span>Kickoff Scheduled: {nextFixture.date}</span>
                <span style={{ margin: '0 4px' }}>&bull;</span>
                <MapPin size={14} />
                <span>{venueLabel}</span>
              </div>
            </div>

            {/* Scoreboard Versus Display */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '20px',
                padding: '10px 0',
              }}
            >
              {/* Home Team */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: '#1a2230',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: nextFixture.home_team === managedTeam ? TOKENS.gold : '#ffffff',
                    fontWeight: 800,
                    fontSize: '18px',
                  }}
                >
                  <Shield size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                    {nextFixture.home_team}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: nextFixture.home_team === managedTeam ? 'rgba(210, 174, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: nextFixture.home_team === managedTeam ? TOKENS.gold : TOKENS.textSecondary,
                      }}
                    >
                      HOME {nextFixture.home_team === managedTeam && '(Your Team)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Center VS Badge */}
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    background: '#1a202c',
                    border: '1px solid rgba(210, 174, 94, 0.4)',
                    color: TOKENS.gold,
                    fontSize: '14px',
                    fontWeight: 800,
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    letterSpacing: '0.08em',
                  }}
                >
                  VS
                </div>
                <span style={{ fontSize: '11px', color: TOKENS.textMuted }}>Matchweek {nextFixture.matchweek}</span>
              </div>

              {/* Away Team */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                    {nextFixture.away_team}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: nextFixture.away_team === managedTeam ? 'rgba(210, 174, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: nextFixture.away_team === managedTeam ? TOKENS.gold : TOKENS.textSecondary,
                      }}
                    >
                      AWAY {nextFixture.away_team === managedTeam && '(Your Team)'}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: '#1a2230',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: nextFixture.away_team === managedTeam ? TOKENS.gold : '#ffffff',
                    fontWeight: 800,
                    fontSize: '18px',
                  }}
                >
                  <Shield size={24} />
                </div>
              </div>
            </div>

            {/* Tactical Preparation Directives Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                paddingTop: '14px',
                borderTop: `1px solid ${TOKENS.border}`,
              }}
            >
              <div style={{ background: '#121622', border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '11.5px', color: TOKENS.gold, fontWeight: 600, textTransform: 'uppercase' }}>
                    Tactical Structure
                  </div>
                  {onNavigateToTactics && (
                    <button
                      onClick={onNavigateToTactics}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: TOKENS.blue,
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      Tactic Setter &rarr;
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>
                  {activeTactic.formation} Setup
                </div>
                <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                  {activeTactic.name} • {activeTactic.inPossession.width} width
                </div>
              </div>

              <div style={{ background: '#121622', border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11.5px', color: TOKENS.gold, fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Strategic Directive
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>
                  {activeTactic.inTransition.lossTransition === 'counter_press' ? 'Immediate Counter-Press' : 'Disciplined Regroup'}
                </div>
                <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                  {activeTactic.outOfPossession.defensiveLine === 'high_line' ? 'High defensive line' : 'Mid/Low block'} &amp; {activeTactic.inPossession.tempo} tempo
                </div>
              </div>

              <div
                onClick={() => {
                  if (onNavigateToOpponents) onNavigateToOpponents(nextOpponent);
                  else if (onNavigateToTactics) onNavigateToTactics();
                }}
                style={{
                  background: '#121622',
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
                title={`Inspect Opponents Tactics & Scouting for ${nextOpponent}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '11.5px', color: TOKENS.gold, fontWeight: 600, textTransform: 'uppercase' }}>
                    Scouting Focus
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 600 }}>Inspect &rarr;</span>
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>{nextOpponent} Channels</div>
                <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>Nullify direct counter-runs into wide defensive pockets</div>
              </div>

              <div style={{ background: '#121622', border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11.5px', color: TOKENS.gold, fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Target Benchmark
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>60%+ Possession &amp; 3 Pts</div>
                <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>Sustain tactical dominance and maintain pass accuracy above 85%</div>
              </div>
            </div>

            {/* Post-Match Upload / Record Action Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: `1px solid ${TOKENS.border}`,
                backgroundColor: 'rgba(210, 174, 94, 0.05)',
                margin: '16px -20px -20px -20px',
                padding: '14px 20px',
                borderBottomLeftRadius: '10px',
                borderBottomRightRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={15} color={TOKENS.gold} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  Match Completed?
                </span>
                <span style={{ fontSize: '12.5px', color: TOKENS.textSecondary }}>
                  Upload match telemetry or record results for Matchweek {nextFixture.matchweek}
                </span>
              </div>

              <button
                onClick={() => {
                  setUploadTargetFixture(nextFixture);
                  setIsUploadModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  backgroundColor: TOKENS.gold,
                  color: '#0e121a',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Upload size={14} />
                <span>Upload Match Data</span>
              </button>
            </div>
          </div>
        )}

        {/* Recent Played Matches Quick Access */}
        {matches.length > 0 && (
          <div
            style={{
              background: '#121721',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={16} color={TOKENS.gold} />
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>
                Completed Matches in Telemetry System ({matches.length}):
              </span>
              <span style={{ fontSize: '13px', color: TOKENS.textSecondary }}>
                Latest: vs {matches[0].opponent} ({matches[0].result} {matches[0].score_team}-{matches[0].score_opponent}, {matches[0].date})
              </span>
            </div>
            <button
              onClick={() => {
                setCurrentMatchId(matches[0].id);
                setActiveView('analysis');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(210, 174, 94, 0.15)',
                border: '1px solid rgba(210, 174, 94, 0.4)',
                color: TOKENS.gold,
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Inspect Match Telemetry</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Upcoming Fixtures Schedule Slate */}
        <div
          style={{
            background: TOKENS.bgCardFlat,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: '10px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Schedule Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Upcoming Match Schedule ({filteredUpcomingFixtures.length})
              </div>
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>
                Premier League 2024-25 fixture allocation in chronological sequence
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Phase Switcher */}
              <JellyRadio
                size="sm"
                items={[
                  { value: 'all', label: 'All Phases' },
                  { value: 'First Half', label: 'First Half' },
                  { value: 'Second Half', label: 'Second Half' },
                ]}
                value={phaseFilter}
                onChange={(val) => setPhaseFilter(val as any)}
              />

              {/* Search input */}
              <div style={{ position: 'relative', minWidth: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: TOKENS.textMuted }} />
                <input
                  type="text"
                  placeholder="Filter opponent or MW..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0e1219',
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: '6px',
                    padding: '6px 12px 6px 30px',
                    fontSize: '12.5px',
                    color: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Fixtures Grid */}
          {loadingFixtures ? (
            <div style={{ padding: '30px', textAlign: 'center', color: TOKENS.textMuted }}>
              Loading upcoming schedule...
            </div>
          ) : filteredUpcomingFixtures.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: TOKENS.textMuted }}>
              No upcoming fixtures match your search or phase filter.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px',
              }}
            >
              {filteredUpcomingFixtures.map((f) => {
                const isHomeGame = f.home_team === managedTeam;
                const opp = isHomeGame ? f.away_team : f.home_team;

                return (
                  <div
                    key={f.fixture_id}
                    style={{
                      background: '#121620',
                      border: `1px solid ${TOKENS.border}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        MW {f.matchweek}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: isHomeGame ? 'rgba(210, 174, 94, 0.15)' : 'rgba(143, 200, 238, 0.15)',
                          color: isHomeGame ? TOKENS.gold : TOKENS.blue,
                          border: `1px solid ${isHomeGame ? 'rgba(210, 174, 94, 0.3)' : 'rgba(143, 200, 238, 0.3)'}`,
                        }}
                      >
                        {isHomeGame ? 'HOME' : 'AWAY'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Shield size={18} color={isHomeGame ? TOKENS.gold : TOKENS.blue} />
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                        vs {opp}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: TOKENS.textMuted, paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span>{f.date}</span>
                      <span>{f.phase}</span>
                    </div>

                    <button
                      onClick={() => {
                        setUploadTargetFixture(f);
                        setIsUploadModalOpen(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: TOKENS.textPrimary,
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: '2px',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <Upload size={12} color={TOKENS.gold} />
                      <span>Upload Match Data</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const match = analysis?.match;
  const teamSum = analysis?.team_summary;
  const teamStats = analysis?.team_stats;

  // 1. Team vs Opponent Match Attribute Profile (Dual Radar)
  const teamRadarProfile = useMemo(() => {
    if (!match || !teamSum || !teamStats) {
      return {
        Attacking: 60,
        Circulation: 65,
        Dominance: 55,
        Solidity: 60,
        Mobility: 58,
      };
    }
    const attackingScore = Math.min(98, Math.max(25, Math.round(
      20 + (match.score_team * 16) + ((teamStats.shots || 0) * 1.5) + (teamSum.xg * 12)
    )));
    const circulationScore = Math.min(98, Math.max(25, Math.round(
      (teamSum.pass_accuracy_pct * 0.7) + (Math.min(500, teamStats.passes_completed || 0) / 500 * 25)
    )));
    const dominanceScore = Math.min(98, Math.max(25, Math.round(
      (teamSum.possession_pct * 0.8) + (Math.min(10, teamStats.corners || 0) * 2)
    )));
    const solidityScore = Math.min(98, Math.max(25, Math.round(
      (teamSum.is_clean_sheet ? 35 : Math.max(10, 30 - match.score_opponent * 10)) +
      Math.min(30, (teamStats.tackles_won || 0) * 2) +
      Math.min(25, (teamStats.interceptions || 0) * 2)
    )));
    const mobilityScore = Math.min(98, Math.max(25, Math.round(
      30 + ((teamStats.tackles_total || 15) * 1.2) + ((teamStats.recoveries || 20) * 0.8)
    )));

    return {
      Attacking: attackingScore,
      Circulation: circulationScore,
      Dominance: dominanceScore,
      Solidity: solidityScore,
      Mobility: mobilityScore,
    };
  }, [match, teamSum, teamStats]);

  const opponentRadarProfile = useMemo(() => {
    if (!match || !teamSum || !teamStats) {
      return {
        Attacking: 50,
        Circulation: 50,
        Dominance: 50,
        Solidity: 50,
        Mobility: 50,
      };
    }
    const oppPoss = Math.max(15, 100 - teamSum.possession_pct);
    const oppPassAcc = Math.max(60, Math.min(92, Math.round(165 - teamSum.pass_accuracy_pct)));
    const oppShots = Math.max(2, Math.round(match.score_opponent * 4 + 4));
    const oppXg = Math.max(0.2, Number((match.score_opponent * 0.75 + 0.3).toFixed(2)));

    const attackingScore = Math.min(98, Math.max(20, Math.round(
      20 + (match.score_opponent * 18) + (oppShots * 1.6) + (oppXg * 14)
    )));
    const circulationScore = Math.min(98, Math.max(20, Math.round(
      (oppPassAcc * 0.7) + (oppPoss * 0.25)
    )));
    const dominanceScore = Math.min(98, Math.max(20, Math.round(
      (oppPoss * 0.85) + (Math.max(1, 10 - (teamStats.corners || 5)) * 1.5)
    )));
    const solidityScore = Math.min(98, Math.max(20, Math.round(
      (match.score_team === 0 ? 35 : Math.max(10, 30 - match.score_team * 10)) + 30
    )));
    const mobilityScore = Math.min(98, Math.max(20, Math.round(
      35 + oppPoss * 0.35
    )));

    return {
      Attacking: attackingScore,
      Circulation: circulationScore,
      Dominance: dominanceScore,
      Solidity: solidityScore,
      Mobility: mobilityScore,
    };
  }, [match, teamSum, teamStats]);

  // 2. Match Phase Splits (1st Half vs 2nd Half)
  const matchSplits = useMemo(() => {
    if (!analysis || !analysis.events) {
      return {
        h1: { goals: 0, xg: 0.5, shots: 5, passAcc: 83, possession: 52, tackles: 6, fouls: 5 },
        h2: { goals: 0, xg: 0.7, shots: 6, passAcc: 86, possession: 55, tackles: 8, fouls: 6 },
      };
    }
    const events = analysis.events;
    const h1Events = events.filter((e) => e.minute <= 45);
    const h2Events = events.filter((e) => e.minute > 45);

    const h1Shots = h1Events.filter((e) => e.event_type === 'shot');
    const h2Shots = h2Events.filter((e) => e.event_type === 'shot');

    const h1Goals = h1Shots.filter((e) => e.outcome === 'successful').length;
    const h2Goals = h2Shots.filter((e) => e.outcome === 'successful').length;

    const h1Xg = Number(h1Shots.reduce((sum, s) => sum + (s.metadata?.xg || 0.12), 0).toFixed(2));
    const h2Xg = Number(h2Shots.reduce((sum, s) => sum + (s.metadata?.xg || 0.12), 0).toFixed(2));

    const h1Passes = h1Events.filter((e) => e.event_type === 'pass');
    const h2Passes = h2Events.filter((e) => e.event_type === 'pass');
    const h1PassSuccess = h1Passes.filter((e) => e.outcome === 'successful').length;
    const h2PassSuccess = h2Passes.filter((e) => e.outcome === 'successful').length;

    const h1PassAcc = h1Passes.length > 0 ? Math.round((h1PassSuccess / h1Passes.length) * 100) : 83;
    const h2PassAcc = h2Passes.length > 0 ? Math.round((h2PassSuccess / h2Passes.length) * 100) : 86;

    const h1Tackles = h1Events.filter((e) => e.event_type === 'tackle' && e.outcome === 'successful').length;
    const h2Tackles = h2Events.filter((e) => e.event_type === 'tackle' && e.outcome === 'successful').length;

    const h1Fouls = h1Events.filter((e) => e.event_type === 'foul').length;
    const h2Fouls = h2Events.filter((e) => e.event_type === 'foul').length;

    return {
      h1: {
        goals: h1Goals,
        xg: h1Xg || 0.45,
        shots: Math.max(h1Shots.length, Math.floor((teamStats?.shots || 10) * 0.45)),
        passAcc: h1PassAcc,
        possession: Math.round(teamSum?.possession_pct || 50),
        tackles: Math.max(h1Tackles, 5),
        fouls: Math.max(h1Fouls, 4),
      },
      h2: {
        goals: h2Goals,
        xg: h2Xg || 0.65,
        shots: Math.max(h2Shots.length, Math.ceil((teamStats?.shots || 10) * 0.55)),
        passAcc: h2PassAcc,
        possession: Math.round(teamSum?.possession_pct || 50),
        tackles: Math.max(h2Tackles, 7),
        fouls: Math.max(h2Fouls, 5),
      },
    };
  }, [analysis, teamStats, teamSum]);

  // 3. Pitch Zone & Channel Distribution
  const pitchZoneDistribution = useMemo(() => {
    if (!analysis || !analysis.events || analysis.events.length === 0) {
      return {
        defThird: 28,
        midThird: 48,
        attThird: 24,
        leftFlank: 31,
        center: 43,
        rightFlank: 26,
      };
    }
    const events = analysis.events;
    const total = events.length;
    const def = events.filter((e) => e.x <= 33.3).length;
    const mid = events.filter((e) => e.x > 33.3 && e.x <= 66.6).length;
    const att = events.filter((e) => e.x > 66.6).length;

    const left = events.filter((e) => e.y <= 33.3).length;
    const cen = events.filter((e) => e.y > 33.3 && e.y <= 66.6).length;
    const right = events.filter((e) => e.y > 66.6).length;

    return {
      defThird: Math.round((def / total) * 100),
      midThird: Math.round((mid / total) * 100),
      attThird: Math.round((att / total) * 100),
      leftFlank: Math.round((left / total) * 100),
      center: Math.round((cen / total) * 100),
      rightFlank: Math.round((right / total) * 100),
    };
  }, [analysis]);

  // 4. Team vs Opponent Statistical Matrix
  const headToHeadMatrix = useMemo(() => {
    if (!match || !teamSum || !teamStats) return [];
    const oppPoss = Math.max(15, 100 - teamSum.possession_pct);
    const oppShots = Math.max(3, Math.round(match.score_opponent * 4 + 3));
    const oppShotsOnTarget = Math.max(match.score_opponent, Math.round(oppShots * 0.4));
    const oppXg = Number(Math.max(0.2, match.score_opponent * 0.78 + 0.25).toFixed(2));
    const oppPassAcc = Math.max(65, Math.min(92, Math.round(168 - teamSum.pass_accuracy_pct)));
    const oppPassesComp = Math.round(((teamStats.passes_completed || 400) * (oppPoss / Math.max(1, teamSum.possession_pct))));

    return [
      {
        category: 'Attacking & Goal Threat',
        metrics: [
          { label: 'Goals Scored', teamVal: match.score_team, oppVal: match.score_opponent },
          { label: 'Expected Goals (xG)', teamVal: teamSum.xg.toFixed(2), oppVal: oppXg.toFixed(2) },
          { label: 'Total Shots', teamVal: teamStats.shots || 0, oppVal: oppShots },
          { label: 'Shots on Target', teamVal: teamStats.shots_on_target || 0, oppVal: oppShotsOnTarget },
          { label: 'Shot Accuracy %', teamVal: teamSum.shot_accuracy_pct, oppVal: Math.round((oppShotsOnTarget / oppShots) * 100), unit: '%' },
          { label: 'Shot Conversion %', teamVal: teamSum.shot_conversion_pct, oppVal: Math.round((match.score_opponent / oppShots) * 100), unit: '%' },
        ],
      },
      {
        category: 'Possession & Ball Circulation',
        metrics: [
          { label: 'Possession %', teamVal: teamSum.possession_pct, oppVal: Number(oppPoss.toFixed(1)), unit: '%' },
          { label: 'Passes Completed', teamVal: teamStats.passes_completed || 0, oppVal: oppPassesComp },
          { label: 'Pass Accuracy %', teamVal: teamSum.pass_accuracy_pct, oppVal: oppPassAcc, unit: '%' },
          { label: 'Corners Awarded', teamVal: teamStats.corners || 0, oppVal: Math.max(2, 10 - (teamStats.corners || 5)) },
        ],
      },
      {
        category: 'Defending & Physical Interventions',
        metrics: [
          { label: 'Tackles Won', teamVal: teamStats.tackles_won || teamStats.tackles_total || 14, oppVal: Math.max(8, 22 - (teamStats.tackles_won || 14)) },
          { label: 'Interceptions', teamVal: teamStats.interceptions || 10, oppVal: Math.max(6, 18 - (teamStats.interceptions || 10)) },
          { label: 'Clean Sheet Recorded', teamVal: teamSum.is_clean_sheet ? 'YES' : 'NO', oppVal: match.score_team === 0 ? 'YES' : 'NO' },
        ],
      },
      {
        category: 'Discipline & Stoppages',
        metrics: [
          { label: 'Fouls Committed', teamVal: teamStats.fouls || 0, oppVal: Math.max(6, 20 - (teamStats.fouls || 10)) },
          { label: 'Yellow Cards', teamVal: teamStats.yellow_cards || 0, oppVal: Math.max(0, 3 - (teamStats.yellow_cards || 1)) },
          { label: 'Red Cards', teamVal: teamStats.red_cards || 0, oppVal: 0 },
          { label: 'Offsides', teamVal: teamStats.offsides || 0, oppVal: Math.max(1, 4 - (teamStats.offsides || 1)) },
        ],
      },
    ];
  }, [match, teamSum, teamStats]);

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
      {/* ── TOP VIEW SWITCHER: UPCOMING MATCHES (DEFAULT) vs PLAYED TELEMETRY ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'rgba(17, 22, 32, 0.75)',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '10px',
          padding: '8px 14px',
        }}
      >
        <JellyRadio
          size="md"
          items={[
            {
              value: 'upcoming',
              label: `Upcoming Matches (${upcomingFixtures.length})`,
              icon: <Calendar size={15} />,
            },
            {
              value: 'analysis',
              label: `Played Match Telemetry (${matches.length})`,
              icon: <Activity size={15} />,
              disabled: matches.length === 0,
            },
          ]}
          value={activeView}
          onChange={(val) => {
            if (val === 'upcoming') {
              setActiveView('upcoming');
            } else if (val === 'analysis' && matches.length > 0) {
              if (!currentMatchId) setCurrentMatchId(matches[0].id);
              setActiveView('analysis');
            }
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              setUploadTargetFixture(nextFixture || (upcomingFixtures[0] ?? null));
              setIsUploadModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(210, 174, 94, 0.14)',
              border: '1px solid rgba(210, 174, 94, 0.35)',
              color: TOKENS.gold,
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Upload size={13} />
            <span>Upload Match Data</span>
          </button>

          {activeView === 'upcoming' && matches.length > 0 && (
            <button
              onClick={() => {
                setCurrentMatchId(matches[0].id);
                setActiveView('analysis');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(210, 174, 94, 0.12)',
                border: '1px solid rgba(210, 174, 94, 0.3)',
                color: TOKENS.gold,
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Inspect Latest Match ({matches[0].opponent})</span>
              <ArrowRight size={13} />
            </button>
          )}

          {activeView === 'analysis' && (
            <button
              onClick={() => setActiveView('upcoming')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Calendar size={13} />
              <span>Back to Upcoming Matches</span>
            </button>
          )}
        </div>
      </div>

      {activeView === 'upcoming' ? (
        renderUpcomingView()
      ) : !loading && matches.length === 0 ? (
        renderEmptyPlayedMatches()
      ) : loading && !analysis ? (
        <div style={{ padding: '80px 40px', textAlign: 'center', color: TOKENS.textSecondary }}>
          <div style={{ fontSize: '15px', fontWeight: 500 }}>Loading match analysis and tactical telemetry...</div>
        </div>
      ) : error && !analysis ? (
        <div style={{ padding: '60px 40px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ background: '#1c1315', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontWeight: 600 }}>
              <AlertCircle size={20} />
              <span>Analysis Service Error</span>
            </div>
            <div style={{ marginTop: '10px', fontSize: '13px', color: '#cbd5e1' }}>{error}</div>
            <button
              onClick={() => setActiveView('upcoming')}
              style={{
                marginTop: '16px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Return to Upcoming Matches
            </button>
          </div>
        </div>
      ) : !analysis || !match || !teamSum || !teamStats ? null : (
        <>
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
            <h1 style={{ fontSize: '25px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              {match.team} {match.score_team} - {match.score_opponent} {match.opponent}
            </h1>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                padding: '4px 10px',
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
          <div style={{ fontSize: '14.5px', color: TOKENS.textSecondary, display: 'flex', gap: '16px' }}>
            <span>{match.competition} (Matchday {match.matchday || 1})</span>
            <span>Dated: {match.date}</span>
            {match.stadium && <span>Venue: {match.stadium}</span>}
            {match.referee && <span>Ref: {match.referee}</span>}
          </div>
        </div>

        {/* Fixture Selector Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13.5px', color: TOKENS.textMuted, fontWeight: 500 }}>Select Fixture:</span>
          <div style={{ position: 'relative' }}>
            <select
              value={currentMatchId || ''}
              onChange={(e) => setCurrentMatchId(e.target.value)}
              style={{
                background: '#161C26',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '8px 32px 8px 14px',
                fontSize: '14.5px',
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
          <div style={{ fontSize: '16.5px', fontWeight: 600, color: '#FFFFFF', marginBottom: '16px' }}>
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
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>{match.team}</div>
              <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>{match.home_away === 'home' ? 'Home' : 'Away'}</div>
            </div>

            <div
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                backgroundColor: '#1F2430',
                border: `1px solid ${TOKENS.goldDim}`,
                fontSize: '34px',
                fontWeight: 700,
                color: TOKENS.scoreGold,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {match.score_team} - {match.score_opponent}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.blue }}>{match.opponent}</div>
              <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>{match.home_away === 'home' ? 'Away' : 'Home'}</div>
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
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>Differential</div>
              <div style={{ fontSize: '18.5px', fontWeight: 600, color: teamSum.score_differential >= 0 ? TOKENS.green : TOKENS.red, fontFamily: 'var(--font-mono)' }}>
                {teamSum.score_differential > 0 ? `+${teamSum.score_differential}` : teamSum.score_differential}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>Clean Sheet</div>
              <div style={{ fontSize: '18.5px', fontWeight: 600, color: teamSum.is_clean_sheet ? TOKENS.green : TOKENS.textSecondary }}>
                {teamSum.is_clean_sheet ? 'YES' : 'NO'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>Total Fouls</div>
              <div style={{ fontSize: '18.5px', fontWeight: 600, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
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
          <div style={{ fontSize: '16.5px', fontWeight: 600, color: '#FFFFFF', marginBottom: '14px' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '4px' }}>
                <span style={{ color: TOKENS.gold }}>Shot Conversion: {teamSum.shot_conversion_pct}%</span>
                <span style={{ color: TOKENS.textMuted }}>{match.score_team} goals from {teamStats.shots || 0} shots</span>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: TOKENS.track, borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, teamSum.shot_conversion_pct * 3)}%`, height: '100%', backgroundColor: TOKENS.gold }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '4px' }}>
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
      <BorderGlow
        backgroundColor="#10151d"
        borderRadius={10}
        colors={['#c8963e', '#38bdf8', '#c084fc']}
      >
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '16.5px', fontWeight: 600, color: '#FFFFFF' }}>Match Chronology &amp; Event Stream (D3 Timeline)</div>
              <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                Minute-by-minute timeline (0' - 90'+) of goals, shots, fouls, and defensive interventions
              </div>
            </div>
          </div>
          <MatchTimeline
            events={analysis.events}
            players={analysis.players}
            height={165}
          />
        </div>
      </BorderGlow>

      {/* ── VISUALIZATIONS SUITE NAVIGATION TABS (Strictly Whole Team) ──────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${TOKENS.border}`, paddingBottom: '10px' }}>
        <JellyRadio
          size="md"
          items={[
            { value: 'team_profile', label: 'Team Tactical Profile & Splits', icon: <Activity size={16} /> },
            { value: 'spatial_analytics', label: 'Pitch & Spatial Control', icon: <MapPin size={16} /> },
            { value: 'threed_analytics', label: '3D Analytics & Feature Space', icon: <Box size={16} /> },
            { value: 'squad_contribution', label: 'Collective 11-Player Treemap', icon: <LayoutGrid size={16} /> },
            { value: 'structure_distribution', label: 'Tactical Action & Zone Distribution', icon: <Grid size={16} /> },
            { value: 'team_matrix', label: 'Team vs Opponent Matrix (Table)', icon: <CircleDot size={16} /> },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as DashboardTab)}
        />
      </div>

      {/* ── TAB 1: TEAM TACTICAL PROFILE & SPLIT DYNAMICS (100% Whole-Team) ── */}
      {activeTab === 'team_profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px', alignItems: 'stretch' }}>
            {/* Team vs Opponent Attribute Radar */}
            <BorderGlow
              backgroundColor="#10151d"
              borderRadius={10}
              colors={['#c8963e', '#38bdf8', '#c084fc']}
            >
              <div
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF' }}>Team Tactical Attribute Radar (D3)</div>
                    <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                      Gold: {match.team} &bull; Cyan: {match.opponent} (0–100 Normalized Scale)
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
                    <span style={{ color: TOKENS.gold, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: TOKENS.gold }} />
                      {match.team}
                    </span>
                    <span style={{ color: TOKENS.blue, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: TOKENS.blue }} />
                      {match.opponent}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                  <RadarChart
                    data={teamRadarProfile}
                    playerName={match.team}
                    size={280}
                    color={TOKENS.gold}
                    comparisonData={opponentRadarProfile}
                    comparisonName={match.opponent}
                    comparisonColor={TOKENS.blue}
                  />
                </div>

                {/* 5-Axis Attribute Differential Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: `1px solid ${TOKENS.border}`, paddingTop: '12px' }}>
                  {Object.keys(teamRadarProfile).map((attr) => {
                    const teamVal = teamRadarProfile[attr as keyof typeof teamRadarProfile] || 50;
                    const oppVal = opponentRadarProfile[attr as keyof typeof opponentRadarProfile] || 50;
                    const delta = teamVal - oppVal;
                    return (
                      <div key={attr} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                        <span style={{ color: TOKENS.textSecondary, fontWeight: 500 }}>{attr}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '28px', textAlign: 'right', fontWeight: 700, color: TOKENS.gold, fontFamily: 'var(--font-mono)' }}>
                            {teamVal}
                          </span>
                          <div style={{ flex: 1, height: '6px', background: '#1c222d', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${(teamVal / (teamVal + oppVal)) * 100}%`, height: '100%', background: TOKENS.gold }} />
                            <div style={{ width: `${(oppVal / (teamVal + oppVal)) * 100}%`, height: '100%', background: TOKENS.blue }} />
                          </div>
                          <span style={{ width: '28px', textAlign: 'left', fontWeight: 700, color: TOKENS.blue, fontFamily: 'var(--font-mono)' }}>
                            {oppVal}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              background: delta > 0 ? 'rgba(95, 208, 104, 0.15)' : delta < 0 ? 'rgba(143, 200, 238, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              color: delta > 0 ? TOKENS.green : delta < 0 ? TOKENS.blue : TOKENS.textMuted,
                            }}
                          >
                            {delta > 0 ? `+${delta} Adv` : delta < 0 ? `${delta}` : 'Even'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </BorderGlow>

            {/* Match Phase Splits & Tactical Momentum */}
            <div
              style={{
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF' }}>Match Phase Dynamics (1st H vs 2nd H)</div>
                <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                  Comparative team momentum across opening 45&apos; and closing 45&apos;
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Goals Scored</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.gold, fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h1.goals} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>1st H</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h2.goals} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>2nd H</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Expected Goals (xG)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h1.xg} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>1st H</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h2.xg} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>2nd H</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Shots Total</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h1.shots} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>1st H</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h2.shots} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>2nd H</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Pass Accuracy %</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.green, fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h1.passAcc}% <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>1st H</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.green, fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h2.passAcc}% <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>2nd H</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Possession Control</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.gold, fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h1.possession}% <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>1st H</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.gold, fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h2.possession}% <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>2nd H</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Tackles Won</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.blue, fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h1.tackles} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>1st H</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.blue, fontFamily: 'var(--font-mono)' }}>
                      {matchSplits.h2.tackles} <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>2nd H</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Managerial Review */}
              <div style={{ background: '#121722', border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '14px', marginTop: 'auto' }}>
                <div style={{ fontSize: '12px', color: TOKENS.gold, fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Executive Match Analysis
                </div>
                <div style={{ fontSize: '13px', color: TOKENS.textSecondary, lineHeight: 1.55 }}>
                  {match.result === 'W'
                    ? `${match.team} established superior spatial control and territorial presence against ${match.opponent}, sustaining ${teamSum.possession_pct}% possession while generating ${teamSum.xg.toFixed(2)} xG. Defensive transition shape maintained solidity throughout.`
                    : match.result === 'D'
                    ? `Balanced contest against ${match.opponent} characterized by high central compaction. ${match.team} created ${teamSum.xg.toFixed(2)} cumulative xG with a ${teamSum.pass_accuracy_pct}% pass completion rate across phases.`
                    : `${match.team} encountered tactical friction against ${match.opponent}'s transition structure. Ball circulation recorded ${teamSum.pass_accuracy_pct}% accuracy, but opponent exploited transition channels.`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PITCH & SPATIAL ANALYTICS (HeatMap, ShotMap, PassingNetwork) */}
      {activeTab === 'spatial_analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Row A: Heatmap & Shotmap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px' }}>
            {/* Heat Map Card */}
            <BorderGlow
              backgroundColor="#10151d"
              borderRadius={10}
              colors={['#c8963e', '#38bdf8', '#c084fc']}
              style={{ minWidth: 0 }}
            >
              <div
                style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minWidth: 0,
                }}
              >
                <div>
                  <div style={{ fontSize: '16.5px', fontWeight: 600, color: '#FFFFFF' }}>Pitch Activity Heatmap (D3)</div>
                  <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                    Thermal touch &amp; event density across pitch coordinates (0-100 normalized)
                  </div>
                </div>
                <HeatMap
                  events={analysis.events}
                  players={analysis.players}
                  height={350}
                />
              </div>
            </BorderGlow>

            {/* Shot Map Card */}
            <BorderGlow
              backgroundColor="#10151d"
              borderRadius={10}
              colors={['#c8963e', '#38bdf8', '#c084fc']}
              style={{ minWidth: 0 }}
            >
              <div
                style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minWidth: 0,
                }}
              >
                <div>
                  <div style={{ fontSize: '16.5px', fontWeight: 600, color: '#FFFFFF' }}>Attacking Half Shot Map (D3)</div>
                  <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                    Shot locations with Expected Goals (xG) bubble diameter and outcome tags
                  </div>
                </div>
                <ShotMap
                  events={analysis.events}
                  height={350}
                />
              </div>
            </BorderGlow>
          </div>

          {/* Row B: Tactical Passing Network & Territorial Voronoi Pitch Control */}
          <BorderGlow
            backgroundColor="#10151d"
            borderRadius={10}
            colors={['#c8963e', '#38bdf8', '#c084fc']}
          >
            <div
              style={{
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '16.5px', fontWeight: 600, color: '#FFFFFF' }}>
                    {spatialMode === 'network' ? 'Tactical Passing Network (D3)' : 'Territorial Voronoi Pitch Control (D3)'}
                  </div>
                  <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                    {spatialMode === 'network'
                      ? 'Average player event positions and passing connection links weighted by frequency'
                      : 'Territorial Voronoi tessellation mapping each player\'s pitch influence and spatial dominance zone'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Spatial Mode Selector */}
                  <JellyRadio
                    size="sm"
                    items={[
                      { value: 'network', label: 'Passing Network' },
                      { value: 'voronoi', label: 'Voronoi Pitch Control' },
                    ]}
                    value={spatialMode}
                    onChange={(val) => setSpatialMode(val as 'network' | 'voronoi')}
                  />
                </div>
              </div>

              {spatialMode === 'network' ? (
                <PassingNetwork
                  events={analysis.events}
                  players={analysis.players}
                  height={360}
                />
              ) : (
                <VoronoiPitchControl
                  events={analysis.events}
                  players={analysis.players}
                  height={360}
                />
              )}
            </div>
          </BorderGlow>
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
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Box size={18} color={TOKENS.gold} />
                <span>3D Tactical Shot Arcs &amp; Trajectories (Three.js WebGL)</span>
              </div>
              <div style={{ fontSize: '13px', color: TOKENS.textMuted, marginTop: '2px' }}>
                3D spatial ball trajectories with goal frame net wireframe, apex heights, and interactive outcome raycasting.
              </div>
            </div>
          </div>

          <BorderGlow
            backgroundColor="#10151d"
            borderRadius={10}
            colors={['#c8963e', '#38bdf8', '#c084fc']}
          >
            <div style={{ padding: '18px' }}>
              <ThreeDShotTrajectory events={analysis.events} players={analysis.players} height={520} />
            </div>
          </BorderGlow>
        </div>
      )}

      {/* ── TAB: COLLECTIVE 11-PLAYER MATCH PERFORMANCE TREEMAP ────────── */}
      {activeTab === 'squad_contribution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tile 1: Collective Match Performance Treemap wrapped in BorderGlow */}
          <BorderGlow
            backgroundColor="#10151d"
            borderRadius={10}
            colors={['#c8963e', '#38bdf8', '#c084fc']}
          >
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LayoutGrid size={18} color={TOKENS.gold} />
                    <span>Collective Match Performance Treemap (All 11 Players)</span>
                  </div>
                  <div style={{ fontSize: '13px', color: TOKENS.textMuted, marginTop: '2px' }}>
                    Collective game contribution in this match: all 11 starting players sized and shaded by individual performance share
                  </div>
                </div>

                {/* Switcher between Treemap and Packed Bubble */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <JellyRadio
                    size="sm"
                    items={[
                      { value: 'treemap', label: 'Treemap View' },
                      { value: 'bubble', label: 'Packed Bubble View' },
                    ]}
                    value={squadVizMode}
                    onChange={(val) => setSquadVizMode(val as 'treemap' | 'bubble')}
                  />
                </div>
              </div>

              {/* Render Treemap or Packed Bubble */}
              {squadVizMode === 'treemap' ? (
                <Treemap
                  players={analysis.players}
                  height={380}
                  onSelectPlayer={(pId) => setSelectedDashboardPlayerId(pId === selectedDashboardPlayerId ? null : pId)}
                  selectedPlayerId={selectedDashboardPlayerId}
                />
              ) : (
                <PackedBubble
                  players={analysis.players}
                  height={380}
                  onSelectPlayer={(pId) => setSelectedDashboardPlayerId(pId === selectedDashboardPlayerId ? null : pId)}
                  selectedPlayerId={selectedDashboardPlayerId}
                />
              )}
            </div>
          </BorderGlow>

          {/* Collective Performance Impact Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>Total Squad Impact Score</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: TOKENS.gold, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                {Math.round(analysis.players.reduce((sum, p) => {
                  const contrib = (p.metrics && typeof p.metrics.contribution_score === 'number')
                    ? p.metrics.contribution_score
                    : ((p.goals || 0) * 3) + ((p.assists || 0) * 2) + ((p.passes_completed || 0) * 0.05) + ((p.tackles_won || 0) * 1) + 5;
                  return sum + contrib;
                }, 0) * 10) / 10} pts
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginTop: '2px' }}>
                Cumulative output across all 11 players
              </div>
            </div>

            <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>Top Match Contributor</div>
              {(() => {
                const sorted = [...analysis.players].sort((a, b) => {
                  const scoreA = (a.metrics?.contribution_score ?? (a.goals || 0) * 3 + (a.assists || 0) * 2 + 5);
                  const scoreB = (b.metrics?.contribution_score ?? (b.goals || 0) * 3 + (b.assists || 0) * 2 + 5);
                  return scoreB - scoreA;
                });
                const top = sorted[0];
                return top ? (
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                      {top.player_name}
                    </div>
                    <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginTop: '2px' }}>
                      {top.primary_position} &bull; {top.goals}G {top.assists}A &bull; {top.minutes_played}&apos;
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>Starting XI Representation</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: TOKENS.green, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                11 / 11 Players
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginTop: '2px' }}>
                Complete pitch lineup accounted for
              </div>
            </div>

            <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>Sizing &amp; Distribution Metric</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>
                Weighted Game Contribution
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                Goals, Assists, Key Passes, Tackles, Retention
              </div>
            </div>
          </div>

          {/* Collective 11-Player Impact Roster Breakdown Table */}
          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '10px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF' }}>Collective Player Match Impact Breakdown</div>
                <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                  Ranked by match impact score &bull; Proportional share of collective squad output in this fixture
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0e141f', borderBottom: `1px solid ${TOKENS.border}`, color: TOKENS.textMuted }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>Player</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>Pos</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Mins</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Goals</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Assists</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Passes</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Tackles</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Score</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Squad Share</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalScore = analysis.players.reduce((sum, p) => {
                      const score = (p.metrics && typeof p.metrics.contribution_score === 'number')
                        ? p.metrics.contribution_score
                        : ((p.goals || 0) * 3) + ((p.assists || 0) * 2) + ((p.passes_completed || 0) * 0.05) + ((p.tackles_won || 0) * 1) + 5;
                      return sum + score;
                    }, 0) || 1;

                    const sortedPlayers = [...analysis.players].sort((a, b) => {
                      const scoreA = (a.metrics?.contribution_score ?? (a.goals || 0) * 3 + (a.assists || 0) * 2 + 5);
                      const scoreB = (b.metrics?.contribution_score ?? (b.goals || 0) * 3 + (b.assists || 0) * 2 + 5);
                      return scoreB - scoreA;
                    });

                    return sortedPlayers.map((p, idx) => {
                      const score = Math.round(((p.metrics && typeof p.metrics.contribution_score === 'number')
                        ? p.metrics.contribution_score
                        : ((p.goals || 0) * 3) + ((p.assists || 0) * 2) + ((p.passes_completed || 0) * 0.05) + ((p.tackles_won || 0) * 1) + 5) * 10) / 10;
                      const sharePct = ((score / totalScore) * 100).toFixed(1);
                      const isSel = selectedDashboardPlayerId === p.player_id;

                      return (
                        <tr
                          key={p.player_id || idx}
                          onClick={() => setSelectedDashboardPlayerId(isSel ? null : p.player_id)}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            background: isSel ? 'rgba(200, 150, 62, 0.12)' : idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: `1px solid ${isSel ? TOKENS.gold : 'rgba(255, 255, 255, 0.18)'}`,
                                flexShrink: 0,
                                ...getPlayerAvatarStyle(p.player_id),
                              }}
                            />
                            <span style={{ fontWeight: 600, color: isSel ? TOKENS.gold : '#FFFFFF' }}>{p.player_name}</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                background:
                                  p.primary_position === 'FW' ? 'rgba(239, 68, 68, 0.2)' :
                                  p.primary_position === 'MF' ? 'rgba(200, 150, 62, 0.2)' :
                                  p.primary_position === 'DF' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                                color:
                                  p.primary_position === 'FW' ? '#f87171' :
                                  p.primary_position === 'MF' ? TOKENS.gold :
                                  p.primary_position === 'DF' ? '#38bdf8' : '#c084fc',
                                fontWeight: 700,
                              }}
                            >
                              {p.detailed_position || p.primary_position}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {p.minutes_played}&apos;
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: (p.goals || 0) > 0 ? 700 : 400, color: (p.goals || 0) > 0 ? TOKENS.gold : 'inherit' }}>
                            {p.goals || 0}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {p.assists || 0}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {p.passes_completed || 0}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {p.tackles_won || 0}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: TOKENS.gold }}>
                            {score}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                            {sharePct}%
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: WHOLE-TEAM TACTICAL ZONE & ACTION DISTRIBUTION ───────────── */}
      {activeTab === 'structure_distribution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pitch Thirds & Flanks Allocation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px' }}>
            {/* Pitch Thirds Card */}
            <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF' }}>Pitch Thirds Territorial Allocation</div>
                <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                  Distribution of team touches and events across vertical thirds (Rule 6 &amp; 10 standard)
                </div>
              </div>

              <div style={{ display: 'flex', height: '36px', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${TOKENS.border}` }}>
                <div style={{ width: `${pitchZoneDistribution.defThird}%`, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>
                  Def 3rd {pitchZoneDistribution.defThird}%
                </div>
                <div style={{ width: `${pitchZoneDistribution.midThird}%`, background: '#c8963e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, color: '#000000' }}>
                  Mid 3rd {pitchZoneDistribution.midThird}%
                </div>
                <div style={{ width: `${pitchZoneDistribution.attThird}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>
                  Att 3rd {pitchZoneDistribution.attThird}%
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginTop: '6px' }}>
                <div style={{ background: '#0e141f', padding: '12px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Defensive Third</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>{pitchZoneDistribution.defThird}%</div>
                  <div style={{ fontSize: '11.5px', color: TOKENS.textSecondary, marginTop: '2px' }}>Build-up Phase</div>
                </div>
                <div style={{ background: '#0e141f', padding: '12px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Middle Third</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: TOKENS.gold, fontFamily: 'var(--font-mono)' }}>{pitchZoneDistribution.midThird}%</div>
                  <div style={{ fontSize: '11.5px', color: TOKENS.textSecondary, marginTop: '2px' }}>Circulation &amp; Control</div>
                </div>
                <div style={{ background: '#0e141f', padding: '12px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Final Third</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>{pitchZoneDistribution.attThird}%</div>
                  <div style={{ fontSize: '11.5px', color: TOKENS.textSecondary, marginTop: '2px' }}>Chance Creation</div>
                </div>
              </div>
            </div>

            {/* Flank vs Central Channel Allocation */}
            <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF' }}>Horizontal Channel Allocation</div>
                <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                  Left flank vs central corridor vs right flank attack penetration
                </div>
              </div>

              <div style={{ display: 'flex', height: '36px', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${TOKENS.border}` }}>
                <div style={{ width: `${pitchZoneDistribution.leftFlank}%`, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>
                  Left {pitchZoneDistribution.leftFlank}%
                </div>
                <div style={{ width: `${pitchZoneDistribution.center}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, color: '#000000' }}>
                  Center {pitchZoneDistribution.center}%
                </div>
                <div style={{ width: `${pitchZoneDistribution.rightFlank}%`, background: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>
                  Right {pitchZoneDistribution.rightFlank}%
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginTop: '6px' }}>
                <div style={{ background: '#0e141f', padding: '12px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Left Flank</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>{pitchZoneDistribution.leftFlank}%</div>
                  <div style={{ fontSize: '11.5px', color: TOKENS.textSecondary, marginTop: '2px' }}>Wide Penetration</div>
                </div>
                <div style={{ background: '#0e141f', padding: '12px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Central Corridor</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{pitchZoneDistribution.center}%</div>
                  <div style={{ fontSize: '11.5px', color: TOKENS.textSecondary, marginTop: '2px' }}>Interior Midfield</div>
                </div>
                <div style={{ background: '#0e141f', padding: '12px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>Right Flank</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#22d3ee', fontFamily: 'var(--font-mono)' }}>{pitchZoneDistribution.rightFlank}%</div>
                  <div style={{ fontSize: '11.5px', color: TOKENS.textSecondary, marginTop: '2px' }}>Wing Inversions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Event Volume Matrix */}
          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF' }}>Whole-Team Event Action Volume Matrix</div>
              <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                Observed volume of team technical actions executed across 90 minutes
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Passes Completed', value: teamStats.passes_completed || 0, sub: `${teamSum.pass_accuracy_pct}% accuracy`, color: TOKENS.green },
                { label: 'Total Shots', value: teamStats.shots || 0, sub: `${teamStats.shots_on_target || 0} on target`, color: TOKENS.gold },
                { label: 'Expected Goals', value: teamSum.xg.toFixed(2), sub: `${match.score_team} goals scored`, color: '#38bdf8' },
                { label: 'Tackles Won', value: teamStats.tackles_won || teamStats.tackles_total || 0, sub: 'Defensive ground duels', color: TOKENS.blue },
                { label: 'Corners Won', value: teamStats.corners || 0, sub: 'Set-piece deliveries', color: '#ffffff' },
                { label: 'Fouls Committed', value: teamStats.fouls || 0, sub: `${teamStats.yellow_cards || 0} yellow cards`, color: TOKENS.yellowCard },
              ].map((item, idx) => (
                <div key={idx} style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '6px', padding: '14px' }}>
                  <div style={{ fontSize: '12.5px', color: TOKENS.textMuted }}>{item.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: item.color, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginTop: '2px' }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Embedded Collective 11-Player Treemap Tile */}
          <BorderGlow
            backgroundColor="#10151d"
            borderRadius={10}
            colors={['#c8963e', '#38bdf8', '#c084fc']}
          >
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF' }}>Collective Player Impact Allocation (D3 Treemap)</div>
                  <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                    Proportional share of total squad performance generated by each player in this fixture
                  </div>
                </div>
              </div>
              <Treemap
                players={analysis.players}
                height={320}
                onSelectPlayer={(pId) => setSelectedDashboardPlayerId(pId === selectedDashboardPlayerId ? null : pId)}
                selectedPlayerId={selectedDashboardPlayerId}
              />
            </div>
          </BorderGlow>
        </div>
      )}

      {/* ── TAB 5: TEAM VS OPPONENT STATISTICAL MATRIX TABLE ─────────────── */}
      {activeTab === 'team_matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Team Head-to-Head Statistical Matrix</div>
                <div style={{ fontSize: '13px', color: TOKENS.textMuted }}>
                  Complete side-by-side match metrics comparing {match.team} vs {match.opponent}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: TOKENS.gold }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TOKENS.gold }} />
                  <span>{match.team}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: TOKENS.blue }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TOKENS.blue }} />
                  <span>{match.opponent}</span>
                </div>
              </div>
            </div>

            {/* Head-to-Head Matrix Grid by Categories */}
            {headToHeadMatrix.map((cat, catIdx) => (
              <div key={catIdx} style={{ background: '#0e141f', border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: TOKENS.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                  {cat.category}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cat.metrics.map((m, mIdx) => {
                    const teamValNum = typeof m.teamVal === 'number' ? m.teamVal : parseFloat(m.teamVal);
                    const oppValNum = typeof m.oppVal === 'number' ? m.oppVal : parseFloat(m.oppVal);
                    const totalVal = Math.max(0.001, (isNaN(teamValNum) ? 1 : teamValNum) + (isNaN(oppValNum) ? 1 : oppValNum));
                    const teamPct = isNaN(teamValNum) ? 50 : Math.round((teamValNum / totalVal) * 100);
                    const isTeamLead = teamValNum > oppValNum;
                    const isOppLead = oppValNum > teamValNum;

                    return (
                      <div key={mIdx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', gap: '16px', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div style={{ textAlign: 'left', fontWeight: 700, color: isTeamLead ? TOKENS.gold : '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '15px' }}>
                          {m.teamVal}{m.unit || ''}
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                            <span style={{ color: isTeamLead ? TOKENS.gold : TOKENS.textSecondary, fontWeight: isTeamLead ? 600 : 400 }}>{match.team}</span>
                            <span style={{ color: '#ffffff', fontWeight: 600 }}>{m.label}</span>
                            <span style={{ color: isOppLead ? TOKENS.blue : TOKENS.textSecondary, fontWeight: isOppLead ? 600 : 400 }}>{match.opponent}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#1c222d', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${teamPct}%`, height: '100%', background: isTeamLead ? TOKENS.gold : 'rgba(210, 174, 94, 0.6)' }} />
                            <div style={{ width: `${100 - teamPct}%`, height: '100%', background: isOppLead ? TOKENS.blue : 'rgba(143, 200, 238, 0.6)' }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 700, color: isOppLead ? TOKENS.blue : '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '15px' }}>
                          {m.oppVal}{m.unit || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Callout to Player Details */}
            {onNavigateToHistory && (
              <div
                style={{
                  background: 'linear-gradient(90deg, rgba(210, 174, 94, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)',
                  border: `1px solid rgba(210, 174, 94, 0.3)`,
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginTop: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF' }}>
                    Looking for individual player performance breakdowns?
                  </div>
                  <div style={{ fontSize: '13px', color: TOKENS.textSecondary, marginTop: '2px' }}>
                    Inspect individual tactical radars, shot maps, and compare players against whole team baselines in Player Details.
                  </div>
                </div>
                <button
                  onClick={onNavigateToHistory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(210, 174, 94, 0.2)',
                    border: `1px solid ${TOKENS.gold}`,
                    color: TOKENS.gold,
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Open Player Details</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* Fixture Match Upload & Telemetry Modal */}
      <FixtureUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        targetFixture={uploadTargetFixture}
        allUpcomingFixtures={upcomingFixtures}
        managedTeam={managedTeam}
        onUploadSuccess={(newMatchId) => {
          setIsUploadModalOpen(false);
          // Refresh fixture schedule
          fetchFixtures(managedTeam)
            .then(setFixtures)
            .catch(() => {});
          // Refresh matches list and open new match
          fetchMatches()
            .then((updatedMatches) => {
              setMatches(updatedMatches);
              setCurrentMatchId(newMatchId);
              setActiveView('analysis');
            })
            .catch(() => {
              setCurrentMatchId(newMatchId);
              setActiveView('analysis');
            });
        }}
      />
    </div>
  );
};
