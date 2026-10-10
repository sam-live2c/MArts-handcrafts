import React from 'react';

interface FairWageGuildIconProps {
  className?: string;
  size?: number;
}

export const FairWageGuildIcon: React.FC<FairWageGuildIconProps> = ({
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
      aria-label="Fair-Wage Guild Support"
      role="img"
    >
      {/* 1. Generational Fair-Trade Green Laurel Sprigs (Prosperity & Ethics) */}
      <path
        d="M4.5 12C3.2 10.5 3 8 4 6.2C5.5 7.5 5.8 9.8 5.2 11.5"
        fill="#22C55E"
        opacity="0.9"
      />
      <path
        d="M3.2 15.5C2.2 14.2 2.2 12.2 3.2 11C4.2 12 4.5 13.8 4 15.2"
        fill="#16A34A"
      />
      <path
        d="M19.5 12C20.8 10.5 21 8 20 6.2C18.5 7.5 18.2 9.8 18.8 11.5"
        fill="#22C55E"
        opacity="0.9"
      />
      <path
        d="M20.8 15.5C21.8 14.2 21.8 12.2 20.8 11C19.8 12 19.5 13.8 20 15.2"
        fill="#16A34A"
      />

      {/* 2. Radiant Fair-Wage Golden Coin / Medallion */}
      {/* Outer Coin Rim Shadow */}
      <circle cx="12" cy="10" r="6" fill="#D97706" />
      {/* Golden Coin Face */}
      <circle cx="12" cy="10" r="5.2" fill="#F59E0B" />
      {/* Inner Engraved Border */}
      <circle
        cx="12"
        cy="10"
        r="4.2"
        stroke="#FDE68A"
        strokeWidth="0.75"
        strokeDasharray="1.2 0.8"
      />

      {/* Fairness & Living Wage Scales of Balance in Rich Mahogany Gold */}
      <path
        d="M10 7.8H14"
        stroke="#78350F"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M12 7.2V12.8"
        stroke="#78350F"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M10.5 12.8H13.5"
        stroke="#78350F"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Left scale pan */}
      <path
        d="M9.2 8.5L8.5 10.2H10.5L9.8 8.5"
        stroke="#78350F"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Right scale pan */}
      <path
        d="M14.2 8.5L13.5 10.2H15.5L14.8 8.5"
        stroke="#78350F"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Coin Top Shine Highlight */}
      <ellipse cx="10" cy="7.2" rx="1.5" ry="0.8" fill="#FEF08A" opacity="0.8" />
      <path
        d="M15.5 5.5L16 6.8L17.3 7.3L16 7.8L15.5 9.1L15 7.8L13.7 7.3L15 6.8L15.5 5.5Z"
        fill="#FDE047"
      />

      {/* 3. Artisan Supporting Hands (Warm Terracotta / Skin Tones cupping from below) */}
      {/* Left supporting artisan hand */}
      <path
        d="M4.5 19.5C5.8 17.5 8 16.5 10.5 16.2C11 16.1 11.2 16.6 10.8 17C9.2 17.6 7.8 18.8 6.8 21.2C6.5 21.8 5.6 21.5 5.2 21L4.5 19.5Z"
        fill="#C2410C"
      />
      <path
        d="M5.5 18.8C7 17.2 9 16.6 11.2 16.5"
        stroke="#FB923C"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Right supporting artisan hand */}
      <path
        d="M19.5 19.5C18.2 17.5 16 16.5 13.5 16.2C13 16.1 12.8 16.6 13.2 17C14.8 17.6 16.2 18.8 17.2 21.2C17.5 21.8 18.4 21.5 18.8 21L19.5 19.5Z"
        fill="#C2410C"
      />
      <path
        d="M18.5 18.8C17 17.2 15 16.6 12.8 16.5"
        stroke="#FB923C"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default FairWageGuildIcon;
