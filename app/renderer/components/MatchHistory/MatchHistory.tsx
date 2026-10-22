import React, { useState, useEffect, useMemo } from 'react';
import {
  MatchSummary,
  PlayerTrendAnalysis,
  PlayerSummary,
  MatchAnalysis,
  fetchMatches,
  fetchPlayerHistory,
  fetchPlayers,
  fetchFocusTeam,
  fetchMatchAnalysis,
  fetchSquadSeason,
  SquadSeasonResponse,
} from '../../services/api';
import { LineChart, LineChartPoint } from '../visualizations/LineChart';
import { RadarChart } from '../visualizations/RadarChart';
import { HeatMap } from '../visualizations/HeatMap';
import { ShotMap } from '../visualizations/ShotMap';
import { PassingNetwork } from '../visualizations/PassingNetwork';
import { VoronoiPitchControl } from '../visualizations/VoronoiPitchControl';
import { MatchTimeline } from '../visualizations/MatchTimeline';
import { ThreeDShotTrajectory } from '../visualizations/ThreeDShotTrajectory';
import { BorderGlow } from '../BorderGlow/BorderGlow';
import { JellyRadio } from '../JellyRadio/JellyRadio';
import { DataFormatGuide } from '../common/DataFormatGuide';
import playerHeads from '../../assets/player-heads.jpg';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  UserCheck,
  Search,
  Activity,
  Layers,
  Crosshair,
  MapPin,
  Users,
  ArrowLeftRight,
  Upload,
  X,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { importCsvMatchData } from '../../services/api';

interface MatchHistoryProps {
  onSelectMatch: (matchId: string) => void;
}

// ── Photographic Player Avatar Coordinates Map (from 3x3 sprite) ─────────
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

export const MatchHistory: React.FC<MatchHistoryProps> = ({ onSelectMatch: _onSelectMatch }) => {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('p_cole_palmer');
  const [history, setHistory] = useState<PlayerTrendAnalysis | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [managedTeam, setManagedTeam] = useState<string>('Chelsea');
  const [squadSeason, setSquadSeason] = useState<SquadSeasonResponse | null>(null);

  // Active fixture analysis for spatial and tactical visualizations
  const [selectedMatchLensId, setSelectedMatchLensId] = useState<string>('');
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);

  // Player search and filtering
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'FW' | 'MF' | 'DF' | 'GK'>('ALL');
  const [kpiMode, setKpiMode] = useState<'totals' | 'per90'>('totals');

  // Sub-tabs inside Player Performance: Overview, Spatial, Shooting, Whole Team Comparison, Appearance Log
  const [perfTab, setPerfTab] = useState<'overview' | 'spatial' | 'shooting' | 'team_comparison' | 'appearance_log'>('overview');

  // Trend Metric Selection for LineChart
  const [trendMetric, setTrendMetric] = useState<
    'contribution_score' | 'goals' | 'xg' | 'shots' | 'key_passes' | 'passes_completed' | 'tackles_won' | 'interceptions'
  >('contribution_score');

  // View Mode: 'player_performance', 'player_comparison' or 'match_comparison'
  const [viewMode, setViewMode] = useState<'player_performance' | 'player_comparison' | 'match_comparison'>('player_performance');

  // Match-to-match comparison selection for this specific player
  const [compareMatchAId, setCompareMatchAId] = useState<string>('');
  const [compareMatchBId, setCompareMatchBId] = useState<string>('');

  // Head-to-Head Player Comparison State
  const [comparePlayerBId, setComparePlayerBId] = useState<string>('p_nicolas_jackson');
  const [historyB, setHistoryB] = useState<PlayerTrendAnalysis | null>(null);
  const [_historyBLoading, setHistoryBLoading] = useState<boolean>(false);
  const [playerCompareRateMode, setPlayerCompareRateMode] = useState<'per90' | 'totals'>('per90');
  const [playerCompareTrendMetric, setPlayerCompareTrendMetric] = useState<
    'contribution_score' | 'goals' | 'xg' | 'shots' | 'key_passes' | 'passes_completed' | 'tackles_won' | 'interceptions'
  >('contribution_score');

  // Player Stats CSV Ingestion Modal
  const [isPlayerUploadModalOpen, setIsPlayerUploadModalOpen] = useState<boolean>(false);
  const [playerCsvText, setPlayerCsvText] = useState<string>('');
  const [playerUploadMsg, setPlayerUploadMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isUploadingStats, setIsUploadingStats] = useState<boolean>(false);

  // Fallback squad roster if backend has not loaded yet
  const fallbackPlayers: PlayerSummary[] = [
    { id: 'p_cole_palmer', name: 'Cole Palmer', position: 'MF', primary_position: 'MF', squad_number: 20 },
    { id: 'p_moises_caicedo', name: 'Moisés Caicedo', position: 'MF', primary_position: 'MF', squad_number: 25 },
    { id: 'p_nicolas_jackson', name: 'Nicolas Jackson', position: 'FW', primary_position: 'FW', squad_number: 15 },
    { id: 'p_enzo_fernandez', name: 'Enzo Fernández', position: 'MF', primary_position: 'MF', squad_number: 8 },
    { id: 'p_levi_colwill', name: 'Levi Colwill', position: 'DF', primary_position: 'DF', squad_number: 6 },
    { id: 'p_malo_gusto', name: 'Malo Gusto', position: 'DF', primary_position: 'DF', squad_number: 27 },
    { id: 'p_robert_sanchez', name: 'Robert Sánchez', position: 'GK', primary_position: 'GK', squad_number: 1 },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const team = await fetchFocusTeam().catch(() => 'Chelsea');
      setManagedTeam(team);

      const [mList, pList, squadData] = await Promise.all([
        fetchMatches().catch(() => []),
        fetchPlayers().catch(() => []),
        fetchSquadSeason(undefined, team).catch(() => null),
      ]);
      setMatches(mList);
      if (squadData) setSquadSeason(squadData);

      if (pList && pList.length > 0) {
        setPlayers(pList);
        setSelectedPlayerId(pList[0].id);
        if (pList.length > 1) {
          setComparePlayerBId(pList[1].id);
        }
      } else {
        setPlayers(fallbackPlayers);
        if (fallbackPlayers.length > 1) {
          setComparePlayerBId(fallbackPlayers[2]?.id || fallbackPlayers[1]?.id);
        }
      }

      if (mList.length >= 2) {
        setCompareMatchAId(mList[0].id);
        setCompareMatchBId(mList[1].id);
        setSelectedMatchLensId(mList[0].id);
      } else if (mList.length === 1) {
        setCompareMatchAId(mList[0].id);
        setCompareMatchBId(mList[0].id);
        setSelectedMatchLensId(mList[0].id);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (!selectedPlayerId) return;
    setHistoryLoading(true);
    fetchPlayerHistory(selectedPlayerId)
      .then((data) => {
        setHistory(data);
        setHistoryLoading(false);
        // Automatically select player's most recent fixture as default match lens
        if (data.timeline && data.timeline.length > 0) {
          const latestMatchId = data.timeline[data.timeline.length - 1].match_id;
          setSelectedMatchLensId(latestMatchId);
          if (data.timeline.length >= 2) {
            setCompareMatchAId(data.timeline[data.timeline.length - 1].match_id);
            setCompareMatchBId(data.timeline[data.timeline.length - 2].match_id);
          } else {
            setCompareMatchAId(latestMatchId);
            setCompareMatchBId(latestMatchId);
          }
        }
      })
      .catch(() => {
        setHistory(null);
        setHistoryLoading(false);
      });
  }, [selectedPlayerId]);

  // Load secondary player history for Head-to-Head comparison
  useEffect(() => {
    if (!comparePlayerBId) return;
    setHistoryBLoading(true);
    fetchPlayerHistory(comparePlayerBId)
      .then((data) => {
        setHistoryB(data);
        setHistoryBLoading(false);
      })
      .catch(() => {
        setHistoryB(null);
        setHistoryBLoading(false);
      });
  }, [comparePlayerBId]);

  // Load match analysis when fixture lens changes
  useEffect(() => {
    if (!selectedMatchLensId) return;
    setAnalysisLoading(true);
    fetchMatchAnalysis(selectedMatchLensId)
      .then((res) => {
        setMatchAnalysis(res);
        setAnalysisLoading(false);
      })
      .catch(() => {
        setMatchAnalysis(null);
        setAnalysisLoading(false);
      });
  }, [selectedMatchLensId]);

  const activePlayerList = players.length > 0 ? players : fallbackPlayers;

  // Filter squad members by search text and position
  const filteredPlayers = useMemo(() => {
    return activePlayerList.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(playerSearchQuery.toLowerCase());
      const pos = (p.position || p.primary_position || '').toUpperCase();
      const matchesPos = positionFilter === 'ALL' || pos.includes(positionFilter);
      return matchesSearch && matchesPos;
    });
  }, [activePlayerList, playerSearchQuery, positionFilter]);

  const selectedPlayer = useMemo(() => {
    return activePlayerList.find((p) => p.id === selectedPlayerId) || activePlayerList[0];
  }, [activePlayerList, selectedPlayerId]);

  // Line Chart progression points
  const lineChartData: LineChartPoint[] = (history?.timeline || []).map((t) => ({
    label: `${t.date.slice(5)} (${t.opponent.split(' ')[0]})`,
    value: (t as any)[trendMetric] ?? 0,
    date: t.date,
    opponent: t.opponent,
    secondaryValue: t.minutes_played,
  }));

  const getBadgeClass = (res?: string) => {
    if (res === 'W') return 'score-pill score-pill-win';
    if (res === 'D') return 'score-pill score-pill-draw';
    return 'score-pill score-pill-loss';
  };

  const metricOptions: Array<{ key: typeof trendMetric; label: string }> = [
    { key: 'contribution_score', label: 'Contribution Score' },
    { key: 'goals', label: 'Goals' },
    { key: 'xg', label: 'Expected Goals (xG)' },
    { key: 'shots', label: 'Shots' },
    { key: 'key_passes', label: 'Key Passes' },
    { key: 'passes_completed', label: 'Passes Completed' },
    { key: 'tackles_won', label: 'Tackles Won' },
    { key: 'interceptions', label: 'Interceptions' },
  ];

  // Default radar data fallback if not present
  const radarData: Record<string, number> = history?.radar_profile || {
    Attacking: 50,
    Passing: 50,
    Defending: 50,
    Duels: 50,
    Workrate: 50,
  };

  // Whole-Team aggregate baseline metrics synthesized across squad
  const teamStatsAgg = useMemo(() => {
    if (!squadSeason || !squadSeason.players || squadSeason.players.length === 0) {
      return {
        totalGoals: 36,
        totalXg: 34.2,
        totalAssists: 24,
        totalKeyPasses: 135,
        totalPasses: 4950,
        totalTackles: 195,
        totalInterceptions: 125,
        avgGoalsPer90: 0.18,
        avgXgPer90: 0.16,
        avgAssistsPer90: 0.12,
        avgKeyPassesPer90: 0.85,
        avgPassAcc: 84.5,
        avgTacklesPer90: 1.45,
        avgRadar: {
          Attacking: 62,
          Passing: 68,
          Defending: 58,
          Duels: 60,
          Workrate: 64,
        },
      };
    }

    const pList = squadSeason.players;
    const totalGoals = squadSeason.record?.goals_for || pList.reduce((acc, p) => acc + (p.totals?.goals || 0), 0) || 30;
    const totalXg = squadSeason.team_averages?.total_xg || pList.reduce((acc, p) => acc + (p.totals?.xg || 0), 0) || 28.5;
    const totalAssists = pList.reduce((acc, p) => acc + (p.totals?.assists || 0), 0) || 20;
    const totalKeyPasses = pList.reduce((acc, p) => acc + (p.totals?.key_passes || 0), 0) || 120;
    const totalPasses = squadSeason.team_averages?.total_passes_completed || pList.reduce((acc, p) => acc + (p.totals?.passes_completed || 0), 0) || 4500;
    const totalTackles = pList.reduce((acc, p) => acc + (p.totals?.tackles_won || 0), 0) || 180;
    const totalInterceptions = pList.reduce((acc, p) => acc + (p.totals?.interceptions || 0), 0) || 110;

    const outfield = pList.filter((p) => p.primary_position !== 'GK' && p.minutes > 90);
    const count = Math.max(1, outfield.length);

    const avgGoalsPer90 = Number((outfield.reduce((acc, p) => acc + (p.per_90?.goals_per_90 || 0), 0) / count).toFixed(2)) || 0.18;
    const avgXgPer90 = Number((outfield.reduce((acc, p) => acc + (p.per_90?.xg_per_90 || (p.totals?.xg ? p.totals.xg / Math.max(1, p.minutes / 90) : 0)), 0) / count).toFixed(2)) || 0.16;
    const avgAssistsPer90 = Number((outfield.reduce((acc, p) => acc + (p.per_90?.assists_per_90 || 0), 0) / count).toFixed(2)) || 0.12;
    const avgKeyPassesPer90 = Number((outfield.reduce((acc, p) => acc + (p.per_90?.key_passes_per_90 || (p.totals?.key_passes ? p.totals.key_passes / Math.max(1, p.minutes / 90) : 0)), 0) / count).toFixed(2)) || 0.85;
    const avgPassAcc = squadSeason.team_averages?.avg_pass_accuracy_pct || Number((outfield.reduce((acc, p) => acc + (p.rates?.pass_accuracy_pct || 82), 0) / count).toFixed(1)) || 84.5;
    const avgTacklesPer90 = Number((outfield.reduce((acc, p) => acc + (p.per_90?.tackles_won_per_90 || 0), 0) / count).toFixed(2)) || 1.45;

    return {
      totalGoals,
      totalXg,
      totalAssists,
      totalKeyPasses,
      totalPasses,
      totalTackles,
      totalInterceptions,
      avgGoalsPer90,
      avgXgPer90,
      avgAssistsPer90,
      avgKeyPassesPer90,
      avgPassAcc,
      avgTacklesPer90,
      avgRadar: {
        Attacking: 62,
        Passing: 68,
        Defending: 58,
        Duels: 60,
        Workrate: 64,
      },
    };
  }, [squadSeason]);

  // Compare entries for this specific player in Match A and Match B
  const compareEntryA = useMemo(() => {
    return history?.timeline.find((t) => t.match_id === compareMatchAId) || history?.timeline[0];
  }, [history, compareMatchAId]);

  const compareEntryB = useMemo(() => {
    return history?.timeline.find((t) => t.match_id === compareMatchBId) || history?.timeline[1] || history?.timeline[0];
  }, [history, compareMatchBId]);

  // Compute dual radar profiles for Match A and Match B for this player
  const radarDataA: Record<string, number> = useMemo(() => {
    if (!compareEntryA) return radarData;
    const g = compareEntryA.goals || 0;
    const s = compareEntryA.shots || 0;
    const pc = compareEntryA.passes_completed || 0;
    const pa = compareEntryA.passes_attempted || 1;
    const kp = compareEntryA.key_passes || 0;
    const tw = compareEntryA.tackles_won || 0;
    const intc = compareEntryA.interceptions || 0;
    const acc = Math.min(100, (pc / Math.max(1, pa)) * 100);
    return {
      Attacking: Math.min(98, Math.max(20, Math.round(35 + g * 20 + s * 8))),
      Passing: Math.min(98, Math.max(20, Math.round(acc * 0.6 + kp * 10))),
      Defending: Math.min(98, Math.max(20, Math.round(30 + tw * 15 + intc * 15))),
      Duels: Math.min(98, Math.max(20, Math.round(40 + tw * 15))),
      Workrate: Math.min(98, Math.max(20, Math.round(30 + (compareEntryA.minutes_played / 90) * 45 + (tw + kp) * 8))),
    };
  }, [compareEntryA, radarData]);

  const radarDataB: Record<string, number> = useMemo(() => {
    if (!compareEntryB) return radarData;
    const g = compareEntryB.goals || 0;
    const s = compareEntryB.shots || 0;
    const pc = compareEntryB.passes_completed || 0;
    const pa = compareEntryB.passes_attempted || 1;
    const kp = compareEntryB.key_passes || 0;
    const tw = compareEntryB.tackles_won || 0;
    const intc = compareEntryB.interceptions || 0;
    const acc = Math.min(100, (pc / Math.max(1, pa)) * 100);
    return {
      Attacking: Math.min(98, Math.max(20, Math.round(35 + g * 20 + s * 8))),
      Passing: Math.min(98, Math.max(20, Math.round(acc * 0.6 + kp * 10))),
      Defending: Math.min(98, Math.max(20, Math.round(30 + tw * 15 + intc * 15))),
      Duels: Math.min(98, Math.max(20, Math.round(40 + tw * 15))),
      Workrate: Math.min(98, Math.max(20, Math.round(30 + (compareEntryB.minutes_played / 90) * 45 + (tw + kp) * 8))),
    };
  }, [compareEntryB, radarData]);

  // Spatial events for the selected player in the active fixture lens
  const playerLensEvents = useMemo(() => {
    if (!matchAnalysis || !selectedPlayerId) return [];
    return matchAnalysis.events.filter((e) => e.player_id === selectedPlayerId);
  }, [matchAnalysis, selectedPlayerId]);

  // Secondary Player for Head-to-Head Comparison
  const playerB = useMemo(() => {
    return activePlayerList.find((p) => p.id === comparePlayerBId) || activePlayerList[1] || activePlayerList[0];
  }, [activePlayerList, comparePlayerBId]);

  const handleSwapPlayers = () => {
    const curA = selectedPlayerId;
    const curB = comparePlayerBId;
    setSelectedPlayerId(curB);
    setComparePlayerBId(curA);
  };

  const playerRadarA: Record<string, number> = useMemo(() => {
    return history?.radar_profile || {
      Attacking: 50,
      Passing: 50,
      Defending: 50,
      Duels: 50,
      Workrate: 50,
    };
  }, [history]);

  const playerRadarB: Record<string, number> = useMemo(() => {
    return historyB?.radar_profile || {
      Attacking: 50,
      Passing: 50,
      Defending: 50,
      Duels: 50,
      Workrate: 50,
    };
  }, [historyB]);

  const playerCompareChartDataA: LineChartPoint[] = useMemo(() => {
    return (history?.timeline || []).map((t) => ({
      label: `${t.date.slice(5)} (${t.opponent.split(' ')[0]})`,
      value: (t as any)[playerCompareTrendMetric] ?? 0,
      date: t.date,
      opponent: t.opponent,
      secondaryValue: t.minutes_played,
    }));
  }, [history, playerCompareTrendMetric]);

  const playerCompareChartDataB: LineChartPoint[] = useMemo(() => {
    return (historyB?.timeline || []).map((t) => ({
      label: `${t.date.slice(5)} (${t.opponent.split(' ')[0]})`,
      value: (t as any)[playerCompareTrendMetric] ?? 0,
      date: t.date,
      opponent: t.opponent,
      secondaryValue: t.minutes_played,
    }));
  }, [historyB, playerCompareTrendMetric]);

  const playerComparisonMetrics = useMemo(() => {
    const isP90 = playerCompareRateMode === 'per90';

    const minsA = Math.max(1, history?.total_minutes || 90);
    const minsB = Math.max(1, historyB?.total_minutes || 90);

    const goalsA = isP90
      ? (history?.averages_per_90?.goals_per_90 ?? Number(((history?.totals?.goals || 0) / (minsA / 90)).toFixed(2)))
      : (history?.totals?.goals ?? 0);
    const goalsB = isP90
      ? (historyB?.averages_per_90?.goals_per_90 ?? Number(((historyB?.totals?.goals || 0) / (minsB / 90)).toFixed(2)))
      : (historyB?.totals?.goals ?? 0);

    const xgA = isP90
      ? Number(((history?.totals?.xg ?? 0) / (minsA / 90)).toFixed(2))
      : (history?.totals?.xg ?? 0);
    const xgB = isP90
      ? Number(((historyB?.totals?.xg ?? 0) / (minsB / 90)).toFixed(2))
      : (historyB?.totals?.xg ?? 0);

    const assistsA = isP90
      ? (history?.averages_per_90?.assists_per_90 ?? Number(((history?.totals?.assists || 0) / (minsA / 90)).toFixed(2)))
      : (history?.totals?.assists ?? 0);
    const assistsB = isP90
      ? (historyB?.averages_per_90?.assists_per_90 ?? Number(((historyB?.totals?.assists || 0) / (minsB / 90)).toFixed(2)))
      : (historyB?.totals?.assists ?? 0);

    const keyPassesA = isP90
      ? (history?.averages_per_90?.key_passes_per_90 ?? Number(((history?.totals?.key_passes || 0) / (minsA / 90)).toFixed(2)))
      : (history?.totals?.key_passes ?? 0);
    const keyPassesB = isP90
      ? (historyB?.averages_per_90?.key_passes_per_90 ?? Number(((historyB?.totals?.key_passes || 0) / (minsB / 90)).toFixed(2)))
      : (historyB?.totals?.key_passes ?? 0);

    const passesA = isP90
      ? (history?.averages_per_90?.passes_completed_per_90 ?? Number(((history?.totals?.passes_completed || 0) / (minsA / 90)).toFixed(1)))
      : (history?.totals?.passes_completed ?? 0);
    const passesB = isP90
      ? (historyB?.averages_per_90?.passes_completed_per_90 ?? Number(((historyB?.totals?.passes_completed || 0) / (minsB / 90)).toFixed(1)))
      : (historyB?.totals?.passes_completed ?? 0);

    const passAccA = history?.totals?.pass_accuracy_pct ?? 82.5;
    const passAccB = historyB?.totals?.pass_accuracy_pct ?? 81.0;

    const tacklesA = isP90
      ? (history?.averages_per_90?.tackles_per_90 ?? Number(((history?.totals?.tackles_won || 0) / (minsA / 90)).toFixed(2)))
      : (history?.totals?.tackles_won ?? 0);
    const tacklesB = isP90
      ? (historyB?.averages_per_90?.tackles_per_90 ?? Number(((historyB?.totals?.tackles_won || 0) / (minsB / 90)).toFixed(2)))
      : (historyB?.totals?.tackles_won ?? 0);

    const intercA = isP90
      ? (history?.averages_per_90?.interceptions_per_90 ?? Number(((history?.totals?.interceptions || 0) / (minsA / 90)).toFixed(2)))
      : (history?.totals?.interceptions ?? 0);
    const intercB = isP90
      ? (historyB?.averages_per_90?.interceptions_per_90 ?? Number(((historyB?.totals?.interceptions || 0) / (minsB / 90)).toFixed(2)))
      : (historyB?.totals?.interceptions ?? 0);

    const shotsA = isP90
      ? (history?.averages_per_90?.shots_per_90 ?? Number(((history?.totals?.shots || 0) / (minsA / 90)).toFixed(2)))
      : (history?.totals?.shots ?? 0);
    const shotsB = isP90
      ? (historyB?.averages_per_90?.shots_per_90 ?? Number(((historyB?.totals?.shots || 0) / (minsB / 90)).toFixed(2)))
      : (historyB?.totals?.shots ?? 0);

    const avgScoreA = history?.timeline && history.timeline.length > 0
      ? Number((history.timeline.reduce((acc, t) => acc + (t.contribution_score || 0), 0) / history.timeline.length).toFixed(1))
      : 72.0;
    const avgScoreB = historyB?.timeline && historyB.timeline.length > 0
      ? Number((historyB.timeline.reduce((acc, t) => acc + (t.contribution_score || 0), 0) / historyB.timeline.length).toFixed(1))
      : 70.0;

    return [
      { label: 'Goals Scored', valA: goalsA, valB: goalsB, unit: '' },
      { label: 'Expected Goals (xG)', valA: xgA, valB: xgB, unit: '' },
      { label: 'Assists Created', valA: assistsA, valB: assistsB, unit: '' },
      { label: 'Key Passes (Chances)', valA: keyPassesA, valB: keyPassesB, unit: '' },
      { label: 'Passes Completed', valA: passesA, valB: passesB, unit: '' },
      { label: 'Pass Accuracy Rate', valA: passAccA, valB: passAccB, unit: '%' },
      { label: 'Tackles Won', valA: tacklesA, valB: tacklesB, unit: '' },
      { label: 'Interceptions Made', valA: intercA, valB: intercB, unit: '' },
      { label: 'Total Shots Taken', valA: shotsA, valB: shotsB, unit: '' },
      { label: 'Contribution Score Rating', valA: avgScoreA, valB: avgScoreB, unit: '' },
    ];
  }, [history, historyB, playerCompareRateMode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Workspace Header & Mode Switcher */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Individual Player Details and Performance</h1>
          <p className="page-description">
            Complete manager intelligence: photographic profiles, 5-axis tactical radar, pitch control, and comparative telemetry.
          </p>
        </div>

        {/* View Mode Toggle: Player Performance vs Player Comparison vs Match Comparison */}
        <JellyRadio
          size="md"
          items={[
            {
              value: 'player_performance',
              label: 'Player Performance Profile',
              icon: <UserCheck size={16} />,
            },
            {
              value: 'player_comparison',
              label: 'Compare Two Players (H2H)',
              icon: <Users size={16} />,
            },
            {
              value: 'match_comparison',
              label: 'Match Comparison (Fixture A vs B)',
              icon: <GitCompare size={16} />,
            },
          ]}
          value={viewMode}
          onChange={(val) => setViewMode(val as 'player_performance' | 'player_comparison' | 'match_comparison')}
        />
      </div>

      {/* Squad Member Selection Rail */}
      <div className="surface-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div className="surface-panel-title">Squad Selection</div>
            <div className="surface-panel-caption">Select a player to examine tactical telemetry, spatial territory, and match records</div>
          </div>

          {/* Search & Position Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
              <input
                type="text"
                placeholder="Search player..."
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                style={{
                  background: '#0e131b',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '4px',
                  padding: '6px 12px 6px 34px',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  width: '200px',
                  outline: 'none',
                }}
              />
            </div>

            <JellyRadio
              size="sm"
              items={[
                { value: 'ALL', label: 'ALL' },
                { value: 'FW', label: 'FW' },
                { value: 'MF', label: 'MF' },
                { value: 'DF', label: 'DF' },
                { value: 'GK', label: 'GK' },
              ]}
              value={positionFilter}
              onChange={(val) => setPositionFilter(val as any)}
            />
          </div>
        </div>

        {/* Horizontal Player Chips with Photographic Mini Headshots */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((p) => {
              const isSel = selectedPlayerId === p.id;
              const pos = p.position || p.primary_position || 'MF';
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: isSel ? 'rgba(200, 150, 62, 0.14)' : 'var(--bg-surface-elevated)',
                    border: `1px solid ${isSel ? 'var(--accent-gold)' : 'var(--border-hairline)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Mini Photo Headshot */}
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: `1px solid ${isSel ? 'var(--accent-gold)' : 'rgba(255,255,255,0.2)'}`,
                      flexShrink: 0,
                      ...getPlayerAvatarStyle(p.id),
                    }}
                  />
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background:
                        pos === 'FW'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : pos === 'MF'
                          ? 'rgba(200, 150, 62, 0.2)'
                          : pos === 'DF'
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(168, 85, 247, 0.2)',
                      color:
                        pos === 'FW'
                          ? '#f87171'
                          : pos === 'MF'
                          ? 'var(--accent-gold)'
                          : pos === 'DF'
                          ? '#38bdf8'
                          : '#c084fc',
                    }}
                  >
                    {pos}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: isSel ? 600 : 500, color: isSel ? '#ffffff' : 'var(--text-secondary)' }}>
                    {p.name}
                  </span>
                  {p.squad_number && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      #{p.squad_number}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', padding: '6px' }}>
              No squad players match the current filter.
            </div>
          )}
        </div>
      </div>

      {/* Player Hero Profile Banner with Photographic Portrait */}
      {selectedPlayer && (
        <div
          className="surface-panel"
          style={{
            padding: '22px 26px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            background: 'linear-gradient(135deg, #141721 0%, #0d1118 100%)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            {/* Photographic Player Picture Avatar */}
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                border: '2.5px solid var(--accent-gold)',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                ...getPlayerAvatarStyle(selectedPlayer.id),
              }}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  {selectedPlayer.name}
                </h2>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: '4px',
                    background: 'rgba(200, 150, 62, 0.2)',
                    color: 'var(--accent-gold)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                  }}
                >
                  {selectedPlayer.position || selectedPlayer.primary_position || 'MF'}
                </span>
                {selectedPlayer.squad_number && (
                  <span style={{ fontSize: '15.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    #{selectedPlayer.squad_number}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {managedTeam} &bull; First Team Squad &bull; Premier League 2024-25
              </div>

              {/* Status Badges Row */}
              {history && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: '#0e131b',
                      border: `1px solid ${
                        history.trajectory === 'improving' ? '#4ade80' : history.trajectory === 'declining' ? '#f87171' : 'var(--border-hairline)'
                      }`,
                      fontSize: '13px',
                      fontWeight: 600,
                      color:
                        history.trajectory === 'improving' ? '#4ade80' : history.trajectory === 'declining' ? '#f87171' : 'var(--text-secondary)',
                    }}
                  >
                    {history.trajectory === 'improving' ? (
                      <TrendingUp size={14} color="#4ade80" />
                    ) : history.trajectory === 'declining' ? (
                      <TrendingDown size={14} color="#f87171" />
                    ) : (
                      <Minus size={14} color="var(--text-secondary)" />
                    )}
                    <span style={{ textTransform: 'capitalize' }}>Trajectory: {history.trajectory}</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: '#0e131b',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Activity size={14} color="var(--accent-gold)" />
                    <span>Consistency: {history.consistency_std} &sigma;</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: '#0e131b',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <UserCheck size={14} color="#94a3b8" />
                    <span>
                      {history.total_matches} Apps ({history.totals.starts ?? history.total_matches} Starts, {history.totals.sub_appearances ?? 0} Sub)
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: '#0e131b',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Calendar size={14} color="#94a3b8" />
                    <span>{history.total_minutes} Mins ({history.average_minutes} min/match)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Header Controls: Fixture Lens Dropdown & Compare with Whole Team Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
              <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fixture Telemetry Lens
              </label>
              <select
                value={selectedMatchLensId}
                onChange={(e) => setSelectedMatchLensId(e.target.value)}
                style={{
                  background: '#0e131b',
                  border: '1px solid var(--accent-gold)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    vs {m.opponent} ({m.date}) - {m.result} {m.score_team}-{m.score_opponent}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setPerfTab(perfTab === 'team_comparison' ? 'overview' : 'team_comparison')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: perfTab === 'team_comparison' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(200, 150, 62, 0.14)',
                border: `1px solid ${perfTab === 'team_comparison' ? '#38bdf8' : 'var(--accent-gold)'}`,
                color: perfTab === 'team_comparison' ? '#38bdf8' : 'var(--accent-gold)',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                height: '38px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <GitCompare size={14} />
              <span>{perfTab === 'team_comparison' ? 'Show Player Profile' : 'Compare with Whole Team'}</span>
            </button>

            <button
              onClick={() => {
                setPlayerCsvText('');
                setPlayerUploadMsg(null);
                setIsPlayerUploadModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: 'rgba(56, 189, 248, 0.14)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                height: '38px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Upload size={14} />
              <span>Upload Player Stats</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 1: INDIVIDUAL PLAYER PERFORMANCE PROFILE (All Visualizations)
          ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'player_performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Visualizations Category Sub-Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '10px' }}>
            <JellyRadio
              size="md"
              items={[
                { value: 'overview', label: 'Tactical Profile & Trajectory', icon: <Activity size={16} /> },
                { value: 'spatial', label: 'Pitch Territory & Spatial Control', icon: <MapPin size={16} /> },
                { value: 'shooting', label: 'Finishing & Shot Telemetry (2D/3D)', icon: <Crosshair size={16} /> },
                { value: 'team_comparison', label: 'Compare with Whole Team Baseline', icon: <GitCompare size={16} /> },
                { value: 'appearance_log', label: 'Match Appearance Log', icon: <Layers size={16} /> },
              ]}
              value={perfTab}
              onChange={(val) => setPerfTab(val as any)}
            />
          </div>

          {/* SUB-TAB 1: OVERVIEW & TACTICAL PROFILE */}
          {perfTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* 5-Axis Tactical Radar */}
                <BorderGlow
                  backgroundColor="#0e131b"
                  borderRadius={10}
                  colors={['#c8963e', '#38bdf8', '#c084fc']}
                >
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="surface-panel-title">5-Axis Tactical Attribute Radar</div>
                        <div className="surface-panel-caption">Radial tactical ratings synthesized across matches</div>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--accent-gold)', fontWeight: 600 }}>0 &ndash; 100 Scale</div>
                    </div>

                    {historyLoading ? (
                      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                        Generating tactical radar...
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                        <RadarChart
                          data={radarData}
                          playerName={selectedPlayer?.name || 'Player'}
                          size={280}
                          color="var(--accent-gold)"
                        />

                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {Object.entries(radarData).map(([axis, val]) => (
                            <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                              <span style={{ width: '85px', color: 'var(--text-secondary)', fontWeight: 500 }}>{axis}</span>
                              <div style={{ flex: 1, height: '7px', background: '#0e131b', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${Math.min(100, Math.max(0, val))}%`,
                                    height: '100%',
                                    background: val >= 80 ? '#4ade80' : val >= 60 ? 'var(--accent-gold)' : '#94a3b8',
                                    borderRadius: '3px',
                                  }}
                                />
                              </div>
                              <span style={{ width: '36px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                {val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </BorderGlow>

                {/* Core Manager KPI Matrix */}
                <div className="surface-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div className="surface-panel-title">Performance Metric Summary</div>
                      <div className="surface-panel-caption">Key performance indicators and managerial normalizations</div>
                    </div>

                    <JellyRadio
                      size="sm"
                      items={[
                        { value: 'totals', label: 'Raw Totals' },
                        { value: 'per90', label: 'Per 90 Rates' },
                      ]}
                      value={kpiMode}
                      onChange={(val) => setKpiMode(val as 'totals' | 'per90')}
                    />
                  </div>

                  {history ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Goals Scored</div>
                        <div style={{ fontSize: '23px', fontWeight: 700, color: 'var(--accent-gold)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {kpiMode === 'totals' ? history.totals.goals : history.averages_per_90.goals_per_90}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {kpiMode === 'totals' ? `${history.averages_per_90.goals_per_90} per 90` : `${history.totals.goals} total goals`}
                        </div>
                      </div>

                      <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Expected Goals (xG)</div>
                        <div style={{ fontSize: '23px', fontWeight: 700, color: '#38bdf8', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {history.totals.xg !== undefined ? history.totals.xg : '—'}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {history.totals.xg !== undefined && history.totals.goals > history.totals.xg
                            ? `Overperforming by +${(history.totals.goals - history.totals.xg).toFixed(2)}`
                            : 'Shot quality index'}
                        </div>
                      </div>

                      <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Assists</div>
                        <div style={{ fontSize: '23px', fontWeight: 700, color: '#ffffff', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {kpiMode === 'totals' ? history.totals.assists : history.averages_per_90.assists_per_90}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {kpiMode === 'totals' ? `${history.averages_per_90.assists_per_90} per 90` : `${history.totals.assists} total assists`}
                        </div>
                      </div>

                      <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Key Passes (Chances)</div>
                        <div style={{ fontSize: '23px', fontWeight: 700, color: '#ffffff', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {kpiMode === 'totals' ? history.totals.key_passes : history.averages_per_90.key_passes_per_90 ?? '—'}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {kpiMode === 'totals' ? `${history.averages_per_90.key_passes_per_90 ?? '—'} per 90` : `${history.totals.key_passes} chances created`}
                        </div>
                      </div>

                      <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Passing Retention</div>
                        <div style={{ fontSize: '23px', fontWeight: 700, color: '#ffffff', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {history.totals.pass_accuracy_pct !== undefined ? `${history.totals.pass_accuracy_pct}%` : '—'}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {history.totals.passes_completed ?? 0} / {history.totals.passes_attempted ?? 0} completed
                        </div>
                      </div>

                      <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Tackles Won</div>
                        <div style={{ fontSize: '23px', fontWeight: 700, color: '#ffffff', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {kpiMode === 'totals' ? history.totals.tackles_won : history.averages_per_90.tackles_per_90}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {kpiMode === 'totals' ? `${history.averages_per_90.tackles_per_90} per 90` : `${history.totals.tackles_won} total won`}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Longitudinal Performance Trajectory LineChart */}
              <BorderGlow
                backgroundColor="#0e131b"
                borderRadius={10}
                colors={['#c8963e', '#38bdf8', '#c084fc']}
              >
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div className="surface-panel-title">Match-by-Match Longitudinal Trajectory</div>
                      <div className="surface-panel-caption">Chronological metric evolution and rolling performance across fixtures</div>
                    </div>

                    <JellyRadio
                      size="sm"
                      items={metricOptions.map((m) => ({ value: m.key, label: m.label }))}
                      value={trendMetric}
                      onChange={(val) => setTrendMetric(val as any)}
                    />
                  </div>

                  {historyLoading ? (
                    <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Plotting longitudinal trajectory...
                    </div>
                  ) : lineChartData.length > 0 ? (
                    <LineChart
                      data={lineChartData}
                      metricLabel={trendMetric.replace('_', ' ')}
                      xLabel="Fixture Progression"
                      yLabel={trendMetric.replace('_', ' ').toUpperCase()}
                      height={260}
                      lineColor="var(--accent-gold)"
                    />
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No fixture appearances recorded for this player yet.
                    </div>
                  )}
                </div>
              </BorderGlow>
            </div>
          )}

          {/* SUB-TAB 2: SPATIAL TERRITORY & PITCH CONTROL */}
          {perfTab === 'spatial' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Row 1: Player Smooth Color-Gradient HeatMap */}
              <BorderGlow
                backgroundColor="#0e131b"
                borderRadius={10}
                colors={['#c8963e', '#38bdf8', '#c084fc']}
              >
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div className="surface-panel-title">Player Pitch Heatmap</div>
                    <div className="surface-panel-caption">
                      Spatial action density and tactical presence for {selectedPlayer.name} in selected fixture lens
                    </div>
                  </div>

                  {analysisLoading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading spatial coordinates...</div>
                  ) : matchAnalysis ? (
                    <HeatMap
                      events={playerLensEvents.length > 0 ? playerLensEvents : matchAnalysis.events}
                      players={matchAnalysis.players}
                      height={380}
                    />
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No spatial data available for this fixture.</div>
                  )}
                </div>
              </BorderGlow>

              {/* Row 2: Passing Network & Voronoi Pitch Control */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Passing Network */}
                <BorderGlow
                  backgroundColor="#0e131b"
                  borderRadius={10}
                  colors={['#c8963e', '#38bdf8', '#c084fc']}
                >
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <div className="surface-panel-title">Passing Link-up Network</div>
                      <div className="surface-panel-caption">Teammate distribution nodes and passing volume links</div>
                    </div>
                    {matchAnalysis ? (
                      <PassingNetwork
                        events={matchAnalysis.events}
                        players={matchAnalysis.players}
                        selectedPlayerId={selectedPlayerId}
                        height={320}
                      />
                    ) : (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No passing network available.</div>
                    )}
                  </div>
                </BorderGlow>

                {/* Voronoi Pitch Control */}
                <BorderGlow
                  backgroundColor="#0e131b"
                  borderRadius={10}
                  colors={['#c8963e', '#38bdf8', '#c084fc']}
                >
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <div className="surface-panel-title">Territorial Influence &amp; Pitch Control</div>
                      <div className="surface-panel-caption">Voronoi tessellation showing spatial control relative to formation</div>
                    </div>
                    {matchAnalysis ? (
                      <VoronoiPitchControl
                        events={matchAnalysis.events}
                        players={matchAnalysis.players}
                        selectedPlayerId={selectedPlayerId}
                        height={320}
                      />
                    ) : (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No pitch control data available.</div>
                    )}
                  </div>
                </BorderGlow>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: FINISHING & SHOT TELEMETRY (2D & 3D) */}
          {perfTab === 'shooting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 2D Shot Map */}
              <BorderGlow
                backgroundColor="#0e131b"
                borderRadius={10}
                colors={['#c8963e', '#38bdf8', '#c084fc']}
              >
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div className="surface-panel-title">2D Finishing &amp; Shot Map</div>
                    <div className="surface-panel-caption">
                      Coordinates, expected goals (xG), and outcomes for shots taken by {selectedPlayer.name}
                    </div>
                  </div>
                  {matchAnalysis ? (
                    <ShotMap
                      events={playerLensEvents.length > 0 ? playerLensEvents : matchAnalysis.events}
                      height={320}
                    />
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No shot events available.</div>
                  )}
                </div>
              </BorderGlow>

              {/* 3D WebGL Shot Trajectory */}
              <BorderGlow
                backgroundColor="#0e131b"
                borderRadius={10}
                colors={['#c8963e', '#38bdf8', '#c084fc']}
              >
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div className="surface-panel-title">Shot Trajectories</div>
                    <div className="surface-panel-caption">
                      Parabolic ball flight paths, apex elevation, goal frame wireframe, and outcome raycasting
                    </div>
                  </div>
                  {matchAnalysis ? (
                    <ThreeDShotTrajectory
                      events={playerLensEvents.length > 0 ? playerLensEvents : matchAnalysis.events}
                      players={matchAnalysis.players}
                      height={460}
                    />
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No 3D trajectory data available.</div>
                  )}
                </div>
              </BorderGlow>
            </div>
          )}

          {/* SUB-TAB 4: WHOLE-TEAM COMPARISON (VISUAL & TEXTUAL) */}
          {perfTab === 'team_comparison' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* SECTION A: VISUAL COMPARISONS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1.45fr)', gap: '20px' }}>
                {/* 1. Dual-Layer D3 Radar Chart */}
                <BorderGlow
                  backgroundColor="#0e131b"
                  borderRadius={10}
                  colors={['#c8963e', '#38bdf8', '#c084fc']}
                >
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="surface-panel-title">Dual-Layer Tactical Radar Overlay</div>
                        <div className="surface-panel-caption">
                          Gold: {selectedPlayer.name} &bull; Cyan: Whole Team Average
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 600 }}>
                        <span style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-gold)' }} />
                          Player
                        </span>
                        <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                          Team Avg
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <RadarChart
                        data={radarData}
                        playerName={selectedPlayer.name}
                        comparisonData={teamStatsAgg.avgRadar}
                        comparisonName="Whole Team Average"
                        comparisonColor="#38bdf8"
                        size={280}
                        color="var(--accent-gold)"
                      />
                    </div>

                    {/* Attribute Delta Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-hairline)', paddingTop: '12px' }}>
                      {Object.entries(radarData).map(([axis, val]) => {
                        const teamVal = teamStatsAgg.avgRadar[axis as keyof typeof teamStatsAgg.avgRadar] || 60;
                        const delta = val - teamVal;
                        return (
                          <div key={axis} style={{ display: 'grid', gridTemplateColumns: '85px 1fr 70px', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{axis}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '28px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                                {val}
                              </span>
                              <div style={{ flex: 1, height: '6px', background: '#0e131b', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                                <div style={{ width: `${(val / (val + teamVal)) * 100}%`, height: '100%', background: 'var(--accent-gold)' }} />
                                <div style={{ width: `${(teamVal / (val + teamVal)) * 100}%`, height: '100%', background: '#38bdf8' }} />
                              </div>
                              <span style={{ width: '28px', textAlign: 'left', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                                {teamVal}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  background: delta > 0 ? 'rgba(74, 222, 128, 0.15)' : delta < 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                  color: delta > 0 ? '#4ade80' : delta < 0 ? '#38bdf8' : 'var(--text-muted)',
                                }}
                              >
                                {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </BorderGlow>

                {/* 2. Share of Whole Team Output */}
                <div className="surface-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div className="surface-panel-title">Share of Whole-Team Output</div>
                    <div className="surface-panel-caption">
                      Percentage of {managedTeam}&apos;s cumulative season production generated by {selectedPlayer.name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      {
                        label: 'Goals Contribution',
                        playerVal: history?.totals.goals || 0,
                        teamTotal: teamStatsAgg.totalGoals,
                        color: 'var(--accent-gold)',
                        unit: 'goals',
                      },
                      {
                        label: 'Expected Goals (xG) Share',
                        playerVal: history?.totals.xg || 0,
                        teamTotal: teamStatsAgg.totalXg,
                        color: '#38bdf8',
                        unit: 'xG',
                      },
                      {
                        label: 'Assists Contribution',
                        playerVal: history?.totals.assists || 0,
                        teamTotal: teamStatsAgg.totalAssists,
                        color: '#a78bfa',
                        unit: 'assists',
                      },
                      {
                        label: 'Key Passes (Chances) Created',
                        playerVal: history?.totals.key_passes || 0,
                        teamTotal: teamStatsAgg.totalKeyPasses,
                        color: '#f59e0b',
                        unit: 'key passes',
                      },
                      {
                        label: 'Passes Completed Volume',
                        playerVal: history?.totals.passes_completed || 0,
                        teamTotal: teamStatsAgg.totalPasses,
                        color: '#4ade80',
                        unit: 'passes',
                      },
                      {
                        label: 'Defensive Interventions (Tackles + Interceptions)',
                        playerVal: (history?.totals.tackles_won || 0) + (history?.totals.interceptions || 0),
                        teamTotal: teamStatsAgg.totalTackles + teamStatsAgg.totalInterceptions,
                        color: '#22d3ee',
                        unit: 'actions',
                      },
                    ].map((item, idx) => {
                      const pct = Math.min(100, Number(((item.playerVal / Math.max(1, item.teamTotal)) * 100).toFixed(1)));
                      return (
                        <div key={idx} style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{item.label}</span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <span style={{ fontSize: '16px', fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>
                                {pct}%
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                ({item.playerVal} / {item.teamTotal} {item.unit})
                              </span>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: '7px', background: '#161c26', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Per-90 Rate Delta Indicators */}
              <div className="surface-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div className="surface-panel-title">Per-90 Rate Delta vs Squad Baseline</div>
                  <div className="surface-panel-caption">
                    Individual output normalized per 90 minutes compared against outfield squad average
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {[
                    {
                      label: 'Goals / 90',
                      playerVal: history?.averages_per_90.goals_per_90 ?? 0,
                      teamVal: teamStatsAgg.avgGoalsPer90,
                      unit: '',
                      higherIsBetter: true,
                    },
                    {
                      label: 'Expected Goals / 90',
                      playerVal: history?.averages_per_90.goals_per_90 ? Number(((history.totals.xg || 0) / Math.max(1, (history.total_minutes || 90) / 90)).toFixed(2)) : 0,
                      teamVal: teamStatsAgg.avgXgPer90,
                      unit: '',
                      higherIsBetter: true,
                    },
                    {
                      label: 'Assists / 90',
                      playerVal: history?.averages_per_90.assists_per_90 ?? 0,
                      teamVal: teamStatsAgg.avgAssistsPer90,
                      unit: '',
                      higherIsBetter: true,
                    },
                    {
                      label: 'Key Passes / 90',
                      playerVal: history?.averages_per_90.key_passes_per_90 ?? (history?.totals.key_passes ? Number((history.totals.key_passes / Math.max(1, (history.total_minutes || 90) / 90)).toFixed(2)) : 0),
                      teamVal: teamStatsAgg.avgKeyPassesPer90,
                      unit: '',
                      higherIsBetter: true,
                    },
                    {
                      label: 'Pass Accuracy %',
                      playerVal: history?.totals.pass_accuracy_pct ?? (history?.totals.passes_completed ? Math.round(((history.totals.passes_completed / Math.max(1, history.totals.passes_attempted || 1)) * 100)) : 82),
                      teamVal: teamStatsAgg.avgPassAcc,
                      unit: '%',
                      higherIsBetter: true,
                    },
                    {
                      label: 'Tackles Won / 90',
                      playerVal: history?.averages_per_90.tackles_per_90 ?? 0,
                      teamVal: teamStatsAgg.avgTacklesPer90,
                      unit: '',
                      higherIsBetter: true,
                    },
                  ].map((item, idx) => {
                    const delta = Number((item.playerVal - item.teamVal).toFixed(2));
                    const isAbove = delta > 0;
                    return (
                      <div key={idx} style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '14px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.label}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                            {item.playerVal}{item.unit}
                          </span>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              background: isAbove ? 'rgba(74, 222, 128, 0.15)' : delta < 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              color: isAbove ? '#4ade80' : delta < 0 ? '#38bdf8' : 'var(--text-muted)',
                            }}
                          >
                            {isAbove ? `+${delta}` : `${delta}`}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Team Baseline: {item.teamVal}{item.unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: TEXTUAL EXECUTIVE MANAGERIAL NARRATIVE */}
              <div className="surface-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <div className="surface-panel-title">Executive Tactical Comparison Briefing</div>
                  <div className="surface-panel-caption">
                    Comprehensive natural-language managerial appraisal of {selectedPlayer.name} relative to whole squad benchmarks
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Narrative Box 1: Output Influence */}
                  <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Strategic Role &amp; Output Share
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {selectedPlayer.name} represents a cornerstone of {managedTeam}&apos;s offensive profile, directly accounting for{' '}
                      <strong style={{ color: '#ffffff' }}>
                        {Math.min(100, Math.round(((history?.totals.goals || 0) / Math.max(1, teamStatsAgg.totalGoals)) * 100))}%
                      </strong>{' '}
                      of total team goals and{' '}
                      <strong style={{ color: '#ffffff' }}>
                        {Math.min(100, Math.round(((history?.totals.xg || 0) / Math.max(1, teamStatsAgg.totalXg)) * 100))}%
                      </strong>{' '}
                      of cumulative team expected goals. When factoring in chances created, their match influence ranks in the top tier of the squad, operating as a primary catalyst in final third transitions.
                    </div>
                  </div>

                  {/* Narrative Box 2: Ball Retention & Technical Quality */}
                  <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Circulation &amp; Technical Efficiency
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Recording a pass completion rate of{' '}
                      <strong style={{ color: '#ffffff' }}>
                        {history?.totals.pass_accuracy_pct || 84}%
                      </strong>{' '}
                      against the squad average of{' '}
                      <strong style={{ color: '#ffffff' }}>{teamStatsAgg.avgPassAcc}%</strong>, {selectedPlayer.name} exhibits{' '}
                      {(history?.totals.pass_accuracy_pct || 84) >= teamStatsAgg.avgPassAcc
                        ? 'above-average ball security under pressure with minimal turnover liability in contested zones.'
                        : 'high-risk progressive passing tendencies, attempting high-leverage deliveries between lines rather than conservative recycle passes.'}
                    </div>
                  </div>

                  {/* Narrative Box 3: Defensive Workload */}
                  <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Defensive Workload &amp; Counter-Pressing
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      With{' '}
                      <strong style={{ color: '#ffffff' }}>
                        {history?.averages_per_90.tackles_per_90 || 0} tackles won per 90
                      </strong>{' '}
                      versus the team outfield benchmark of{' '}
                      <strong style={{ color: '#ffffff' }}>{teamStatsAgg.avgTacklesPer90}</strong>, the player provides{' '}
                      {(history?.averages_per_90.tackles_per_90 || 0) >= teamStatsAgg.avgTacklesPer90
                        ? 'exceptional defensive workrate, triggering immediate counter-pressing traps and disrupting opponent build-up sequences.'
                        : 'tactical positioning focused on offensive rest-defense, conserving energy for transition burst phases while secondary pivot midfielders handle ball recoveries.'}
                    </div>
                  </div>

                  {/* Narrative Box 4: Managerial Directives */}
                  <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Tactical Action Directives
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <li>
                          <strong>Role Optimization:</strong> Preserve creative license in the half-spaces while structuring a holding midfielder to cover defensive transition space behind.
                        </li>
                        <li>
                          <strong>Channel Feeding:</strong> Direct inverted wingbacks to overlap when {selectedPlayer.name} tucks inside to open dual passing lanes.
                        </li>
                        <li>
                          <strong>Load Management:</strong> Current minutes average ({history?.average_minutes || 82}&apos;/match) indicates heavy reliance; utilize structured sub rotations during positive score differentials.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: CHRONOLOGICAL MATCH APPEARANCE LOG */}
          {perfTab === 'appearance_log' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Match Event Stream with Goal Net, Assist Boot, and Card Symbols */}
              <BorderGlow
                backgroundColor="#0e131b"
                borderRadius={10}
                colors={['#c8963e', '#38bdf8', '#c084fc']}
              >
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div className="surface-panel-title">Match Chronology &amp; Event Stream</div>
                    <div className="surface-panel-caption">
                      Minute-by-minute action stream: Goal symbol, Card symbol, Assist boot symbol
                    </div>
                  </div>
                  {matchAnalysis ? (
                    <MatchTimeline
                      events={matchAnalysis.events}
                      players={matchAnalysis.players}
                      height={220}
                    />
                  ) : null}
                </div>
              </BorderGlow>

              {/* Chronological Match Appearance Log */}
              {history && history.timeline && history.timeline.length > 0 && (
                <div className="surface-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="surface-panel-title">Chronological Match Appearance Log</div>
                      <div className="surface-panel-caption">
                        {history.timeline.length} appearances recorded &bull; Click &ldquo;Focus Lens&rdquo; to analyze fixture telemetry
                      </div>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-hairline)', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#0e131b', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px' }}>Date</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px' }}>Opponent</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px' }}>Venue</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px' }}>Result</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px' }}>Role</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>Mins</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>G</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>A</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>xG</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>Key P</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>Passes</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>Tackles</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>Inter</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', fontSize: '13px' }}>Score</th>
                          <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center', fontSize: '13px' }}>Lens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.timeline.map((item, idx) => {
                          const isCurrentLens = selectedMatchLensId === item.match_id;
                          return (
                            <tr
                              key={item.match_id || idx}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                background: isCurrentLens
                                  ? 'rgba(200, 150, 62, 0.08)'
                                  : idx % 2 === 0
                                  ? 'transparent'
                                  : 'rgba(255, 255, 255, 0.01)',
                              }}
                            >
                              <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                {item.date}
                              </td>
                              <td style={{ padding: '11px 14px', fontWeight: 600, color: '#ffffff' }}>
                                vs {item.opponent}
                              </td>
                              <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                {item.home_away || 'home'}
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <span className={getBadgeClass(item.result)}>
                                  {item.result || 'W'} {item.score_team !== undefined ? `${item.score_team}-${item.score_opponent}` : ''}
                                </span>
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <span
                                  style={{
                                    fontSize: '12px',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    background: item.is_starter !== false ? 'rgba(74, 222, 128, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                    color: item.is_starter !== false ? '#4ade80' : '#94a3b8',
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.is_starter !== false ? 'Starter' : 'Sub'}
                                </span>
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {item.minutes_played}&apos;
                              </td>
                              <td
                                style={{
                                  padding: '11px 14px',
                                  textAlign: 'right',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: item.goals > 0 ? 700 : 400,
                                  color: item.goals > 0 ? 'var(--accent-gold)' : 'inherit',
                                }}
                              >
                                {item.goals}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {item.assists}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                                {item.xg !== undefined ? item.xg : '—'}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {item.key_passes}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {item.passes_completed !== undefined ? `${item.passes_completed}/${item.passes_attempted}` : '—'}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {item.tackles_won}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {item.interceptions}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-gold)' }}>
                                {item.contribution_score}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                                <button
                                  onClick={() => setSelectedMatchLensId(item.match_id)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '5px 10px',
                                    background: isCurrentLens ? 'var(--accent-gold)' : 'rgba(200, 150, 62, 0.12)',
                                    border: `1px solid ${isCurrentLens ? 'var(--accent-gold)' : 'rgba(200, 150, 62, 0.35)'}`,
                                    color: isCurrentLens ? '#000000' : 'var(--accent-gold)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>{isCurrentLens ? 'Active Lens' : 'Focus Lens'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 3: HEAD-TO-HEAD TWO PLAYER COMPARISON (Player A vs Player B)
          Manager Intelligence: Dual-Layer Radar, Split KPIs, Dual Trend, Text Appraisal
          ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'player_comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Selection & Filter Rail */}
          <div className="surface-panel" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
              <div>
                <div className="surface-panel-title">Head-to-Head Squad Member Comparison</div>
                <div className="surface-panel-caption">
                  Comparative tactical profiling, 5-axis attribute overlay, longitudinal form tracking &amp; managerial appraisal
                </div>
              </div>

              {/* Rate Mode Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>METRIC NORMALIZATION:</span>
                <JellyRadio
                  size="sm"
                  items={[
                    { value: 'per90', label: 'Per 90 Rates' },
                    { value: 'totals', label: 'Raw Season Totals' },
                  ]}
                  value={playerCompareRateMode}
                  onChange={(val) => setPlayerCompareRateMode(val as 'per90' | 'totals')}
                />
              </div>
            </div>

            {/* Player A / Swap / Player B Selectors Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '16px',
                alignItems: 'center',
                background: '#0e131b',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-hairline)',
              }}
            >
              {/* Player A Selector (Gold Accent) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Player A (Primary - Gold)
                </label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  style={{
                    background: '#161c26',
                    border: '1px solid var(--accent-gold)',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '14px',
                    outline: 'none',
                    fontWeight: 600,
                  }}
                >
                  {activePlayerList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position || p.primary_position || 'MF'}) {p.squad_number ? `— #${p.squad_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Button */}
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: '20px' }}>
                <button
                  onClick={handleSwapPlayers}
                  title="Swap Player A and Player B"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-hairline)',
                    color: '#ffffff',
                    padding: '9px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ArrowLeftRight size={15} color="var(--accent-gold)" />
                  <span>Swap (A ⇄ B)</span>
                </button>
              </div>

              {/* Player B Selector (Cyan Accent) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Player B (Comparison - Cyan)
                </label>
                <select
                  value={comparePlayerBId}
                  onChange={(e) => setComparePlayerBId(e.target.value)}
                  style={{
                    background: '#161c26',
                    border: '1px solid #38bdf8',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '14px',
                    outline: 'none',
                    fontWeight: 600,
                  }}
                >
                  {activePlayerList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position || p.primary_position || 'MF'}) {p.squad_number ? `— #${p.squad_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Dual Player Hero Header (Side-by-side cards with central VS duel badge) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'stretch' }}>
            {/* Player A Card */}
            <div
              className="surface-panel"
              style={{
                padding: '22px',
                background: 'linear-gradient(135deg, rgba(200, 150, 62, 0.12) 0%, #0e131b 100%)',
                border: '1px solid rgba(200, 150, 62, 0.4)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    border: '2.5px solid var(--accent-gold)',
                    flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(200, 150, 62, 0.3)',
                    ...getPlayerAvatarStyle(selectedPlayer.id),
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedPlayer.name}
                    </h2>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(200, 150, 62, 0.25)',
                        color: 'var(--accent-gold)',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {selectedPlayer.position || selectedPlayer.primary_position || 'MF'}
                    </span>
                    {selectedPlayer.squad_number && (
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        #{selectedPlayer.squad_number}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {history?.total_matches || 0} appearances &bull; {history?.total_minutes || 0} mins ({history?.average_minutes || 0} min/match)
                  </div>
                </div>
              </div>

              {/* Trajectory & Summary Pill Badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: '#141a24',
                    border: '1px solid var(--border-hairline)',
                    color: history?.trajectory === 'improving' ? '#4ade80' : history?.trajectory === 'declining' ? '#f87171' : 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  {history?.trajectory === 'improving' ? <TrendingUp size={12} /> : history?.trajectory === 'declining' ? <TrendingDown size={12} /> : <Minus size={12} />}
                  Form: {history?.trajectory || 'stable'}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: '#141a24',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--accent-gold)',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Score: {history?.timeline && history.timeline.length > 0
                    ? Number((history.timeline.reduce((acc, t) => acc + (t.contribution_score || 0), 0) / history.timeline.length).toFixed(1))
                    : 72.0}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  G: <strong style={{ color: '#ffffff' }}>{history?.totals?.goals || 0}</strong> &bull; A: <strong style={{ color: '#ffffff' }}>{history?.totals?.assists || 0}</strong> &bull; xG: <strong style={{ color: '#ffffff' }}>{history?.totals?.xg || 0}</strong>
                </span>
              </div>
            </div>

            {/* Central VS Duel Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 4px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #231b14 0%, #101c27 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.08em' }}>VS</span>
              </div>
            </div>

            {/* Player B Card */}
            <div
              className="surface-panel"
              style={{
                padding: '22px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, #0e131b 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    border: '2.5px solid #38bdf8',
                    flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)',
                    ...getPlayerAvatarStyle(playerB.id),
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {playerB.name}
                    </h2>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {playerB.position || playerB.primary_position || 'FW'}
                    </span>
                    {playerB.squad_number && (
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        #{playerB.squad_number}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {historyB?.total_matches || 0} appearances &bull; {historyB?.total_minutes || 0} mins ({historyB?.average_minutes || 0} min/match)
                  </div>
                </div>
              </div>

              {/* Trajectory & Summary Pill Badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: '#141a24',
                    border: '1px solid var(--border-hairline)',
                    color: historyB?.trajectory === 'improving' ? '#4ade80' : historyB?.trajectory === 'declining' ? '#f87171' : 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  {historyB?.trajectory === 'improving' ? <TrendingUp size={12} /> : historyB?.trajectory === 'declining' ? <TrendingDown size={12} /> : <Minus size={12} />}
                  Form: {historyB?.trajectory || 'stable'}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: '#141a24',
                    border: '1px solid var(--border-hairline)',
                    color: '#38bdf8',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Score: {historyB?.timeline && historyB.timeline.length > 0
                    ? Number((historyB.timeline.reduce((acc, t) => acc + (t.contribution_score || 0), 0) / historyB.timeline.length).toFixed(1))
                    : 70.0}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  G: <strong style={{ color: '#ffffff' }}>{historyB?.totals?.goals || 0}</strong> &bull; A: <strong style={{ color: '#ffffff' }}>{historyB?.totals?.assists || 0}</strong> &bull; xG: <strong style={{ color: '#ffffff' }}>{historyB?.totals?.xg || 0}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* ─── TILE 1 & TILE 2: VISUALIZATION GRID (Wrapped in BorderGlow) ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* TILE 1: 5-Axis Tactical Radar Comparison */}
            <BorderGlow
              backgroundColor="#0e131b"
              borderRadius={10}
              colors={['#c8963e', '#38bdf8', '#c084fc']}
            >
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="surface-panel-title">5-Axis Tactical Radar Comparison</div>
                    <div className="surface-panel-caption">
                      Direct tactical role overlay: {selectedPlayer.name} (Gold) vs {playerB.name} (Cyan)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <RadarChart
                    data={playerRadarA}
                    playerName={selectedPlayer.name}
                    color="var(--accent-gold)"
                    comparisonData={playerRadarB}
                    comparisonName={playerB.name}
                    comparisonColor="#38bdf8"
                    size={280}
                  />
                </div>

                {/* 5-Axis Differential Breakdown Table */}
                <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '12px', marginTop: 'auto' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Tactical Axis Differential
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['Attacking', 'Passing', 'Defending', 'Duels', 'Workrate'].map((axis) => {
                      const valA = playerRadarA[axis] ?? 50;
                      const valB = playerRadarB[axis] ?? 50;
                      const diff = valA - valB;
                      return (
                        <div
                          key={axis}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '45px 1fr 45px 95px',
                            alignItems: 'center',
                            fontSize: '12.5px',
                            padding: '4px 0',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                          }}
                        >
                          <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {valA}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 500 }}>
                            {axis}
                          </span>
                          <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                            {valB}
                          </span>
                          <span
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              fontSize: '11.5px',
                              color: diff > 0 ? 'var(--accent-gold)' : diff < 0 ? '#38bdf8' : 'var(--text-muted)',
                            }}
                          >
                            {diff > 0 ? `+${diff} A` : diff < 0 ? `+${Math.abs(diff)} B` : 'Even'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </BorderGlow>

            {/* TILE 2: Metric-by-Metric Head-to-Head KPI Gauges / Split Bars */}
            <BorderGlow
              backgroundColor="#0e131b"
              borderRadius={10}
              colors={['#c8963e', '#38bdf8', '#c084fc']}
            >
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="surface-panel-title">Metric-by-Metric Split Comparison</div>
                    <div className="surface-panel-caption">
                      {playerCompareRateMode === 'per90' ? 'Standardized per 90 match minutes' : 'Total cumulative match production'}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Gold: {selectedPlayer.name.split(' ')[0]} &bull; Cyan: {playerB.name.split(' ')[0]}
                  </div>
                </div>

                {/* Split Progress Bars List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {playerComparisonMetrics.map((m, idx) => {
                    const total = m.valA + m.valB;
                    const pctA = total === 0 ? 50 : Math.max(10, Math.min(90, Math.round((m.valA / total) * 100)));
                    const pctB = 100 - pctA;
                    const diff = Number((m.valA - m.valB).toFixed(2));
                    const aWins = diff > 0;
                    const bWins = diff < 0;

                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                          <span
                            style={{
                              color: aWins ? 'var(--accent-gold)' : 'var(--text-secondary)',
                              fontWeight: aWins ? 700 : 500,
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {m.valA}{m.unit}
                          </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '12px' }}>
                            {m.label}
                          </span>
                          <span
                            style={{
                              color: bWins ? '#38bdf8' : 'var(--text-secondary)',
                              fontWeight: bWins ? 700 : 500,
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {m.valB}{m.unit}
                          </span>
                        </div>

                        {/* Split Progress Bar */}
                        <div
                          style={{
                            height: '7px',
                            background: '#161c26',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            display: 'flex',
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              width: `${pctA}%`,
                              background: aWins ? 'var(--accent-gold)' : 'rgba(200, 150, 62, 0.45)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                          <div
                            style={{
                              width: `${pctB}%`,
                              background: bWins ? '#38bdf8' : 'rgba(56, 189, 248, 0.45)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </BorderGlow>
          </div>

          {/* ─── TILE 3: LONGITUDINAL MATCH-BY-MATCH TREND (Dual Line Series) ─── */}
          <BorderGlow
            backgroundColor="#0e131b"
            borderRadius={10}
            colors={['#c8963e', '#38bdf8', '#c084fc']}
          >
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div className="surface-panel-title">Longitudinal Match Progression (Dual Line Series)</div>
                  <div className="surface-panel-caption">
                    Tracking timeline form volatility and per-match output: {selectedPlayer.name} (Gold) vs {playerB.name} (Cyan)
                  </div>
                </div>

                {/* Trend Metric Selector Chips */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {metricOptions.map((opt) => {
                    const isSel = playerCompareTrendMetric === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setPlayerCompareTrendMetric(opt.key)}
                        style={{
                          background: isSel ? 'rgba(200, 150, 62, 0.2)' : '#161c26',
                          border: `1px solid ${isSel ? 'var(--accent-gold)' : 'var(--border-hairline)'}`,
                          color: isSel ? 'var(--accent-gold)' : 'var(--text-secondary)',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: isSel ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dual Series Line Chart */}
              <div style={{ minHeight: '280px', width: '100%' }}>
                <LineChart
                  data={playerCompareChartDataA}
                  metricLabel={metricOptions.find((m) => m.key === playerCompareTrendMetric)?.label || 'Metric'}
                  height={280}
                  lineColor="var(--accent-gold)"
                  primaryName={selectedPlayer.name}
                  comparisonData={playerCompareChartDataB}
                  comparisonName={playerB.name}
                  comparisonColor="#38bdf8"
                  xLabel="Fixture Progression (Opponent)"
                  yLabel={metricOptions.find((m) => m.key === playerCompareTrendMetric)?.label}
                />
              </div>
            </div>
          </BorderGlow>

          {/* ─── SECTION 4: MANAGERIAL HEAD-TO-HEAD APPRAISAL (Textual Synthesis) ─── */}
          <div className="surface-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div className="surface-panel-title">Managerial Head-to-Head Scouting &amp; Tactical Appraisal</div>
              <div className="surface-panel-caption">
                Automated coaching synthesis evaluating attacking output, possession security, defensive pressing, and tactical deployment directives
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              {/* Pillar 1: Attacking Output & Goal Threat */}
              <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  1. Attacking Output &amp; Goal Threat Differential
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Comparing finishing efficiency and attacking presence:{' '}
                  <strong style={{ color: '#ffffff' }}>{selectedPlayer.name}</strong> accounts for{' '}
                  <strong style={{ color: 'var(--accent-gold)' }}>{history?.totals?.goals || 0} goals</strong> ({history?.averages_per_90?.goals_per_90 || 0}/90) from{' '}
                  <strong style={{ color: '#ffffff' }}>{history?.totals?.xg || 0} xG</strong>, whereas{' '}
                  <strong style={{ color: '#ffffff' }}>{playerB.name}</strong> has produced{' '}
                  <strong style={{ color: '#38bdf8' }}>{historyB?.totals?.goals || 0} goals</strong> ({historyB?.averages_per_90?.goals_per_90 || 0}/90) from{' '}
                  <strong style={{ color: '#ffffff' }}>{historyB?.totals?.xg || 0} xG</strong>.{' '}
                  {(history?.totals?.goals || 0) >= (historyB?.totals?.goals || 0)
                    ? `${selectedPlayer.name} provides superior clinical box presence and set-piece composure, converting opportunities at a higher rate.`
                    : `${playerB.name} offers more vertical penetration and direct penalty box presence, generating greater raw shot volume.`}
                </div>
              </div>

              {/* Pillar 2: Circulation, Possession & Ball Retention */}
              <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  2. Possession, Circulation &amp; Ball Retention
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  In the buildup and playmaking phase:{' '}
                  <strong style={{ color: '#ffffff' }}>{selectedPlayer.name}</strong> maintains{' '}
                  <strong style={{ color: 'var(--accent-gold)' }}>{history?.totals?.pass_accuracy_pct || 82}% accuracy</strong> with{' '}
                  <strong style={{ color: '#ffffff' }}>{history?.totals?.key_passes || 0} key passes</strong>, compared to{' '}
                  <strong style={{ color: '#ffffff' }}>{playerB.name}</strong> at{' '}
                  <strong style={{ color: '#38bdf8' }}>{historyB?.totals?.pass_accuracy_pct || 81}% accuracy</strong> with{' '}
                  <strong style={{ color: '#ffffff' }}>{historyB?.totals?.key_passes || 0} key passes</strong>.{' '}
                  {(history?.totals?.key_passes || 0) >= (historyB?.totals?.key_passes || 0)
                    ? `${selectedPlayer.name} functions as the primary creative orchestrator, demonstrating superior vision to execute key passes between opponent defensive lines.`
                    : `${playerB.name} excels as a direct line-breaker, favoring rapid vertical progression over sustained lateral circulation.`}
                </div>
              </div>

              {/* Pillar 3: Defensive Workrate & Pressing Intensity */}
              <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', marginBottom: '8px' }}>
                  3. Defensive Workrate &amp; Pressing Traps
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Defensive contribution and counter-press engagement:{' '}
                  <strong style={{ color: '#ffffff' }}>{selectedPlayer.name}</strong> records{' '}
                  <strong style={{ color: 'var(--accent-gold)' }}>{history?.averages_per_90?.tackles_per_90 || 0} tackles won/90</strong> and{' '}
                  <strong style={{ color: '#ffffff' }}>{history?.averages_per_90?.interceptions_per_90 || 0} interceptions/90</strong>, versus{' '}
                  <strong style={{ color: '#ffffff' }}>{playerB.name}</strong> with{' '}
                  <strong style={{ color: '#38bdf8' }}>{historyB?.averages_per_90?.tackles_per_90 || 0} tackles won/90</strong> and{' '}
                  <strong style={{ color: '#ffffff' }}>{historyB?.averages_per_90?.interceptions_per_90 || 0} interceptions/90</strong>.{' '}
                  {(history?.averages_per_90?.tackles_per_90 || 0) >= (historyB?.averages_per_90?.tackles_per_90 || 0)
                    ? `${selectedPlayer.name} exhibits higher defensive engagement in middle-third ball recovery and counter-pressing traps.`
                    : `${playerB.name} applies more energetic first-line pressing, closing down opposing center-backs and disrupting initial distribution.`}
                </div>
              </div>

              {/* Pillar 4: Tactical Synergy & Selection Directive */}
              <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  4. Tactical Synergy &amp; Deployment Directive
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>
                      <strong>Opposition Low-Block:</strong> Deploy{' '}
                      <strong style={{ color: 'var(--accent-gold)' }}>{selectedPlayer.name}</strong> to unlock compact defensive blocks with incisive half-space distribution.
                    </li>
                    <li>
                      <strong>High-Line Transition Counter:</strong> Utilize{' '}
                      <strong style={{ color: '#38bdf8' }}>{playerB.name}</strong> to exploit vertical depth behind opposition defensive lines on rapid transition breaks.
                    </li>
                    <li>
                      <strong>Concurrent Synergy:</strong> When fielded together, instruct{' '}
                      {selectedPlayer.name} to operate in the right half-space feeding channel runs for {playerB.name}&apos;s diagonal box penetrations.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 2: DEDICATED PLAYER MATCH COMPARISON (Fixture A vs Fixture B)
          No redirection away — dedicated head-to-head performance telemetry!
          ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'match_comparison' && (
        <div className="surface-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div className="surface-panel-title">Head-to-Head Fixture Performance Comparison</div>
            <div className="surface-panel-caption">
              Evaluating {selectedPlayer.name}&apos;s performance differentials between Fixture A and Fixture B
            </div>
          </div>

          {/* Fixture Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13.5px', color: 'var(--accent-gold)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Fixture A (Gold):
              </label>
              <select
                value={compareMatchAId}
                onChange={(e) => setCompareMatchAId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#161c26',
                  border: '1px solid var(--accent-gold)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '14px',
                }}
              >
                {(history?.timeline || []).map((t) => (
                  <option key={t.match_id} value={t.match_id}>
                    vs {t.opponent} ({t.date}) - {t.result} {t.score_team}-{t.score_opponent} ({t.minutes_played}&apos;, Score: {t.contribution_score})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '13.5px', color: '#38bdf8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Fixture B (Cyan):
              </label>
              <select
                value={compareMatchBId}
                onChange={(e) => setCompareMatchBId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#161c26',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '14px',
                }}
              >
                {(history?.timeline || []).map((t) => (
                  <option key={t.match_id} value={t.match_id}>
                    vs {t.opponent} ({t.date}) - {t.result} {t.score_team}-{t.score_opponent} ({t.minutes_played}&apos;, Score: {t.contribution_score})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {compareEntryA && compareEntryB && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Fixture Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Match A Card */}
                <div style={{ background: '#0e131b', borderRadius: '8px', padding: '18px', border: '1px solid var(--accent-gold)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>vs {compareEntryA.opponent}</div>
                      <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {compareEntryA.date} &bull; {(compareEntryA.home_away || 'home').toUpperCase()} &bull; {compareEntryA.position || 'MF'}
                      </div>
                    </div>
                    <span className={getBadgeClass(compareEntryA.result)} style={{ fontSize: '14px' }}>
                      {compareEntryA.result} {compareEntryA.score_team}-{compareEntryA.score_opponent}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', marginTop: '16px', alignItems: 'center' }}>
                    <div style={{ background: '#161c26', borderRadius: '4px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Contribution Score</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                        {compareEntryA.contribution_score}
                      </div>
                    </div>
                    <div style={{ background: '#161c26', borderRadius: '4px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Minutes Played</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        {compareEntryA.minutes_played}&apos;
                      </div>
                    </div>
                    <div style={{ background: '#161c26', borderRadius: '4px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Role</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: compareEntryA.is_starter !== false ? '#4ade80' : '#94a3b8' }}>
                        {compareEntryA.is_starter !== false ? 'Starter' : 'Substitute'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match B Card */}
                <div style={{ background: '#0e131b', borderRadius: '8px', padding: '18px', border: '1px solid #38bdf8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>vs {compareEntryB.opponent}</div>
                      <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {compareEntryB.date} &bull; {(compareEntryB.home_away || 'home').toUpperCase()} &bull; {compareEntryB.position || 'MF'}
                      </div>
                    </div>
                    <span className={getBadgeClass(compareEntryB.result)} style={{ fontSize: '14px' }}>
                      {compareEntryB.result} {compareEntryB.score_team}-{compareEntryB.score_opponent}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', marginTop: '16px', alignItems: 'center' }}>
                    <div style={{ background: '#161c26', borderRadius: '4px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Contribution Score</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        {compareEntryB.contribution_score}
                      </div>
                    </div>
                    <div style={{ background: '#161c26', borderRadius: '4px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Minutes Played</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        {compareEntryB.minutes_played}&apos;
                      </div>
                    </div>
                    <div style={{ background: '#161c26', borderRadius: '4px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Role</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: compareEntryB.is_starter !== false ? '#4ade80' : '#94a3b8' }}>
                        {compareEntryB.is_starter !== false ? 'Starter' : 'Substitute'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dual Radar & Head-to-Head Comparison Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Dual Tactical Radar Visualizer */}
                <BorderGlow
                  backgroundColor="#0e131b"
                  borderRadius={8}
                  colors={['#c8963e', '#38bdf8', '#c084fc']}
                >
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', marginBottom: '12px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Comparative Tactical Radar Profiles</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Gold: Fixture A (vs {compareEntryA.opponent}) &bull; Cyan: Fixture B (vs {compareEntryB.opponent})
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '6px' }}>
                          Fixture A Profile
                        </div>
                        <RadarChart data={radarDataA} playerName={`${selectedPlayer.name} A`} size={220} color="var(--accent-gold)" />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12.5px', color: '#38bdf8', fontWeight: 700, marginBottom: '6px' }}>
                          Fixture B Profile
                        </div>
                        <RadarChart data={radarDataB} playerName={`${selectedPlayer.name} B`} size={220} color="#38bdf8" />
                      </div>
                    </div>
                  </div>
                </BorderGlow>

                {/* Head-to-Head Metric Differential Table */}
                <div style={{ background: '#0e131b', borderRadius: '8px', padding: '20px', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Head-to-Head Metric Differential</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      Side-by-side match action differential for {selectedPlayer.name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Goals Scored', valA: compareEntryA.goals, valB: compareEntryB.goals },
                      { label: 'Expected Goals (xG)', valA: compareEntryA.xg ?? 0, valB: compareEntryB.xg ?? 0 },
                      { label: 'Assists', valA: compareEntryA.assists, valB: compareEntryB.assists },
                      { label: 'Key Passes', valA: compareEntryA.key_passes, valB: compareEntryB.key_passes },
                      {
                        label: 'Passes Completed',
                        valA: compareEntryA.passes_completed ?? 0,
                        valB: compareEntryB.passes_completed ?? 0,
                      },
                      {
                        label: 'Pass Accuracy %',
                        valA: compareEntryA.pass_accuracy_pct ?? 0,
                        valB: compareEntryB.pass_accuracy_pct ?? 0,
                        unit: '%',
                      },
                      { label: 'Tackles Won', valA: compareEntryA.tackles_won, valB: compareEntryB.tackles_won },
                      { label: 'Interceptions', valA: compareEntryA.interceptions, valB: compareEntryB.interceptions },
                      { label: 'Shots Total', valA: compareEntryA.shots, valB: compareEntryB.shots },
                      { label: 'Contribution Score', valA: compareEntryA.contribution_score, valB: compareEntryB.contribution_score },
                    ].map((row, rIdx) => {
                      const diff = Number((row.valA - row.valB).toFixed(2));
                      return (
                        <div
                          key={rIdx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '85px 1fr 85px',
                            alignItems: 'center',
                            padding: '7px 0',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            fontSize: '13.5px',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                            {row.valA}{row.unit || ''}
                          </span>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{row.label}</span>
                            <span
                              style={{
                                marginLeft: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: diff > 0 ? '#4ade80' : diff < 0 ? '#38bdf8' : 'var(--text-muted)',
                              }}
                            >
                              {diff > 0 ? `+${diff} (A)` : diff < 0 ? `+${Math.abs(diff)} (B)` : '='}
                            </span>
                          </div>
                          <span style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                            {row.valB}{row.unit || ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Player Stats CSV Upload Modal */}
      {isPlayerUploadModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#111722',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Upload size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                  Upload Player Match Stats (CSV)
                </h3>
              </div>
              <button
                onClick={() => setIsPlayerUploadModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
              Ingest match statistics for {selectedPlayer?.name || 'squad players'} from a CSV sheet. Updates historical appearances, passing rates, and rating trajectories.
            </p>

            {/* Accepted Format & Column Specifications */}
            <DataFormatGuide
              formatType="player_stats_csv"
              defaultExpanded={false}
              onInsertSample={(sample) => setPlayerCsvText(sample)}
            />

            <div
              style={{
                border: '1px dashed rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
              }}
            >
              <FileText size={26} color="#c8963e" style={{ margin: '0 auto 8px' }} />
              <label
                style={{
                  display: 'inline-block',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Select CSV File
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setPlayerCsvText((event.target?.result as string) || '');
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Supported format: comma-separated values (.csv)
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                CSV Preview / Direct Paste:
              </label>
              <textarea
                value={playerCsvText}
                onChange={(e) => setPlayerCsvText(e.target.value)}
                placeholder="player_id,player_name,jersey_number,team,position,minutes,goals,assists..."
                rows={5}
                style={{
                  width: '100%',
                  backgroundColor: '#0a0e16',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '10px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {playerUploadMsg && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  backgroundColor: playerUploadMsg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  border: `1px solid ${playerUploadMsg.isError ? '#ef4444' : '#22c55e'}`,
                  color: playerUploadMsg.isError ? '#ef4444' : '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {playerUploadMsg.isError ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
                <span>{playerUploadMsg.text}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setIsPlayerUploadModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  color: '#94a3b8',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                disabled={isUploadingStats || !playerCsvText.trim()}
                onClick={async () => {
                  if (!playerCsvText.trim()) return;
                  setIsUploadingStats(true);
                  setPlayerUploadMsg(null);
                  try {
                    await importCsvMatchData(playerCsvText);
                    setPlayerUploadMsg({ text: 'Player match metrics imported successfully!' });
                    if (selectedPlayerId) {
                      const updated = await fetchPlayerHistory(selectedPlayerId);
                      setHistory(updated);
                    }
                    setTimeout(() => {
                      setIsPlayerUploadModalOpen(false);
                      setPlayerCsvText('');
                      setPlayerUploadMsg(null);
                    }, 1200);
                  } catch (err: any) {
                    setPlayerUploadMsg({ text: err.message || 'Failed to import player stats', isError: true });
                  } finally {
                    setIsUploadingStats(false);
                  }
                }}
                style={{
                  background: isUploadingStats || !playerCsvText.trim() ? 'rgba(56, 189, 248, 0.4)' : '#38bdf8',
                  color: '#090d14',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isUploadingStats || !playerCsvText.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isUploadingStats ? 'Ingesting...' : 'Ingest Stats'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
