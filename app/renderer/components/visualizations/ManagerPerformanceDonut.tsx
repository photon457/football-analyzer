import React from 'react';

interface ManagerPerformanceDonutProps {
  wins: number;
  draws: number;
  losses: number;
  size?: number;
}

export const ManagerPerformanceDonut: React.FC<ManagerPerformanceDonutProps> = ({
  wins,
  draws,
  losses,
  size = 110,
}) => {
  const played = Math.max(0, wins + draws + losses);
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const winPct = played > 0 ? Math.round((wins / played) * 100) : 0;
  const drawPct = played > 0 ? Math.round((draws / played) * 100) : 0;
  const lossPct = played > 0 ? Math.max(0, 100 - winPct - drawPct) : 0;

  // Arc stroke dash lengths
  const winStroke = (winPct / 100) * circumference;
  const drawStroke = (drawPct / 100) * circumference;
  const lossStroke = (lossPct / 100) * circumference;

  // Rotational offsets (starting from top, i.e., -90deg)
  const winOffset = 0;
  const drawOffset = -winStroke;
  const lossOffset = -(winStroke + drawStroke);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '10px 14px',
        background: 'rgba(10, 14, 22, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        maxWidth: '320px',
      }}
    >
      {/* Doughnut SVG */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1c222d"
            strokeWidth={strokeWidth}
          />

          {played > 0 ? (
            <>
              {/* Wins arc */}
              {winStroke > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${winStroke} ${circumference - winStroke}`}
                  strokeDashoffset={winOffset}
                />
              )}

              {/* Draws arc */}
              {drawStroke > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#eab308"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${drawStroke} ${circumference - drawStroke}`}
                  strokeDashoffset={drawOffset}
                />
              )}

              {/* Losses arc */}
              {lossStroke > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${lossStroke} ${circumference - lossStroke}`}
                  strokeDashoffset={lossOffset}
                />
              )}
            </>
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#262b33"
              strokeWidth={strokeWidth}
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: played > 0 ? '16px' : '13px',
              fontWeight: 800,
              color: '#ffffff',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1,
            }}
          >
            {played > 0 ? `${winPct}%` : '0'}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#8b8f9a',
              marginTop: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 600,
            }}
          >
            {played > 0 ? 'Win Rate' : 'Matches'}
          </div>
        </div>
      </div>

      {/* Legend & Counts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#d1d5db', fontWeight: 600 }}>Wins</span>
          </div>
          <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {wins} <span style={{ color: '#6b7280', fontWeight: 500 }}>({winPct}%)</span>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#eab308',
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#d1d5db', fontWeight: 600 }}>Draws</span>
          </div>
          <span style={{ color: '#eab308', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {draws} <span style={{ color: '#6b7280', fontWeight: 500 }}>({drawPct}%)</span>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#d1d5db', fontWeight: 600 }}>Losses</span>
          </div>
          <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {losses} <span style={{ color: '#6b7280', fontWeight: 500 }}>({lossPct}%)</span>
          </span>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '4px',
            marginTop: '2px',
            display: 'flex',
            justifyContent: 'space-between',
            color: '#9ca3af',
            fontSize: '11px',
          }}
        >
          <span>Total Played:</span>
          <span style={{ fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
            {played}
          </span>
        </div>
      </div>
    </div>
  );
};
