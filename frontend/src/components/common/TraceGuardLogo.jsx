import React from 'react';

export const TraceGuardLogo = ({
  variant = 'full', // 'full' | 'icon' | 'compact'
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  showTagline = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const taglineSizes = {
    sm: 'text-[8.5px]',
    md: 'text-[9.5px]',
    lg: 'text-[11px]',
  };

  const ShieldIcon = (
    <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(7,139,255,0.4)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldGradComp" x1="20" y1="15" x2="100" y2="105" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00CFFF" />
            <stop offset="50%" stopColor="#078BFF" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="fingerprintGradComp" x1="40" y1="35" x2="80" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#00CFFF" />
            <stop offset="100%" stopColor="#078BFF" />
          </linearGradient>
        </defs>

        {/* Outer Orbital Scanning Ring */}
        <circle cx="60" cy="60" r="54" stroke="#078BFF" strokeOpacity="0.25" strokeWidth="1.2" strokeDasharray="3 4" />
        <circle cx="60" cy="60" r="54" stroke="#00CFFF" strokeWidth="2" strokeDasharray="25 150" strokeLinecap="round" />
        <circle cx="60" cy="60" r="54" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="15 160" strokeDashoffset="-70" strokeLinecap="round" />

        {/* Scanning Brackets */}
        <path d="M 12 24 L 12 12 L 24 12" stroke="#078BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 108 24 L 108 12 L 96 12" stroke="#078BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 12 96 L 12 108 L 24 108" stroke="#078BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 108 96 L 108 108 L 96 108" stroke="#078BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Outer Futuristic Shield Contour */}
        <path
          d="M 60 16 L 96 30 L 96 62 C 96 87 60 102 60 102 C 60 102 24 87 24 62 L 24 30 Z"
          fill="#101214"
          stroke="url(#shieldGradComp)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Inner Shield Trim */}
        <path
          d="M 60 23 L 89 35 L 89 61 C 89 81 60 94 60 94 C 60 94 31 81 31 61 L 31 35 Z"
          fill="#151719"
          stroke="#292D32"
          strokeWidth="1.2"
        />

        {/* Digital Fingerprint */}
        <g stroke="url(#fingerprintGradComp)" strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M 60 45 C 57 45 55 47 55 51 C 55 57 59 62 60 67 C 60.5 70 60 74 58 78" />
          <path d="M 51 53 C 51 46 55 41 60 41 C 65 41 68 45 68 50 C 68 57 65 62 65 68 C 65 72 67 76 68 80" />
          <path d="M 46 62 C 46 51 52 37 60 37 C 68 37 73 43 73 51 C 73 59 69 66 70 73 C 70.5 76 72 79 74 81" />
          <path d="M 42 70 C 42 56 48 33 60 33 C 71 33 78 40 78 51 C 78 61 74 70 75 78 C 75.5 81 77 84 80 86" />
          <circle cx="60" cy="51" r="1.5" fill="#00CFFF" stroke="none" />
        </g>

        {/* Scanning Laser Line */}
        <line x1="32" y1="58" x2="88" y2="58" stroke="#00CFFF" strokeWidth="1" strokeOpacity="0.8" strokeDasharray="4 2" />
        <circle cx="60" cy="58" r="2.5" fill="#FFFFFF" />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{ShieldIcon}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {ShieldIcon}
      <div className="flex flex-col text-left">
        <div className="flex items-center tracking-wider">
          <span className={`font-black ${textSizes[size]} text-white`}>TRACE</span>
          <span className={`font-black ${textSizes[size]} text-[#078BFF] ml-1.5`}>GUARD</span>
        </div>
        {showTagline && (
          <span className={`${taglineSizes[size]} font-mono font-medium text-[#9CA3AF] tracking-[0.2em] uppercase`}>
            YOUR DIGITAL LIFE. YOUR CONTROL.
          </span>
        )}
      </div>
    </div>
  );
};

