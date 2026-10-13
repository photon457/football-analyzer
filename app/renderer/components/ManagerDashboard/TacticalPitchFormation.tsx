import React, { useMemo } from 'react';
import { PlayerStats, SpatialEvent } from '../../services/api';
import managerAvatarImg from '../../assets/manager-avatar.jpg';

interface TacticalPitchFormationProps {
  players: PlayerStats[];
  events?: SpatialEvent[];
  selectedPlayerId?: string | null;
  onSelectPlayer?: (playerId: string) => void;
  philosophy?: string;
  formationName?: string;
}

// 4-3-3 Standard Tactical Pitch Coordinates (percentages 0-100)
// Matching reference letter badges: A, B, M, R, etc.
const FORMATION_433_SLOTS = [
  { role: 'GK', letter: 'R', x: 12, y: 50 },
  { role: 'RB', letter: 'A', x: 28, y: 18 },
  { role: 'CB_R', letter: 'B', x: 26, y: 38 },
  { role: 'CB_L', letter: 'B', x: 26, y: 62 },
  { role: 'LB', letter: 'A', x: 28, y: 82 },
  { role: 'DM', letter: 'B', x: 44, y: 50 },
  { role: 'CM_R', letter: 'B', x: 55, y: 32 },
  { role: 'CM_L', letter: 'B', x: 55, y: 68 },
  { role: 'RW', letter: 'A', x: 74, y: 22 },
  { role: 'ST', letter: 'M', x: 82, y: 50 },
  { role: 'LW', letter: 'A', x: 74, y: 78 },
];

export const TacticalPitchFormation: React.FC<TacticalPitchFormationProps> = ({
  players,
  events: _events,
  selectedPlayerId,
  onSelectPlayer,
  philosophy = 'High-Press-Transition',
  formationName = '4-3-3 Holding (Fluid-up)',
}) => {
  // Map starting players to formation slots
  const formationNodes = useMemo(() => {
    const starters = players.filter((p) => p.is_starter);
    const activePlayers = starters.length >= 11 ? starters.slice(0, 11) : players.slice(0, 11);

    return FORMATION_433_SLOTS.map((slot, idx) => {
      const p = activePlayers[idx];
      return {
        id: p ? p.player_id : `slot_${idx}`,
        name: p ? p.player_name : `Player ${idx + 1}`,
        jersey: p ? p.jersey_number : idx + 1,
        letter: slot.letter,
        x: slot.x,
        y: slot.y,
        role: slot.role,
      };
    });
  }, [players]);

  // Tactical passing network chords (connections between slots matching reference)
  const connections = useMemo(() => {
    return [
      // GK to CBs
      { from: 0, to: 2, weight: 3.5 },
      { from: 0, to: 3, weight: 3.0 },
      // CBs to Fullbacks
      { from: 2, to: 1, weight: 4.0 },
      { from: 3, to: 4, weight: 4.0 },
      { from: 2, to: 3, weight: 4.5 },
      // Defense to DM
      { from: 2, to: 5, weight: 4.0 },
      { from: 3, to: 5, weight: 3.5 },
      { from: 1, to: 5, weight: 2.5 },
      { from: 4, to: 5, weight: 2.5 },
      // DM to CMs
      { from: 5, to: 6, weight: 4.5 },
      { from: 5, to: 7, weight: 4.0 },
      { from: 6, to: 7, weight: 3.0 },
      // CMs to Wings & Striker
      { from: 6, to: 8, weight: 4.0 },
      { from: 7, to: 10, weight: 4.0 },
      { from: 6, to: 9, weight: 3.5 },
      { from: 7, to: 9, weight: 3.5 },
      { from: 5, to: 9, weight: 2.0 },
      { from: 8, to: 9, weight: 3.0 },
      { from: 10, to: 9, weight: 3.0 },
      // Fullback overlaps to Wings
      { from: 1, to: 8, weight: 3.2 },
      { from: 4, to: 10, weight: 3.2 },
      { from: 1, to: 6, weight: 2.5 },
      { from: 4, to: 7, weight: 2.5 },
    ];
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Pitch Tactical Chalkboard */}
      <div
        style={{
          width: '100%',
          height: '240px',
          background: '#101319',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 64"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* Pitch Markings */}
          <rect x="2" y="2" width="96" height="60" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          {/* Halfway line */}
          <line x1="50" y1="2" x2="50" y2="62" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          {/* Center circle */}
          <circle cx="50" cy="32" r="10" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          <circle cx="50" cy="32" r="0.8" fill="rgba(255, 255, 255, 0.25)" />

          {/* Left Penalty Area */}
          <rect x="2" y="14" width="16" height="36" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          <rect x="2" y="22" width="6" height="20" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          <path d="M 18 26 A 7 7 0 0 1 18 38" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          <circle cx="12" cy="32" r="0.7" fill="rgba(255, 255, 255, 0.25)" />

          {/* Right Penalty Area */}
          <rect x="82" y="14" width="16" height="36" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          <rect x="92" y="22" width="6" height="20" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          <path d="M 82 26 A 7 7 0 0 0 82 38" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          <circle cx="88" cy="32" r="0.7" fill="rgba(255, 255, 255, 0.25)" />

          {/* Gold Passing Connection Chords */}
          {connections.map((c, idx) => {
            const n1 = formationNodes[c.from];
            const n2 = formationNodes[c.to];
            if (!n1 || !n2) return null;
            // Map 0-100% y to 0-64 svg height
            const y1 = (n1.y / 100) * 64;
            const y2 = (n2.y / 100) * 64;

            return (
              <line
                key={`chord_${idx}`}
                x1={n1.x}
                y1={y1}
                x2={n2.x}
                y2={y2}
                stroke="#D4A34B"
                strokeWidth={c.weight * 0.28}
                strokeOpacity={0.78}
                strokeLinecap="round"
              />
            );
          })}

          {/* Player Formation Nodes (Red circles with white letter labels) */}
          {formationNodes.map((node) => {
            const isSelected = selectedPlayerId === node.id;
            const cy = (node.y / 100) * 64;

            return (
              <g
                key={node.id}
                onClick={() => onSelectPlayer && onSelectPlayer(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer shadow / selection ring */}
                {isSelected && (
                  <circle cx={node.x} cy={cy} r="3.2" fill="none" stroke="#D4A34B" strokeWidth="0.8" />
                )}
                {/* Red node circle */}
                <circle
                  cx={node.x}
                  cy={cy}
                  r="2.5"
                  fill="#D9232D"
                  stroke="#FFFFFF"
                  strokeWidth="0.5"
                />
                {/* Letter badge inside circle */}
                <text
                  x={node.x}
                  y={cy + 0.9}
                  fill="#FFFFFF"
                  fontSize="2.4"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {node.letter}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* The Manager Inset Callout Card */}
      <div
        style={{
          background: 'rgba(18, 20, 28, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <img
          src={managerAvatarImg}
          alt="Manager"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '6px',
            objectFit: 'cover',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#C8963E',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            THE MANAGER
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.2fr)',
              gap: '10px',
              marginTop: '1px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#8B8F9A', textTransform: 'uppercase' }}>
                TACTICAL PHILOSOPHY
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                {philosophy}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#8B8F9A', textTransform: 'uppercase' }}>
                FORMATION
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                {formationName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
