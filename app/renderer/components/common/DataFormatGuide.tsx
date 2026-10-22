import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Table,
} from 'lucide-react';

export type GuideFormatType =
  | 'player_stats_csv'
  | 'opponent_teamsheet_csv'
  | 'telemetry_json'
  | 'quick_scorecard';

interface ColumnDef {
  name: string;
  type: 'STRING' | 'INT' | 'FLOAT' | 'ENUM';
  required: boolean;
  acceptedValues?: string;
  description: string;
  example: string;
}

const QUICK_SCORECARD_COLUMNS: ColumnDef[] = [
  {
    name: 'Home Score',
    type: 'INT',
    required: true,
    acceptedValues: '0 - 99',
    description: 'Goals scored by home club',
    example: '2',
  },
  {
    name: 'Away Score',
    type: 'INT',
    required: true,
    acceptedValues: '0 - 99',
    description: 'Goals scored by away club',
    example: '1',
  },
  {
    name: 'Possession %',
    type: 'FLOAT',
    required: true,
    acceptedValues: '30.0% - 75.0%',
    description: 'Home team possession share (away team is derived as 100 - home %)',
    example: '56%',
  },
  {
    name: 'Home Shots',
    type: 'INT',
    required: true,
    acceptedValues: '4 - 30',
    description: 'Total attempts on goal by home club (including blocked & off-target)',
    example: '14',
  },
  {
    name: 'Away Shots',
    type: 'INT',
    required: true,
    acceptedValues: '4 - 30',
    description: 'Total attempts on goal by away club (including blocked & off-target)',
    example: '9',
  },
];

const PLAYER_STATS_CSV_COLUMNS: ColumnDef[] = [
  {
    name: 'player_name',
    type: 'STRING',
    required: true,
    description: 'Full name of the squad member (aliases: name, player)',
    example: 'Cole Palmer',
  },
  {
    name: 'position',
    type: 'ENUM',
    required: true,
    acceptedValues: 'GK, CB, LB, RB, DM, CM, AM, RW, LW, ST (or GK, DF, MF, FW)',
    description: 'Tactical role or positional category on the pitch',
    example: 'AM',
  },
  {
    name: 'minutes',
    type: 'INT',
    required: true,
    acceptedValues: '0 - 120',
    description: 'Minutes played in the match',
    example: '90',
  },
  {
    name: 'player_id',
    type: 'STRING',
    required: false,
    description: 'Unique player identifier (auto-slugged from player_name if omitted)',
    example: 'p_cole_palmer',
  },
  {
    name: 'jersey_number',
    type: 'INT',
    required: false,
    acceptedValues: '1 - 99',
    description: 'Squad shirt number (alias: jersey)',
    example: '20',
  },
  {
    name: 'team',
    type: 'STRING',
    required: false,
    description: 'Club name (defaults to current managed focus club if blank)',
    example: 'Chelsea',
  },
  {
    name: 'opponent',
    type: 'STRING',
    required: false,
    description: 'Opponent club name in this fixture',
    example: 'Manchester United',
  },
  {
    name: 'match_id',
    type: 'STRING',
    required: false,
    description: 'Unique match code (auto-linked to fixture if omitted)',
    example: 'match_mw10_che_mun',
  },
  {
    name: 'goals',
    type: 'INT',
    required: false,
    acceptedValues: '>= 0',
    description: 'Goals scored in match',
    example: '1',
  },
  {
    name: 'assists',
    type: 'INT',
    required: false,
    acceptedValues: '>= 0',
    description: 'Goal assists created',
    example: '1',
  },
  {
    name: 'shots',
    type: 'INT',
    required: false,
    acceptedValues: '>= 0',
    description: 'Total shots attempted',
    example: '4',
  },
  {
    name: 'xg',
    type: 'FLOAT',
    required: false,
    acceptedValues: '>= 0.00',
    description: 'Expected Goals probability value',
    example: '0.65',
  },
  {
    name: 'passes_completed',
    type: 'INT',
    required: false,
    acceptedValues: '>= 0',
    description: 'Accurate completed passes',
    example: '45',
  },
  {
    name: 'tackles',
    type: 'INT',
    required: false,
    acceptedValues: '>= 0',
    description: 'Tackles successfully won',
    example: '2',
  },
  {
    name: 'interceptions',
    type: 'INT',
    required: false,
    acceptedValues: '>= 0',
    description: 'Pass interceptions made',
    example: '1',
  },
  {
    name: 'yellow_cards',
    type: 'INT',
    required: false,
    acceptedValues: '0, 1, 2',
    description: 'Yellow card cautions received',
    example: '0',
  },
  {
    name: 'red_cards',
    type: 'INT',
    required: false,
    acceptedValues: '0, 1',
    description: 'Red cards dismissed',
    example: '0',
  },
];

const OPPONENT_TEAMSHEET_COLUMNS: ColumnDef[] = [
  {
    name: 'player_id',
    type: 'STRING',
    required: true,
    description: 'Unique opponent player code',
    example: 'p_man_utd_08_fernandes',
  },
  {
    name: 'player_name',
    type: 'STRING',
    required: true,
    description: 'Opponent player full name',
    example: 'Bruno Fernandes',
  },
  {
    name: 'jersey_number',
    type: 'INT',
    required: true,
    acceptedValues: '1 - 99',
    description: 'Squad jersey number',
    example: '8',
  },
  {
    name: 'team',
    type: 'STRING',
    required: true,
    description: 'Opponent team name',
    example: 'Manchester United',
  },
  {
    name: 'position',
    type: 'ENUM',
    required: true,
    acceptedValues: 'GK, DF, MF, FW (or detailed CB, CM, etc.)',
    description: 'Positional unit',
    example: 'MF',
  },
  {
    name: 'minutes',
    type: 'INT',
    required: true,
    description: 'Cumulative or match minutes',
    example: '810',
  },
  {
    name: 'goals',
    type: 'INT',
    required: false,
    description: 'Goals tally',
    example: '2',
  },
  {
    name: 'assists',
    type: 'INT',
    required: false,
    description: 'Assists tally',
    example: '4',
  },
  {
    name: 'shots',
    type: 'INT',
    required: false,
    description: 'Total shots',
    example: '26',
  },
  {
    name: 'xg',
    type: 'FLOAT',
    required: false,
    description: 'Expected Goals tally',
    example: '2.45',
  },
  {
    name: 'passes_completed',
    type: 'INT',
    required: false,
    description: 'Completed passes tally',
    example: '480',
  },
  {
    name: 'tackles',
    type: 'INT',
    required: false,
    description: 'Tackles won tally',
    example: '18',
  },
  {
    name: 'interceptions',
    type: 'INT',
    required: false,
    description: 'Interceptions tally',
    example: '9',
  },
  {
    name: 'yellow_cards',
    type: 'INT',
    required: false,
    description: 'Yellow cards tally',
    example: '2',
  },
];

const SAMPLE_CSV_PLAYER_STATS = `player_id,player_name,jersey_number,team,opponent,position,minutes,goals,assists,shots,xg,passes_completed,tackles,interceptions,yellow_cards,red_cards
p_cole_palmer,Cole Palmer,20,Chelsea,Manchester United,AM,90,1,1,4,0.65,45,2,1,0,0
p_nicolas_jackson,Nicolas Jackson,15,Chelsea,Manchester United,ST,85,1,0,3,0.58,18,1,0,0,0
p_moises_caicedo,Moisés Caicedo,25,Chelsea,Manchester United,DM,90,0,0,1,0.05,58,4,3,1,0
p_levi_colwill,Levi Colwill,6,Chelsea,Manchester United,CB,90,0,0,0,0.02,62,3,2,0,0
p_robert_sanchez,Robert Sánchez,1,Chelsea,Manchester United,GK,90,0,0,0,0.00,32,0,0,0,0`;

const SAMPLE_CSV_OPPONENT_TEAMSHEET = `player_id,player_name,jersey_number,team,position,minutes,goals,assists,shots,xg,passes_completed,tackles,interceptions,yellow_cards
p_mun_08_fernandes,Bruno Fernandes,8,Manchester United,MF,810,2,4,28,2.75,465,19,8,2
p_mun_17_garnacho,Alejandro Garnacho,17,Manchester United,FW,680,3,1,24,2.30,195,12,4,1
p_mun_10_rashford,Marcus Rashford,10,Manchester United,FW,720,1,1,19,1.85,210,9,5,0
p_mun_20_dalot,Diogo Dalot,20,Manchester United,DF,810,0,1,6,0.40,420,24,14,3
p_mun_24_onana,André Onana,24,Manchester United,GK,810,0,0,0,0.00,290,1,0,0`;

const SAMPLE_JSON_TELEMETRY = `{
  "match": {
    "match_id": "match_01",
    "date": "2024-09-28",
    "competition": "Premier League",
    "season": "2024-25",
    "team": "Chelsea",
    "opponent": "Brighton & Hove Albion",
    "home_away": "home",
    "score_team": 4,
    "score_opponent": 2,
    "result": "W"
  },
  "team_metrics": {
    "possession_pct": 60.0,
    "shots": 15,
    "shots_on_target": 7,
    "passes_total": 480,
    "passes_completed": 412,
    "pass_accuracy_pct": 85.8,
    "xg": 3.15,
    "fouls": 10,
    "yellow_cards": 2,
    "red_cards": 0
  },
  "players": [
    {
      "player_id": "p_cole_palmer",
      "player_name": "Cole Palmer",
      "jersey_number": 20,
      "primary_position": "MF",
      "detailed_position": "AM",
      "is_starter": true,
      "minutes_played": 90,
      "goals": 4,
      "assists": 0,
      "shots_total": 7,
      "passes_completed": 46,
      "passes_attempted": 52,
      "tackles_won": 1,
      "interceptions": 1
    }
  ],
  "events": [
    {
      "minute": 21,
      "player_id": "p_cole_palmer",
      "event_type": "goal",
      "x": 88.5,
      "y": 50.2,
      "xg": 0.76
    }
  ]
}`;

interface DataFormatGuideProps {
  formatType: GuideFormatType;
  title?: string;
  defaultExpanded?: boolean;
  onInsertSample?: (sampleText: string) => void;
  style?: React.CSSProperties;
}

export const DataFormatGuide: React.FC<DataFormatGuideProps> = ({
  formatType,
  title,
  defaultExpanded = false,
  onInsertSample,
  style,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const columns =
    formatType === 'player_stats_csv'
      ? PLAYER_STATS_CSV_COLUMNS
      : formatType === 'opponent_teamsheet_csv'
      ? OPPONENT_TEAMSHEET_COLUMNS
      : formatType === 'quick_scorecard'
      ? QUICK_SCORECARD_COLUMNS
      : [];

  const sampleText =
    formatType === 'player_stats_csv'
      ? SAMPLE_CSV_PLAYER_STATS
      : formatType === 'opponent_teamsheet_csv'
      ? SAMPLE_CSV_OPPONENT_TEAMSHEET
      : formatType === 'quick_scorecard'
      ? 'Home Score: 2 | Away Score: 1 | Possession: 56% | Home Shots: 14 | Away Shots: 9'
      : SAMPLE_JSON_TELEMETRY;

  const headerRow = columns.map((c) => c.name).join(',');

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(label);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const defaultTitle =
    formatType === 'player_stats_csv'
      ? 'Accepted CSV Column Schema & Specifications'
      : formatType === 'opponent_teamsheet_csv'
      ? 'Accepted Opponent Team Sheet CSV Schema'
      : formatType === 'quick_scorecard'
      ? 'Scorecard Input Bounds & Acceptance Range'
      : 'Accepted JSON Telemetry Schema Specifications';

  return (
    <div
      style={{
        backgroundColor: '#0c111a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '8px',
        overflow: 'hidden',
        fontSize: '12.5px',
        ...style,
      }}
    >
      {/* Collapsible Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#111722',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={15} color="#38bdf8" />
          <span style={{ fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
            {title || defaultTitle}
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '3px',
              backgroundColor:
                formatType === 'quick_scorecard'
                  ? 'rgba(200, 150, 62, 0.15)'
                  : 'rgba(56, 189, 248, 0.15)',
              color: formatType === 'quick_scorecard' ? '#c8963e' : '#38bdf8',
              fontFamily: 'monospace',
            }}
          >
            {formatType.endsWith('_csv')
              ? 'CSV FORMAT'
              : formatType === 'quick_scorecard'
              ? 'FORM INPUT'
              : 'JSON FORMAT'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
            {isExpanded ? 'Hide Format Details' : 'View Accepted Format'}
          </span>
          {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Quick Summary Pill & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              {formatType === 'player_stats_csv' && (
                <span>
                  Requires <strong>player_name</strong>, <strong>position</strong>, and <strong>minutes</strong>. All other stats are optional and default to 0.
                </span>
              )}
              {formatType === 'opponent_teamsheet_csv' && (
                <span>
                  Team sheet CSV with player identity, position, appearance minutes, and performance metrics.
                </span>
              )}
              {formatType === 'quick_scorecard' && (
                <span>
                  Requires valid scoreline (0-99), possession share (30-75%), and shot totals. Engine synthesizes ratings and 80+ events.
                </span>
              )}
              {formatType === 'telemetry_json' && (
                <span>
                  Requires match metadata, team metrics, starting lineup/player stats, and coordinate pitch events.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {formatType.endsWith('_csv') && (
                <button
                  type="button"
                  onClick={() => handleCopy(headerRow, 'header')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                  }}
                  title="Copy header column list"
                >
                  {copiedType === 'header' ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                  <span>{copiedType === 'header' ? 'Copied Header' : 'Copy Header Row'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCopy(sampleText, 'sample')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                }}
                title="Copy sample snippet"
              >
                {copiedType === 'sample' ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                <span>{copiedType === 'sample' ? 'Copied Sample' : 'Copy Sample Data'}</span>
              </button>

              {onInsertSample && (
                <button
                  type="button"
                  onClick={() => onInsertSample(sampleText)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(200, 150, 62, 0.18)',
                    border: '1px solid rgba(200, 150, 62, 0.4)',
                    color: '#c8963e',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Insert sample data into input"
                >
                  <FileText size={12} />
                  <span>Insert Sample</span>
                </button>
              )}
            </div>
          </div>

          {/* Table of Columns (for CSV formats) */}
          {columns.length > 0 && (
            <div
              style={{
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                overflowX: 'auto',
                maxHeight: '260px',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#131924', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '7px 10px', fontWeight: 600 }}>
                      {formatType === 'quick_scorecard' ? 'Input Field' : 'Column Name'}
                    </th>
                    <th style={{ padding: '7px 10px', fontWeight: 600, width: '70px' }}>Type</th>
                    <th style={{ padding: '7px 10px', fontWeight: 600, width: '85px' }}>Status</th>
                    <th style={{ padding: '7px 10px', fontWeight: 600 }}>Description &amp; Allowed Values</th>
                    <th style={{ padding: '7px 10px', fontWeight: 600, width: '110px' }}>Example</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, idx) => (
                    <tr
                      key={col.name}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                      }}
                    >
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                        {col.name}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: '#94a3b8',
                            fontFamily: 'monospace',
                          }}
                        >
                          {col.type}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {col.required ? (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              fontWeight: 700,
                            }}
                          >
                            REQUIRED
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              color: '#94a3b8',
                            }}
                          >
                            OPTIONAL
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>
                        {col.description}
                        {col.acceptedValues && (
                          <div style={{ fontSize: '10.5px', color: '#38bdf8', marginTop: '2px', fontFamily: 'monospace' }}>
                            Values: {col.acceptedValues}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#c8963e' }}>
                        {col.example}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* JSON Telemetry Specification (for JSON format) */}
          {formatType === 'telemetry_json' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <div style={{ background: '#121824', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>match Object</div>
                <div style={{ color: '#cbd5e1', fontSize: '11.5px', lineHeight: 1.4 }}>
                  <code>match_id</code>, <code>date</code> (YYYY-MM-DD), <code>competition</code>, <code>season</code>, <code>team</code>, <code>opponent</code>, <code>home_away</code>, <code>score_team</code>, <code>score_opponent</code>, <code>result</code>
                </div>
              </div>

              <div style={{ background: '#121824', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontWeight: 700, color: '#c8963e', marginBottom: '4px' }}>team_metrics Object</div>
                <div style={{ color: '#cbd5e1', fontSize: '11.5px', lineHeight: 1.4 }}>
                  <code>possession_pct</code> (30-75%), <code>shots</code>, <code>shots_on_target</code>, <code>passes_total</code>, <code>passes_completed</code>, <code>pass_accuracy_pct</code>, <code>xg</code>
                </div>
              </div>

              <div style={{ background: '#121824', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: '4px' }}>players Array</div>
                <div style={{ color: '#cbd5e1', fontSize: '11.5px', lineHeight: 1.4 }}>
                  Array of 11-18 squad members with <code>player_id</code>, <code>player_name</code>, <code>primary_position</code> (GK/DF/MF/FW), <code>minutes_played</code>, goals, assists, shots, passes, tackles
                </div>
              </div>

              <div style={{ background: '#121824', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontWeight: 700, color: '#c084fc', marginBottom: '4px' }}>events Array</div>
                <div style={{ color: '#cbd5e1', fontSize: '11.5px', lineHeight: 1.4 }}>
                  Array of match events with <code>minute</code> (0-90), <code>player_id</code>, <code>event_type</code> (goal, shot, foul, tackle), and pitch coordinates <code>x</code> (0-100), <code>y</code> (0-100)
                </div>
              </div>
            </div>
          )}

          {/* Sample Code Block Preview */}
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
              Sample Data Format Preview:
            </div>
            <pre
              style={{
                margin: 0,
                padding: '8px 12px',
                backgroundColor: '#070a10',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#94a3b8',
                overflowX: 'auto',
                maxHeight: '110px',
              }}
            >
              {sampleText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
