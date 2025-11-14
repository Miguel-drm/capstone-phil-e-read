import React from 'react';

interface AdminLoaderProps {
  label?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const AdminLoader: React.FC<AdminLoaderProps> = ({ 
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
    ? "min-h-screen bg-slate-50 flex items-center justify-center"
    : "flex flex-col items-center justify-center py-8";

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className={`animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 mx-auto ${sizeClasses[size]}`}></div>
        <p className="mt-4 text-slate-600 font-medium">{label}</p>
      </div>
    </div>
  );
};

export default AdminLoader;