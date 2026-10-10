import React from 'react';

interface LogoProps {
  variant?: 'light' | 'dark'; // 'light' for dark header, 'dark' for white/light background
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showCaption?: boolean;
  caption?: string;
  showStoreTag?: boolean;
}

const Logo: React.FC<LogoProps> = ({
  variant = 'dark',
  size = 'md',
  className = '',
  showCaption = false,
  caption = '',
  showStoreTag = true,
}) => {
  const heightConfig = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-14 sm:h-16',
  };

  const textConfig = {
    sm: 'text-xl sm:text-2xl',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-4xl sm:text-5xl',
  };

  const hClass = heightConfig[size] || heightConfig.md;
  const tClass = textConfig[size] || textConfig.md;

  const textColor = variant === 'light' ? 'text-amber-50' : 'text-[#2B221B]';
  const accentColor = variant === 'light' ? '#E07A5F' : '#B85D36';
  const clayColor = variant === 'light' ? '#F4F1DE' : '#81B29A';

  return (
    <div className={`inline-flex flex-col items-start select-none transition-transform active:scale-98 ${className}`}>
      <div className={`relative inline-flex items-center gap-2 ${hClass}`}>
        {/* MArts Handcrafted Pottery & Statue Amphora Emblem */}
        <svg
          viewBox="0 0 100 100"
          className="h-full w-auto aspect-square shrink-0 drop-shadow-xs"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Wheel-thrown pottery base & pedestal */}
          <ellipse cx="50" cy="88" rx="26" ry="6" fill={variant === 'light' ? 'rgba(255,255,255,0.2)' : '#E7D8CD'} />
          <path
            d="M 32 86 L 68 86 L 62 76 L 38 76 Z"
            fill={accentColor}
          />
          
          {/* Sculpted Amphora / Urn Body */}
          <path
            d="M 38 76 C 26 70, 20 54, 26 38 C 30 30, 40 28, 44 26 L 44 20 L 56 20 L 56 26 C 60 28, 70 30, 74 38 C 80 54, 74 70, 62 76 Z"
            fill={variant === 'light' ? '#E07A5F' : '#B85D36'}
          />

          {/* Clay Glaze Highlight Wave */}
          <path
            d="M 32 44 C 42 36, 58 48, 68 40 C 70 48, 66 58, 58 64 C 44 64, 34 54, 32 44 Z"
            fill={variant === 'light' ? '#F4F1DE' : '#E7B594'}
            opacity="0.9"
          />

          {/* Left Artisan Handle */}
          <path
            d="M 28 36 C 18 36, 16 48, 24 54"
            stroke={variant === 'light' ? '#F4F1DE' : '#8C3F1E'}
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Right Artisan Handle */}
          <path
            d="M 72 36 C 82 36, 84 48, 76 54"
            stroke={variant === 'light' ? '#F4F1DE' : '#8C3F1E'}
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Golden Sculptor Chisel / Spark Accent */}
          <circle cx="50" cy="14" r="3.5" fill="#D4A373" />
          <path d="M 50 8 L 50 12 M 45 10 L 48 12 M 55 10 L 52 12" stroke="#D4A373" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* MArts Wordmark */}
        <div className="flex flex-col justify-center leading-none">
          <div className="flex items-baseline">
            <span className={`${tClass} font-serif font-black tracking-tight ${textColor} leading-none`}>
              MArts
            </span>
            {showStoreTag && (
              <span className={`text-[10px] sm:text-xs font-semibold tracking-wider uppercase ml-1.5 px-1.5 py-0.5 rounded ${
                variant === 'light' 
                  ? 'bg-white/20 text-amber-100' 
                  : 'bg-[#F2E8E1] text-[#9C4320]'
              }`}>
                Studio
              </span>
            )}
          </div>
          {size !== 'sm' && (
            <span className={`text-[9px] sm:text-[10px] tracking-widest uppercase font-medium mt-0.5 ${
              variant === 'light' ? 'text-amber-200/80' : 'text-[#8C6D58]'
            }`}>
              Pottery &amp; Statues
            </span>
          )}
        </div>
      </div>

      {showCaption && caption && (
        <span className={`text-[10px] sm:text-xs font-medium tracking-wide mt-1 ${
          variant === 'light' ? 'text-amber-200/80' : 'text-[#8C6D58]'
        }`}>
          {caption}
        </span>
      )}
    </div>
  );
};

export default Logo;
