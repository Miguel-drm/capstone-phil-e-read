/**
 * WordDisplay Component
 * 
 * Renders individual words with their visual states during reading sessions.
 * Applies appropriate styling based on word status and miscue type.
 * Supports click events for word selection and manual correction.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import React, { useCallback } from 'react';
import { getWordStyles } from '@/utils/detectionColors';
import type { WordState } from '@/hooks/useWordStateManager';

export interface MiscueToggleState {
  correct: boolean;
  mispronunciation: boolean;
  omission: boolean;
  substitution: boolean;
  insertion: boolean;
  repetition: boolean;
  transposition: boolean;
  reversal: boolean;
  selfCorrection: boolean;
}

export interface WordDisplayProps {
  /** The word state to display */
  word: WordState;
  /** Whether this is the current word being evaluated */
  isCurrent: boolean;
  /** Optional callback when word is clicked */
  onClick?: (index: number) => void;
  /** Optional className for custom styling */
  className?: string;
  /** Optional flag to show as selected */
  isSelected?: boolean;
  /** Optional miscue toggle state to filter enabled miscues */
  toggleState?: MiscueToggleState;
}

/**
 * WordDisplay Component
 * 
 * Renders a single word with styling based on its status and miscue type.
 * Applies the 'current' word yellow highlight when isCurrent is true.
 * Handles click events for word selection and manual correction.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */
export const WordDisplay: React.FC<WordDisplayProps> = ({
  word,
  isCurrent,
  onClick,
  className = '',
  isSelected = false,
  toggleState
}) => {
  const handleClick = useCallback(() => {
    onClick?.(word.index);
  }, [word.index, onClick]);

  // Check if this miscue type is enabled in the toggle
  const isMiscueEnabled = (): boolean => {
    if (!toggleState) return true; // If no toggle state, show all miscues
    
    const miscueType = word.miscueType || word.status;
    
    // Map miscue types to toggle keys
    const toggleKeyMap: { [key: string]: keyof MiscueToggleState } = {
      'correct': 'correct',
      'mispronunciation': 'mispronunciation',
      'omission': 'omission',
      'substitution': 'substitution',
      'insertion': 'insertion',
      'repetition': 'repetition',
      'transposition': 'transposition',
      'reversal': 'reversal',
      'self_correction': 'selfCorrection',
      'selfCorrection': 'selfCorrection',
      'pending': 'correct', // Treat pending as correct
      'unread': 'correct'   // Treat unread as correct
    };
    
    const toggleKey = toggleKeyMap[miscueType];
    return toggleKey ? toggleState[toggleKey] : true;
  };

  // If miscue is disabled, don't render it at all
  if (toggleState && word.status === 'miscue' && !isMiscueEnabled()) {
    return null;
  }

  // Get base styles from detection colors
  const baseStyles = getWordStyles(word.miscueType || word.status);

  // Build the final style object with current word highlighting
  const finalStyle: React.CSSProperties = {
    ...baseStyles,
    // Apply current word yellow highlight
    ...(isCurrent && {
      backgroundColor: '#fef3c7', // yellow-100
      borderColor: '#fcd34d', // yellow-300
      borderWidth: '2px',
      borderStyle: 'solid',
      fontWeight: 'bold',
    }),
    // Apply selection styling if selected
    ...(isSelected && {
      outline: '2px solid #3b82f6',
      outlineOffset: '2px',
    }),
    // Common word styling
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    margin: '0.125rem',
    borderRadius: baseStyles.borderRadius,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.15s ease',
    userSelect: 'none',
  };

  // Build accessibility attributes
  const ariaLabel = buildAriaLabel(word, isCurrent, isMiscueEnabled());

  return (
    <span
      style={finalStyle}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role={onClick ? 'button' : 'text'}
      tabIndex={onClick ? 0 : -1}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={`word-display ${className}`}
    >
      {word.text}
    </span>
  );
};

/**
 * Builds an accessible aria-label for the word based on its state.
 * Provides context about the word's status and any miscues.
 * 
 * @param word - The word state
 * @param isCurrent - Whether this is the current word
 * @param isMiscueEnabled - Whether the miscue type is enabled in toggle
 * @returns Aria label string
 */
function buildAriaLabel(word: WordState, isCurrent: boolean, isMiscueEnabled: boolean): string {
  const parts: string[] = [word.text];

  if (isCurrent) {
    parts.push('current word');
  }

  // Only show miscue info if it's enabled
  if (isMiscueEnabled) {
    switch (word.status) {
      case 'correct':
        parts.push('read correctly');
        break;
      case 'miscue':
        if (word.miscueType) {
          parts.push(`${word.miscueType.replace(/_/g, ' ')}`);
          if (word.spokenWord) {
            parts.push(`spoken as ${word.spokenWord}`);
          }
        }
        break;
      case 'pending':
        parts.push('not yet read');
        break;
    }
  }

  return parts.join(', ');
}

export default WordDisplay;
