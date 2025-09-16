import React from 'react';

interface Session {
  id: string;
  title: string;
  time: string;
  type: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  students: string[];
  studentCount: number;
  level?: string;
}

interface UpcomingSessionsProps {
  sessions: Session[];
}

const UpcomingSessions: React.FC<UpcomingSessionsProps> = ({ sessions }) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 lg:mb-6 space-y-3 sm:space-y-0">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Upcoming Sessions</h3>
          <p className="text-sm text-gray-500">Your scheduled activities</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg shadow transition-all duration-200 text-sm font-semibold self-start sm:self-auto">
          <i className="fas fa-list mr-2"></i>
          View All
        </button>
      </div>
      <div className="space-y-3 lg:space-y-4">
        {sessions.map((session) => (
          <div key={session.id} className="group/session flex items-start p-3 sm:p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white mr-3 sm:mr-4 flex-shrink-0 group-hover/session:scale-110 transition-transform duration-200`}>
              <i className={`${session.icon} text-sm sm:text-base`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate group-hover/session:text-blue-600 transition-colors duration-200">
                {session.title.replace('Group Reading - ', '')}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 flex items-center">
                <i className="fas fa-clock mr-1.5 text-xs"></i>
                {session.time}
              </p>
              {session.students.length > 0 ? (
                <div className="flex items-center mt-2 sm:mt-3">
                  <div className="flex -space-x-1 sm:-space-x-2">
                    {session.students.slice(0, 3).map((student, index) => (
                      <div key={index} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-xs text-white font-medium border-2 border-white shadow-sm">
                        {student}
                      </div>
                    ))}
                    {session.students.length > 3 && (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs text-white font-medium border-2 border-white shadow-sm">
                        +{session.students.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 ml-2 sm:ml-3 font-medium">
                    {session.studentCount} students
                  </span>
                </div>
              ) : (
                session.level && (
                  <div className="mt-2 sm:mt-3">
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                      <i className="fas fa-star mr-1 text-xs"></i>
                      {session.level}
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="ml-2 opacity-0 group-hover/session:opacity-100 transition-opacity duration-200">
              <i className="fas fa-chevron-right text-gray-400 text-sm"></i>
            </div>
          </div>
        ))}
      </div>
      
      {/* Quick Action */}
      <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-100">
        <button className="w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all duration-200 group shadow font-semibold">
          <i className="fas fa-plus mr-2 text-sm group-hover:scale-110 transition-transform duration-200"></i>
          <span className="font-medium text-sm">Schedule New Session</span>
        </button>
      </div>
    </>
  );
};

export default UpcomingSessions; 