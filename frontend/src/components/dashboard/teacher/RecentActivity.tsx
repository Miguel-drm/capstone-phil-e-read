import React, { useEffect, useState } from 'react';
import { subscribeToRecentActivities, type ActivityItem } from '../../../services/activityService';
import { useAuth } from '../../../contexts/AuthContext';

const iconMap: Record<string, string> = {
  'reading-session': 'fas fa-book-open',
  'test': 'fas fa-clipboard-check',
  'student': 'fas fa-user-plus',
  'export': 'fas fa-file-export',
  'general': 'fas fa-bell'
};

const colorMap: Record<string, string> = {
  'reading-session': 'bg-blue-500',
  'test': 'bg-green-500',
  'student': 'bg-purple-500',
  'export': 'bg-yellow-500',
  'general': 'bg-gray-500'
};

export default function RecentActivity() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Temporarily disable activities to avoid permission errors
    // TODO: Re-enable when Firestore rules are deployed
    console.log('Activities feature temporarily disabled due to permission restrictions');
    setItems([]);
    
    // Uncomment this when rules are deployed:
    // const unsub = subscribeToRecentActivities(currentUser.uid, setItems);
    // return () => unsub();
  }, [currentUser?.uid]);

  return (
    <div className="lg:col-span-2 bg-white rounded-lg p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 space-y-2 sm:space-y-0">
        <h3 className="text-base md:text-lg font-semibold text-[#2C3E50]">Recent Activity</h3>
      </div>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        <div className="space-y-4 md:space-y-6">
          {items.length === 0 && (
            <div className="text-sm text-gray-500">No activity yet. Actions you take will appear here in real time.</div>
          )}
          {items.map((item) => (
            <div key={item.id} className="relative pl-8 md:pl-10">
              <div className={`absolute left-0 top-1 w-6 h-6 md:w-8 md:h-8 rounded-full ${colorMap[item.type || 'general']} flex items-center justify-center text-white`}>
                <i className={`${iconMap[item.type || 'general']} text-xs md:text-sm`}></i>
              </div>
              <div>
                <h4 className="font-medium text-[#2C3E50] text-sm md:text-base">{item.title}</h4>
                {item.description && (
                  <p className="text-xs md:text-sm text-gray-500 mt-1">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


