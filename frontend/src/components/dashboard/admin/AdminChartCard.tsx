import React from 'react';

interface AdminChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const AdminChartCard: React.FC<AdminChartCardProps> = ({ 
  title, 
  description, 
  children, 
  className = '' 
}) => {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default AdminChartCard;
