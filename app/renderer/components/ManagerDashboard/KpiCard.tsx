import React from 'react';
import { TeamSummaryStats } from '../../services/api';

interface KpiCardProps {
  teamSummary: TeamSummaryStats;
  teamStats: Record<string, any>;
  homeScore?: number;
  awayScore?: number;
}

// Single Concentric Donut Gauge Component matching reference image
const CircularGauge: React.FC<{
  value: string | number;
  pct: number;
  color: string;
  size?: number;
  isDouble?: boolean;
}> = ({ value, pct, color, size = 88, isDouble = false }) => {
  const strokeWidth = 5.5;
  const r = (size - strokeWidth * 2) / 2;
  const c = 2 * Math.PI * r;
  const sweep = Math.min(1, Math.max(0.12, pct));
  const dashArray = `${c * sweep} ${c * (1 - sweep)}`;

  const rInner = r - 7;
  const cInner = 2 * Math.PI * rInner;
  const innerDash = `${cInner * sweep} ${cInner * (1 - sweep)}`;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {/* Outer Dark Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1A1F2B"
          strokeWidth={strokeWidth}
        />

        {/* Inner Dark Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rInner}
          fill="none"
          stroke="#141822"
          strokeWidth={strokeWidth - 1}
        />

        {/* Outer Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          strokeLinecap="round"
        />

        {/* Inner Progress Arc if Double */}
        {isDouble && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={rInner}
            fill="none"
            stroke="rgba(212, 163, 75, 0.4)"
            strokeWidth={strokeWidth - 1.5}
            strokeDasharray={innerDash}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Center Value */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: String(value).length > 4 ? '17px' : '20px',
          fontWeight: 700,
          color: '#FFFFFF',
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '-0.02em',
          userSelect: 'none',
        }}
      >
        {value}
      </div>
    </div>
  );
};

export const KpiCard: React.FC<KpiCardProps> = ({ teamSummary, teamStats }) => {
  const possession = Math.round(teamSummary.possession_pct || 55);
  const oppPossession = 100 - possession;

  const totalShots = teamStats.shots || 15;
  const oppShots = 9;

  const shotsOnTarget = teamStats.shots_on_target || 7;
  const oppShotsOnTarget = 4;

  const xg = Number((teamSummary.xg || 2.1).toFixed(1));
  const oppXg = 1.4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', gap: '18px' }}>
      {/* ── Top Row of 4 Circular Gauges ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          justifyItems: 'center',
          alignItems: 'center',
          padding: '6px 0',
        }}
      >
        {/* 55% Possession */}
        <CircularGauge
          value={`${possession}%`}
          pct={possession / 100}
          color="#D4A34B"
          isDouble={true}
        />

        {/* 15 Total Shots */}
        <CircularGauge
          value={totalShots}
          pct={0.72}
          color="#38BDF8"
        />

        {/* 7 Shots on Target */}
        <CircularGauge
          value={shotsOnTarget}
          pct={0.62}
          color="#C68715"
        />

        {/* 2.1 xG */}
        <CircularGauge
          value={xg}
          pct={0.68}
          color="#60A5FA"
        />
      </div>

      {/* ── Bottom Section: 2 Columns of 2 Rows (Exact Reference Layout) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px 28px',
          paddingTop: '4px',
        }}
      >
        {/* Left Col Row 1: Possession */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '5px',
            }}
          >
            <span style={{ color: '#D4A34B' }}>{possession}%</span>
            <span style={{ color: '#8B8F9A', fontWeight: 500, fontSize: '11.5px' }}>Possession</span>
            <span style={{ color: '#38BDF8' }}>{oppPossession}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: '#1F2430',
              borderRadius: '9999px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div style={{ width: `${possession}%`, height: '100%', background: '#D4A34B' }} />
            <div style={{ width: `${oppPossession}%`, height: '100%', background: '#38BDF8' }} />
          </div>
        </div>

        {/* Right Col Row 1: Shots on Target */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '5px',
            }}
          >
            <span style={{ color: '#D1D5DB', fontWeight: 500, fontSize: '11.5px' }}>Shots on Target</span>
            <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>{oppShotsOnTarget}</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: '#1F2430',
              borderRadius: '9999px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div style={{ width: '64%', height: '100%', background: '#D4A34B', borderRadius: '9999px 0 0 9999px' }} />
            <div style={{ width: '36%', height: '100%', background: '#38BDF8', borderRadius: '0 9999px 9999px 0' }} />
          </div>
        </div>

        {/* Left Col Row 2: Total Shots */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '5px',
            }}
          >
            <span style={{ color: '#D1D5DB', fontWeight: 500, fontSize: '11.5px' }}>Total Shots</span>
            <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>{oppShots}</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: '#1F2430',
              borderRadius: '9999px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div style={{ width: '62%', height: '100%', background: '#D4A34B', borderRadius: '9999px 0 0 9999px' }} />
            <div style={{ width: '38%', height: '100%', background: '#38BDF8', borderRadius: '0 9999px 9999px 0' }} />
          </div>
        </div>

        {/* Right Col Row 2: xG */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '5px',
            }}
          >
            <span style={{ color: '#D1D5DB', fontWeight: 500, fontSize: '11.5px' }}>xG</span>
            <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>{oppXg}</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: '#1F2430',
              borderRadius: '9999px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div style={{ width: '60%', height: '100%', background: '#D4A34B', borderRadius: '9999px 0 0 9999px' }} />
            <div style={{ width: '40%', height: '100%', background: '#38BDF8', borderRadius: '0 9999px 9999px 0' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
