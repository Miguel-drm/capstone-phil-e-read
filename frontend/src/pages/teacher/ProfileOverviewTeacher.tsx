import React, { useRef, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { EditProfileModalContext, BannerContext } from '../../components/layout/DashboardLayout';
import axios from 'axios';
import Cropper from 'react-easy-crop';
import Loader from '../../components/Loader';
import { gradeService, type ClassGrade } from '../../services/gradeService';
import { studentService, type Student } from '../../services/studentService';
import { updateUserProfile } from '../../services/authService';

const ProfileOverviewTeacher: React.FC = () => {
  const { userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: userProfile?.displayName || '',
    email: userProfile?.email || '',
    phoneNumber: userProfile?.phoneNumber || '',
    school: userProfile?.school || '',
    gradeLevel: userProfile?.gradeLevel || '',
    addressStreet: (userProfile as any)?.addressStreet || '',
    addressCity: (userProfile as any)?.addressCity || '',
    addressProvince: (userProfile as any)?.addressProvince || '',
    addressZip: (userProfile as any)?.addressZip || '',
  });
  const [settingsTab, setSettingsTab] = useState('personal');
  const [preferences, setPreferences] = useState({
    notifications: { email: true, push: false, sms: true },
    privacy: { profileVisible: true, showEmail: false, showPhone: false },
    display: { theme: 'light', language: 'en', timezone: 'America/New_York' }
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const { openEditProfileModal } = useContext(EditProfileModalContext);
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ phoneNumber?: string; school?: string; gradeLevel?: string }>({});
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const { banner } = useContext(BannerContext);
  // Classes data
  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [expandedGradeId, setExpandedGradeId] = useState<string | null>(null);
  const [gradeStudents, setGradeStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (userProfile) {
      setProfileData(prev => ({
        ...prev,
        displayName: userProfile.displayName || '',
        email: userProfile.email || '',
        phoneNumber: userProfile.phoneNumber || '',
        school: userProfile.school || '',
        gradeLevel: userProfile.gradeLevel || '',
        addressStreet: (userProfile as any)?.addressStreet || prev.addressStreet,
        addressCity: (userProfile as any)?.addressCity || prev.addressCity,
        addressProvince: (userProfile as any)?.addressProvince || prev.addressProvince,
        addressZip: (userProfile as any)?.addressZip || prev.addressZip,
      }));

      // If Firestore has a single composed address, try to hydrate structured fields
      const composed = String((userProfile as any)?.address || '').trim();
      if (composed) {
        const parts = composed.split(',').map(p => p.trim()).filter(Boolean);
        // Heuristic: [street, city, province, zip]
        let street = '', city = '', province = '', zip = '';
        if (parts.length >= 1) street = parts[0];
        if (parts.length >= 2) city = parts[1];
        if (parts.length >= 3) {
          // detect if last token is zip
          const last = parts[parts.length - 1];
          if (/^\d{4,}$/.test(last)) {
            zip = last;
            province = parts[2] || '';
          } else {
            province = parts[2] || '';
          }
          // If there are more than 4 parts, merge middle into street
          if (parts.length > 4) {
            street = parts.slice(0, parts.length - 3).join(', ');
            city = parts[parts.length - 3] || city;
            province = parts[parts.length - 2] || province;
            zip = /^\d{4,}$/.test(last) ? last : zip;
          }
        }
        setProfileData(prev => ({
          ...prev,
          addressStreet: prev.addressStreet || street,
          addressCity: prev.addressCity || city,
          addressProvince: prev.addressProvince || province,
          addressZip: prev.addressZip || zip,
        }));
      }
    }
  }, [userProfile]);

  useEffect(() => {
    async function fetchProfileImage() {
      if (!firebaseUid) return;
      try {
        const API_BASE = (import.meta as any)?.env?.VITE_API_URL ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '') : 'http://localhost:5000';
        const res = await axios.get(`${API_BASE}/api/teachers/${firebaseUid}/profile-image`);
        if (res.data && res.data.profileImage) {
          setProfileImage(`data:image/png;base64,${res.data.profileImage}`);
        }
      } catch (err) {
        setProfileImage(null);
      }
    }
    fetchProfileImage();
  }, [firebaseUid]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Compose single address string for Firestore
      const composedAddress = [
        profileData.addressStreet,
        profileData.addressCity,
        profileData.addressProvince,
        profileData.addressZip
      ].filter(Boolean).join(', ');

      await updateUserProfile({
        displayName: profileData.displayName,
        phoneNumber: profileData.phoneNumber,
        school: profileData.school,
        gradeLevel: profileData.gradeLevel,
        address: composedAddress,
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Save profile failed:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
      // Helper to get cropped image as blob
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
      // 1. Sync teacher document first
      await fetch('/api/teachers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid,
          name: userProfile.displayName || 'Teacher',
          email: userProfile.email || ''
        })
      });
      // 2. Upload the cropped image
      const formData = new FormData();
      formData.append('image', new File([croppedBlob], 'avatar.png', { type: 'image/png' }));
      const API_BASE = (import.meta as any)?.env?.VITE_API_URL ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '') : 'http://localhost:5000';
      const response = await fetch(`${API_BASE}/api/teachers/${firebaseUid}/profile-image`, {
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

  const handleUpdatePreferences = () => {
    // showSuccess('Preferences Updated', 'Your preferences have been saved successfully!');
  };

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

  const handleDeleteAccount = async () => {
    if (!userProfile) return;
    const confirmResult = window.confirm('This action cannot be undone. All your data will be permanently deleted. Are you absolutely sure?');
    if (confirmResult) {
      setIsDeletingAccount(true);
      try {
        // Simulate deletion
        await new Promise(resolve => setTimeout(resolve, 2000));
        // showSuccess('Account Deleted', 'Your account and all associated data have been permanently deleted.');
      } catch (error) {
        // showError('Deletion Failed', 'An error occurred during account deletion.');
      } finally {
        setIsDeletingAccount(false);
      }
    }
  };

  const getProfileImage = () => {
    if (profileImage) return profileImage;
    return undefined;
  };

  const validateFields = (data: typeof profileData) => {
    const newErrors: { phoneNumber?: string; school?: string; gradeLevel?: string } = {};
    if (data.phoneNumber && !/^[0-9]*$/.test(data.phoneNumber)) {
      newErrors.phoneNumber = 'Phone number must contain numbers only.';
    }
    if (data.school && /\d/.test(data.school)) {
      newErrors.school = 'School name cannot contain numbers.';
    }
    if (data.gradeLevel && !/^\d*$/.test(data.gradeLevel)) {
      newErrors.gradeLevel = 'Grade level must be a number.';
    }
    return newErrors;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let filteredValue = value;
    if (name === 'phoneNumber') {
      filteredValue = value.replace(/[^\d]/g, '');
    }
    if (name === 'school') {
      filteredValue = value.replace(/\d/g, '');
    }
    if (name === 'gradeLevel') {
      filteredValue = value.replace(/[^\d]/g, '');
    }
    setProfileData(prev => ({ ...prev, [name]: filteredValue }));
    setErrors(validateFields({ ...profileData, [name]: filteredValue }));
  };

  if (!firebaseUid) return <Loader label="Loading profile..." />;

  


  // Load classes for teacher
  useEffect(() => {
    const loadGrades = async () => {
      if (!currentUser?.uid) return;
      try {
        setGradesLoading(true);
        const gradesData = await gradeService.getGradesByTeacher(currentUser.uid);
        // Attach student counts
        const withCounts = await Promise.all(
          gradesData.map(async (g: any) => {
            try {
              if (!g.id) return { ...g, studentCount: 0 };
              const studentsInGrade = await gradeService.getStudentsInGrade(g.id);
              return { ...g, studentCount: studentsInGrade.length };
            } catch {
              return { ...g, studentCount: 0 };
            }
          })
        );
        setGrades(withCounts);
      } finally {
        setGradesLoading(false);
      }
    };
    if (settingsTab === 'classes') loadGrades();
  }, [settingsTab, currentUser?.uid]);

  const toggleGradeStudents = async (grade: ClassGrade) => {
    if (!grade.id || !currentUser?.uid) return;
    // Collapse if already open
    if (expandedGradeId === grade.id) {
      setExpandedGradeId(null);
      setGradeStudents([]);
      return;
    }
    setExpandedGradeId(grade.id);
    try {
      const studentsInGrade = await gradeService.getStudentsInGrade(grade.id);
      const all = await studentService.getStudents(currentUser.uid);
      const detailed = studentsInGrade
        .map(sg => all.find(s => s.id === sg.studentId))
        .filter(Boolean) as Student[];
      detailed.sort((a, b) => a.name.localeCompare(b.name));
      setGradeStudents(detailed);
    } catch {
      setGradeStudents([]);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Banner with only top corners rounded */}
      <div className="relative w-full h-48 md:h-64 bg-gray-200 rounded-t-2xl overflow-hidden">
        <img
          src={banner}
          alt="Profile Banner"
          className="object-cover w-full h-full rounded-t-2xl"
        />
      </div>
      {/* Profile Header Row: Avatar, Name, Actions */}
      <div className="relative max-w-5xl mx-auto flex items-end justify-center sm:justify-start px-4 -mt-16 sm:-mt-20 md:-mt-24">
        {/* Avatar and Name+Button in relative container */}
        <div className="relative flex w-full flex-col sm:flex-row sm:items-end gap-4 sm:gap-0" style={{ minHeight: '140px' }}>
          {/* Avatar with camera icon */}
          <div className="relative z-10 flex-shrink-0 mx-auto sm:mx-0">
            <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full bg-white flex items-center justify-center border-4 border-white overflow-hidden relative">
              {getProfileImage() ? (
                <img
                  src={getProfileImage()}
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
                  {profileData.displayName || '-'}
                </h2>
                <span className="text-sm sm:text-base text-gray-500 font-medium mt-0">Teacher</span>
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
        {
          <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 lg:p-14 flex flex-col gap-6 sm:gap-8 border border-blue-100">
            <div className="border-b border-gray-200 mb-4 sm:mb-6">
              <nav className="-mb-px flex flex-wrap gap-2 sm:gap-4 lg:gap-8">
                <button
                  onClick={() => setSettingsTab('personal')}
                  className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm ${settingsTab === 'personal' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  <span className="hidden sm:inline">Personal Information</span>
                  <span className="sm:hidden">Personal</span>
                </button>
                <button
                  onClick={() => setSettingsTab('classes')}
                  className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm ${settingsTab === 'classes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Classes
                </button>
                <button
                  onClick={() => setSettingsTab('preferences')}
                  className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm ${settingsTab === 'preferences' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Preferences
                </button>
                <button
                  onClick={() => setSettingsTab('security')}
                  className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm ${settingsTab === 'security' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Security
                </button>
              </nav>
            </div>
            {settingsTab === 'personal' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Display Name</label>
                    <input
                      type="text"
                      value={profileData.displayName}
                      onChange={e => setProfileData({ ...profileData, displayName: e.target.value })}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Email Address</label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 text-sm sm:text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Grade Level</label>
                    <select
                      name="gradeLevel"
                      value={profileData.gradeLevel}
                      onChange={e => handleInputChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">Select grade level</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Phone Number</label>
                    <div className="flex items-center gap-2">
                      <span className="px-2 sm:px-3 py-2 rounded-md bg-gray-100 text-gray-600 border border-gray-300 text-xs sm:text-sm">+63</span>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={profileData.phoneNumber}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="9XXXXXXXXX"
                        className={`flex-1 border ${errors.phoneNumber ? 'border-red-400' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100`}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Philippines format: +63 9XXXXXXXXX (10 digits after +63).</div>
                    {errors.phoneNumber && <div className="text-xs text-red-500 mt-1">{errors.phoneNumber}</div>}
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">School</label>
                    <input
                      type="text"
                      name="school"
                      value={profileData.school}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full border ${errors.school ? 'border-red-400' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100`}
                    />
                    {errors.school && <div className="text-xs text-red-500 mt-1">{errors.school}</div>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Address</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <input
                      placeholder="House No., Street, Barangay"
                      value={profileData.addressStreet}
                      onChange={e => setProfileData({ ...profileData, addressStreet: e.target.value })}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                    <input
                      placeholder="City / Municipality"
                      value={profileData.addressCity}
                      onChange={e => setProfileData({ ...profileData, addressCity: e.target.value })}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                    <input
                      placeholder="Province"
                      value={profileData.addressProvince}
                      onChange={e => setProfileData({ ...profileData, addressProvince: e.target.value })}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                    <input
                      placeholder="ZIP (4 digits)"
                      value={profileData.addressZip}
                      onChange={e => setProfileData({ ...profileData, addressZip: e.target.value })}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
                  {isEditing && (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving || Object.keys(errors).length > 0 && Object.values(errors).some(Boolean)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            {settingsTab === 'preferences' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                <div className="bg-white rounded-lg border border-gray-200 p-6">
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
            {settingsTab === 'classes' && (
              <div className="space-y-6">
                {/* Classes Summary */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-chalkboard-teacher text-blue-600 text-sm sm:text-lg"></i>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">My Classes Overview</h3>
                  </div>
                  {gradesLoading ? (
                    <div className="text-sm sm:text-base text-gray-600">Loading classes...</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="bg-white rounded-lg p-3 sm:p-4">
                        <div className="text-xl sm:text-2xl font-bold text-blue-600">{grades.length}</div>
                        <div className="text-xs sm:text-sm text-gray-600">Total Classes</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 sm:p-4">
                        <div className="text-xl sm:text-2xl font-bold text-green-600">
                          {grades.reduce((sum, g) => sum + (g.studentCount || 0), 0)}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">Total Students</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 sm:p-4 sm:col-span-2 lg:col-span-1">
                        <div className="text-xl sm:text-2xl font-bold text-purple-600">
                          {grades.length > 0 ? Math.round(grades.reduce((sum, g) => sum + (g.studentCount || 0), 0) / grades.length) : 0}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">Avg Students/Class</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Classes List */}
                <div className="bg-white rounded-3xl p-4 sm:p-6 lg:p-8 border border-blue-100">
                  {gradesLoading ? (
                    <div className="py-8 sm:py-12 text-center text-gray-600">
                      <i className="fas fa-spinner fa-spin text-xl sm:text-2xl mb-3 sm:mb-4"></i>
                      <div className="text-sm sm:text-base">Loading classes...</div>
                    </div>
                  ) : grades.length === 0 ? (
                    <div className="py-8 sm:py-12 text-center text-gray-500">
                      <i className="fas fa-chalkboard-teacher text-3xl sm:text-4xl mb-3 sm:mb-4 text-gray-300"></i>
                      <div className="text-base sm:text-lg font-medium mb-2">No classes yet</div>
                      <div className="text-xs sm:text-sm">Create your first class to get started with managing students.</div>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
                        <h4 className="text-base sm:text-lg font-semibold text-gray-900">Class Details</h4>
                        <div className="text-xs sm:text-sm text-gray-500">
                          {grades.length} class{grades.length !== 1 ? 'es' : ''} total
                        </div>
                      </div>
                      {grades.map((g, index) => (
                        <div key={g.id} className="w-full rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-4 sm:p-6 flex flex-col transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold text-xs sm:text-sm">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-base sm:text-lg font-semibold text-gray-900 truncate">{g.name}</div>
                                <div className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{g.description || 'No description provided'}</div>
                                {g.ageRange && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    <i className="fas fa-users mr-1"></i>
                                    Age range: {g.ageRange}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                                {g.studentCount || 0} student{(g.studentCount || 0) !== 1 ? 's' : ''}
                              </span>
                              {g.color && (
                                <div 
                                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white"
                                  style={{ backgroundColor: g.color }}
                                  title={`Class color: ${g.color}`}
                                ></div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <button
                              onClick={() => toggleGradeStudents(g)}
                              className="flex-1 inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              <i className={`fas fa-chevron-${expandedGradeId === g.id ? 'up' : 'down'} mr-1 sm:mr-2`}></i>
                              <span className="hidden sm:inline">{expandedGradeId === g.id ? 'Hide Students' : 'View Students'}</span>
                              <span className="sm:hidden">{expandedGradeId === g.id ? 'Hide' : 'View'}</span>
                            </button>
                            <button
                              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                              title="Class settings (coming soon)"
                            >
                              <i className="fas fa-cog"></i>
                            </button>
                          </div>
                          
                          {expandedGradeId === g.id && (
                            <div className="mt-3 sm:mt-4 border-t border-gray-200 pt-3 sm:pt-4">
                              {gradeStudents.length === 0 ? (
                                <div className="text-center py-6 sm:py-8 text-gray-500">
                                  <i className="fas fa-user-graduate text-2xl sm:text-3xl mb-2 sm:mb-3 text-gray-300"></i>
                                  <div className="text-xs sm:text-sm">No students in this class yet.</div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2 sm:mb-3">
                                    <h5 className="text-xs sm:text-sm font-medium text-gray-700">Students in this class</h5>
                                    <span className="text-xs text-gray-500">{gradeStudents.length} student{gradeStudents.length !== 1 ? 's' : ''}</span>
                                  </div>
                                  <div className="max-h-48 sm:max-h-60 overflow-auto border border-gray-200 rounded-lg">
                                    <ul className="divide-y divide-gray-100">
                                      {gradeStudents.map((s, studentIndex) => (
                                        <li key={s.id} className="py-2 sm:py-3 px-3 sm:px-4 flex items-center justify-between hover:bg-gray-50">
                                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium text-xs sm:text-sm flex-shrink-0">
                                              {studentIndex + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{s.name}</div>
                                              <div className="text-xs text-gray-500">
                                                {s.grade && `Grade ${s.grade}`}
                                                {s.grade && s.readingLevel && ' • '}
                                                {s.readingLevel && `Level ${s.readingLevel}`}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                            {s.readingLevel && (
                                              <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-green-100 text-green-700">
                                                L{s.readingLevel}
                                              </span>
                                            )}
                                            <span className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                                              s.status === 'active' ? 'bg-green-100 text-green-700' :
                                              s.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-gray-100 text-gray-700'
                                            }`}>
                                              {s.status || 'active'}
                                            </span>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        }
      </div>
    </div>
  );
};

export default ProfileOverviewTeacher; 