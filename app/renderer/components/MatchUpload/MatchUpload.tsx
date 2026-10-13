import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw, Eye, Database, Table, Layers } from 'lucide-react';
import {
  importMatchData,
  importCsvMatchData,
  resetDatabase,
  fetchFocusTeam,
  setFocusTeam,
  ImportSuccessResponse,
  CsvImportResponse,
} from '../../services/api';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface MatchUploadProps {
  onImportSuccess: (matchId: string) => void;
}

interface SampleFixture {
  id: number;
  team: string;
  opponent: string;
  score: string;
  date: string;
  competition: string;
  isInvalid?: boolean;
}

const SAMPLE_FIXTURES: SampleFixture[] = [
  { id: 1, team: 'Chelsea', opponent: 'Brighton & Hove Albion', score: '4-2', date: '28 Sep 2024', competition: 'Premier League' },
  { id: 2, team: 'Chelsea', opponent: 'Nottingham Forest', score: '1-1', date: '06 Oct 2024', competition: 'Premier League' },
  { id: 3, team: 'Liverpool', opponent: 'Chelsea', score: '2-1', date: '20 Oct 2024', competition: 'Premier League' },
  { id: 4, team: 'Test Malformed Payload', opponent: 'Schema Test', score: 'N/A', date: 'Sample', competition: 'Rejection test', isInvalid: true },
];

export const MatchUpload: React.FC<MatchUploadProps> = ({ onImportSuccess }) => {
  const [importMode, setImportMode] = useState<'csv' | 'json'>('csv');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportSuccessResponse | null>(null);
  const [csvResult, setCsvResult] = useState<CsvImportResponse | null>(null);
  const [showRawPreview, setShowRawPreview] = useState<boolean>(false);
  const [focusTeamName, setFocusTeamName] = useState<string>('Chelsea');
  const [resettingDb, setResettingDb] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchFocusTeam()
      .then((t) => setFocusTeamName(t))
      .catch(() => setFocusTeamName('Chelsea'));
  }, []);

  const handleTeamChange = (newTeam: string) => {
    setFocusTeamName(newTeam);
    setFocusTeam(newTeam).catch(() => {});
  };

  const loadJsonSample = async (sampleNumber: number) => {
    setErrors([]);
    setImportResult(null);
    setCsvResult(null);
    try {
      let sampleData: any;
      if (sampleNumber === 1) {
        sampleData = await import('../../../../data/samples/match_01_chelsea_vs_brighton.json');
      } else if (sampleNumber === 2) {
        sampleData = await import('../../../../data/samples/match_02_chelsea_vs_forest.json');
      } else if (sampleNumber === 3) {
        sampleData = await import('../../../../data/samples/match_03_liverpool_vs_chelsea.json');
      } else {
        sampleData = await import('../../../../data/samples/match_invalid_sample.json');
      }

      const parsed = sampleData.default || sampleData;
      const content = JSON.stringify(parsed, null, 2);
      setFileContent(content);
      const name = sampleNumber === 4 ? 'match_invalid_sample.json' : `match_0${sampleNumber}_chelsea_sample.json`;
      setFileName(name);
    } catch (e: any) {
      setErrors([`Failed to load sample fixture file: ${e.message}`]);
    }
  };

  const loadCsvSample = async () => {
    setErrors([]);
    setImportResult(null);
    setCsvResult(null);
    setIsValidating(true);
    try {
      // Ingest default football_player_match_stats_sample.csv via API
      const result = await importCsvMatchData({
        file_path: 'football_player_match_stats_sample.csv',
        focus_team: focusTeamName,
      });
      setCsvResult(result);
      setFileName('football_player_match_stats_sample.csv');
      setFileContent('Parsed 8 matches from football_player_match_stats_sample.csv');
    } catch (e: any) {
      setErrors([`Failed to ingest sample CSV: ${e.message}`]);
    } finally {
      setIsValidating(false);
    }
  };

  const loadFullPlayerCsv = async () => {
    setErrors([]);
    setImportResult(null);
    setCsvResult(null);
    setIsValidating(true);
    try {
      const result = await importCsvMatchData({
        file_path: 'player.csv',
        focus_team: focusTeamName,
      });
      setCsvResult(result);
      setFileName('player.csv');
      setFileContent('Parsed 8 matches with full 16-18 player squads (172 records) from player.csv');
    } catch (e: any) {
      setErrors([`Failed to ingest player.csv: ${e.message}`]);
    } finally {
      setIsValidating(false);
    }
  };

  const handleWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      setErrors([]);
      setImportResult(null);
      setCsvResult(null);
      if (file.name.endsWith('.json')) {
        setImportMode('json');
      } else if (file.name.endsWith('.csv')) {
        setImportMode('csv');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileContent) return;
    setIsValidating(true);
    setErrors([]);
    setImportResult(null);
    setCsvResult(null);

    try {
      if (importMode === 'csv' || fileName?.endsWith('.csv')) {
        const result = await importCsvMatchData({
          csv_content: fileContent,
          focus_team: focusTeamName,
        });
        setCsvResult(result);
      } else {
        const parsed = JSON.parse(fileContent);
        const result = await importMatchData(parsed);
        setImportResult(result);
      }
    } catch (err: any) {
      const lines = err.message ? err.message.split('\n') : ['Unknown error occurred during import'];
      setErrors(lines);
    } finally {
      setIsValidating(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('Wipe the database and start fresh with the 2024-25 fixture schedule and sample CSV matches?')) {
      return;
    }
    setResettingDb(true);
    setResetMessage(null);
    setErrors([]);
    try {
      const res = await resetDatabase(true, focusTeamName);
      setResetMessage(`Database refreshed cleanly: 380 Premier League fixtures seeded, ${res.imported_matches_count || 8} matches imported.`);
      setCsvResult(null);
      setImportResult(null);
      setFileContent(null);
      setFileName(null);
    } catch (err: any) {
      setErrors([`Reset failed: ${err.message}`]);
    } finally {
      setResettingDb(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
      {/* Page Title & Mode Switcher */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Match data ingestion</h1>
          <p className="page-description">
            Import match sheets via CSV tabular statistics or full JSON telemetry with coordinate event mapping.
          </p>
        </div>

        {/* Mode Selector */}
        <JellyRadio
          size="sm"
          items={[
            {
              value: 'csv',
              label: 'CSV Player Stats',
              icon: <Table size={14} />,
            },
            {
              value: 'json',
              label: 'JSON Telemetry',
              icon: <Layers size={14} />,
            },
          ]}
          value={importMode}
          onChange={(val) => setImportMode(val as 'csv' | 'json')}
        />
      </div>

      {/* Main Import Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Sample Datasets or CSV Ingestion Box */}
        <div className="surface-panel">
          <div className="surface-panel-header">
            <div>
              <div className="surface-panel-title">
                {importMode === 'csv' ? 'CSV Tabular Player Match Statistics' : 'Pre-validated JSON Match Sheets'}
              </div>
              <div className="surface-panel-caption">
                {importMode === 'csv'
                  ? 'Automatically integrates with the Premier League 2024-25 fixture calendar'
                  : 'Full match documentation with 0-100 normalized spatial pitch events'}
              </div>
            </div>
          </div>

          {importMode === 'csv' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Comprehensive Full Squad Dataset Card */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #18202c 0%, #121824 100%)',
                  border: '1px solid rgba(210, 174, 94, 0.4)',
                  borderRadius: '6px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>
                      Full Squad Dataset (player.csv)
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--accent-gold)', marginTop: '2px' }}>
                      8 Premier League matches &bull; 172 player stat lines &bull; Full 16-18 player lineups &bull; Real player names
                    </div>
                  </div>
                  <button
                    onClick={loadFullPlayerCsv}
                    disabled={isValidating}
                    style={{
                      background: 'var(--accent-gold)',
                      color: '#0b0c0e',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Ingest Full Squad CSV
                  </button>
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Complete Chelsea squad (Cole Palmer, Nicolas Jackson, Madueke, Enzo, Caicedo, Colwill, Sánchez) + Premier League stars (Haaland, Salah, Eze, Welbeck) across Matchweeks 1-8. Designed for full Bar Charts, Treemaps, Bubble clusters, and 3D Trajectories.
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '6px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '15.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      football_player_match_stats_sample.csv
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      8 matches &bull; 40 player stat lines &bull; Matches M1001-M1008
                    </div>
                  </div>
                  <button
                    onClick={loadCsvSample}
                    disabled={isValidating}
                    style={{
                      background: 'var(--accent-gold)',
                      color: '#0b0c0e',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Ingest Sample CSV
                  </button>
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Includes Arsenal vs Chelsea (M1001), Liverpool vs Tottenham (M1002), Man City vs Newcastle (M1003), plus European fixtures.
                </div>
              </div>

              {/* Focus Team Configuration */}
              <div
                style={{
                  background: 'rgba(14, 15, 18, 0.6)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '6px',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Focus Managed Team:
                  </span>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Perspective used for Home/Away, W/D/L record, and squad aggregation
                  </div>
                </div>
                <select
                  value={focusTeamName}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="form-select"
                  style={{ width: '160px' }}
                >
                  <option value="Chelsea">Chelsea</option>
                  <option value="Arsenal">Arsenal</option>
                  <option value="Liverpool">Liverpool</option>
                  <option value="Manchester City">Manchester City</option>
                  <option value="Tottenham Hotspur">Tottenham Hotspur</option>
                  <option value="Real Madrid">Real Madrid</option>
                </select>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SAMPLE_FIXTURES.map((fixture) => {
                const isSelected = fileName?.includes(`0${fixture.id}`) || (fixture.isInvalid && fileName?.includes('invalid'));
                return (
                  <div
                    key={fixture.id}
                    onClick={() => loadJsonSample(fixture.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: isSelected ? 'var(--bg-surface-elevated)' : 'rgba(14, 15, 18, 0.6)',
                      border: isSelected ? '1px solid var(--border-highlight)' : '1px solid var(--border-hairline)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14.5px', fontWeight: '600', color: fixture.isInvalid ? '#f87171' : 'var(--text-primary)' }}>
                        {fixture.team} vs {fixture.opponent}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {fixture.competition} &bull; {fixture.date}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={fixture.isInvalid ? 'score-pill score-pill-loss' : 'score-pill score-pill-win'}>
                        {fixture.score}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadJsonSample(fixture.id);
                        }}
                        style={{
                          background: isSelected ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSelected ? '#0b0c0e' : 'var(--text-primary)',
                          border: '1px solid var(--border-hairline)',
                          borderRadius: '4px',
                          padding: '5px 12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? 'Selected' : 'Load'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Custom File Intake Dropzone & Database Reset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            onClick={() => document.getElementById('web-file-input')?.click()}
            style={{
              border: '1px dashed var(--border-hairline)',
              borderRadius: '6px',
              background: 'rgba(14, 15, 18, 0.5)',
              padding: '36px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-gold)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-hairline)')}
          >
            <Upload size={24} color="var(--accent-gold)" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Choose {importMode === 'csv' ? 'player stats CSV' : 'match JSON'}
            </div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Drag &amp; drop or click to browse
            </div>
            <input
              id="web-file-input"
              type="file"
              accept={importMode === 'csv' ? '.csv' : '.json'}
              onChange={handleWebFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Database Reset Section */}
          <div className="surface-panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              <Database size={14} color="var(--accent-gold)" />
              <span>Database maintenance</span>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              Wipe previous match sheets and re-seed the full 2024-25 Premier League fixture schedule cleanly.
            </p>
            <button
              onClick={handleResetDatabase}
              disabled={resettingDb}
              style={{
                marginTop: '6px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '4px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: resettingDb ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {resettingDb ? <RefreshCw size={12} className="animate-spin" /> : null}
              <span>Reset &amp; Re-seed from CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Banner */}
      {resetMessage && (
        <div className="surface-panel" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(14, 22, 18, 0.95)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontSize: '13px', fontWeight: 500 }}>
            <CheckCircle size={16} />
            <span>{resetMessage}</span>
          </div>
        </div>
      )}

      {/* Selected File Preview & Import Actions */}
      {fileName && fileContent && (
        <div className="surface-panel">
          <div className="surface-panel-header">
            <div>
              <div className="surface-panel-title">
                <FileText size={16} color="var(--accent-gold)" />
                <span>Selected file: {fileName}</span>
              </div>
              <div className="surface-panel-caption">
                {(fileContent.length / 1024).toFixed(1)} KB payload loaded
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowRawPreview(!showRawPreview)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-secondary)',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Eye size={12} /> {showRawPreview ? 'Hide preview' : 'Inspect raw data'}
              </button>

              <button
                onClick={handleImport}
                disabled={isValidating}
                style={{
                  background: 'var(--accent-gold)',
                  color: '#0b0c0e',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '7px 16px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: isValidating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isValidating ? 0.7 : 1,
                }}
              >
                {isValidating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Ingesting data...
                  </>
                ) : (
                  <>
                    <CheckCircle size={13} /> Ingest &amp; persist match records
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Raw Content View */}
          {showRawPreview && (
            <pre
              style={{
                marginTop: '14px',
                padding: '12px',
                background: 'rgba(9, 10, 12, 0.95)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '4px',
                maxHeight: '260px',
                overflowY: 'auto',
                fontSize: '12.5px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                lineHeight: '1.5',
              }}
            >
              {fileContent}
            </pre>
          )}
        </div>
      )}

      {/* Errors Display */}
      {errors.length > 0 && (
        <div
          className="surface-panel"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            background: 'rgba(20, 16, 18, 0.95)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: '600', fontSize: '14.5px', marginBottom: '8px' }}>
            <AlertCircle size={16} /> Discrepancies during ingestion:
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#fca5a5', lineHeight: '1.6' }}>
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* CSV Batch Ingestion Success Feedback */}
      {csvResult && (
        <div className="surface-panel" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(14, 22, 18, 0.95)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: '600', fontSize: '15.5px' }}>
                <CheckCircle size={18} /> {csvResult.message}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                All match fixtures linked to Premier League calendar &amp; squad histories updated.
              </div>
            </div>
            {csvResult.matches.length > 0 && (
              <button
                onClick={() => onImportSuccess(csvResult.matches[0].match_id)}
                style={{
                  background: 'var(--accent-gold)',
                  color: '#0b0c0e',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Inspect First Match ({csvResult.matches[0].match_id})
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {csvResult.matches.map((m) => (
              <div
                key={m.match_id}
                onClick={() => onImportSuccess(m.match_id)}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '4px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-hairline)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14.5px', fontWeight: 600 }}>
                  <span style={{ color: '#FFFFFF' }}>{m.team} vs {m.opponent}</span>
                  <span className="score-pill score-pill-win" style={{ fontSize: '12.5px' }}>{m.score}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{m.competition} &bull; {m.date}</span>
                  <span>{m.players_count} players</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON Single Ingestion Success Feedback */}
      {importResult && (
        <div className="surface-panel" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(14, 22, 18, 0.95)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: '600', fontSize: '15.5px' }}>
                <CheckCircle size={18} /> Match ingested and saved
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '4px' }}>
                {importResult.team} vs {importResult.opponent} ({importResult.score})
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {importResult.players_count} squad records stored, {importResult.events_count} spatial events mapped.
              </div>
            </div>

            <button
              onClick={() => onImportSuccess(importResult.match_id)}
              style={{
                background: 'var(--accent-gold)',
                color: '#0b0c0e',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Open in manager dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
