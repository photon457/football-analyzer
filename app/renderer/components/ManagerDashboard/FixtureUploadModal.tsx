import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Upload,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  Calendar,
  Sparkles,
  Table,
  Download,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import {
  FixtureItem,
  recordFixtureMatch,
  RecordFixtureMatchPayload,
  fetchFixtureCsvTemplate,
} from '../../services/api';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface FixtureUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFixture: FixtureItem | null;
  allUpcomingFixtures: FixtureItem[];
  managedTeam: string;
  onUploadSuccess: (matchId: string) => void;
}

interface ParsedPlayerRow {
  rowId: number;
  playerId: string;
  name: string;
  jersey: number;
  position: string;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  xg: number;
  passes: number;
  tackles: number;
  interceptions: number;
  yellowCards: number;
  redCards: number;
}

const TOKENS = {
  bgOverlay: 'rgba(5, 8, 14, 0.78)',
  bgModal: '#121722',
  bgCard: '#171e2c',
  bgInset: '#0e121a',
  border: 'rgba(255, 255, 255, 0.12)',
  gold: '#D2AE5E',
  goldDim: 'rgba(210, 174, 94, 0.18)',
  blue: '#8FC8EE',
  green: '#5FD068',
  red: '#f87171',
  textPrimary: '#F2F4F7',
  textSecondary: '#A8AFB9',
  textMuted: '#6F7885',
};

export const FixtureUploadModal: React.FC<FixtureUploadModalProps> = ({
  isOpen,
  onClose,
  targetFixture,
  allUpcomingFixtures,
  managedTeam,
  onUploadSuccess,
}) => {
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(
    targetFixture ? targetFixture.fixture_id : null
  );

  // Tab mode: Default is dedicated player-by-player CSV import
  const [activeTab, setActiveTab] = useState<'csv_player' | 'quick' | 'file' | 'sample'>('csv_player');

  // Player-by-Player CSV State
  const [playerCsvText, setPlayerCsvText] = useState<string>('');
  const [playerCsvFileName, setPlayerCsvFileName] = useState<string>('');
  const [isLoadingTemplate, setIsLoadingTemplate] = useState<boolean>(false);
  const [csvViewMode, setCsvViewMode] = useState<'table' | 'raw'>('table');

  // Quick Scorecard State
  const [scoreHome, setScoreHome] = useState<number>(2);
  const [scoreAway, setScoreAway] = useState<number>(1);
  const [possessionPct, setPossessionPct] = useState<number>(56);
  const [shotsHome, setShotsHome] = useState<number>(14);
  const [shotsAway, setShotsAway] = useState<number>(9);

  // File Upload State (for generic telemetry file tab)
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'json' | 'csv' | null>(null);

  // Status & Progress
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const currentFixture =
    allUpcomingFixtures.find((f) => f.fixture_id === selectedFixtureId) || targetFixture;

  // Function to load CSV template (blank or sample)
  const loadTemplate = async (fixtureId: number, sample: boolean) => {
    setIsLoadingTemplate(true);
    setErrorMessage(null);
    try {
      const res = await fetchFixtureCsvTemplate(fixtureId, sample);
      setPlayerCsvText(res.csv_content);
      setPlayerCsvFileName(res.filename);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate player CSV template');
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  // Sync selected fixture when targetFixture changes & auto-load authentic CSV template
  useEffect(() => {
    if (targetFixture) {
      setSelectedFixtureId(targetFixture.fixture_id);
      const isHome = targetFixture.home_team === managedTeam;
      if (isHome) {
        setScoreHome(2);
        setScoreAway(1);
      } else {
        setScoreHome(1);
        setScoreAway(2);
      }
      loadTemplate(targetFixture.fixture_id, true);
    } else if (allUpcomingFixtures.length > 0) {
      setSelectedFixtureId(allUpcomingFixtures[0].fixture_id);
      loadTemplate(allUpcomingFixtures[0].fixture_id, true);
    }
  }, [targetFixture, allUpcomingFixtures, managedTeam]);

  // When manager changes fixture selection via dropdown, reload template
  const handleFixtureSelectChange = (newFixtureId: number) => {
    setSelectedFixtureId(newFixtureId);
    loadTemplate(newFixtureId, true);
  };

  // Parse CSV into structured rows
  const parsedPlayers: ParsedPlayerRow[] = useMemo(() => {
    if (!playerCsvText.trim()) return [];
    const lines = playerCsvText.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const getIdx = (keys: string[]) => {
      return headers.findIndex((h) => keys.includes(h));
    };

    const nameIdx = getIdx(['player_name', 'name', 'player']);
    const numIdx = getIdx(['jersey_number', 'jersey', 'number', 'num']);
    const posIdx = getIdx(['position', 'pos']);
    const minsIdx = getIdx(['minutes', 'mins', 'minutes_played']);
    const goalsIdx = getIdx(['goals', 'g']);
    const assistsIdx = getIdx(['assists', 'a']);
    const shotsIdx = getIdx(['shots', 'sh']);
    const xgIdx = getIdx(['xg']);
    const passesIdx = getIdx(['passes_completed', 'passes', 'pass']);
    const tacklesIdx = getIdx(['tackles', 'tk', 'tackles_won']);
    const intsIdx = getIdx(['interceptions', 'int', 'ints']);
    const ycIdx = getIdx(['yellow_cards', 'yellow_card', 'yc']);
    const rcIdx = getIdx(['red_cards', 'red_card', 'rc']);
    const idIdx = getIdx(['player_id', 'id']);

    return lines.slice(1).map((line, rowIdx) => {
      const cols = line.split(',').map((c) => c.trim());
      return {
        rowId: rowIdx,
        playerId: idIdx >= 0 ? cols[idIdx] : `p_${rowIdx}`,
        name: nameIdx >= 0 ? cols[nameIdx] : `Player ${rowIdx + 1}`,
        jersey: numIdx >= 0 ? parseInt(cols[numIdx]) || rowIdx + 1 : rowIdx + 1,
        position: posIdx >= 0 ? cols[posIdx] || 'MF' : 'MF',
        minutes: minsIdx >= 0 ? parseInt(cols[minsIdx]) || 0 : 0,
        goals: goalsIdx >= 0 ? parseInt(cols[goalsIdx]) || 0 : 0,
        assists: assistsIdx >= 0 ? parseInt(cols[assistsIdx]) || 0 : 0,
        shots: shotsIdx >= 0 ? parseInt(cols[shotsIdx]) || 0 : 0,
        xg: xgIdx >= 0 ? parseFloat(cols[xgIdx]) || 0 : 0,
        passes: passesIdx >= 0 ? parseInt(cols[passesIdx]) || 0 : 0,
        tackles: tacklesIdx >= 0 ? parseInt(cols[tacklesIdx]) || 0 : 0,
        interceptions: intsIdx >= 0 ? parseInt(cols[intsIdx]) || 0 : 0,
        yellowCards: ycIdx >= 0 ? parseInt(cols[ycIdx]) || 0 : 0,
        redCards: rcIdx >= 0 ? parseInt(cols[rcIdx]) || 0 : 0,
      };
    });
  }, [playerCsvText]);

  // Aggregate metrics computed from the player table
  const aggregates = useMemo(() => {
    const totalGoals = parsedPlayers.reduce((sum, p) => sum + p.goals, 0);
    const totalAssists = parsedPlayers.reduce((sum, p) => sum + p.assists, 0);
    const totalShots = parsedPlayers.reduce((sum, p) => sum + p.shots, 0);
    const totalXg = parsedPlayers.reduce((sum, p) => sum + p.xg, 0);
    const totalPasses = parsedPlayers.reduce((sum, p) => sum + p.passes, 0);
    const totalTackles = parsedPlayers.reduce((sum, p) => sum + p.tackles, 0);
    const totalYellows = parsedPlayers.reduce((sum, p) => sum + p.yellowCards, 0);
    return {
      totalGoals,
      totalAssists,
      totalShots,
      totalXg: totalXg.toFixed(2),
      totalPasses,
      totalTackles,
      totalYellows,
      squadCount: parsedPlayers.length,
    };
  }, [parsedPlayers]);

  if (!isOpen) return null;

  // Handle direct file input for Player CSV tab
  const handlePlayerCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Please select a valid CSV player stats sheet (.csv).');
      return;
    }

    setPlayerCsvFileName(file.name);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPlayerCsvText(text);
    };
    reader.readAsText(file);
  };

  // Download current CSV
  const handleDownloadCsv = () => {
    if (!playerCsvText) return;
    const blob = new Blob([playerCsvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', playerCsvFileName || `fixture_${currentFixture?.fixture_id}_player_stats.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Submit Player CSV
  const handlePlayerCsvSubmit = async () => {
    if (!currentFixture) {
      setErrorMessage('Please select an upcoming fixture.');
      return;
    }
    if (!playerCsvText.trim()) {
      setErrorMessage('Player CSV content is empty. Please load template or upload a file.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const payload: RecordFixtureMatchPayload = {
        csv_content: playerCsvText,
        focus_team: managedTeam,
      };
      const result = await recordFixtureMatch(currentFixture.fixture_id, payload);
      setSuccessInfo(
        `Player CSV Ingested: ${result.team} vs ${result.opponent} (${result.score}) with ${result.players_count ?? parsedPlayers.length} player stats`
      );

      setTimeout(() => {
        onUploadSuccess(result.match_id);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to ingest player-by-player match CSV');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generic File Change (Tab 3)
  const handleGenericFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);

    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');

    if (!isJson && !isCsv) {
      setErrorMessage('Please select a valid JSON match telemetry or CSV player stats file.');
      return;
    }

    setFileType(isJson ? 'json' : 'csv');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
  };

  // Generic Quick Submit
  const handleQuickSubmit = async () => {
    if (!currentFixture) {
      setErrorMessage('Please select an upcoming fixture.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const payload: RecordFixtureMatchPayload = {
        score_home: scoreHome,
        score_away: scoreAway,
        possession_pct: possessionPct,
        shots_home: shotsHome,
        shots_away: shotsAway,
        focus_team: managedTeam,
      };

      const result = await recordFixtureMatch(currentFixture.fixture_id, payload);
      setSuccessInfo(`Recorded: ${result.team} vs ${result.opponent} (${result.score})`);

      setTimeout(() => {
        onUploadSuccess(result.match_id);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record match data');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generic File Submit
  const handleGenericFileSubmit = async () => {
    if (!currentFixture) {
      setErrorMessage('Please select an upcoming fixture.');
      return;
    }
    if (!fileContent) {
      setErrorMessage('Please choose a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      if (fileType === 'csv') {
        const payload: RecordFixtureMatchPayload = {
          csv_content: fileContent,
          focus_team: managedTeam,
        };
        const result = await recordFixtureMatch(currentFixture.fixture_id, payload);
        setSuccessInfo(`CSV Ingested: ${result.score} (${result.match_id})`);
        setTimeout(() => {
          onUploadSuccess(result.match_id);
        }, 700);
      } else {
        const parsed = JSON.parse(fileContent);
        const payload: RecordFixtureMatchPayload = {
          custom_payload: parsed,
          focus_team: managedTeam,
        };
        const result = await recordFixtureMatch(currentFixture.fixture_id, payload);
        setSuccessInfo(`Telemetry Ingested: ${result.score} (${result.match_id})`);
        setTimeout(() => {
          onUploadSuccess(result.match_id);
        }, 700);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process match file');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset Submit
  const handlePresetSubmit = async (presetType: 'win' | 'draw' | 'loss') => {
    if (!currentFixture) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const isHome = currentFixture.home_team === managedTeam;
      let sHome = 2;
      let sAway = 1;
      let poss = 55;

      if (presetType === 'win') {
        sHome = isHome ? 3 : 1;
        sAway = isHome ? 1 : 2;
        poss = 58;
      } else if (presetType === 'draw') {
        sHome = 1;
        sAway = 1;
        poss = 50;
      } else {
        sHome = isHome ? 0 : 2;
        sAway = isHome ? 2 : 1;
        poss = 46;
      }

      const payload: RecordFixtureMatchPayload = {
        score_home: sHome,
        score_away: sAway,
        possession_pct: poss,
        focus_team: managedTeam,
      };

      const result = await recordFixtureMatch(currentFixture.fixture_id, payload);
      setSuccessInfo(`Generated telemetry: ${result.team} (${result.score}) ${result.opponent}`);

      setTimeout(() => {
        onUploadSuccess(result.match_id);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load telemetry preset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: TOKENS.bgOverlay,
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          backgroundColor: TOKENS.bgModal,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '12px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${TOKENS.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f141d',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                backgroundColor: 'rgba(210, 174, 94, 0.15)',
                border: '1px solid rgba(210, 174, 94, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: TOKENS.gold,
              }}
            >
              <Table size={18} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Match Telemetry &amp; Player-by-Player Ingestion
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>
                Record match outcome and ingest player statistics for scheduled fixtures
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: TOKENS.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Target Fixture Selector Bar */}
          <div
            style={{
              backgroundColor: TOKENS.bgInset,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={18} color={TOKENS.gold} />
              <div>
                <div style={{ fontSize: '11px', color: TOKENS.gold, fontWeight: 700, textTransform: 'uppercase' }}>
                  Target Upcoming Game
                </div>
                {currentFixture && (
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    MW {currentFixture.matchweek}: {currentFixture.home_team} vs {currentFixture.away_team}
                  </div>
                )}
                {currentFixture && (
                  <div style={{ fontSize: '11.5px', color: TOKENS.textMuted }}>
                    Scheduled: {currentFixture.date} &bull; {currentFixture.phase}
                  </div>
                )}
              </div>
            </div>

            {/* Fixture Selector Dropdown */}
            {allUpcomingFixtures.length > 1 && (
              <div>
                <select
                  value={selectedFixtureId || ''}
                  onChange={(e) => handleFixtureSelectChange(Number(e.target.value))}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: '#161d2a',
                    border: `1px solid ${TOKENS.border}`,
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '7px 12px',
                    fontSize: '12.5px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {allUpcomingFixtures.map((f) => (
                    <option key={f.fixture_id} value={f.fixture_id}>
                      MW {f.matchweek}: vs {f.home_team === managedTeam ? f.away_team : f.home_team} ({f.date})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <JellyRadio
              value={activeTab}
              onChange={(val) => setActiveTab(val as 'csv_player' | 'quick' | 'file' | 'sample')}
              items={[
                { value: 'csv_player', label: 'Player-by-Player CSV', icon: <Table size={14} /> },
                { value: 'quick', label: 'Scorecard Entry', icon: <Activity size={14} /> },
                { value: 'file', label: 'Telemetry Ingest', icon: <Upload size={14} /> },
                { value: 'sample', label: 'Tactical Presets', icon: <Sparkles size={14} /> },
              ]}
              size="md"
              style={{ width: '100%', justifyContent: 'center' }}
            />
          </div>

          {/* TAB 1: PLAYER-BY-PLAYER CSV IMPORT (PRIMARY) */}
          {activeTab === 'csv_player' && currentFixture && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Actions & Controls Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  backgroundColor: TOKENS.bgCard,
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => loadTemplate(currentFixture.fixture_id, false)}
                    disabled={isLoadingTemplate || isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#1e2638',
                      border: `1px solid ${TOKENS.border}`,
                      color: TOKENS.textPrimary,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={13} className={isLoadingTemplate ? 'spin' : ''} />
                    <span>Load Blank Squad Template</span>
                  </button>

                  <button
                    onClick={() => loadTemplate(currentFixture.fixture_id, true)}
                    disabled={isLoadingTemplate || isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'rgba(210, 174, 94, 0.15)',
                      border: `1px solid rgba(210, 174, 94, 0.4)`,
                      color: TOKENS.gold,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Load Realistic Match Sheet</span>
                  </button>

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#1e2638',
                      border: `1px solid ${TOKENS.border}`,
                      color: TOKENS.textPrimary,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={13} />
                    <span>Browse CSV File</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handlePlayerCsvFileChange}
                      disabled={isSubmitting}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <button
                    onClick={handleDownloadCsv}
                    disabled={!playerCsvText || isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${TOKENS.border}`,
                      color: TOKENS.textSecondary,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={13} />
                    <span>Download .csv</span>
                  </button>
                </div>

                {/* Table vs Raw CSV View Toggle */}
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

              {/* Aggregated Tactical Summary Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    backgroundColor: TOKENS.bgInset,
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: '6px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: TOKENS.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
                    Squad Selected
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    {aggregates.squadCount} Players
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: TOKENS.bgInset,
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: '6px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: TOKENS.gold, textTransform: 'uppercase', fontWeight: 600 }}>
                    {managedTeam} Goals
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: TOKENS.gold, marginTop: '2px' }}>
                    {aggregates.totalGoals} Goals ({aggregates.totalAssists} Ast)
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: TOKENS.bgInset,
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: '6px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: TOKENS.blue, textTransform: 'uppercase', fontWeight: 600 }}>
                    Attacking Output
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    {aggregates.totalShots} Shots &bull; {aggregates.totalXg} xG
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: TOKENS.bgInset,
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: '6px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: TOKENS.green, textTransform: 'uppercase', fontWeight: 600 }}>
                    Circulation &amp; Duels
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                    {aggregates.totalPasses} Passes &bull; {aggregates.totalTackles} Tkl
                  </div>
                </div>
              </div>

              {/* View Mode: Table or Raw CSV */}
              {csvViewMode === 'table' ? (
                <div
                  style={{
                    backgroundColor: TOKENS.bgCard,
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      maxHeight: '340px',
                      overflowY: 'auto',
                      overflowX: 'auto',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '12px',
                        textAlign: 'left',
                      }}
                    >
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
                          <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '8px 12px' }}>Player Name</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '48px' }}>Pos</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '50px' }}>Min</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '42px', color: TOKENS.gold }}>G</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '42px', color: TOKENS.blue }}>A</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '48px' }}>Shots</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '56px' }}>xG</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '60px' }}>Passes</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '50px' }}>Tkl</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '50px' }}>Int</th>
                          <th style={{ padding: '8px 8px', textAlign: 'center', width: '48px' }}>YC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={12} style={{ padding: '30px', textAlign: 'center', color: TOKENS.textMuted }}>
                              No player rows loaded. Click "Load Realistic Match Sheet" or "Load Blank Squad Template".
                            </td>
                          </tr>
                        ) : (
                          parsedPlayers.map((player) => {
                            const isStandout = player.goals > 0 || player.assists > 0;
                            return (
                              <tr
                                key={player.playerId}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                  backgroundColor: isStandout ? 'rgba(210, 174, 94, 0.05)' : 'transparent',
                                }}
                              >
                                <td style={{ padding: '7px 10px', textAlign: 'center', color: TOKENS.textMuted, fontWeight: 700 }}>
                                  {player.jersey}
                                </td>
                                <td style={{ padding: '7px 12px', fontWeight: 600, color: '#ffffff' }}>
                                  {player.name}
                                  {player.minutes < 45 && (
                                    <span style={{ fontSize: '10px', color: TOKENS.textMuted, marginLeft: '6px' }}>(Sub)</span>
                                  )}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor:
                                        player.position === 'FW'
                                          ? 'rgba(239, 68, 68, 0.2)'
                                          : player.position === 'MF'
                                          ? 'rgba(143, 200, 238, 0.2)'
                                          : player.position === 'DF'
                                          ? 'rgba(95, 208, 104, 0.2)'
                                          : 'rgba(210, 174, 94, 0.2)',
                                      color:
                                        player.position === 'FW'
                                          ? '#f87171'
                                          : player.position === 'MF'
                                          ? TOKENS.blue
                                          : player.position === 'DF'
                                          ? TOKENS.green
                                          : TOKENS.gold,
                                    }}
                                  >
                                    {player.position}
                                  </span>
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                                  {player.minutes}'
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: player.goals > 0 ? TOKENS.gold : TOKENS.textMuted }}>
                                  {player.goals}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: player.assists > 0 ? TOKENS.blue : TOKENS.textMuted }}>
                                  {player.assists}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                                  {player.shots}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: player.xg > 0.3 ? TOKENS.gold : TOKENS.textSecondary }}>
                                  {player.xg.toFixed(2)}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                                  {player.passes}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: player.tackles > 2 ? TOKENS.green : TOKENS.textSecondary }}>
                                  {player.tackles}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: TOKENS.textSecondary }}>
                                  {player.interceptions}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: player.yellowCards > 0 ? '#facc15' : TOKENS.textMuted }}>
                                  {player.yellowCards}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Raw CSV Text Area */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: TOKENS.textMuted }}>
                    <span>Edit or paste raw CSV text (rows automatically update the live table preview):</span>
                    <span>{playerCsvText.split('\n').length} lines</span>
                  </div>
                  <textarea
                    rows={12}
                    value={playerCsvText}
                    onChange={(e) => setPlayerCsvText(e.target.value)}
                    disabled={isSubmitting}
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

              {/* Submit Button */}
              <button
                onClick={handlePlayerCsvSubmit}
                disabled={isSubmitting || parsedPlayers.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: TOKENS.gold,
                  color: '#0e121a',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isSubmitting || parsedPlayers.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting || parsedPlayers.length === 0 ? 0.6 : 1,
                  transition: 'background 0.15s ease',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Activity size={16} className="spin" />
                    <span>Ingesting Player Stats &amp; Computing Telemetry...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Ingest Player CSV &amp; Analyze Match</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: QUICK SCORECARD ENTRY */}
          {activeTab === 'quick' && currentFixture && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  backgroundColor: TOKENS.bgCard,
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: '8px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ fontSize: '13px', color: TOKENS.textSecondary }}>
                  Input final match scorecard. The analysis engine will generate player ratings, xG differentials, passing networks, and 80+ spatial pitch events matching the official fixture context.
                </div>

                {/* Scoreline Input Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '10px 0',
                  }}
                >
                  {/* Home Team Score */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      backgroundColor: '#101520',
                      border: `1px solid ${currentFixture.home_team === managedTeam ? 'rgba(210, 174, 94, 0.4)' : TOKENS.border}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
                      {currentFixture.home_team}
                    </div>
                    <span style={{ fontSize: '11px', color: currentFixture.home_team === managedTeam ? TOKENS.gold : TOKENS.textMuted, fontWeight: 600 }}>
                      HOME {currentFixture.home_team === managedTeam && '(Your Team)'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={() => setScoreHome(Math.max(0, scoreHome - 1))}
                        disabled={isSubmitting}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: '#1d2536',
                          border: `1px solid ${TOKENS.border}`,
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '16px',
                          cursor: 'pointer',
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={scoreHome}
                        onChange={(e) => setScoreHome(Math.max(0, parseInt(e.target.value) || 0))}
                        disabled={isSubmitting}
                        style={{
                          width: '54px',
                          height: '42px',
                          backgroundColor: '#0d1118',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#ffffff',
                          textAlign: 'center',
                          fontSize: '22px',
                          fontWeight: 800,
                          borderRadius: '6px',
                        }}
                      />
                      <button
                        onClick={() => setScoreHome(scoreHome + 1)}
                        disabled={isSubmitting}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: '#1d2536',
                          border: `1px solid ${TOKENS.border}`,
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '16px',
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* VS separator */}
                  <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, color: TOKENS.textMuted }}>
                    FT
                  </div>

                  {/* Away Team Score */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      backgroundColor: '#101520',
                      border: `1px solid ${currentFixture.away_team === managedTeam ? 'rgba(210, 174, 94, 0.4)' : TOKENS.border}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
                      {currentFixture.away_team}
                    </div>
                    <span style={{ fontSize: '11px', color: currentFixture.away_team === managedTeam ? TOKENS.gold : TOKENS.textMuted, fontWeight: 600 }}>
                      AWAY {currentFixture.away_team === managedTeam && '(Your Team)'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={() => setScoreAway(Math.max(0, scoreAway - 1))}
                        disabled={isSubmitting}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: '#1d2536',
                          border: `1px solid ${TOKENS.border}`,
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '16px',
                          cursor: 'pointer',
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={scoreAway}
                        onChange={(e) => setScoreAway(Math.max(0, parseInt(e.target.value) || 0))}
                        disabled={isSubmitting}
                        style={{
                          width: '54px',
                          height: '42px',
                          backgroundColor: '#0d1118',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#ffffff',
                          textAlign: 'center',
                          fontSize: '22px',
                          fontWeight: 800,
                          borderRadius: '6px',
                        }}
                      />
                      <button
                        onClick={() => setScoreAway(scoreAway + 1)}
                        disabled={isSubmitting}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: '#1d2536',
                          border: `1px solid ${TOKENS.border}`,
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '16px',
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Match Context Sliders */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '14px',
                    paddingTop: '12px',
                    borderTop: `1px solid ${TOKENS.border}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                      <span>Possession ({managedTeam})</span>
                      <span style={{ fontWeight: 700, color: TOKENS.gold }}>{possessionPct}%</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="75"
                      value={possessionPct}
                      onChange={(e) => setPossessionPct(Number(e.target.value))}
                      disabled={isSubmitting}
                      style={{ width: '100%', accentColor: TOKENS.gold }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                      <span>Shots ({managedTeam})</span>
                      <span style={{ fontWeight: 700, color: TOKENS.gold }}>{shotsHome} shots</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="30"
                      value={shotsHome}
                      onChange={(e) => setShotsHome(Number(e.target.value))}
                      disabled={isSubmitting}
                      style={{ width: '100%', accentColor: TOKENS.gold }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                      <span>Opponent Shots</span>
                      <span style={{ fontWeight: 700, color: TOKENS.blue }}>{shotsAway} shots</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="30"
                      value={shotsAway}
                      onChange={(e) => setShotsAway(Number(e.target.value))}
                      disabled={isSubmitting}
                      style={{ width: '100%', accentColor: TOKENS.blue }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleQuickSubmit}
                disabled={isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: TOKENS.gold,
                  color: '#0e121a',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: 'background 0.15s ease',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Activity size={16} className="spin" />
                    <span>Persisting &amp; Computing Match Telemetry...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Record Match &amp; Generate Telemetry</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: FILE INGESTION (JSON OR CSV) */}
          {activeTab === 'file' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  border: `2px dashed ${fileName ? TOKENS.gold : 'rgba(255, 255, 255, 0.2)'}`,
                  borderRadius: '10px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  backgroundColor: TOKENS.bgInset,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(210, 174, 94, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: TOKENS.gold,
                  }}
                >
                  <Upload size={22} />
                </div>

                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                    Select match telemetry or statistics sheet
                  </div>
                  <div style={{ fontSize: '12.5px', color: TOKENS.textMuted, marginTop: '4px' }}>
                    Supports full event telemetry (.json) or tabular squad sheets (.csv)
                  </div>
                </div>

                <label
                  style={{
                    marginTop: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileText size={14} />
                  <span>Browse Device Files</span>
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={handleGenericFileChange}
                    disabled={isSubmitting}
                    style={{ display: 'none' }}
                  />
                </label>

                {fileName && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#1b2230',
                      border: `1px solid ${TOKENS.gold}`,
                      borderRadius: '6px',
                      padding: '6px 14px',
                      marginTop: '8px',
                      fontSize: '12.5px',
                      color: TOKENS.gold,
                    }}
                  >
                    <CheckCircle size={14} />
                    <span>Selected: {fileName} ({fileType?.toUpperCase()})</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleGenericFileSubmit}
                disabled={!fileContent || isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: !fileContent || isSubmitting ? 'rgba(210, 174, 94, 0.3)' : TOKENS.gold,
                  color: '#0e121a',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: !fileContent || isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Activity size={16} className="spin" />
                    <span>Validating &amp; Ingesting Match File...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>Upload &amp; Analyze Match Data</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 4: TACTICAL PRESETS */}
          {activeTab === 'sample' && currentFixture && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: TOKENS.textSecondary }}>
                Instantly populate rich tactical telemetry for this upcoming game using authenticated Premier League tactical models:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {/* Win Preset */}
                <div
                  onClick={() => !isSubmitting && handlePresetSubmit('win')}
                  style={{
                    backgroundColor: TOKENS.bgCard,
                    border: '1px solid rgba(95, 208, 104, 0.35)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'transform 0.1s ease, border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: TOKENS.green, textTransform: 'uppercase' }}>
                      Dominant Victory
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>W</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    High-xG Offensive Win
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>
                    58% possession, 16 shots, positive passing circulation, clean transition structures.
                  </div>
                </div>

                {/* Draw Preset */}
                <div
                  onClick={() => !isSubmitting && handlePresetSubmit('draw')}
                  style={{
                    backgroundColor: TOKENS.bgCard,
                    border: '1px solid rgba(143, 200, 238, 0.35)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: TOKENS.blue, textTransform: 'uppercase' }}>
                      Contested Draw
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>D</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    1-1 Stalemate
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>
                    Balanced 50% territory battle, heavy midfield duels, Voronoi defensive balance.
                  </div>
                </div>

                {/* Defeat Preset */}
                <div
                  onClick={() => !isSubmitting && handlePresetSubmit('loss')}
                  style={{
                    backgroundColor: TOKENS.bgCard,
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
                      Counter-Attack Loss
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>L</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    Defensive Struggle
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>
                    Compact rest defense compromised by wide counter-channels.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback & Alerts */}
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#261214',
                border: '1px solid #7f1d1d',
                borderRadius: '6px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#f87171',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successInfo && (
            <div
              style={{
                backgroundColor: '#102417',
                border: '1px solid #14532d',
                borderRadius: '6px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#4ade80',
                fontSize: '13px',
              }}
            >
              <CheckCircle size={16} />
              <span>{successInfo} &mdash; Opening post-match telemetry...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
