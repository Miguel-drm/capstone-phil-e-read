import React from 'react';

interface LoaderProps {
  label?: string;
  size?: number;
}

const Loader: React.FC<LoaderProps> = ({ label = 'Loading...', size = 32 }) => (
  <div className="flex flex-col items-center justify-center py-4">
    <span
      className="animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"
      style={{ width: size, height: size, borderTopColor: '#3b82f6' }}
    />
    {label && <span className="mt-2 text-gray-600 text-sm">{label}</span>}
  </div>
);

export default Loader; 