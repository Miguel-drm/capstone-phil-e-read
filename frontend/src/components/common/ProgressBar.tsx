import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  backgroundColor?: string;
  height?: string;
  animated?: boolean;
  indeterminate?: boolean;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = 'bg-primary-600',
  backgroundColor = 'bg-gray-200',
  height = 'h-2',
  animated = false,
  indeterminate = false,
  className = ''
}) => {
  return (
    <div 
      className={`relative ${height} ${backgroundColor} rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <div className={`absolute top-0 left-0 h-full w-full ${color} progress-indeterminate`}></div>
      ) : (
        <div
          className={`absolute top-0 left-0 h-full ${color} rounded-full ${animated ? 'progress-bar-animated' : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        ></div>
      )}
    </div>
  );
};

export default ProgressBar;
