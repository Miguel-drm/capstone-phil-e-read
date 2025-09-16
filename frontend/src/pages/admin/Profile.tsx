import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Routes, Route } from 'react-router-dom';
import ProfileOverviewAdmin from './ProfileOverviewAdmin';

const AdminProfile: React.FC = () => {
  useAuth();

  return (
    <Routes>
      <Route index element={<ProfileOverviewAdmin />} />
    </Routes>
  );
};

export default AdminProfile; 