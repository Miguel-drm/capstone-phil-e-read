import React, { useState } from 'react';
import UpcomingSessions from './UpcomingSessions';

interface StatCard {
  title: string;
  value: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

interface StatsCardsProps {
  stats: StatCard[];
  sessions: any[];
  showSessionsModal: boolean;
  setShowSessionsModal: (show: boolean) => void;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return 'fas fa-arrow-up';
      case 'negative':
        return 'fas fa-arrow-down';
      default:
        return 'fas fa-exclamation-circle';
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'text-emerald-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-amber-600';
    }
  };

  const getChangeBgColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-emerald-50';
      case 'negative':
        return 'bg-red-50';
      default:
        return 'bg-amber-50';
    }
  };

  return (
    <div className="relative mb-4">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-500 text-sm font-medium truncate mb-1">
                    {stat.title}
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 truncate">
                    {stat.value}
                  </h3>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center ${stat.iconColor} flex-shrink-0 ml-3 group-hover:scale-110 transition-transform duration-300`}>
                  <i className={`${stat.icon} text-lg`}></i>
                </div>
              </div>
              <div className={`mt-3 flex items-center ${getChangeBgColor(stat.changeType)} rounded-lg px-2 py-1`}>
                <i className={`${getChangeIcon(stat.changeType)} mr-1.5 text-xs ${getChangeColor(stat.changeType)}`}></i>
                <span className={`text-xs font-medium ${getChangeColor(stat.changeType)} truncate`}>
                  {stat.change}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsCards; 