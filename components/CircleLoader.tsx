import React from 'react';

interface CircleLoaderProps {
  size?: 'sm' | 'md' | 'lg';
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
            strokeDashoffset={currentSize.r * 2 * Math.PI * 0.7}
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
      <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
        {content}
      </div>
    );
  }

  return content;
};

export default CircleLoader;
