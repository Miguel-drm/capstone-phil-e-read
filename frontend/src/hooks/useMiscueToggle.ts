/**
 * Hook for managing miscue detection toggles
 * 
 * Allows enabling/disabling specific miscue types during reading sessions.
 * Persists state to localStorage for user preferences.
 */

import { useState, useEffect, useCallback } from 'react';
import type { MiscueToggleState, MiscueType } from '@/components/reading/MiscueTogglePanel';

const STORAGE_KEY = 'miscue_toggle_preferences';

/**
 * Default state - all miscues enabled
 */
const DEFAULT_STATE: MiscueToggleState = {
  correct: true,
  mispronunciation: true,
  omission: true,
  substitution: true,
  insertion: true,
  repetition: true,
  transposition: true,
  reversal: true,
  selfCorrection: true
};

/**
 * Hook for managing miscue toggle state
 * 
 * @returns Object with toggle state and update function
 */
export function useMiscueToggle() {
  const [toggleState, setToggleState] = useState<MiscueToggleState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setToggleState({ ...DEFAULT_STATE, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load miscue preferences:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toggleState));
      } catch (error) {
        console.error('Failed to save miscue preferences:', error);
      }
    }
  }, [toggleState, isLoaded]);

  /**
   * Toggle a specific miscue type
   */
  const toggleMiscue = useCallback((miscueType: MiscueType, enabled: boolean) => {
    setToggleState((prev) => ({
      ...prev,
      [miscueType]: enabled
    }));
  }, []);

  /**
   * Enable all miscues
   */
  const enableAll = useCallback(() => {
    setToggleState(DEFAULT_STATE);
  }, []);

  /**
   * Disable all miscues
   */
  const disableAll = useCallback(() => {
    const allDisabled: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };
    setToggleState(allDisabled);
  }, []);

  /**
   * Check if a specific miscue type is enabled
   */
  const isMiscueEnabled = useCallback((miscueType: MiscueType): boolean => {
    return toggleState[miscueType];
  }, [toggleState]);

  /**
   * Get count of enabled miscues
   */
  const getEnabledCount = useCallback((): number => {
    return Object.values(toggleState).filter(Boolean).length;
  }, [toggleState]);

  /**
   * Reset to default state
   */
  const reset = useCallback(() => {
    setToggleState(DEFAULT_STATE);
  }, []);

  return {
    toggleState,
    toggleMiscue,
    enableAll,
    disableAll,
    isMiscueEnabled,
    getEnabledCount,
    reset,
    isLoaded
  };
}

export default useMiscueToggle;
