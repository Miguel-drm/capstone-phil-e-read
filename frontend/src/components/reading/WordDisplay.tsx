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
import { getWordStyles, type DetectionType } from '@/utils/detectionColors';
import type { WordState } from '@/hooks/useWordStateManager';

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
  /** Optional pending miscue type for instant visual feedback */
  pendingMiscueType?: string;
  /** Optional flag indicating word is pending recognition */
  isPendingRecognized?: boolean;
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
  pendingMiscueType,
  isPendingRecognized = false
}) => {
  const handleClick = useCallback(() => {
    onClick?.(word.index);
  }, [word.index, onClick]);

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
    // Apply pending recognized styling (pulsing green)
    ...(isPendingRecognized && !word.miscueType && {
      backgroundColor: '#dcfce7', // green-100
      borderColor: '#22c55e', // green-500
      borderWidth: '2px',
      borderStyle: 'solid',
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    }),
    // Apply pending miscue styling (pulsing colored)
    ...(pendingMiscueType && {
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      opacity: 0.9,
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
  const ariaLabel = buildAriaLabel(word, isCurrent, isPendingRecognized, pendingMiscueType);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
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
        title={isPendingRecognized ? 'Pending confirmation' : pendingMiscueType ? `Pending: ${pendingMiscueType}` : ''}
      >
        {word.text}
      </span>
    </>
  );
};

/**
 * Builds an accessible aria-label for the word based on its state.
 * Provides context about the word's status and any miscues.
 * 
 * @param word - The word state
 * @param isCurrent - Whether this is the current word
 * @param isPendingRecognized - Whether word is pending recognition
 * @param pendingMiscueType - Pending miscue type if any
 * @returns Aria label string
 */
function buildAriaLabel(word: WordState, isCurrent: boolean, isPendingRecognized: boolean = false, pendingMiscueType?: string): string {
  const parts: string[] = [word.text];

  if (isCurrent) {
    parts.push('current word');
  }

  if (isPendingRecognized) {
    parts.push('pending recognition');
  }

  if (pendingMiscueType) {
    parts.push(`pending ${pendingMiscueType}`);
  }

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

  return parts.join(', ');
}

export default WordDisplay;
