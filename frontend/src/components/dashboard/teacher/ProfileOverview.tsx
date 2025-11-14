import React from 'react';
import ProfileImageUploader from './ProfileImageUploader';
import TeacherProfileImage from './TeacherProfileImage';
import TeacherLoader from '../../teacher/TeacherLoader';
import { useAuth } from '../../../contexts/AuthContext';

const ProfileOverview: React.FC = () => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;

  const refetchTeacherData = () => window.location.reload();

  if (!firebaseUid) return <TeacherLoader label="Loading profile..." />;

  return (
    <div>
      <TeacherProfileImage firebaseUid={firebaseUid} />
      <ProfileImageUploader firebaseUid={firebaseUid} onUploadSuccess={refetchTeacherData} />
    </div>
  );
};

export default ProfileOverview; 