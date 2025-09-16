import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Routes, Route } from 'react-router-dom';
import ProfileOverviewTeacher from './ProfileOverviewTeacher';

const TeacherProfile: React.FC = () => {
  useAuth();

  return (
    <Routes>
      <Route index element={<ProfileOverviewTeacher />} />
    </Routes>
  );
};

export default TeacherProfile; 