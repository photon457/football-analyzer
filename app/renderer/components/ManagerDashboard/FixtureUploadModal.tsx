import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  FixtureItem,
  recordFixtureMatch,
  RecordFixtureMatchPayload,
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

  const [activeTab, setActiveTab] = useState<'quick' | 'file' | 'sample'>('quick');

  // Quick Scorecard State
  const [scoreHome, setScoreHome] = useState<number>(2);
  const [scoreAway, setScoreAway] = useState<number>(1);
  const [possessionPct, setPossessionPct] = useState<number>(56);
  const [shotsHome, setShotsHome] = useState<number>(14);
  const [shotsAway, setShotsAway] = useState<number>(9);

  // File Upload State
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'json' | 'csv' | null>(null);

  // Status & Progress
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Sync selected fixture when targetFixture changes
  useEffect(() => {
    if (targetFixture) {
      setSelectedFixtureId(targetFixture.fixture_id);
      // Auto-set realistic default score according to home/away
      const isHome = targetFixture.home_team === managedTeam;
      if (isHome) {
        setScoreHome(2);
        setScoreAway(1);
      } else {
        setScoreHome(1);
        setScoreAway(2);
      }
    } else if (allUpcomingFixtures.length > 0) {
      setSelectedFixtureId(allUpcomingFixtures[0].fixture_id);
    }
  }, [targetFixture, allUpcomingFixtures, managedTeam]);

  if (!isOpen) return null;

  const currentFixture =
    allUpcomingFixtures.find((f) => f.fixture_id === selectedFixtureId) || targetFixture;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleFileSubmit = async () => {
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
          maxWidth: '720px',
          backgroundColor: TOKENS.bgModal,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '12px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
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
              <Upload size={17} />
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
                Upload Match Data &amp; Telemetry
              </div>
              <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>
                Record match outcome and ingest player tracking events for scheduled fixture
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
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Target Fixture Selector Bar */}
          <div
            style={{
              backgroundColor: TOKENS.bgInset,
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
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>
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
                  onChange={(e) => setSelectedFixtureId(Number(e.target.value))}
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
              onChange={(val) => setActiveTab(val as 'quick' | 'file' | 'sample')}
              items={[
                { value: 'quick', label: 'Record Match Result', icon: <Activity size={14} /> },
                { value: 'file', label: 'Upload File (JSON / CSV)', icon: <Upload size={14} /> },
                { value: 'sample', label: 'Telemetry Presets', icon: <Sparkles size={14} /> },
              ]}
              size="md"
              style={{ width: '100%', justifyContent: 'center' }}
            />
          </div>

          {/* TAB 1: QUICK SCORECARD RECORDER */}
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

          {/* TAB 2: FILE UPLOAD (JSON OR CSV) */}
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
                    onChange={handleFileChange}
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
                onClick={handleFileSubmit}
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

          {/* TAB 3: TELEMETRY PRESETS */}
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
