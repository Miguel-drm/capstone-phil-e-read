/**
 * OptimisticWordDisplay Component
 * 
 * Displays words with three-layer feedback system:
 * 1. Yellow highlight (immediate) - current word being read
 * 2. Green checkmark (async) - backend confirmed correct
 * 3. Error indicators (async) - backend detected errors
 * 
 * This provides instant visual feedback while validation happens in background.
 * 
 * Uses DepEd Phil-IRI color marking standards for detection types:
 * - correct: green background (#dcfce7)
 * - omission: orange background with circular border (#fed7aa)
 * - substitution: yellow background (#fef08a)
 * - insertion: purple background with dashed border (#e9d5ff)
 * - mispronunciation: red background with underline (#fecaca)
 * - repetition: blue background with dotted border (#bfdbfe)
 * - transposition: indigo background (#c7d2fe)
 * - reversal: pink background (#fbcfe8)
 * - self_correction: teal background (#99f6e4)
 */

import React from 'react';
import type { WordValidation } from '@/hooks/useOptimisticReading';
import {
  getWordStyles,
  getMiscueAnnotation,
  type DetectionType,
  type MiscueAnnotationResult,
  type WordStyleObject
} from '@/utils/detectionColors';

interface OptimisticWordDisplayProps {
  words: string[];
  currentIndex: number;
  validatedWords: Map<number, boolean>;
  wordErrors: Map<number, WordValidation>;
  onWordClick?: (index: number) => void;
}

export const OptimisticWordDisplay: React.FC<OptimisticWordDisplayProps> = ({
  words,
  currentIndex,
  validatedWords,
  wordErrors,
  onWordClick
}) => {
  /**
   * Determines the detection type for a word based on validation and error state
   */
  const getDetectionType = (index: number): DetectionType | null => {
    const error = wordErrors.get(index);
    if (error && error.errorType) {
      // Map error types to detection types
      const errorTypeMap: Record<string, DetectionType> = {
        'mispronunciation': 'mispronunciation',
        'omission': 'omission',
        'substitution': 'substitution',
        'insertion': 'insertion',
        'repetition': 'repetition',
        'transposition': 'transposition',
        'reversal': 'reversal',
        'self_correction': 'self_correction'
      };
      return errorTypeMap[error.errorType] || null;
    }
    
    if (validatedWords.has(index)) {
      return validatedWords.get(index) ? 'correct' : null;
    }
    
    return null;
  };

  /**
   * Gets inline styles for a word based on its detection type
   * Uses the new color marking system from detectionColors.ts
   */
  const getWordInlineStyles = (index: number): React.CSSProperties => {
    const detectionType = getDetectionType(index);
    
    // Layer 1: Yellow highlight for current word (immediate feedback)
    if (index === currentIndex) {
      return {
        backgroundColor: '#fef08a',
        fontWeight: 600,
        transition: 'none'
      };
    }
    
    // Layer 2 & 3: Use detection-based colors for validated/error words
    if (detectionType) {
      const styles = getWordStyles(detectionType);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
        borderWidth: styles.borderWidth,
        borderStyle: styles.borderStyle as React.CSSProperties['borderStyle'],
        borderRadius: styles.borderRadius,
        textDecoration: styles.textDecoration
      };
    }
    
    // Default: unread styling
    return getWordStyles('unread') as React.CSSProperties;
  };

  const getWordClassName = (index: number): string => {
    const classes = ['word'];
    
    // Layer 1: Yellow highlight (immediate)
    if (index === currentIndex) {
      classes.push('current');
    }
    
    // Layer 2: Validation status (async)
    if (validatedWords.has(index)) {
      if (validatedWords.get(index)) {
        classes.push('validated');
      } else {
        classes.push('error');
      }
    }
    
    // Layer 3: Specific error type (async)
    const error = wordErrors.get(index);
    if (error) {
      classes.push(`error-${error.errorType}`);
    }
    
    return classes.join(' ');
  };
  
  /**
   * Renders miscue annotation for a word based on detection type
   * Follows DepEd Phil-IRI marking standards
   */
  const renderMiscueAnnotation = (index: number): React.ReactNode => {
    const error = wordErrors.get(index);
    if (!error) return null;
    
    const annotation = getMiscueAnnotation(error.errorType, {
      spokenWord: error.spokenWord,
      expectedWord: words[index]
    });
    
    if (!annotation) return null;
    
    return <MiscueAnnotationDisplay annotation={annotation} />;
  };
  
  const getValidationIndicator = (index: number): React.ReactNode => {
    if (!validatedWords.has(index)) return null;
    
    if (validatedWords.get(index)) {
      return <span className="validation-indicator correct">✓</span>;
    }
    
    return null;
  };
  
  return (
    <div className="optimistic-word-display">
      {words.map((word, index) => (
        <span
          key={index}
          className={getWordClassName(index)}
          style={getWordInlineStyles(index)}
          onClick={() => onWordClick?.(index)}
          data-index={index}
        >
          {renderMiscueAnnotation(index)}
          {word}
          {getValidationIndicator(index)}
        </span>
      ))}
      
      <style jsx>{`
        .optimistic-word-display {
          font-size: 1.5rem;
          line-height: 2.5rem;
          padding: 2rem;
          user-select: none;
        }
        
        .word {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          margin: 0.25rem;
          position: relative;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        /* Layer 1: Yellow highlight (immediate, no transition) */
        .word.current {
          animation: pulse 0.5s ease-in-out;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        /* Layer 2: Validation indicators (async, smooth fade-in) */
        .validation-indicator {
          position: absolute;
          top: -8px;
          right: -8px;
          font-size: 1rem;
          animation: fadeIn 0.3s ease;
        }
        
        .validation-indicator.correct {
          color: #10b981;
          font-weight: bold;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        /* Hover effects */
        .word:hover {
          filter: brightness(0.95);
        }
        
        .word.current:hover {
          background-color: #fde047;
        }
      `}</style>
    </div>
  );
};


/**
 * MiscueAnnotationDisplay Component
 * 
 * Renders annotation symbols above/below/before/after words
 * following DepEd Phil-IRI marking standards:
 * - substitution: shows substituted word above expected word (Req 3.3)
 * - insertion: shows caret (^) symbol before insertion point (Req 4.3)
 * - mispronunciation: shows phonetic spelling above word (Req 5.3)
 * - repetition: underlines repeated portion below word (Req 6.3)
 * - transposition: shows transpositional symbol (↔) above swapped words (Req 7.3)
 * - reversal: shows correct word above reversed word (Req 8.3)
 * - self_correction: shows 'S' marker above word (Req 9.3)
 */
interface MiscueAnnotationDisplayProps {
  annotation: MiscueAnnotationResult;
}

const MiscueAnnotationDisplay: React.FC<MiscueAnnotationDisplayProps> = ({ annotation }) => {
  const { position, symbol, displayText, type } = annotation;
  
  // Determine what to display: symbol, displayText, or both
  const content = displayText || symbol || '';
  
  if (!content) return null;
  
  // Position-based styling
  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      fontSize: '0.75rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      animation: 'fadeIn 0.3s ease',
      zIndex: 1
    };
    
    switch (position) {
      case 'above':
        return {
          ...baseStyles,
          top: '-1.25rem',
          left: '50%',
          transform: 'translateX(-50%)'
        };
      case 'below':
        return {
          ...baseStyles,
          bottom: '-1.25rem',
          left: '50%',
          transform: 'translateX(-50%)'
        };
      case 'before':
        return {
          ...baseStyles,
          left: '-0.75rem',
          top: '50%',
          transform: 'translateY(-50%)'
        };
      case 'after':
        return {
          ...baseStyles,
          right: '-0.75rem',
          top: '50%',
          transform: 'translateY(-50%)'
        };
      default:
        return baseStyles;
    }
  };
  
  // Type-based color styling
  const getTypeColor = (): string => {
    const colorMap: Record<string, string> = {
      substitution: '#854d0e',      // yellow-800
      insertion: '#6b21a8',         // purple-800
      mispronunciation: '#991b1b',  // red-800
      repetition: '#1e40af',        // blue-800
      transposition: '#3730a3',     // indigo-800
      reversal: '#9d174d',          // pink-800
      self_correction: '#115e59'    // teal-800
    };
    return colorMap[type] || '#6b7280';
  };
  
  return (
    <span
      className={`miscue-annotation miscue-annotation-${position} miscue-annotation-${type}`}
      style={{
        ...getPositionStyles(),
        color: getTypeColor()
      }}
      title={`${type}: ${content}`}
    >
      {content}
    </span>
  );
};
