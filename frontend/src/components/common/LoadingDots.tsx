import React from 'react';

interface LoadingDotsProps {
  color?: string;
  className?: string;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({ 
  color = 'text-primary-600',
  className = '' 
}) => {
  return (
    <div className={`loading-dots ${color} ${className}`} role="status" aria-label="Loading">
      <span className="loading-dot"></span>
      <span className="loading-dot"></span>
      <span className="loading-dot"></span>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingDots;
