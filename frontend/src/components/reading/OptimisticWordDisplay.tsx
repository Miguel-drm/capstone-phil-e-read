/**
 * OptimisticWordDisplay Component
 * 
 * Displays words with three-layer feedback system:
 * 1. Yellow highlight (immediate) - current word being read
 * 2. Green checkmark (async) - backend confirmed correct
 * 3. Error indicators (async) - backend detected errors
 * 
 * This provides instant visual feedback while validation happens in background.
 */

import React from 'react';
import type { WordValidation } from '@/hooks/useOptimisticReading';

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
  
  const getErrorIndicator = (index: number): React.ReactNode => {
    const error = wordErrors.get(index);
    if (!error) return null;
    
    switch (error.errorType) {
      case 'mispronunciation':
        return <span className="error-indicator mispronunciation" title="Mispronounced">🔴</span>;
      case 'omission':
        return <span className="error-indicator omission" title="Omitted">⭕</span>;
      case 'substitution':
        return <span className="error-indicator substitution" title="Substituted">🟡</span>;
      case 'insertion':
        return <span className="error-indicator insertion" title="Inserted">➕</span>;
      case 'repetition':
        return <span className="error-indicator repetition" title="Repeated">🔁</span>;
      default:
        return null;
    }
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
          onClick={() => onWordClick?.(index)}
          data-index={index}
        >
          {word}
          {getValidationIndicator(index)}
          {getErrorIndicator(index)}
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
          border-radius: 0.25rem;
          position: relative;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        /* Layer 1: Yellow highlight (immediate, no transition) */
        .word.current {
          background-color: #fef08a;
          font-weight: 600;
          transition: none;
          animation: pulse 0.5s ease-in-out;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        /* Layer 2: Validation indicators (async, smooth fade-in) */
        .word.validated {
          background-color: #d1fae5;
        }
        
        .word.error {
          background-color: #fee2e2;
        }
        
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
        
        /* Layer 3: Error type indicators (async, smooth fade-in) */
        .error-indicator {
          position: absolute;
          bottom: -8px;
          right: -8px;
          font-size: 0.875rem;
          animation: fadeIn 0.3s ease;
        }
        
        .word.error-mispronunciation {
          border-bottom: 2px solid #ef4444;
        }
        
        .word.error-omission {
          border: 2px dashed #f97316;
          background-color: transparent;
        }
        
        .word.error-substitution {
          border-bottom: 2px solid #eab308;
        }
        
        .word.error-insertion::before {
          content: '➕';
          position: absolute;
          left: -16px;
          color: #06b6d4;
        }
        
        .word.error-repetition {
          border-bottom: 2px solid #3b82f6;
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
          background-color: #e5e7eb;
        }
        
        .word.current:hover {
          background-color: #fde047;
        }
      `}</style>
    </div>
  );
};
