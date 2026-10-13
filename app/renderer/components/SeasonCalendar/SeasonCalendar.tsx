import React, { useState, useEffect } from 'react';
import {
  FixtureItem,
  fetchFixtures,
  fetchFocusTeam,
} from '../../services/api';
import { Search, ExternalLink } from 'lucide-react';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface SeasonCalendarProps {
  onSelectMatch: (matchId: string) => void;
}

export const SeasonCalendar: React.FC<SeasonCalendarProps> = ({ onSelectMatch }) => {
  const [fixtures, setFixtures] = useState<FixtureItem[]>([]);
  const [managedTeam, setManagedTeam] = useState<string>('Chelsea');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'First Half' | 'Second Half'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'played' | 'scheduled'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const team = await fetchFocusTeam().catch(() => 'Chelsea');
      setManagedTeam(team);
      const list = await fetchFixtures(team).catch(() => []);
      setFixtures(list);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const filteredFixtures = fixtures.filter((f) => {
    const matchPhase = phaseFilter === 'all' || f.phase === phaseFilter;
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    const matchSearch =
      searchQuery.trim() === '' ||
      f.home_team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.away_team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(f.matchweek).includes(searchQuery);
    return matchPhase && matchStatus && matchSearch;
  });

  const playedCount = fixtures.filter((f) => f.status === 'played').length;
  const scheduledCount = fixtures.filter((f) => f.status === 'scheduled').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Season Fixture Allocation Calendar</h1>
          <p className="page-description">
            Official 38-matchweek Premier League schedule for {managedTeam} with linked match telemetry and score records.
          </p>
        </div>

        {/* Metric Counters */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Total Matches</div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{fixtures.length}</div>
          </div>
          <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Played</div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{playedCount}</div>
          </div>
          <div style={{ background: '#0e131b', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Scheduled</div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>{scheduledCount}</div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="surface-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Toolbar: Phase, Status, and Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Phase Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginRight: '4px' }}>Phase:</span>
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
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginRight: '4px' }}>Status:</span>
              <JellyRadio
                size="sm"
                items={[
                  { value: 'all', label: 'All' },
                  { value: 'played', label: 'Played' },
                  { value: 'scheduled', label: 'Scheduled' },
                ]}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as any)}
              />
            </div>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Search club or gameweek..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: '#0e131b',
                border: '1px solid var(--border-hairline)',
                borderRadius: '4px',
                padding: '7px 12px 7px 34px',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                width: '230px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Fixtures Table */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14.5px' }}>
            Loading season fixtures...
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-hairline)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0e131b', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>GW</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>Date</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>Home Team</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>Away Team</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>Venue</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>Status</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>Result / Time</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFixtures.map((f, idx) => {
                  const isFocusHome = f.home_team.toLowerCase() === managedTeam.toLowerCase();
                  const isPlayed = f.status === 'played';
                  return (
                    <tr
                      key={f.fixture_id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: isPlayed ? 'rgba(74, 222, 128, 0.02)' : idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        GW{f.matchweek}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {f.date}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: isFocusHome ? 700 : 400, color: isFocusHome ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                        {f.home_team}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: !isFocusHome ? 700 : 400, color: !isFocusHome ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                        {f.away_team}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                        {isFocusHome ? 'Home' : 'Away'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: isPlayed ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: isPlayed ? '#4ade80' : 'var(--text-secondary)',
                          }}
                        >
                          {f.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {isPlayed && f.score_home !== null && f.score_home !== undefined && f.score_away !== null && f.score_away !== undefined ? (
                          <span style={{ color: '#ffffff' }}>{f.score_home} - {f.score_away}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Scheduled</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {f.match_id ? (
                          <button
                            onClick={() => onSelectMatch(f.match_id!)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '5px 12px',
                              background: 'rgba(200, 150, 62, 0.15)',
                              border: '1px solid rgba(200, 150, 62, 0.4)',
                              color: 'var(--accent-gold)',
                              borderRadius: '4px',
                              fontSize: '12.5px',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            <span>Open Telemetry</span>
                            <ExternalLink size={12} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
