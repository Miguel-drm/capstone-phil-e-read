import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { showSuccess, showError } from '../../services/alertService';
import Cropper from 'react-easy-crop';
import { updateUserProfile } from '../../services/authService';
import { BannerContext } from '../../components/layout/DashboardLayout';

const bannerUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80';

const defaultBanners = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
];

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to get cropped image as blob
async function getCroppedImg(imageSrc: string, crop: any) {
  const createImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', error => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  canvas.width = crop.width;
  canvas.height = crop.height;
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas is empty'));
    }, 'image/png');
  });
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, currentUser, refreshUserProfile } = useAuth();
  const firebaseUid = currentUser?.uid;
  const [editAvatar, setEditAvatar] = useState<string | undefined>(undefined);
  const [editBanner, setEditBanner] = useState<string>(bannerUrl);
  const [editBio, setEditBio] = useState(userProfile?.bio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [errors, setErrors] = useState<{ phoneNumber?: string; school?: string; gradeLevel?: string }>({});

  // Cropper modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Add local state for editing profile fields
  const [editProfile, setEditProfile] = useState({
    phoneNumber: userProfile?.phoneNumber || '',
    school: userProfile?.school || '',
    gradeLevel: userProfile?.gradeLevel || '',
  });

  // Add new state for banner picker
  const [showBannerPicker, setShowBannerPicker] = useState(false);

  const { banner, setBanner } = useContext(BannerContext);

  // Fetch current profile image from backend when modal opens
  useEffect(() => {
    if (!isOpen || !firebaseUid) return;
    async function fetchProfileImage() {
      try {
        const res = await fetch(`/api/teachers/${firebaseUid}/profile-image`);
        const data = await res.json();
        if (data && data.profileImage) {
          setEditAvatar(`data:image/png;base64,${data.profileImage}`);
        } else {
          setEditAvatar(undefined);
        }
      } catch {
        setEditAvatar(undefined);
      }
    }
    fetchProfileImage();
  }, [isOpen, firebaseUid]);

  if (!isOpen) return null;

  const handleEditAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // When crop is confirmed
  const handleCropConfirm = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const croppedUrl = URL.createObjectURL(croppedBlob);
      setEditAvatar(croppedUrl);
      setAvatarFile(new File([croppedBlob], 'avatar.png', { type: 'image/png' }));
      setShowCropModal(false);
    } catch (err) {
      showError('Crop failed', (err as Error).message);
    }
  }, [imageToCrop, croppedAreaPixels]);

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleEditBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditBanner(URL.createObjectURL(file));
    }
  };
  const handleEditCancel = () => {
    onClose();
    setEditAvatar(undefined);
    setEditBanner(bannerUrl);
    setEditBio(userProfile?.bio || '');
    setAvatarFile(null);
  };
  const handleEditSave = async () => {
    console.log('Save button clicked');
    console.log('editBanner value:', editBanner);
    setSavingEdit(true);
    try {
      // 1. Upload avatar image if changed
      if (avatarFile && firebaseUid) {
        // Ensure teacher document exists (sync)
        await fetch('/api/teachers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseUid,
            name: userProfile?.displayName || 'Teacher',
            email: userProfile?.email || ''
          })
        });
        // Upload image
        const formData = new FormData();
        formData.append('image', avatarFile);
        const response = await fetch(`/api/teachers/${firebaseUid}/profile-image`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!data.success) {
          showError('Upload failed', data.error || 'Unknown error');
          setSavingEdit(false);
          return;
        }
      }
      // Save banner and other profile info, removing undefined values
      console.log('Saving banner:', editBanner);
      const profileToSave = {
        ...userProfile,
        banner: editBanner,
        bio: editBio,
        phoneNumber: editProfile.phoneNumber,
        school: editProfile.school,
        gradeLevel: editProfile.gradeLevel,
      };
      console.log('profileToSave:', profileToSave);
      await updateUserProfile(profileToSave);
      await refreshUserProfile();
      showSuccess('Profile Updated', 'Your profile has been updated!');
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (err: any) {
      showError('Upload failed', err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Overlay click handler to close modal if clicked outside content
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleEditCancel();
    }
  };

  const validateFields = (data: typeof editProfile) => {
    const newErrors: { phoneNumber?: string; school?: string; gradeLevel?: string } = {};
    if (data && data.phoneNumber && !/^\d*$/.test(data.phoneNumber)) {
      newErrors.phoneNumber = 'Phone number must contain numbers only.';
    }
    if (data && data.school && /\d/.test(data.school)) {
      newErrors.school = 'School name cannot contain numbers.';
    }
    if (data && data.gradeLevel && !/^\d*$/.test(data.gradeLevel)) {
      newErrors.gradeLevel = 'Grade level must be a number.';
    }
    return newErrors;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let filteredValue = value;
    if (name === 'phoneNumber') filteredValue = value.replace(/[^\d]/g, '');
    if (name === 'school') filteredValue = value.replace(/\d/g, '');
    if (name === 'gradeLevel') filteredValue = value.replace(/[^\d]/g, '');
    setEditProfile(prev => ({ ...prev, [name]: filteredValue }));
    setErrors(validateFields({ ...editProfile, [name]: filteredValue }));
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-white rounded-t-2xl px-8 py-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
          <button className="text-gray-400 text-2xl font-bold hover:text-gray-700 transition-colors" onClick={handleEditCancel} aria-label='Close'>&times;</button>
        </div>
        <div className="p-4 pt-2 overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-blue-300 scrollbar-track-blue-100" style={{ maxHeight: '70vh' }}>
          {/* Profile Picture */}
          <div className="flex flex-col items-center mb-6 mt-2">
            <div className="relative w-28 h-28 mb-2">
              {editAvatar ? (
                <img
                  src={editAvatar}
                  alt="Avatar Preview"
                  className="w-28 h-28 rounded-full object-cover border-4 border-white shadow"
                  onError={e => (e.currentTarget.src = '')}
                  style={{ background: '#e0e7ef', objectFit: 'cover' }}
                />
              ) : (
                <div className="w-28 h-28 rounded-full flex items-center justify-center bg-gray-200 border-4 border-white shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5a8.25 8.25 0 1115 0v.75A2.25 2.25 0 0117.25 22.5h-10.5A2.25 2.25 0 014.5 20.25v-.75z" />
                  </svg>
                </div>
              )}
              {/* Camera icon at bottom-right */}
              <label className="absolute bottom-0 right-0 bg-gray-100 rounded-full p-2 shadow border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors" title="Change profile photo">
                <input type="file" accept="image/*" className="hidden" onChange={handleEditAvatarChange} />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 19.5V6.75A2.25 2.25 0 014.5 4.5h3.379c.414 0 .789.252.937.64l.574 1.53a.75.75 0 00.7.48h4.38a.75.75 0 00.7-.48l.574-1.53a1 1 0 01.937-.64H19.5a2.25 2.25 0 012.25 2.25v12.75a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 19.5z" />
                  <circle cx="12" cy="13" r="3.25" />
                </svg>
              </label>
            </div>
            <span className="text-sm text-gray-500">Change Profile Picture</span>
          </div>
          {/* Cropper Modal */}
          {showCropModal && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-60">
              <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-4xl relative flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-4">Crop Image</h3>
                <div className="relative w-[600px] h-[600px] bg-gray-100">
                  <Cropper
                    image={imageToCrop!}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300" onClick={handleCropCancel}>Cancel</button>
                  <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={handleCropConfirm}>Crop</button>
                </div>
              </div>
            </div>
          )}
          {/* Banner */}
          <div className="mb-6">
            <div className="relative w-full h-24 rounded-xl overflow-hidden mb-2">
              <img
                src={banner}
                alt="Banner Preview"
                className="object-cover w-full h-full"
                style={{ background: '#e0e7ef' }}
              />
              <label className="absolute bottom-2 right-2 bg-gray-100 rounded-full p-2 shadow border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors" title="Change banner photo">
                <input type="file" accept="image/*" className="hidden" onChange={handleEditBannerChange} />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 19.5V6.75A2.25 2.25 0 014.5 4.5h3.379c.414 0 .789.252.937.64l.574 1.53a.75.75 0 00.7.48h4.38a.75.75 0 00.7-.48l.574-1.53a1 1 0 01.937-.64H19.5a2.25 2.25 0 012.25 2.25v12.75a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 19.5z" />
                  <circle cx="12" cy="13" r="3.25" />
                </svg>
              </label>
              <button
                className="absolute top-2 right-2 bg-white rounded-full px-3 py-1 text-xs text-gray-600 border border-gray-200 shadow hover:bg-blue-100 transition-colors"
                onClick={() => setShowBannerPicker(true)}
                type="button"
              >
                Choose
              </button>
            </div>
            <span className="text-sm text-gray-500">Change Banner</span>
          </div>
          {/* Banner Picker Modal */}
          {showBannerPicker && (
            <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full flex flex-col gap-4">
                <h3 className="text-lg font-semibold mb-2">Choose a Background</h3>
                <div className="grid grid-cols-2 gap-4">
                  {defaultBanners.map((url, idx) => (
                    <button
                      key={url}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${banner === url ? 'border-blue-600 ring-2 ring-blue-300' : 'border-transparent hover:border-blue-400 focus:border-blue-600'}`}
                      onClick={() => { setBanner(url); setEditBanner(url); setShowBannerPicker(false); }}
                      type="button"
                    >
                      <img
                        src={url}
                        alt={`Default banner ${idx + 1}`}
                        className="w-full h-24 object-cover"
                        onError={e => { e.currentTarget.src = 'https://via.placeholder.com/400x96?text=Image+not+found'; }}
                      />
                      {banner === url && (
                        <span className="absolute top-2 left-2 bg-blue-600 text-white rounded-full p-1 text-xs font-bold shadow">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  className="mt-4 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors self-end"
                  onClick={() => setShowBannerPicker(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* Bio */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              placeholder="Write something about yourself..."
              maxLength={300}
            />
            <div className="text-xs text-gray-400 text-right mt-1">{editBio.length}/300</div>
          </div>
          {/* Phone Number */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              name="phoneNumber"
              value={editProfile.phoneNumber}
              onChange={handleInputChange}
              disabled={savingEdit}
              inputMode="numeric"
              pattern="[0-9]*"
              className={`w-full border ${errors.phoneNumber ? 'border-red-400' : 'border-gray-300'} rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100`}
            />
            {errors.phoneNumber && <div className="text-xs text-red-500 mt-1">{errors.phoneNumber}</div>}
          </div>
          {/* School */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">School</label>
            <input
              type="text"
              name="school"
              value={editProfile.school}
              onChange={handleInputChange}
              disabled={savingEdit}
              className={`w-full border ${errors.school ? 'border-red-400' : 'border-gray-300'} rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100`}
            />
            {errors.school && <div className="text-xs text-red-500 mt-1">{errors.school}</div>}
          </div>
          {/* Grade Level */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
            <input
              type="text"
              name="gradeLevel"
              value={editProfile.gradeLevel}
              onChange={handleInputChange}
              disabled={savingEdit}
              inputMode="numeric"
              pattern="[0-9]*"
              className={`w-full border ${errors.gradeLevel ? 'border-red-400' : 'border-gray-300'} rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100`}
            />
            {errors.gradeLevel && <div className="text-xs text-red-500 mt-1">{errors.gradeLevel}</div>}
          </div>
        </div>
        {/* Sticky Action Buttons */}
        <div className="flex justify-end gap-3 p-4 border-t bg-white sticky bottom-0 z-10">
          <button
            className="px-5 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            onClick={handleEditCancel}
            disabled={savingEdit}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={handleEditSave}
            disabled={savingEdit || Object.keys(errors).length > 0 && Object.values(errors).some(Boolean)}
          >
            {savingEdit ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal; 