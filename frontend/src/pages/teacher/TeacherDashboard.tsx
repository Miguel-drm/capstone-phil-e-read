
import React, { useState } from 'react';
import TeacherDashboard from '@/components/dashboard/teacher/TeacherDashboard';

const TeacherDashboardPage: React.FC = () => {
  const [showSessionsModal, setShowSessionsModal] = useState(false);

  return <TeacherDashboard showSessionsModal={showSessionsModal} setShowSessionsModal={setShowSessionsModal} />;
};

export default TeacherDashboardPage; 
