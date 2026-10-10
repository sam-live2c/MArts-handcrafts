import React from 'react';

interface CircleLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  className?: string;
  fullPage?: boolean;
}

export const CircleLoader: React.FC<CircleLoaderProps> = ({
  size = 'md',
  label,
  className = '',
  fullPage = false
}) => {
  const sizeMap = {
    sm: {
      spinner: 'w-6 h-6',
      strokeWidth: 3,
      r: 10,
      cx: 12,
      cy: 12
    },
    md: {
      spinner: 'w-10 h-10',
      strokeWidth: 3.5,
      r: 16,
      cx: 20,
      cy: 20
    },
    lg: {
      spinner: 'w-14 h-14',
      strokeWidth: 4,
      r: 22,
      cx: 28,
      cy: 28
    },
    xl: {
      spinner: 'w-16 h-16',
      strokeWidth: 4,
      r: 26,
      cx: 32,
      cy: 32
    }
  };

  const currentSize = sizeMap[size];

  const content = (
    <div className={`flex flex-col items-center justify-center gap-3.5 select-none ${className}`}>
      {/* Smooth Circular SVG Spinner */}
      <div className={`relative ${currentSize.spinner}`}>
        <svg
          className="w-full h-full animate-spin"
          viewBox={`0 0 ${currentSize.cx * 2} ${currentSize.cy * 2}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Loading"
        >
          {/* Subtle background track */}
          <circle
            cx={currentSize.cx}
            cy={currentSize.cy}
            r={currentSize.r}
            stroke="#F2E8DE"
            strokeWidth={currentSize.strokeWidth}
            className="opacity-70"
          />
          {/* Active rotating terracotta arc */}
          <circle
            cx={currentSize.cx}
            cy={currentSize.cy}
            r={currentSize.r}
            stroke="#C85A32"
            strokeWidth={currentSize.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={currentSize.r * 2 * Math.PI}
            strokeDashoffset={currentSize.r * 2 * Math.PI * 0.72}
          />
        </svg>
      </div>

      {label && (
        <p className="text-xs font-medium text-[#735A4C] tracking-wide animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF8F5] select-none p-6">
        {content}
      </div>
    );
  }

  return content;
};

/**
 * Full screen circular loading animation for page navigations.
 * Pure circle spinner, centered, no text/labels.
 */
export const FullScreenCircleLoader: React.FC<{ overlay?: boolean; bgClassName?: string }> = ({
  overlay = false,
  bgClassName = 'bg-[#FAF8F5]'
}) => {
  return (
    <div
      className={`${
        overlay ? 'fixed inset-0 z-[999]' : 'min-h-screen w-full'
      } flex items-center justify-center ${bgClassName} select-none`}
      role="status"
      aria-label="Loading"
    >
      <div className="relative w-12 h-12 sm:w-14 sm:h-14">
        <svg
          className="w-full h-full animate-spin"
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle background track */}
          <circle
            cx="28"
            cy="28"
            r="22"
            stroke="#F2E8DE"
            strokeWidth="3.5"
            className="opacity-70"
          />
          {/* Active rotating brand terracotta arc */}
          <circle
            cx="28"
            cy="28"
            r="22"
            stroke="#C85A32"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={22 * 2 * Math.PI}
            strokeDashoffset={22 * 2 * Math.PI * 0.72}
          />
        </svg>
      </div>
    </div>
  );
};

export default CircleLoader;
