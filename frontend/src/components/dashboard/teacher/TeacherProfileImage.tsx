import React, { useState } from 'react';

interface TeacherProfileImageProps {
  firebaseUid: string;
}

const TeacherProfileImage: React.FC<TeacherProfileImageProps> = ({ firebaseUid }) => {
  const imageUrl = `/api/teachers/${firebaseUid}/profile-image`;
  const [imgError, setImgError] = useState(false);

  return (
    <img
      src={imgError ? '/default-profile.png' : imageUrl}
      alt="Profile"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
        display: 'block',
      }}
      onError={() => setImgError(true)}
    />
  );
};

export default TeacherProfileImage; 