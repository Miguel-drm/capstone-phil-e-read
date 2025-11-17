import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

const SyncTeacherProfile = () => {
  const { currentUser } = useAuth();

  useEffect(() => {
    const syncProfile = async () => {
      if (!currentUser) return;

      const providerProfile = currentUser.providerData?.[0];
      const payload = {
        firebaseUid: currentUser.uid,
        name: currentUser.displayName,
        email: currentUser.email,
        photoURL: currentUser.photoURL || providerProfile?.photoURL || '',
        providerId: providerProfile?.providerId,
        phoneNumber: currentUser.phoneNumber || providerProfile?.phoneNumber || '',
        metadata: {
          creationTime: currentUser.metadata?.creationTime,
          lastSignInTime: currentUser.metadata?.lastSignInTime
        }
      };

      try {
        const response = await fetch(`${API_BASE}/api/teachers/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to sync teacher profile:', response.status, errorText);
        } else {
          await response.json().catch(() => null);
        }
      } catch (error) {
        console.error('Error syncing teacher profile:', error);
      }
    };

    void syncProfile();
  }, [currentUser]);

  return null;
};

export default SyncTeacherProfile;