/**
 * Frontend Variant Service Wrapper
 * 
 * Provides a frontend-friendly interface to the variant management system.
 * Communicates with the backend variant service through API calls.
 * 
 * Note: This is a simplified wrapper that focuses on API communication.
 * The backend handles all variant storage and retrieval.
 */

import axios from 'axios';

// Get API base URL - prioritize environment variable, fallback to localhost in dev
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  if (envUrl && envUrl.trim()) {
    return String(envUrl).replace(/\/$/, '');
  }
  
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }
  
  return 'https://phileread-api.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

export interface VariantData {
  word: string;
  variant: string;
  language: 'english' | 'tagalog';
  isBuiltIn: boolean;
  storyId?: string;
}

/**
 * Frontend Variant Service
 * 
 * Manages variant operations through API calls to the backend.
 * Provides a simple interface for adding, removing, and retrieving variants.
 */
class FrontendVariantService {
  private static instance: FrontendVariantService;
  private localVariantCache: Map<string, VariantData[]> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): FrontendVariantService {
    if (!FrontendVariantService.instance) {
      FrontendVariantService.instance = new FrontendVariantService();
    }
    return FrontendVariantService.instance;
  }

  /**
   * Add a custom variant
   */
  async addCustomVariant(
    word: string,
    variant: string,
    storyId: string,
    language: 'english' | 'tagalog'
  ): Promise<void> {
    try {
      console.log('📤 Sending variant to backend:', {
        word,
        variant,
        storyId,
        language,
        url: `${API_BASE_URL}/api/variants/add`
      });

      const response = await axios.post(`${API_BASE_URL}/api/variants/add`, {
        word,
        variant,
        storyId,
        language,
      });

      console.log('✅ Variant added successfully:', response.data);

      // Invalidate cache for this story
      this.localVariantCache.delete(storyId);
    } catch (error) {
      console.error('❌ Failed to add variant:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Backend response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Remove a custom variant
   */
  async removeCustomVariant(
    word: string,
    variant: string,
    storyId: string
  ): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/api/variants/remove`, {
        word,
        variant,
        storyId,
      });

      // Invalidate cache for this story
      this.localVariantCache.delete(storyId);
    } catch (error) {
      console.error('Failed to remove variant:', error);
      throw error;
    }
  }

  /**
   * Get all variants for a story
   */
  getAllVariantsForStory(): Map<string, string[]> {
    // Return empty map - variants are fetched from backend on demand
    // This is a placeholder for UI compatibility
    return new Map();
  }

  /**
   * Get the cache object for UI display (simplified)
   */
  getCache(): any {
    return {
      builtInEnglish: new Map(),
      builtInTagalog: new Map(),
      storyVariants: this.localVariantCache,
      lastUpdated: new Map(),
      isInitialized: true,
    };
  }

  /**
   * Clear the local cache
   */
  clearCache(): void {
    this.localVariantCache.clear();
  }
}

export const VariantService = FrontendVariantService;
