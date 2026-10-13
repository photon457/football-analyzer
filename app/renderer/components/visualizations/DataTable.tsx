import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { PlayerStats } from '../../services/api';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface DataTableProps {
  players: PlayerStats[];
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
}

type MetricMode = 'raw' | 'per90';

export const DataTable: React.FC<DataTableProps> = ({
  players,
  onSelectPlayer,
  selectedPlayerId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW'>('ALL');
  const [metricMode, setMetricMode] = useState<MetricMode>('raw');
  const [sortKey, setSortKey] = useState<string>('minutes_played');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const filteredPlayers = useMemo(() => {
    return players
      .filter((p) => {
        const matchesSearch = p.player_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPos = positionFilter === 'ALL' || p.primary_position === positionFilter;
        return matchesSearch && matchesPos;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortKey === 'player_name') {
          valA = a.player_name;
          valB = b.player_name;
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (metricMode === 'per90') {
          if (sortKey === 'goals') valA = a.per_90.goals_per_90;
          else if (sortKey === 'assists') valA = a.per_90.assists_per_90;
          else if (sortKey === 'shots') valA = a.per_90.shots_per_90;
          else if (sortKey === 'passes') valA = a.per_90.passes_completed_per_90;
          else if (sortKey === 'tackles') valA = a.per_90.tackles_won_per_90;
          else if (sortKey === 'interceptions') valA = a.per_90.interceptions_per_90;
          else if (sortKey === 'minutes_played') valA = a.minutes_played;

          if (sortKey === 'goals') valB = b.per_90.goals_per_90;
          else if (sortKey === 'assists') valB = b.per_90.assists_per_90;
          else if (sortKey === 'shots') valB = b.per_90.shots_per_90;
          else if (sortKey === 'passes') valB = b.per_90.passes_completed_per_90;
          else if (sortKey === 'tackles') valB = b.per_90.tackles_won_per_90;
          else if (sortKey === 'interceptions') valB = b.per_90.interceptions_per_90;
          else if (sortKey === 'minutes_played') valB = b.minutes_played;
        } else {
          if (sortKey === 'minutes_played') {
            valA = a.minutes_played;
            valB = b.minutes_played;
          } else if (sortKey === 'goals') {
            valA = a.goals;
            valB = b.goals;
          } else if (sortKey === 'assists') {
            valA = a.assists;
            valB = b.assists;
          } else if (sortKey === 'shots') {
            valA = a.shots_total;
            valB = b.shots_total;
          } else if (sortKey === 'passes') {
            valA = a.passes_completed;
            valB = b.passes_completed;
          } else if (sortKey === 'tackles') {
            valA = a.tackles_won;
            valB = b.tackles_won;
          } else if (sortKey === 'interceptions') {
            valA = a.interceptions;
            valB = b.interceptions;
          }
        }

        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [players, searchTerm, positionFilter, metricMode, sortKey, sortOrder]);

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} color="var(--text-muted)" style={{ marginLeft: '4px' }} />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={12} color="var(--accent-gold)" style={{ marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={12} color="var(--accent-gold)" style={{ marginLeft: '4px' }} />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-pitch)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '4px',
            padding: '7px 14px',
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Filter squad by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              fontFamily: 'var(--font-main)',
              width: '200px',
            }}
          />
        </div>

        {/* Position Filter */}
        <JellyRadio
          size="sm"
          items={[
            { value: 'ALL', label: 'All' },
            { value: 'GK', label: 'GK' },
            { value: 'DF', label: 'DF' },
            { value: 'MF', label: 'MF' },
            { value: 'FW', label: 'FW' },
          ]}
          value={positionFilter}
          onChange={(val) => setPositionFilter(val as any)}
        />

        {/* Raw vs Per-90 Toggle */}
        <JellyRadio
          size="sm"
          items={[
            { value: 'raw', label: 'Raw volume' },
            { value: 'per90', label: 'Per-90 normalized' },
          ]}
          value={metricMode}
          onChange={(val) => setMetricMode(val as MetricMode)}
        />
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-pitch)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <th style={{ padding: '11px 14px', width: '36px', fontFamily: 'var(--font-mono)' }}>#</th>
              <th
                onClick={() => handleSort('player_name')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>Player {renderSortIcon('player_name')}</div>
              </th>
              <th style={{ padding: '11px 14px' }}>Unit</th>
              <th
                onClick={() => handleSort('minutes_played')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Minutes {renderSortIcon('minutes_played')}
                </div>
              </th>
              <th
                onClick={() => handleSort('goals')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {metricMode === 'per90' ? 'Goals/90' : 'Goals'} {renderSortIcon('goals')}
                </div>
              </th>
              <th
                onClick={() => handleSort('assists')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {metricMode === 'per90' ? 'Assists/90' : 'Assists'} {renderSortIcon('assists')}
                </div>
              </th>
              <th
                onClick={() => handleSort('shots')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {metricMode === 'per90' ? 'Shots/90' : 'Shots'} {renderSortIcon('shots')}
                </div>
              </th>
              <th
                onClick={() => handleSort('passes')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {metricMode === 'per90' ? 'Passes/90' : 'Passes'} {renderSortIcon('passes')}
                </div>
              </th>
              <th
                onClick={() => handleSort('tackles')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {metricMode === 'per90' ? 'Tackles/90' : 'Tackles'} {renderSortIcon('tackles')}
                </div>
              </th>
              <th
                onClick={() => handleSort('interceptions')}
                style={{ padding: '11px 14px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {metricMode === 'per90' ? 'Int/90' : 'Interceptions'} {renderSortIcon('interceptions')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((p) => {
              const isSelected = selectedPlayerId === p.player_id;
              return (
                <tr
                  key={p.player_id}
                  onClick={() => onSelectPlayer && onSelectPlayer(p.player_id)}
                  style={{
                    borderBottom: '1px solid var(--border-hairline)',
                    background: isSelected ? 'var(--bg-surface-elevated)' : 'transparent',
                    cursor: onSelectPlayer ? 'pointer' : 'default',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13.5px',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: '11px 14px', color: 'var(--text-muted)' }}>{p.jersey_number}</td>
                  <td style={{ padding: '11px 14px', fontWeight: '500', fontFamily: 'var(--font-main)', color: isSelected ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{p.player_name}</span>
                      {p.is_starter && (
                        <span
                          style={{
                            background: 'var(--accent-gold-soft)',
                            color: 'var(--accent-gold)',
                            border: '1px solid var(--border-highlight)',
                            fontSize: '11.5px',
                            padding: '1px 5px',
                            borderRadius: '2px',
                            fontWeight: '600',
                          }}
                        >
                          XI
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: 'var(--bg-pitch)',
                        border: '1px solid var(--border-hairline)',
                        color:
                          p.primary_position === 'FW'
                            ? 'var(--accent-gold)'
                            : p.primary_position === 'MF'
                            ? '#38bdf8'
                            : p.primary_position === 'DF'
                            ? '#a1a1aa'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {p.detailed_position || p.primary_position}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>{p.minutes_played}'</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: p.goals > 0 ? '700' : 'normal', color: p.goals > 0 ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                    {metricMode === 'per90' ? p.per_90.goals_per_90 : p.goals}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {metricMode === 'per90' ? p.per_90.assists_per_90 : p.assists}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {metricMode === 'per90' ? p.per_90.shots_per_90 : p.shots_total}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {metricMode === 'per90'
                      ? p.per_90.passes_completed_per_90
                      : `${p.passes_completed}/${p.passes_attempted}`}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {metricMode === 'per90' ? p.per_90.tackles_won_per_90 : p.tackles_won}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {metricMode === 'per90' ? p.per_90.interceptions_per_90 : p.interceptions}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
