import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { type Story } from '../types/Story';

const API_BASE_URL = `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : 'http://localhost:5000'}/api`;

export const storyApi = {
  // Get all stories with optional filters
  getStories: async (filters?: { readingLevel?: string; categories?: string[]; language?: string }) => {
    const response = await axios.get(`${API_BASE_URL}/stories`, { params: filters });
    const stories = response.data;
    const storiesWithPdfUrl = stories.map((story: Story) => ({
      ...story,
      pdfUrl: `/api/stories/${story._id}/pdf`
    }));
    console.log('Stories found:', storiesWithPdfUrl.length);
    return storiesWithPdfUrl;
  },

  // Search stories
  searchStories: async (query: string) => {
    const response = await axios.get(`${API_BASE_URL}/stories/search`, { params: { q: query } });
    return response.data;
  },

  // Get a single story by ID
  getStoryById: async (id: string) => {
    const response = await axios.get(`${API_BASE_URL}/stories/${id}`);
    return response.data;
  },

  // Download PDF
  downloadPDF: async (id: string) => {
    const response = await axios.get(`${API_BASE_URL}/stories/${id}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Create a new story
  createStory: async (storyData: FormData) => {
    const response = await axios.post(`${API_BASE_URL}/stories`, storyData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Update a story
  updateStory: async (id: string, storyData: FormData) => {
    const response = await axios.put(`${API_BASE_URL}/stories/${id}`, storyData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Delete a story
  deleteStory: async (id: string) => {
    const response = await axios.delete(`${API_BASE_URL}/stories/${id}`);
    return response.data;
  }
};

export const getReadingSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, 'reading-sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error('Reading session not found');
    }

    return { id: sessionSnap.id, ...sessionSnap.data() };
  } catch (error) {
    console.error('Error fetching reading session:', error);
    throw error;
  }
};