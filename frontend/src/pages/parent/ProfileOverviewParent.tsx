import React, { useRef, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { EditProfileModalContext, BannerContext } from '../../components/layout/DashboardLayout';
import axios from 'axios';
import Cropper from 'react-easy-crop';

const ProfileOverviewParent: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const { openEditProfileModal } = useContext(EditProfileModalContext);
  const { banner } = useContext(BannerContext);
  const [activeTab, setActiveTab] = useState<'Profile' | 'Settings'>('Profile');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const firebaseUid = currentUser?.uid;
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const formatPhoneDisplay = (raw?: string | null) => {
    if (!raw) return '-';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length >= 12) {
      const n = digits.slice(2); // 10 digits
      const p1 = n.slice(0, 3);
      const p2 = n.slice(3, 6);
      const p3 = n.slice(6, 10);
      return `+63${p1} ${p2} ${p3}`;
    }
    return raw;
  };

  useEffect(() => {
    async function fetchProfileImage() {
      if (!firebaseUid) return;
      try {
        const res = await axios.get(`/api/teachers/${firebaseUid}/profile-image`);
        if (res.data && res.data.profileImage) {
          setProfileImage(`data:image/png;base64,${res.data.profileImage}`);
        }
      } catch (_err) {
        setProfileImage(null);
      }
    }
    fetchProfileImage();
  }, [firebaseUid]);

  const handleCameraClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_: any, area: any) => setCroppedAreaPixels(area), []);

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
  };

  const handleCropConfirm = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels || !firebaseUid || !userProfile) return;
    const createImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', reject);
      img.setAttribute('crossOrigin', 'anonymous');
      img.src = url;
    });

    try {
      const image = await createImage(imageToCrop);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      const croppedBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Canvas is empty'))), 'image/png');
      });

      await fetch('/api/teachers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid,
          name: userProfile.displayName || 'Parent',
          email: userProfile.email || ''
        })
      });

      const formData = new FormData();
      formData.append('image', new File([croppedBlob], 'avatar.png', { type: 'image/png' }));
      const response = await fetch(`/api/teachers/${firebaseUid}/profile-image`, { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success) {
        setShowCropModal(false);
        setImageToCrop(null);
        window.location.reload();
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    }
  }, [imageToCrop, croppedAreaPixels, firebaseUid, userProfile]);

  const handleChangePassword = async () => {
    if (!userProfile?.email) return;
    const confirmed = window.confirm(`Send password reset email to ${userProfile.email}?`);
    if (!confirmed) return;
    setIsChangingPassword(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportData = async () => {
    setIsExportingData(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
    } finally {
      setIsExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('This action cannot be undone. Delete your account?');
    if (!confirmed) return;
    setIsDeletingAccount(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="relative w-full h-48 md:h-64 bg-gray-200 rounded-t-2xl overflow-hidden">
        <img src={banner} alt="Profile Banner" className="object-cover w-full h-full rounded-t-2xl" />
      </div>

      {/* Profile Header Row: Avatar, Name, Actions */}
      <div className="relative max-w-5xl mx-auto flex items-end justify-center sm:justify-start px-4 -mt-16 sm:-mt-20 md:-mt-24">
        {/* Avatar and Name+Button in relative container */}
        <div className="relative flex w-full flex-col sm:flex-row sm:items-end gap-4 sm:gap-0" style={{ minHeight: '140px' }}>
          {/* Avatar with camera icon */}
          <div className="relative z-10 flex-shrink-0 mx-auto sm:mx-0">
            <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full bg-white flex items-center justify-center border-4 border-white overflow-hidden relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="object-cover w-full h-full rounded-full z-10"
                  style={{ position: 'relative', zIndex: 10 }}
                />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
                  viewBox="0 0 24 24"
                  fill="#cfd8dc"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4v1H4v-1z" />
                </svg>
              )}
            </div>
            {/* Camera Icon Overlay */}
            <>
              <button
                className="absolute -bottom-1 -right-1 bg-gray-100 rounded-full p-1.5 sm:p-2 border border-gray-200 hover:bg-gray-200 transition-colors"
                style={{ zIndex: 999 }}
                title="Change profile photo"
                aria-label="Change profile photo"
                onClick={handleCameraClick}
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 19.5V6.75A2.25 2.25 0 014.5 4.5h3.379c.414 0 .789.252.937.64l.574 1.53a.75.75 0 00.7.48h4.38a.75.75 0 00.7-.48l.574-1.53a1 1 0 01.937-.64H19.5a2.25 2.25 0 012.25 2.25v12.75a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 19.5z" />
                  <circle cx="12" cy="13" r="3.25" />
                </svg>
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />
            </>
            {/* Cropper Modal */}
            {showCropModal && (
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-60">
                <div className="bg-white rounded-2xl p-10 w-full max-w-4xl relative flex flex-col items-center">
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
          </div>
          {/* Name, role, and Edit Profile button inline */}
          <div className="flex flex-col justify-end sm:ml-6 pb-4 flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 sm:justify-between">
              <div className="flex flex-col">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-0">
                  {userProfile?.displayName || '-'}
                </h2>
                <span className="text-sm sm:text-base text-gray-500 font-medium mt-0">Parent</span>
              </div>
              <button
                onClick={openEditProfileModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-colors text-xs sm:text-base font-semibold flex-shrink-0 mx-auto sm:mx-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487c.637-1.093-.148-2.487-1.392-2.487H8.53c-1.244 0-2.029 1.394-1.392 2.487l.7 1.2A2.25 2.25 0 007.5 7.25v.25c0 .414.336.75.75.75h7.5a.75.75 0 00.75-.75v-.25a2.25 2.25 0 00-.338-1.563l.7-1.2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75v2.25m0 0a2.25 2.25 0 01-2.25-2.25h4.5a2.25 2.25 0 01-2.25 2.25z" />
                </svg>
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto mt-8 px-4">
        <div className="border-b border-gray-200 mb-4 sm:mb-6">
          <nav className="-mb-px flex flex-wrap gap-2 sm:gap-4 lg:gap-8">
            {(['Profile', 'Settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto px-4">
        {activeTab === 'Profile' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 lg:p-14 flex flex-col gap-6 sm:gap-8 border border-blue-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Email Address</label>
                <div className="text-sm sm:text-base font-semibold text-gray-900">{userProfile?.email || '-'}</div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Phone Number</label>
                <div className="text-sm sm:text-base font-semibold text-gray-900">{formatPhoneDisplay(userProfile?.phoneNumber)}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Address</label>
                <div className="text-sm sm:text-base font-semibold text-gray-900">{userProfile?.address || '-'}</div>
              </div>
            </div>
          </div>
        )}

       

        

        {activeTab === 'Settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Security Settings</h2>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Change Password</h3>
                    <p className="text-sm text-gray-600">Update your account password</p>
                  </div>
                  <button onClick={handleChangePassword} disabled={isChangingPassword} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base">
                    {isChangingPassword ? 'Sending...' : 'Change Password'}
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Export Data</h3>
                    <p className="text-sm text-gray-600">Download your account data</p>
                  </div>
                  <button onClick={handleExportData} disabled={isExportingData} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base">
                    {isExportingData ? 'Exporting...' : 'Export Data'}
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <h3 className="text-sm font-medium text-red-900">Delete Account</h3>
                    <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                  </div>
                  <button onClick={handleDeleteAccount} disabled={isDeletingAccount} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base">
                    {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileOverviewParent;
