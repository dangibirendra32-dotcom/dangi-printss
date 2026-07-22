import React from 'react';

export const PETROL_LOGOS = {
  JIO_BP: (
    <div className="flex flex-col items-center justify-center w-full h-full p-2 bg-white">
      <svg viewBox="0 0 350 200" className="w-[100%] h-auto max-w-[200px] max-h-[120px] transition-transform duration-300 hover:scale-105">
        {/* Left Side: Jio Green Disk */}
        <circle cx="95" cy="100" r="72" fill="#009944" />
        
        {/* Jio branded text custom vector */}
        <g transform="translate(48, 70)">
          {/* Letter J */}
          <path d="M26 12 C26 7 30 5 35 5 C40 5 43 8 43 14 L43 55 C43 72 31 82 10 82 C-5 82 -11 73 -11 65 C-11 60 -7 56 -1 56 C6 56 8 61 11 63 C14 65 17 67 22 67 C30 67 33 61 33 49 L33 22 Z" fill="#FFFFFF" />
          {/* Dot of i */}
          <circle cx="56" cy="8" r="8" fill="#FFFFFF" />
          {/* Body of i */}
          <rect x="49" y="22" width="14" height="42" rx="4" fill="#FFFFFF" />
          {/* Letter o with concentric circles */}
          <circle cx="98" cy="43" r="21" fill="none" stroke="#FFFFFF" strokeWidth="14" />
        </g>
        
        {/* Middle: Vertical Separator Line */}
        <line x1="185" y1="40" x2="185" y2="160" stroke="#009944" strokeWidth="4" strokeLinecap="round" />
        
        {/* Right Side: BP Blossom */}
        <g transform="translate(255, 115)">
          {/* Outer Dark Green petals */}
          {Array.from({ length: 18 }).map((_, i) => (
            <path
              key={`outer-${i}`}
              d="M 0,-42 C -8,-22 -4,0 0,0 C 4,0 8,-22 0,-42 Z"
              fill="#009944"
              transform={`rotate(${i * 20})`}
            />
          ))}
          {/* Middle Light Green petals */}
          {Array.from({ length: 18 }).map((_, i) => (
            <path
              key={`mid-${i}`}
              d="M 0,-33 C -6,-17 -3,0 0,0 C 3,0 6,-17 0,-33 Z"
              fill="#7AC143"
              transform={`rotate(${i * 20 + 10})`}
            />
          ))}
          {/* Inner Yellow petals */}
          {Array.from({ length: 18 }).map((_, i) => (
            <path
              key={`inner-${i}`}
              d="M 0,-24 C -4,-12 -2,0 0,0 C 2,0 4,-12 0,-24 Z"
              fill="#FFF200"
              transform={`rotate(${i * 20})`}
            />
          ))}
          {/* Center White starburst */}
          <circle cx="0" cy="0" r="10" fill="#FFFFFF" />
          {Array.from({ length: 12 }).map((_, i) => (
            <path
              key={`star-${i}`}
              d="M 0,-14 L 2,0 L -2,0 Z"
              fill="#FFFFFF"
              transform={`rotate(${i * 30})`}
            />
          ))}
        </g>
        
        {/* bp text at top right of blossom */}
        <text 
          x="302" 
          y="70" 
          fontSize="48" 
          fontWeight="900" 
          fill="#009944" 
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-3px' }}
        >
          bp
        </text>
      </svg>
    </div>
  ),
  HP: (
    <div className="flex flex-col items-center justify-center w-full h-full p-1 bg-white">
      <svg viewBox="0 0 180 210" className="w-[100%] h-auto max-w-[155px] max-h-[180px] transition-transform duration-300 hover:scale-105 shadow-[0_2px_10px_rgba(0,0,0,0.06)] rounded-xl border border-[#00529B] bg-white">
        {/* Red branding header strip */}
        <rect x="0" y="0" width="180" height="40" fill="#E41E26" />
        <text 
          x="90" 
          y="25" 
          fontSize="12.5" 
          fontWeight="900" 
          textAnchor="middle" 
          fill="#FFFFFF" 
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '0.2px' }}
        >
          हिन्दुस्तान पेट्रोलियम
        </text>
        
        {/* Main Logo Sphere Graphic */}
        <g transform="translate(90, 122)">
          {/* Shield/Circle Boundary */}
          <circle cx="0" cy="0" r="50" fill="#FFFFFF" stroke="#00529B" strokeWidth="4" />
          
          {/* Inner Liquid Spray Wings (Gushing streams) */}
          <path d="M-43,6 C-27,-10 27,-10 43,6 C18,-3 -18,-3 -43,6 Z" fill="#00529B" />
          <path d="M-38,18 C-20,0 20,0 38,18 C18,7 -18,7 -38,18 Z" fill="#00529B" />
          <path d="M-5,41 L5,41 L0,49 Z" fill="#00529B" />
          
          {/* HP Red Bold lettering */}
          <text 
            x="0" 
            y="5" 
            fontSize="45" 
            fontWeight="950" 
            textAnchor="middle" 
            fill="#E41E26" 
            style={{ fontFamily: 'Arial Black, Impact, sans-serif', letterSpacing: '-1.5px' }}
          >
            HP
          </text>
        </g>
      </svg>
    </div>
  ),
  BHARAT_PETROLEUM: (
    <div className="flex flex-col items-center justify-center w-full h-full p-1 bg-white">
      <svg viewBox="0 0 180 210" className="w-[100%] h-auto max-w-[155px] max-h-[180px] transition-transform duration-300 hover:scale-105 shadow-[0_2px_10px_rgba(0,0,0,0.06)] rounded-xl border border-[#FFD200] overflow-hidden bg-white">
        {/* White header region for blue logo drop */}
        <rect x="0" y="0" width="180" height="120" fill="#FFFFFF" />
        
        <g transform="translate(90, 60)">
          {/* Blue outer sphere */}
          <circle cx="0" cy="0" r="46" fill="#0071BC" />
          {/* White inner concentric ring */}
          <circle cx="0" cy="0" r="39" fill="none" stroke="#FFFFFF" strokeWidth="3" />
          {/* Yellow swirling flame/drop design */}
          <path 
            d="M-20,-2 C-26,14 -16,26 -2,26 C16,26 25,12 25,-8 C25,-24 10,-26 -2,-22 C-10,-18 -12,-8 -5,-8 C2,-8 5,-15 10,-13 C15,-11 15,-2 11,8 C8,16 -7,20 -12,9 C-15,1 -10,-4 -18,-2" 
            fill="#FFD200" 
          />
        </g>

        {/* Yellow BPCL Nameplate */}
        <rect x="0" y="118" width="180" height="75" fill="#FFD200" />
        <text 
          x="90" 
          y="148" 
          fontSize="24" 
          fontWeight="950" 
          textAnchor="middle" 
          fill="#0071BC" 
          style={{ fontFamily: 'Arial Black, Impact, sans-serif', letterSpacing: '0.5px' }}
        >
          Bharat
        </text>
        <text 
          x="90" 
          y="178" 
          fontSize="18" 
          fontWeight="950" 
          textAnchor="middle" 
          fill="#0071BC" 
          style={{ fontFamily: 'Arial Black, Impact, sans-serif', letterSpacing: '0.5px' }}
        >
          Petroleum
        </text>
        
        {/* Blue foot bar */}
        <rect x="0" y="193" width="180" height="17" fill="#0071BC" />
      </svg>
    </div>
  )
};

export const COMMON_ADDRESSES = {
  MART: "SuperMart Central, 12th Main, Indiranagar, Bengaluru - 560038",
  RESTAURANT: "The Spicy Bistro, Park Street, Kolkata - 700016",
  PETROL: "Near the bypass madgao road"
};
