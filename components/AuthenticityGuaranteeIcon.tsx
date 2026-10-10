import React from 'react';

interface AuthenticityGuaranteeIconProps {
  className?: string;
  size?: number;
}

export const AuthenticityGuaranteeIcon: React.FC<AuthenticityGuaranteeIconProps> = ({
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
      aria-label="Authenticity Guarantee"
      role="img"
    >
      {/* 1. Golden Ceremonial Ribbon Tails (Guild Certificate Quality) */}
      {/* Left ribbon tail */}
      <path
        d="M8.5 13.5L6.5 21.5L9.5 20L12 21.5L10.5 13.5"
        fill="#F59E0B"
        stroke="#D97706"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Left ribbon crease shadow */}
      <path
        d="M8.5 13.5L7.5 17.5L9.5 20"
        stroke="#B45309"
        strokeWidth="0.6"
        opacity="0.6"
      />

      {/* Right ribbon tail */}
      <path
        d="M15.5 13.5L13.5 21.5L16 20L19 21.5L17 13.5"
        fill="#D97706"
        stroke="#B45309"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Right ribbon highlight */}
      <path
        d="M15.5 13.5L17.5 17.5L16 20"
        stroke="#FDE68A"
        strokeWidth="0.6"
        opacity="0.7"
      />

      {/* 2. Scalloped Royal Crimson Artisan Wax Seal / Rosette */}
      {/* Outer scalloped petals */}
      <path
        d="M12 2C13.2 2 14.1 2.8 15.2 3.2C16.4 3.7 17.5 3.6 18.4 4.5C19.3 5.4 19.3 6.6 20 7.7C20.6 8.8 21.6 9.5 21.8 10.7C22.1 12 21.4 13.1 21.2 14.3C20.9 15.5 21.4 16.7 20.8 17.8C20.2 18.9 18.9 19.3 18 20.2C17.1 21 16.5 22.2 15.3 22.5C14.1 22.8 13.1 22 11.8 22C10.6 22 9.6 22.8 8.4 22.5C7.2 22.2 6.6 21 5.7 20.2C4.8 19.3 3.5 18.9 2.9 17.8C2.3 16.7 2.8 15.5 2.5 14.3C2.3 13.1 1.6 12 1.9 10.7C2.1 9.5 3.1 8.8 3.7 7.7C4.4 6.6 4.4 5.4 5.3 4.5C6.2 3.6 7.3 3.7 8.5 3.2C9.6 2.8 10.5 2 12 2Z"
        fill="#DC2626"
        stroke="#991B1B"
        strokeWidth="0.8"
      />

      {/* Wax Seal Inner Rim (Rich Carved Relief) */}
      <circle cx="12" cy="11.5" r="7.2" fill="#B91C1C" />
      <circle
        cx="12"
        cy="11.5"
        r="6.4"
        stroke="#FEF08A"
        strokeWidth="0.9"
        strokeDasharray="1.5 1"
      />

      {/* 3. Artisan Guild Master Hallmark (Vase & Verification Checkmark) */}
      {/* Master wheel-thrown pottery amphora silhouette in gold */}
      <path
        d="M10.2 8.5C10.2 7.8 10.8 7.5 12 7.5C13.2 7.5 13.8 7.8 13.8 8.5C13.8 9.2 13.3 9.6 13.5 10.5C13.8 11.6 14.5 12.2 14.5 13.2C14.5 14.4 13.4 14.8 12 14.8C10.6 14.8 9.5 14.4 9.5 13.2C9.5 12.2 10.2 11.6 10.5 10.5C10.7 9.6 10.2 9.2 10.2 8.5Z"
        fill="#FDE047"
        opacity="0.4"
      />

      {/* Prominent White Crisp Authenticity Guarantee Checkmark */}
      <path
        d="M9.2 11.6L11.2 13.6L15.2 9.4"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Wax gloss highlights */}
      <ellipse cx="8.5" cy="7" rx="1.6" ry="0.8" fill="#FCA5A5" opacity="0.6" transform="rotate(-30 8.5 7)" />
      <circle cx="17" cy="7.5" r="0.8" fill="#FEF08A" />
    </svg>
  );
};

export default AuthenticityGuaranteeIcon;
