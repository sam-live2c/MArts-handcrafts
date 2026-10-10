import React from 'react';

interface TimberCratePackagingIconProps {
  className?: string;
  size?: number;
}

export const TimberCratePackagingIcon: React.FC<TimberCratePackagingIconProps> = ({
  className = '',
  size = 20,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Timber-Crate Packaging"
      role="img"
    >
      {/* 1. Main Timber Crate Body (Warm Natural Cedar/Pine Wood) */}
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="1.5"
        fill="#B45309"
        stroke="#78350F"
        strokeWidth="1.2"
      />

      {/* 2. Horizontal Wood Planks / Slats */}
      {/* Top Slat */}
      <rect x="4.2" y="5.2" width="15.6" height="4.5" fill="#D97706" />
      <line x1="4.2" y1="9.7" x2="19.8" y2="9.7" stroke="#92400E" strokeWidth="1" />

      {/* Middle Slat */}
      <rect x="4.2" y="9.8" width="15.6" height="4.8" fill="#B45309" />
      <line x1="4.2" y1="14.6" x2="19.8" y2="14.6" stroke="#78350F" strokeWidth="1" />

      {/* Bottom Slat */}
      <rect x="4.2" y="14.7" width="15.6" height="4.3" fill="#D97706" />

      {/* Wood Grain Lines */}
      <line x1="6" y1="7.2" x2="10" y2="7.2" stroke="#F59E0B" strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />
      <line x1="14" y1="7.2" x2="18" y2="7.2" stroke="#F59E0B" strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />
      <line x1="5.5" y1="12" x2="9" y2="12" stroke="#F59E0B" strokeWidth="0.6" strokeLinecap="round" opacity="0.6" />
      <line x1="13" y1="16.8" x2="17.5" y2="16.8" stroke="#F59E0B" strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />

      {/* 3. Heavy-Duty Timber Diagonal Cross Battens */}
      <line
        x1="4.5"
        y1="5.5"
        x2="19.5"
        y2="18.5"
        stroke="#78350F"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="19.5"
        y1="5.5"
        x2="4.5"
        y2="18.5"
        stroke="#78350F"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 4. Industrial Steel Corner Brackets with Rivets */}
      {/* Top-Left Steel Bracket */}
      <path d="M3 4H7.5V6.5H5.5V8.5H3V4Z" fill="#475569" stroke="#334155" strokeWidth="0.5" />
      <circle cx="4.5" cy="5.5" r="0.6" fill="#CBD5E1" />

      {/* Top-Right Steel Bracket */}
      <path d="M21 4H16.5V6.5H18.5V8.5H21V4Z" fill="#475569" stroke="#334155" strokeWidth="0.5" />
      <circle cx="19.5" cy="5.5" r="0.6" fill="#CBD5E1" />

      {/* Bottom-Left Steel Bracket */}
      <path d="M3 20H7.5V17.5H5.5V15.5H3V20Z" fill="#475569" stroke="#334155" strokeWidth="0.5" />
      <circle cx="4.5" cy="18.5" r="0.6" fill="#CBD5E1" />

      {/* Bottom-Right Steel Bracket */}
      <path d="M21 20H16.5V17.5H18.5V15.5H21V20Z" fill="#475569" stroke="#334155" strokeWidth="0.5" />
      <circle cx="19.5" cy="18.5" r="0.6" fill="#CBD5E1" />

      {/* 5. Red "FRAGILE / CERAMICS" Stencil Badge on Timber */}
      <circle cx="12" cy="12" r="3.2" fill="#FEF2F2" stroke="#EF4444" strokeWidth="0.8" />
      {/* Fragile Glass / Pottery Stem Stencil */}
      <path
        d="M10.8 10.3C10.8 11.4 11.5 12 12 12C12.5 12 13.2 11.4 13.2 10.3H10.8Z"
        fill="#DC2626"
      />
      <line x1="12" y1="12" x2="12" y2="13.7" stroke="#DC2626" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="11.2" y1="13.7" x2="12.8" y2="13.7" stroke="#DC2626" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
};

export default TimberCratePackagingIcon;
