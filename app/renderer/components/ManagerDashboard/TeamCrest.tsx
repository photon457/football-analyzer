import React from 'react';

interface TeamCrestProps {
  teamName: string;
  size?: number;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({ teamName, size = 48 }) => {
  const norm = (teamName || '').toLowerCase().trim();

  // Arsenal
  if (norm.includes('arsenal')) {
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M30 4C17 4 10 11 10 22C10 38 30 56 30 56C30 56 50 38 50 22C50 11 43 4 30 4Z"
          fill="#D9232D"
          stroke="#C68715"
          strokeWidth="2.5"
        />
        {/* Gold inner shield contour */}
        <path
          d="M30 7.5C19.5 7.5 13.5 13.5 13.5 22.5C13.5 35.5 30 50.5 30 50.5C30 50.5 46.5 35.5 46.5 22.5C46.5 13.5 40.5 7.5 30 7.5Z"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1"
          fill="#BA1720"
        />
        {/* Top banner */}
        <rect x="17" y="11" width="26" height="7" rx="2" fill="#0C1B33" />
        <text
          x="30"
          y="16.5"
          fill="#FFFFFF"
          fontSize="5.5"
          fontWeight="800"
          textAnchor="middle"
          letterSpacing="0.08em"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          ARSENAL
        </text>
        {/* Cannon silhouette */}
        <g transform="translate(18, 22) scale(0.48)">
          <path
            d="M5 28C5 24 9 20 15 20L40 18L44 14L48 14L46 22L40 22L15 24C12 24 10 26 10 28Z"
            fill="#D2AE5E"
          />
          <circle cx="18" cy="28" r="8" fill="#0C1B33" stroke="#D2AE5E" strokeWidth="2.5" />
          <circle cx="18" cy="28" r="3" fill="#D2AE5E" />
          <circle cx="34" cy="30" r="4.5" fill="#0C1B33" stroke="#D2AE5E" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  // Manchester City
  if (norm.includes('manchester city') || norm.includes('man city')) {
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="26" fill="#6CADDF" stroke="#001838" strokeWidth="2.5" />
        <circle cx="30" cy="30" r="22.5" fill="#FFFFFF" stroke="#001838" strokeWidth="1" />
        <circle cx="30" cy="30" r="16.5" fill="#6CADDF" />
        {/* Outer Circular Ribbon Text */}
        <path id="cityCircleUpper" d="M 12 30 A 18 18 0 0 1 48 30" fill="none" />
        <path id="cityCircleLower" d="M 48 30 A 18 18 0 0 1 12 30" fill="none" />
        <text fontSize="4.2" fontWeight="800" fill="#001838" fontFamily="system-ui, sans-serif" letterSpacing="0.06em">
          <textPath href="#cityCircleUpper" startOffset="50%" textAnchor="middle">
            MANCHESTER
          </textPath>
        </text>
        <text fontSize="4.2" fontWeight="800" fill="#001838" fontFamily="system-ui, sans-serif" letterSpacing="0.08em">
          <textPath href="#cityCircleLower" startOffset="50%" textAnchor="middle">
            CITY
          </textPath>
        </text>
        {/* Ship inside central shield */}
        <g transform="translate(22, 22) scale(0.55)">
          <path d="M4 14L8 6L20 6L24 14L4 14Z" fill="#D2AE5E" stroke="#001838" strokeWidth="1" />
          <path d="M2 14L26 14L22 22L6 22L2 14Z" fill="#D2AE5E" stroke="#001838" strokeWidth="1" />
          <path d="M14 6V1M14 1L18 3.5L14 6Z" fill="#D2AE5E" />
          {/* Red Rose below */}
          <circle cx="14" cy="27" r="3.5" fill="#D9232D" />
        </g>
      </svg>
    );
  }

  // Chelsea
  if (norm.includes('chelsea')) {
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="26" fill="#034694" stroke="#D2AE5E" strokeWidth="2.5" />
        <circle cx="30" cy="30" r="21.5" fill="#034694" stroke="#FFFFFF" strokeWidth="1" />
        <text x="30" y="15" fill="#FFFFFF" fontSize="5" fontWeight="800" textAnchor="middle" letterSpacing="0.1em">
          CHELSEA
        </text>
        <text x="30" y="50" fill="#D2AE5E" fontSize="4.5" fontWeight="700" textAnchor="middle" letterSpacing="0.1em">
          F.C.
        </text>
        {/* Lion Rampant Silhouette */}
        <g transform="translate(21, 19) scale(0.58)">
          <path
            d="M10 26C10 26 12 22 14 20C16 18 17 14 16 11C15 8 18 6 21 6C23 6 25 8 25 10C25 13 22 15 22 18C22 20 24 23 25 26L20 25C19 23 17 22 15 23L13 26H10Z"
            fill="#FFFFFF"
          />
          <path d="M21 7L24 10H18L21 7Z" fill="#D2AE5E" />
        </g>
      </svg>
    );
  }

  // Liverpool
  if (norm.includes('liverpool')) {
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M30 6C18 6 12 12 12 24C12 40 30 55 30 55C30 55 48 40 48 24C48 12 42 6 30 6Z"
          fill="#C8102E"
          stroke="#00B2A9"
          strokeWidth="2"
        />
        <text x="30" y="16" fill="#FEE12B" fontSize="5.5" fontWeight="800" textAnchor="middle">
          L.F.C.
        </text>
        {/* Liver Bird Silhouette */}
        <g transform="translate(22, 22) scale(0.55)">
          <path
            d="M15 4C14 4 12 6 12 9C12 12 15 15 15 19L11 26H19L18 20C20 18 23 14 22 10C21 6 18 4 15 4Z"
            fill="#FEE12B"
          />
        </g>
      </svg>
    );
  }

  // Default Club Crest
  const initials = teamName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 3)
    .join('')
    .toUpperCase();

  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="26" fill="#1A202C" stroke="#D2AE5E" strokeWidth="2.5" />
      <circle cx="30" cy="30" r="22" fill="#141721" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text
        x="30"
        y="34"
        fill="#FFFFFF"
        fontSize="13"
        fontWeight="800"
        textAnchor="middle"
        letterSpacing="0.05em"
        fontFamily="var(--font-mono, monospace)"
      >
        {initials}
      </text>
    </svg>
  );
};
