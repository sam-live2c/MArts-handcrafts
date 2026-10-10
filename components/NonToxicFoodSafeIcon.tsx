import React from 'react';

interface NonToxicFoodSafeIconProps {
  className?: string;
  size?: number;
}

export const NonToxicFoodSafeIcon: React.FC<NonToxicFoodSafeIconProps> = ({
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
      aria-label="100% Non-Toxic & Food-Safe"
      role="img"
    >
      {/* 1. Drinking Vessel / Wine Glass (Beverage & Drinking Water Contact Safe) */}
      <path
        d="M3.5 6.5C3.5 9.4 5.6 11 5.8 12.5V17.5"
        stroke="#0284C7"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 6.5C8.2 9.4 6 11 5.8 12.5"
        stroke="#0284C7"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6.5H8.2"
        stroke="#0284C7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Stem Base */}
      <path
        d="M4.2 17.5H7.4"
        stroke="#0284C7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Glass water highlight reflection */}
      <path
        d="M4.1 8.2C4.7 9.3 5.4 9.6 5.8 9.6C6.3 9.6 7 9.3 7.6 8.2"
        stroke="#38BDF8"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* 2. Culinary Fork (Food Contact Safe Tableware) */}
      <path
        d="M9.8 6.5V9.8C9.8 10.8 10.6 11.5 11.4 11.7V17.5"
        stroke="#475569"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 6.5V9.8C13 10.8 12.2 11.5 11.4 11.7"
        stroke="#475569"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Middle prong */}
      <path
        d="M11.4 6.5V9.5"
        stroke="#475569"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* 3. Organic Non-Toxic Green Leaf (100% Lead-Free & Cadmium-Free Glazes) */}
      <path
        d="M13.2 12.8C13.2 8.2 16.6 4.2 21.2 3.2C21.2 7.8 17.8 12.2 13.2 12.8Z"
        fill="#22C55E"
      />
      <path
        d="M13.2 12.8C15.8 9.8 18.8 6.2 21.2 3.2"
        stroke="#15803D"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M15.4 10.2C15.8 8.4 17.6 6.4 19.6 5.2"
        stroke="#86EFAC"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* 4. 100% Certified Food-Safe & Non-Toxic Guarantee Badge */}
      <circle cx="18.5" cy="17.5" r="3.5" fill="#16A34A" />
      <path
        d="M16.8 17.5L18 18.7L20.2 16.3"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default NonToxicFoodSafeIcon;
