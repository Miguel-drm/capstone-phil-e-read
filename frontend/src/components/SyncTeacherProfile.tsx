import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SyncTeacherProfile = () => {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetch('http://localhost:5000/api/teachers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: currentUser.uid,
          name: currentUser.displayName,
          email: currentUser.email,
        }),
      });
    }
  }, [currentUser]);

  return null;
};

export default SyncTeacherProfile; 