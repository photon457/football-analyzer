import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Calendar,
  Download,
  Upload,
  FileText,
  Table,
  Users,
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Target,
  Compass,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  OpponentListItem,
  OpponentPerformanceResponse,
  OpponentTeamSheetResponse,
  fetchOpponentsList,
  fetchOpponentPerformance,
  fetchOpponentTeamSheet,
  saveOpponentTeamSheet,
} from '../../services/api';
import { RadarChart } from '../visualizations/RadarChart';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface OpponentTacticsProps {
  managedTeam: string;
  initialOpponent?: string;
  onNavigateToMatches?: () => void;
}

const TOKENS = {
  bgApp: '#090d14',
  bgCard: '#111722',
  bgCardHover: '#161e2c',
  bgInset: '#0a0e16',
  border: 'rgba(255, 255, 255, 0.10)',
  borderLight: 'rgba(255, 255, 255, 0.18)',
  gold: '#c8963e',
  goldDim: 'rgba(200, 150, 62, 0.15)',
  goldBorder: 'rgba(200, 150, 62, 0.40)',
  cyan: '#38bdf8',
  cyanDim: 'rgba(56, 189, 248, 0.12)',
  green: '#22c55e',
  greenDim: 'rgba(34, 197, 94, 0.15)',
  red: '#ef4444',
  redDim: 'rgba(239, 68, 68, 0.15)',
  textPrimary: '#ffffff',
  textSecondary: '#a0aab8',
  textMuted: '#687484',
};

export const OpponentTactics: React.FC<OpponentTacticsProps> = ({
  managedTeam,
  initialOpponent,
  onNavigateToMatches,
}) => {
  const [opponents, setOpponents] = useState<OpponentListItem[]>([]);
  const [selectedOpponentName, setSelectedOpponentName] = useState<string>(
    initialOpponent || 'Manchester United'
  );
  // Date filter: defaults to Nov 3, 2024 (upcoming MW 10 fixture)
  const [asOfDate, setAsOfDate] = useState<string>('2024-11-03');

  // Sub-tab: 'blueprint' | 'team_sheet' | 'matches'
  const [activeSubTab, setActiveSubTab] = useState<'blueprint' | 'team_sheet' | 'matches'>('blueprint');

  // Performance data
  const [performance, setPerformance] = useState<OpponentPerformanceResponse | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState<boolean>(true);

  // Team Sheet data
  const [teamSheet, setTeamSheet] = useState<OpponentTeamSheetResponse | null>(null);
  const [loadingTeamSheet, setLoadingTeamSheet] = useState<boolean>(false);
  const [csvText, setCsvText] = useState<string>('');
  const [csvViewMode, setCsvViewMode] = useState<'table' | 'raw'>('table');

  // Status feedback
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Load Opponents List
  useEffect(() => {
    fetchOpponentsList()
      .then((list) => {
        setOpponents(list);
        if (!initialOpponent && list.length > 0) {
          // If there's an upcoming fixture opponent, pick it
          const nextOpp = list.find((o) => o.next_fixture && o.next_fixture.status === 'scheduled');
          if (nextOpp) {
            setSelectedOpponentName(nextOpp.name);
            if (nextOpp.next_fixture?.date) {
              setAsOfDate(nextOpp.next_fixture.date);
            }
          } else {
            setSelectedOpponentName(list[0].name);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load opponents list', err);
      });
  }, [initialOpponent, managedTeam]);

  // Load Performance when opponent or date changes
  useEffect(() => {
    if (!selectedOpponentName) return;
    setLoadingPerformance(true);
    setStatusMsg(null);

    fetchOpponentPerformance(selectedOpponentName, asOfDate)
      .then((data) => {
        setPerformance(data);
        setLoadingPerformance(false);
      })
      .catch((err) => {
        console.error('Failed to load opponent performance', err);
        setLoadingPerformance(false);
      });
  }, [selectedOpponentName, asOfDate]);

  // Load Team Sheet when opponent changes
  useEffect(() => {
    if (!selectedOpponentName) return;
    setLoadingTeamSheet(true);

    fetchOpponentTeamSheet(selectedOpponentName)
      .then((data) => {
        setTeamSheet(data);
        setCsvText(data.csv_content);
        setLoadingTeamSheet(false);
      })
      .catch((err) => {
        console.error('Failed to load opponent team sheet', err);
        setLoadingTeamSheet(false);
      });
  }, [selectedOpponentName]);

  const currentOpponentMeta = opponents.find((o) => o.name === selectedOpponentName);

  // Handle Download CSV
  const handleDownloadCsv = () => {
    if (!csvText) return;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', teamSheet?.filename || `${selectedOpponentName}_team_sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle CSV file upload
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setStatusMsg({ text: 'Please select a valid CSV file (.csv)', isError: true });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      try {
        const updated = await saveOpponentTeamSheet(selectedOpponentName, text);
        setTeamSheet(updated);
        setStatusMsg({ text: `Successfully updated ${selectedOpponentName} team sheet from CSV!` });
      } catch (err: any) {
        setStatusMsg({ text: err.message || 'Failed to parse uploaded CSV', isError: true });
      }
    };
    reader.readAsText(file);
  };

  // Radar Profile Data Format
  const radarChartData = useMemo(() => {
    if (!performance || !performance.radar) return [];
    return Object.entries(performance.radar).map(([axis, val]) => ({
      axis,
      value: val,
      comparison: 50, // Premier League 50/100 baseline
    }));
  }, [performance]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%', padding: '0 4px' }}>
      {/* Top Header & Opponent / Date Filter Bar */}
      <div
        style={{
          backgroundColor: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '10px',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: TOKENS.cyan,
                }}
              >
                <Target size={18} />
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase' }}>
                Opposition Tactics &amp; Scouting Intel
              </h1>
            </div>
            <div style={{ fontSize: '12.5px', color: TOKENS.textSecondary, marginTop: '4px' }}>
              Detailed tactical analysis, player-by-player team sheets (CSV), and historical performance metrics evaluated up to any date.
            </div>
          </div>

          {/* Quick Stats Pill */}
          {currentOpponentMeta?.next_fixture && (
            <div
              style={{
                backgroundColor: TOKENS.bgInset,
                border: `1px solid ${TOKENS.goldBorder}`,
                borderRadius: '8px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Calendar size={15} color={TOKENS.gold} />
              <div>
                <div style={{ fontSize: '11px', color: TOKENS.gold, fontWeight: 700, textTransform: 'uppercase' }}>
                  Next Match vs {managedTeam}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  MW {currentOpponentMeta.next_fixture.matchweek} &bull; {currentOpponentMeta.next_fixture.venue} ({currentOpponentMeta.next_fixture.date})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filter Toolbar: Opponent Selector + Date Picker */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            paddingTop: '12px',
            borderTop: `1px solid ${TOKENS.border}`,
          }}
        >
          {/* Opponent Club Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: TOKENS.textSecondary, textTransform: 'uppercase' }}>
              Opponent Club:
            </span>
            <select
              value={selectedOpponentName}
              onChange={(e) => setSelectedOpponentName(e.target.value)}
              style={{
                backgroundColor: '#161d2a',
                border: `1px solid ${TOKENS.borderLight}`,
                color: '#ffffff',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {opponents.map((opp) => (
                <option key={opp.name} value={opp.name}>
                  {opp.name} ({opp.formation}) {opp.next_fixture ? `[MW ${opp.next_fixture.matchweek}]` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector ('Performance Till Date') */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: TOKENS.cyan, textTransform: 'uppercase' }}>
              Performance Till Date:
            </span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{
                backgroundColor: '#161d2a',
                border: `1px solid ${TOKENS.cyan}`,
                color: '#ffffff',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            />

            {/* Quick Date Presets */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setAsOfDate('2024-11-03')}
                style={{
                  background: asOfDate === '2024-11-03' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: `1px solid ${asOfDate === '2024-11-03' ? TOKENS.cyan : TOKENS.border}`,
                  color: asOfDate === '2024-11-03' ? TOKENS.cyan : TOKENS.textSecondary,
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                MW 10 (Nov 3)
              </button>
              <button
                onClick={() => setAsOfDate('2024-10-20')}
                style={{
                  background: asOfDate === '2024-10-20' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: `1px solid ${asOfDate === '2024-10-20' ? TOKENS.cyan : TOKENS.border}`,
                  color: asOfDate === '2024-10-20' ? TOKENS.cyan : TOKENS.textSecondary,
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                MW 8 (Oct 20)
              </button>
              <button
                onClick={() => setAsOfDate('2024-09-28')}
                style={{
                  background: asOfDate === '2024-09-28' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: `1px solid ${asOfDate === '2024-09-28' ? TOKENS.cyan : TOKENS.border}`,
                  color: asOfDate === '2024-09-28' ? TOKENS.cyan : TOKENS.textSecondary,
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                MW 6 (Sep 28)
              </button>
              <button
                onClick={() => setAsOfDate('2025-05-25')}
                style={{
                  background: asOfDate === '2025-05-25' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: `1px solid ${asOfDate === '2025-05-25' ? TOKENS.cyan : TOKENS.border}`,
                  color: asOfDate === '2025-05-25' ? TOKENS.cyan : TOKENS.textSecondary,
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Full Season
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <JellyRadio
          value={activeSubTab}
          onChange={(val) => setActiveSubTab(val as 'blueprint' | 'team_sheet' | 'matches')}
          items={[
            { value: 'blueprint', label: 'Tactical Blueprint & Form', icon: <Shield size={14} /> },
            { value: 'team_sheet', label: 'Opponent Team Sheet (CSV)', icon: <Table size={14} /> },
            { value: 'matches', label: 'Match Log Till Date', icon: <Calendar size={14} /> },
          ]}
          size="md"
          style={{ width: '100%', justifyContent: 'center' }}
        />
      </div>

      {/* Status Feedback Alert */}
      {statusMsg && (
        <div
          style={{
            backgroundColor: statusMsg.isError ? '#261214' : '#102417',
            border: `1px solid ${statusMsg.isError ? '#7f1d1d' : '#14532d'}`,
            borderRadius: '6px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: statusMsg.isError ? '#f87171' : '#4ade80',
            fontSize: '13px',
          }}
        >
          {statusMsg.isError ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* SUB-TAB 1: TACTICAL BLUEPRINT & FORM */}
      {activeSubTab === 'blueprint' && performance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top 5 KPI Record Cards up to asOfDate */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Record & Points */}
            <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', color: TOKENS.cyan, fontWeight: 700, textTransform: 'uppercase' }}>
                Record as of {performance.as_of_date}
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {performance.record.wins}W - {performance.record.draws}D - {performance.record.losses}L
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                {performance.record.points} Points ({performance.record.points_per_game} PPG in {performance.record.played} games)
              </div>
            </div>

            {/* Goal Output */}
            <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', color: TOKENS.gold, fontWeight: 700, textTransform: 'uppercase' }}>
                Goals Scored &amp; Conceded
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: TOKENS.gold, marginTop: '4px' }}>
                {performance.record.goals_for} GF &bull; {performance.record.goals_against} GA
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                GD: {performance.record.goal_differential >= 0 ? `+${performance.record.goal_differential}` : performance.record.goal_differential} ({performance.averages.goals_per_90} GF/90)
              </div>
            </div>

            {/* Expected Threat (xG / xGA) */}
            <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', color: TOKENS.green, fontWeight: 700, textTransform: 'uppercase' }}>
                Expected Threat (xG Differential)
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {performance.averages.xg_per_90} xG vs {performance.averages.xga_per_90} xGA
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                xG Net Diff: {(performance.averages.xg_per_90 - performance.averages.xga_per_90).toFixed(2)} / 90
              </div>
            </div>

            {/* Territory Control */}
            <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', color: TOKENS.cyan, fontWeight: 700, textTransform: 'uppercase' }}>
                Possession &amp; Pressing
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {performance.averages.possession_pct}% Poss
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted, marginTop: '2px' }}>
                PPDA: {performance.tactical_profile.ppda} &bull; {performance.record.clean_sheets} Clean Sheets ({performance.averages.clean_sheet_pct}%)
              </div>
            </div>
          </div>

          {/* Form Guide Streak Strip */}
          <div
            style={{
              backgroundColor: TOKENS.bgInset,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color={TOKENS.cyan} />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>
                Recent Form Streak (Pre-{performance.as_of_date}):
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {performance.record.recent_form.length === 0 ? (
                <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>No games recorded before this date.</span>
              ) : (
                performance.record.recent_form.map((res, i) => (
                  <div
                    key={i}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor:
                        res === 'W'
                          ? TOKENS.greenDim
                          : res === 'D'
                          ? TOKENS.cyanDim
                          : TOKENS.redDim,
                      border: `1px solid ${
                        res === 'W'
                          ? TOKENS.green
                          : res === 'D'
                          ? TOKENS.cyan
                          : TOKENS.red
                      }`,
                      color:
                        res === 'W'
                          ? TOKENS.green
                          : res === 'D'
                          ? TOKENS.cyan
                          : TOKENS.red,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}
                  >
                    {res}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mid Row: Tactical Radar & Opponent Profile */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.4fr)',
              gap: '16px',
            }}
          >
            {/* Tactical Radar Chart */}
            <div
              style={{
                backgroundColor: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '8px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div style={{ width: '100%', marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  Tactical Attribute Radar
                </div>
                <div style={{ fontSize: '11.5px', color: TOKENS.textMuted }}>
                  Compared against Premier League 50/100 baseline
                </div>
              </div>

              <div style={{ width: '100%', height: '280px', display: 'flex', justifyContent: 'center' }}>
                {radarChartData.length > 0 && (
                  <RadarChart
                    data={radarChartData}
                    width={280}
                    height={280}
                    color={TOKENS.cyan}
                    comparisonColor="rgba(255, 255, 255, 0.25)"
                  />
                )}
              </div>
            </div>

            {/* Tactical Archetype & Dangerous Strengths */}
            <div
              style={{
                backgroundColor: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: TOKENS.cyan, fontWeight: 700, textTransform: 'uppercase' }}>
                  Official Tactical Archetype
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                  {performance.tactical_profile.archetype} ({performance.tactical_profile.formation})
                </div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginTop: '4px', lineHeight: '1.4' }}>
                  {performance.tactical_profile.philosophy}
                </div>
              </div>

              {/* Strengths */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: TOKENS.green, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Primary Offensive Threat Vectors:
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: TOKENS.textSecondary, lineHeight: '1.6' }}>
                  {performance.tactical_profile.strengths.map((str, idx) => (
                    <li key={idx}>{str}</li>
                  ))}
                </ul>
              </div>

              {/* Vulnerabilities */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: TOKENS.red, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Defensive Vulnerabilities to Exploit:
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: TOKENS.textSecondary, lineHeight: '1.6' }}>
                  {performance.tactical_profile.vulnerabilities.map((vul, idx) => (
                    <li key={idx}>{vul}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Danger Men Grid */}
          <div
            style={{
              backgroundColor: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: TOKENS.gold, textTransform: 'uppercase', marginBottom: '12px' }}>
              Opposition Key Danger Men &amp; Core Pillars
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
              {performance.top_performers.top_scorer && (
                <div style={{ backgroundColor: TOKENS.bgInset, padding: '12px 14px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '11px', color: TOKENS.textMuted, textTransform: 'uppercase' }}>Primary Threat</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    #{performance.top_performers.top_scorer.jersey} {performance.top_performers.top_scorer.name}
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.gold, fontWeight: 700, marginTop: '2px' }}>
                    {performance.top_performers.top_scorer.stat}
                  </div>
                </div>
              )}
              {performance.top_performers.top_creator && (
                <div style={{ backgroundColor: TOKENS.bgInset, padding: '12px 14px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '11px', color: TOKENS.textMuted, textTransform: 'uppercase' }}>Primary Creator</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    #{performance.top_performers.top_creator.jersey} {performance.top_performers.top_creator.name}
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.cyan, fontWeight: 700, marginTop: '2px' }}>
                    {performance.top_performers.top_creator.stat}
                  </div>
                </div>
              )}
              {performance.top_performers.defensive_anchor && (
                <div style={{ backgroundColor: TOKENS.bgInset, padding: '12px 14px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '11px', color: TOKENS.textMuted, textTransform: 'uppercase' }}>Defensive Anchor</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    #{performance.top_performers.defensive_anchor.jersey} {performance.top_performers.defensive_anchor.name}
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.green, fontWeight: 700, marginTop: '2px' }}>
                    {performance.top_performers.defensive_anchor.stat}
                  </div>
                </div>
              )}
              {performance.top_performers.goalkeeper && (
                <div style={{ backgroundColor: TOKENS.bgInset, padding: '12px 14px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: '11px', color: TOKENS.textMuted, textTransform: 'uppercase' }}>Goalkeeper</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    {performance.top_performers.goalkeeper.name}
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginTop: '2px' }}>
                    {performance.top_performers.goalkeeper.stat}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: OPPONENT TEAM SHEET (CSV) */}
      {activeSubTab === 'team_sheet' && teamSheet && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Action Toolbar */}
          <div
            style={{
              backgroundColor: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleDownloadCsv}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(200, 150, 62, 0.15)',
                  border: `1px solid ${TOKENS.goldBorder}`,
                  color: TOKENS.gold,
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                <span>Download Team Sheet (.csv)</span>
              </button>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#1b2230',
                  border: `1px solid ${TOKENS.border}`,
                  color: '#ffffff',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Upload size={14} />
                <span>Upload Custom CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>
                File: {teamSheet.filename} ({teamSheet.players_count} registered squad members)
              </span>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#101520', padding: '3px', borderRadius: '6px', border: `1px solid ${TOKENS.border}` }}>
              <button
                onClick={() => setCsvViewMode('table')}
                style={{
                  border: 'none',
                  background: csvViewMode === 'table' ? TOKENS.gold : 'transparent',
                  color: csvViewMode === 'table' ? '#0e121a' : TOKENS.textSecondary,
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Roster Table
              </button>
              <button
                onClick={() => setCsvViewMode('raw')}
                style={{
                  border: 'none',
                  background: csvViewMode === 'raw' ? TOKENS.gold : 'transparent',
                  color: csvViewMode === 'raw' ? '#0e121a' : TOKENS.textSecondary,
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Raw CSV
              </button>
            </div>
          </div>

          {/* Table View */}
          {csvViewMode === 'table' ? (
            <div
              style={{
                backgroundColor: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#101520',
                        borderBottom: `1px solid ${TOKENS.border}`,
                        color: TOKENS.textSecondary,
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                      }}
                    >
                      <th style={{ padding: '9px 10px', width: '38px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '9px 12px' }}>Player Name</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '50px' }}>Pos</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '50px' }}>Role</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '56px' }}>Min</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '42px', color: TOKENS.gold }}>G</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '42px', color: TOKENS.cyan }}>A</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '48px' }}>Shots</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '56px' }}>xG</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '60px' }}>Passes</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '50px' }}>Tkl</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '50px' }}>Int</th>
                      <th style={{ padding: '9px 8px', textAlign: 'center', width: '48px' }}>YC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamSheet.players.map((p) => {
                      const isKey = p.g > 2 || p.a > 2 || p.tk > 20;
                      return (
                        <tr
                          key={p.num}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundColor: isKey ? 'rgba(56, 189, 248, 0.04)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: TOKENS.textMuted, fontWeight: 700 }}>
                            {p.num}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#ffffff' }}>
                            {p.name}
                            {isKey && (
                              <span style={{ fontSize: '10px', color: TOKENS.cyan, marginLeft: '6px', fontWeight: 700 }}>
                                [Key Player]
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor:
                                  p.pos === 'FW'
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : p.pos === 'MF'
                                    ? 'rgba(56, 189, 248, 0.2)'
                                    : p.pos === 'DF'
                                    ? 'rgba(34, 197, 94, 0.2)'
                                    : 'rgba(200, 150, 62, 0.2)',
                                color:
                                  p.pos === 'FW'
                                    ? '#f87171'
                                    : p.pos === 'MF'
                                    ? TOKENS.cyan
                                    : p.pos === 'DF'
                                    ? TOKENS.green
                                    : TOKENS.gold,
                              }}
                            >
                              {p.pos}
                            </span>
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: TOKENS.textSecondary, fontWeight: 600 }}>
                            {p.role}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                            {p.mins}'
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: p.g > 0 ? TOKENS.gold : TOKENS.textMuted }}>
                            {p.g}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: p.a > 0 ? TOKENS.cyan : TOKENS.textMuted }}>
                            {p.a}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                            {p.sh}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: p.xg > 1.0 ? TOKENS.gold : TOKENS.textSecondary }}>
                            {p.xg.toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                            {p.pc}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: p.tk > 15 ? TOKENS.green : TOKENS.textSecondary }}>
                            {p.tk}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                            {p.it}
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: p.yc > 0 ? '#facc15' : TOKENS.textMuted }}>
                            {p.yc}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Raw CSV View / Editor */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: TOKENS.textMuted }}>
                <span>Official CSV text for {selectedOpponentName}:</span>
                <span>{csvText.split('\n').length} lines</span>
              </div>
              <textarea
                rows={14}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  padding: '12px',
                  backgroundColor: '#0d1118',
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: '6px',
                  color: '#ffffff',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: MATCH LOG TILL DATE */}
      {activeSubTab === 'matches' && performance && (
        <div
          style={{
            backgroundColor: TOKENS.bgCard,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>
              Official Match Log Prior to {performance.as_of_date} ({performance.form_timeline.length} matches)
            </span>
            <span style={{ fontSize: '12px', color: TOKENS.cyan, fontWeight: 600 }}>
              {performance.record.points} Points Collected
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#101520', borderBottom: `1px solid ${TOKENS.border}`, color: TOKENS.textSecondary }}>
                <th style={{ padding: '9px 12px', width: '50px' }}>MW</th>
                <th style={{ padding: '9px 12px', width: '100px' }}>Date</th>
                <th style={{ padding: '9px 14px' }}>Opponent</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: '70px' }}>Venue</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', width: '70px' }}>Result</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', width: '80px' }}>Score</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: '70px' }}>Poss</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: '80px' }}>xG</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: '80px' }}>xGA</th>
              </tr>
            </thead>
            <tbody>
              {performance.form_timeline.map((m, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <td style={{ padding: '8px 12px', color: TOKENS.textMuted, fontWeight: 700 }}>MW {m.mw}</td>
                  <td style={{ padding: '8px 12px', color: TOKENS.textSecondary }}>{m.date}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 600, color: '#ffffff' }}>vs {m.opp}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', textTransform: 'capitalize', color: TOKENS.textMuted }}>
                    {m.venue}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor:
                          m.res === 'W'
                            ? TOKENS.greenDim
                            : m.res === 'D'
                            ? TOKENS.cyanDim
                            : TOKENS.redDim,
                        color:
                          m.res === 'W'
                            ? TOKENS.green
                            : m.res === 'D'
                            ? TOKENS.cyan
                            : TOKENS.red,
                      }}
                    >
                      {m.res}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#ffffff' }}>
                    {m.scored} - {m.conceded}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: TOKENS.textSecondary }}>
                    {m.poss}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: TOKENS.gold }}>
                    {m.xg.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: TOKENS.textSecondary }}>
                    {m.xga.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
