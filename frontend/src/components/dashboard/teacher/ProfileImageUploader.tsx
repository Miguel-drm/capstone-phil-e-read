import React, { useRef } from 'react';

interface ProfileImageUploaderProps {
  firebaseUid: string;
  onUploadSuccess?: () => void;
}

const ProfileImageUploader: React.FC<ProfileImageUploaderProps> = ({ firebaseUid, onUploadSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`http://localhost:5000/api/teachers/firebase/${firebaseUid}/profile-image`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.success) {
      alert('Profile image uploaded!');
      if (onUploadSuccess) onUploadSuccess();
    } else {
      alert('Upload failed: ' + (data.error || 'Unknown error'));
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button onClick={() => fileInputRef.current?.click()}>
        Upload Profile Image
      </button>
    </div>
  );
};

export default ProfileImageUploader; 