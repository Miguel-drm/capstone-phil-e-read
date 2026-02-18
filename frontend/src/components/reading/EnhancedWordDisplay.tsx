/**
 * Enhanced WordDisplay Component
 * 
 * Renders words with CLEAR visual differentiation for all 8 miscue types.
 * Includes animations, icons, and detailed annotations per DepEd Phil-IRI standards.
 * 
 * ENHANCED FEATURES:
 * - Distinct visual styling for each of 8 miscue types
 * - Animated transitions for state changes
 * - Icon indicators for each miscue type
 * - Hover tooltips with detailed information
 * - Spoken word annotations above/below expected words
 * - Smooth highlighting for current word
 * - Accessibility-compliant with ARIA labels
 */

import React, { useCallback, useState, useEffect } from 'react';
import { getWordStyles, getMiscueAnnotation, type DetectionType } from '@/utils/detectionColors';
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

export interface EnhancedWordDisplayProps {
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
  /** Enable animations (default: true) */
  enableAnimations?: boolean;
  /** Show miscue icons (default: true) */
  showIcons?: boolean;
  /** Show spoken word annotations (default: true) */
  showAnnotations?: boolean;
}

// Miscue type icons
const MISCUE_ICONS: Record<DetectionType, string> = {
  correct: '✓',
  omission: '⊘',
  substitution: '↔',
  insertion: '+',
  mispronunciation: '~',
  repetition: '↻',
  transposition: '⇄',
  reversal: '⤾',
  self_correction: 'S',
  unread: '○'
};

// Miscue type descriptions for tooltips
const MISCUE_DESCRIPTIONS: Record<DetectionType, string> = {
  correct: 'Read correctly',
  omission: 'Word was skipped or omitted',
  substitution: 'Different word was read instead',
  insertion: 'Extra word was added',
  mispronunciation: 'Word was mispronounced',
  repetition: 'Word was repeated',
  transposition: 'Words were swapped in order',
  reversal: 'Word order was reversed',
  self_correction: 'Student self-corrected the error',
  unread: 'Word not yet read'
};

/**
 * Enhanced WordDisplay Component
 * 
 * Renders a single word with CLEAR visual differentiation for all miscue types.
 * Includes animations, icons, and annotations per DepEd Phil-IRI standards.
 */
export const EnhancedWordDisplay: React.FC<EnhancedWordDisplayProps> = ({
  word,
  isCurrent,
  onClick,
  className = '',
  isSelected = false,
  toggleState,
  enableAnimations = true,
  showIcons = true,
  showAnnotations = true
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  // Trigger animation when word status changes
  useEffect(() => {
    if (word.status !== 'unread' && word.status !== 'pending') {
      setJustChanged(true);
      const timer = setTimeout(() => setJustChanged(false), 600);
      return () => clearTimeout(timer);
    }
  }, [word.status, word.miscueType]);

  const handleClick = useCallback(() => {
    onClick?.(word.index);
  }, [word.index, onClick]);

  // Check if this miscue type is enabled in the toggle
  const isMiscueEnabled = (): boolean => {
    if (!toggleState) return true;
    
    const miscueType = word.miscueType || word.status;
    
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
      'pending': 'correct',
      'unread': 'correct'
    };
    
    const toggleKey = toggleKeyMap[miscueType];
    return toggleKey ? toggleState[toggleKey] : true;
  };

  // If miscue is disabled, don't render it
  if (toggleState && word.status === 'miscue' && !isMiscueEnabled()) {
    return null;
  }

  // Get base styles from detection colors
  const baseStyles = getWordStyles(word.miscueType || word.status);
  const miscueType = (word.miscueType || word.status) as DetectionType;
  const icon = MISCUE_ICONS[miscueType];
  const description = MISCUE_DESCRIPTIONS[miscueType];

  // Get annotation if applicable
  const annotation = showAnnotations ? getMiscueAnnotation(miscueType, {
    spokenWord: word.spokenWord,
    expectedWord: word.text
  }) : null;

  // Build the final style object
  const finalStyle: React.CSSProperties = {
    ...baseStyles,
    // Current word highlighting (YELLOW)
    ...(isCurrent && {
      backgroundColor: '#fef3c7',
      borderColor: '#fbbf24',
      borderWidth: '3px',
      borderStyle: 'solid',
      fontWeight: 'bold',
      boxShadow: '0 0 0 3px rgba(251, 191, 36, 0.3)',
      transform: 'scale(1.05)',
    }),
    // Selection styling
    ...(isSelected && {
      outline: '3px solid #3b82f6',
      outlineOffset: '3px',
    }),
    // Hover effect
    ...(isHovered && !isCurrent && {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    }),
    // Common word styling
    display: 'inline-block',
    padding: '0.5rem 0.75rem',
    margin: '0.25rem',
    borderRadius: baseStyles.borderRadius,
    cursor: onClick ? 'pointer' : 'default',
    transition: enableAnimations ? 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
    userSelect: 'none',
    position: 'relative',
    fontSize: '1.125rem',
    lineHeight: '1.5',
  };

  // Animation for newly changed words
  const animationClass = enableAnimations && justChanged ? 'word-just-changed' : '';

  // Build accessibility attributes
  const ariaLabel = buildAriaLabel(word, isCurrent, isMiscueEnabled(), description);

  return (
    <span
      style={finalStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
      className={`enhanced-word-display ${animationClass} ${className}`}
      title={description}
    >
      {/* Annotation above word (substitution, mispronunciation, etc.) */}
      {annotation && annotation.position === 'above' && (
        <span className="word-annotation word-annotation-above">
          {annotation.displayText || annotation.symbol}
        </span>
      )}

      {/* Icon indicator */}
      {showIcons && miscueType !== 'unread' && (
        <span className="miscue-icon" aria-hidden="true">
          {icon}
        </span>
      )}

      {/* The word text */}
      <span className="word-text">{word.text}</span>

      {/* Annotation below word (repetition, etc.) */}
      {annotation && annotation.position === 'below' && (
        <span className="word-annotation word-annotation-below">
          {annotation.displayText || annotation.symbol}
        </span>
      )}

      {/* Hover tooltip with detailed info */}
      {isHovered && (
        <span className="word-tooltip">
          <strong>{MISCUE_DESCRIPTIONS[miscueType]}</strong>
          {word.spokenWord && word.spokenWord !== word.text && (
            <span className="tooltip-detail">
              <br />Spoken: "{word.spokenWord}"
            </span>
          )}
        </span>
      )}

      <style>{`
        .enhanced-word-display {
          font-family: 'Comic Sans MS', 'Comic Sans', cursive;
        }

        .miscue-icon {
          position: absolute;
          top: -8px;
          right: -8px;
          background: white;
          border: 2px solid currentColor;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .word-annotation {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
          padding: 0.125rem 0.375rem;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid currentColor;
          border-radius: 0.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .word-annotation-above {
          bottom: 100%;
          margin-bottom: 4px;
        }

        .word-annotation-below {
          top: 100%;
          margin-top: 4px;
        }

        .word-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          padding: 0.5rem 0.75rem;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          white-space: nowrap;
          pointer-events: none;
          z-index: 1000;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }

        .word-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: rgba(0, 0, 0, 0.9);
        }

        .tooltip-detail {
          font-size: 0.75rem;
          opacity: 0.9;
        }

        @keyframes word-change-pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
          }
        }

        .word-just-changed {
          animation: word-change-pulse 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .word-text {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </span>
  );
};

/**
 * Builds an accessible aria-label for the word based on its state.
 */
function buildAriaLabel(
  word: WordState, 
  isCurrent: boolean, 
  isMiscueEnabled: boolean,
  description: string
): string {
  const parts: string[] = [word.text];

  if (isCurrent) {
    parts.push('current word');
  }

  if (isMiscueEnabled) {
    parts.push(description);
    if (word.spokenWord && word.spokenWord !== word.text) {
      parts.push(`spoken as ${word.spokenWord}`);
    }
  }

  return parts.join(', ');
}

export default EnhancedWordDisplay;
