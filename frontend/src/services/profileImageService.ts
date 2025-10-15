// Service to fetch profile images from MongoDB
const API_BASE = (import.meta as any)?.env?.VITE_API_URL ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '') : 'http://localhost:5000';

export interface ProfileImageResponse {
  profileImage: string | null;
}

export const profileImageService = {
  // Fetch teacher profile image from MongoDB
  async getTeacherProfileImage(teacherId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/api/teachers/${teacherId}/profile-image`);
      if (!response.ok) {
        console.warn('Failed to fetch teacher profile image:', response.status);
        return null;
      }
      const data: ProfileImageResponse = await response.json();
      return data.profileImage;
    } catch (error) {
      console.warn('Error fetching teacher profile image:', error);
      return null;
    }
  },

  // Fetch parent profile image from MongoDB (if parent model exists)
  async getParentProfileImage(parentId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/api/parents/${parentId}/profile-image`);
      if (!response.ok) {
        console.warn('Failed to fetch parent profile image:', response.status);
        return null;
      }
      const data: ProfileImageResponse = await response.json();
      return data.profileImage;
    } catch (error) {
      console.warn('Error fetching parent profile image:', error);
      return null;
    }
  },

  // Convert base64 string to data URL
  convertBase64ToDataUrl(base64String: string): string {
    if (!base64String) return '';
    // Check if it already has data URL prefix
    if (base64String.startsWith('data:')) {
      return base64String;
    }
    // Add data URL prefix for image
    return `data:image/jpeg;base64,${base64String}`;
  }
};
