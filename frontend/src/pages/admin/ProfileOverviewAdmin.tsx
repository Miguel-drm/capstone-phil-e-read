import React, { useRef, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { EditProfileModalContext, BannerContext } from '../../components/layout/DashboardLayout';
import axios from 'axios';
import Cropper from 'react-easy-crop';

const ProfileOverviewAdmin: React.FC = () => {
  const { userProfile } = useAuth();
  const { openEditProfileModal } = useContext(EditProfileModalContext);
  const { banner } = useContext(BannerContext);
  const [activeTab, setActiveTab] = useState('Profile');
  const [settingsTab, setSettingsTab] = useState('personal');
  const [profileData, setProfileData] = useState({
    displayName: userProfile?.displayName || '',
    email: userProfile?.email || '',
    phoneNumber: userProfile?.phoneNumber || '',
  });
  const [preferences, setPreferences] = useState({
    notifications: { email: true, push: false, sms: true },
  });
  // Add state for security actions if not already present
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    async function fetchProfileImage() {
      if (!firebaseUid) return;
      try {
        const res = await axios.get(`/api/teachers/${firebaseUid}/profile-image`);
        if (res.data && res.data.profileImage) {
          setProfileImage(`data:image/png;base64,${res.data.profileImage}`);
        }
      } catch (err) {
        setProfileImage(null);
      }
    }
    fetchProfileImage();
  }, [firebaseUid]);

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

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

  const handleCropConfirm = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels || !firebaseUid || !userProfile) return;
    try {
      const createImage = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new window.Image();
          image.addEventListener('load', () => resolve(image));
          image.addEventListener('error', error => reject(error));
          image.setAttribute('crossOrigin', 'anonymous');
          image.src = url;
        });
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
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas is empty'));
        }, 'image/png');
      });
      // 1. Sync admin document (reuse teacher endpoint for now)
      await fetch('/api/teachers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid,
          name: userProfile.displayName || 'Admin',
          email: userProfile.email || ''
        })
      });
      // 2. Upload the cropped image
      const formData = new FormData();
      formData.append('image', new File([croppedBlob], 'avatar.png', { type: 'image/png' }));
      const response = await fetch(`/api/teachers/${firebaseUid}/profile-image`, {
        method: 'POST',
        body: formData,
      });
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

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Handler for updating preferences
  const handleUpdatePreferences = () => {
    // showSuccess('Preferences Updated', 'Your preferences have been saved successfully!');
  };

  // Handler for changing password
  const handleChangePassword = async () => {
    if (!userProfile || !userProfile.email) return;
    const result = window.confirm(`Send password reset email to ${userProfile.email}?`);
    if (result) {
      setIsChangingPassword(true);
      try {
        // await sendPasswordResetEmail(auth, userProfile.email);
        // showSuccess('Email Sent', 'Password reset instructions have been sent to your email.');
      } catch (error) {
        // showError('Email Failed', 'Failed to send password reset email.');
      } finally {
        setIsChangingPassword(false);
      }
    }
  };

  // Handler for exporting data
  const handleExportData = async () => {
    setIsExportingData(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      // showSuccess('Export Started', 'Your data export will be available for download shortly.');
    } catch (error) {
      // showError('Export Failed', 'An error occurred during data export.');
    } finally {
      setIsExportingData(false);
    }
  };

  // Handler for deleting account
  const handleDeleteAccount = async () => {
    if (!userProfile) return;
    const confirmResult = window.confirm('This action cannot be undone. All your data will be permanently deleted. Are you absolutely sure?');
    if (confirmResult) {
      setIsDeletingAccount(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        // showSuccess('Account Deleted', 'Your account and all associated data have been permanently deleted.');
      } catch (error) {
        // showError('Deletion Failed', 'An error occurred during account deletion.');
      } finally {
        setIsDeletingAccount(false);
      }
    }
  };

  const tabs = ['Profile', 'Users', 'System Settings', 'Reports', 'Settings'];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="relative w-full h-48 md:h-64 bg-gray-200 rounded-t-2xl overflow-hidden">
        <img src={banner} alt="Profile Banner" className="object-cover w-full h-full rounded-t-2xl" />
      </div>
      <div className="relative max-w-5xl mx-auto flex items-end px-4 -mt-20 md:-mt-24">
        <div className="relative flex items-end" style={{ minHeight: '160px' }}>
          <div className="relative z-10">
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-white flex items-center justify-center shadow-lg border-4 border-white overflow-hidden relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="object-cover w-full h-full rounded-full z-10"
                  style={{ position: 'relative', zIndex: 10 }}
                />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24" viewBox="0 0 24 24" fill="#cfd8dc">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4v1H4v-1z" />
                </svg>
              )}
            </div>
            {/* Camera Icon Overlay */}
            <>
              <button
                className="absolute -bottom-0 -right-0 bg-gray-100 rounded-full p-2 shadow-md border border-gray-200 hover:bg-gray-200 transition-colors"
                style={{ zIndex: 999 }}
                title="Change profile photo"
                aria-label="Change profile photo"
                onClick={handleCameraClick}
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-700">
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
          </div>
          <div className="flex flex-col justify-end ml-6 pb-4 flex-1">
            <div className="flex items-center">
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-0">
                {userProfile?.displayName || '-'}
              </h2>
              <button
                onClick={openEditProfileModal}
                className="ml-60 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow transition-colors text-base font-semibold"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487c.637-1.093-.148-2.487-1.392-2.487H8.53c-1.244 0-2.029 1.394-1.392 2.487l.7 1.2A2.25 2.25 0 007.5 7.25v.25c0 .414.336.75.75.75h7.5a.75.75 0 00.75-.75v-.25a2.25 2.25 0 00-.338-1.563l.7-1.2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75v2.25m0 0a2.25 2.25 0 01-2.25-2.25h4.5a2.25 2.25 0 01-2.25 2.25z" />
                </svg>
                Edit Profile
              </button>
            </div>
            <span className="text-base text-gray-500 font-medium mt-0">
              {userProfile?.role ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1) : '-'}
            </span>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto mt-8 px-4">
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 text-gray-700 font-medium border-b-2 transition-colors focus:outline-none ${activeTab === tab ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-blue-600 hover:border-blue-600'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="w-full max-w-5xl mx-auto mt-8 px-4">
        {activeTab === 'Profile' && (
          <div className="bg-white rounded-3xl shadow-2xl p-10 md:p-14 flex flex-col gap-8 border border-blue-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Name</label>
                <div className="text-lg font-bold text-gray-900">{userProfile?.displayName || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                <div className="text-lg font-bold text-gray-900">{userProfile?.email || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role</label>
                <div className="text-lg font-bold text-gray-900">Admin</div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'Users' && (
          <div className="bg-white rounded-3xl shadow-2xl p-10 md:p-14 border border-blue-100">
            <div className="text-lg font-semibold text-gray-800 mb-2">User Management</div>
            <div className="text-gray-600">Manage teachers, parents, and students from the Users section in the sidebar.</div>
          </div>
        )}
        {activeTab === 'System Settings' && (
          <div className="bg-white rounded-3xl shadow-2xl p-10 md:p-14 border border-blue-100">
            <div className="text-lg font-semibold text-gray-800 mb-2">System Settings</div>
            <div className="text-gray-600">Configure system-wide settings from the sidebar or contact your developer for advanced options.</div>
          </div>
        )}
        {activeTab === 'Reports' && (
          <div className="bg-white rounded-3xl shadow-2xl p-10 md:p-14 border border-blue-100">
            <div className="text-lg font-semibold text-gray-800 mb-2">Reports</div>
            <div className="text-gray-600">Access and generate reports from the Reports section in the sidebar.</div>
          </div>
        )}
        {activeTab === 'Settings' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mt-6">
            <div className="flex border-b mb-6">
              <button className={`px-4 py-2 font-medium focus:outline-none ${settingsTab === 'personal' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setSettingsTab('personal')}>Personal Information</button>
              <button className={`px-4 py-2 font-medium focus:outline-none ml-4 ${settingsTab === 'preferences' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setSettingsTab('preferences')}>Preferences</button>
              <button className={`px-4 py-2 font-medium focus:outline-none ml-4 ${settingsTab === 'security' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setSettingsTab('security')}>Security</button>
            </div>
            {settingsTab === 'personal' && (
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" value={profileData.displayName} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" className="w-full border rounded-lg px-3 py-2 bg-gray-100" value={profileData.email} readOnly />
                  <span className="text-xs text-gray-400">Email cannot be changed</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" value={profileData.phoneNumber} readOnly />
                </div>
                {/* Add more admin-specific fields here if needed */}
                <div className="col-span-2">
                  <button type="button" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Edit Profile</button>
                </div>
              </form>
            )}
            {settingsTab === 'preferences' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-600">Receive notifications via email</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.notifications.email}
                          onChange={e => setPreferences({
                            ...preferences,
                            notifications: { ...preferences.notifications, email: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Push Notifications</h3>
                        <p className="text-sm text-gray-600">Receive push notifications in browser</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.notifications.push}
                          onChange={e => setPreferences({
                            ...preferences,
                            notifications: { ...preferences.notifications, push: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">SMS Notifications</h3>
                        <p className="text-sm text-gray-600">Receive notifications via SMS</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.notifications.sms}
                          onChange={e => setPreferences({
                            ...preferences,
                            notifications: { ...preferences.notifications, sms: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={handleUpdatePreferences}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}
            {settingsTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Security Settings</h2>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Change Password</h3>
                        <p className="text-sm text-gray-600">Update your account password</p>
                      </div>
                      <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isChangingPassword ? 'Sending...' : 'Change Password'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Export Data</h3>
                        <p className="text-sm text-gray-600">Download your account data</p>
                      </div>
                      <button
                        onClick={handleExportData}
                        disabled={isExportingData}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isExportingData ? 'Exporting...' : 'Export Data'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                      <div>
                        <h3 className="text-sm font-medium text-red-900">Delete Account</h3>
                        <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                      </div>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileOverviewAdmin; 