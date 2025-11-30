import React from 'react';
import type { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  text, 
  position = 'top',
  className = '' 
}) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-4 border-transparent border-l-gray-900',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-gray-900',
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      {/* Tooltip */}
      <div 
        className={`absolute ${positionClasses[position]} px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50`}
      >
        {text}
        {/* Arrow */}
        <div className={`absolute ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};

export default Tooltip;
