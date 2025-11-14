import React from 'react';

interface TeacherLoaderProps {
  label?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const TeacherLoader: React.FC<TeacherLoaderProps> = ({ 
  label = 'Loading...', 
  fullScreen = false,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12', 
    lg: 'h-16 w-16'
  };

  const containerClasses = fullScreen 
    ? "min-h-screen bg-gray-50 flex items-center justify-center"
    : "flex flex-col items-center justify-center py-8";

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className={`animate-spin rounded-full border-4 border-gray-200 border-t-green-600 mx-auto ${sizeClasses[size]}`}></div>
        <p className="mt-4 text-gray-600 font-medium">{label}</p>
      </div>
    </div>
  );
};

export default TeacherLoader;