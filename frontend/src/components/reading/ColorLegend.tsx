/**
 * ColorLegend Component
 * 
 * Displays a color legend showing all detection types and their corresponding
 * colors following DepEd Phil-IRI marking standards.
 * 
 * Requirements:
 * - 10.1: Display color legend showing all detection types and their colors
 * - 10.3: Include detection type name and color sample for each type
 * - 10.4: Collapsible to save screen space when not needed
 */

import React, { useState, useEffect } from 'react';
import {
  ALL_DETECTION_TYPES,
  DETECTION_COLORS,
  type DetectionType
} from '@/utils/detectionColors';

// Local storage key for persisting collapsed state
const LEGEND_COLLAPSED_KEY = 'colorLegend_collapsed';

/**
 * Human-readable descriptions for each detection type
 */
const DETECTION_DESCRIPTIONS: Record<DetectionType, string> = {
  correct: 'Word read accurately',
  omission: 'Word was skipped',
  substitution: 'Different word was read',
  insertion: 'Extra word was added',
  mispronunciation: 'Word was mispronounced',
  repetition: 'Word was repeated',
  transposition: 'Words were swapped',
  reversal: 'Word order reversed',
  self_correction: 'Student self-corrected',
  unread: 'Word not yet read'
};

/**
 * Human-readable display names for each detection type
 */
const DETECTION_DISPLAY_NAMES: Record<DetectionType, string> = {
  correct: 'Correct',
  omission: 'Omission',
  substitution: 'Substitution',
  insertion: 'Insertion',
  mispronunciation: 'Mispronunciation',
  repetition: 'Repetition',
  transposition: 'Transposition',
  reversal: 'Reversal',
  self_correction: 'Self-Correction',
  unread: 'Unread'
};

export interface ColorLegendProps {
  /** Optional initial collapsed state (overrides localStorage) */
  initialCollapsed?: boolean;
  /** Optional callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Optional className for custom styling */
  className?: string;
}

export const ColorLegend: React.FC<ColorLegendProps> = ({
  initialCollapsed,
  onCollapsedChange,
  className = ''
}) => {
  // Initialize collapsed state from localStorage or prop
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (initialCollapsed !== undefined) {
      return initialCollapsed;
    }
    try {
      const stored = localStorage.getItem(LEGEND_COLLAPSED_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LEGEND_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // Ignore localStorage errors
    }
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev);
  };

  // Filter out 'unread' from display as it's not a meaningful detection type for users
  const displayTypes = ALL_DETECTION_TYPES.filter(type => type !== 'unread');

  return (
    <div className={`color-legend ${isCollapsed ? 'collapsed' : ''} ${className}`}>
      <button
        className="legend-toggle"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-controls="legend-content"
        type="button"
      >
        <span className="legend-title">Color Legend</span>
        <span className="toggle-icon" aria-hidden="true">
          {isCollapsed ? '▶' : '▼'}
        </span>
      </button>

      {!isCollapsed && (
        <div id="legend-content" className="legend-content">
          {displayTypes.map(type => {
            const colors = DETECTION_COLORS[type];
            return (
              <div key={type} className="legend-item">
                <span
                  className="color-sample"
                  style={{
                    backgroundColor: colors.backgroundColor,
                    color: colors.textColor,
                    borderColor: colors.borderColor,
                    borderWidth: colors.borderWidth,
                    borderStyle: colors.borderStyle,
                    borderRadius: colors.borderRadius,
                    textDecoration: colors.textDecoration
                  }}
                  aria-hidden="true"
                >
                  Aa
                </span>
                <div className="legend-text">
                  <span className="detection-name">{DETECTION_DISPLAY_NAMES[type]}</span>
                  <span className="detection-description">{DETECTION_DESCRIPTIONS[type]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .color-legend {
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          max-width: 280px;
        }

        .legend-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #f9fafb;
          border: none;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          transition: background-color 0.2s ease;
        }

        .legend-toggle:hover {
          background-color: #f3f4f6;
        }

        .legend-toggle:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }

        .legend-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .toggle-icon {
          font-size: 0.625rem;
          transition: transform 0.2s ease;
        }

        .legend-content {
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.375rem 0.5rem;
          border-radius: 0.25rem;
          transition: background-color 0.15s ease;
        }

        .legend-item:hover {
          background-color: #f9fafb;
        }

        .color-sample {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          height: 1.5rem;
          padding: 0 0.25rem;
          font-size: 0.75rem;
          font-weight: 500;
          flex-shrink: 0;
        }

        .legend-text {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }

        .detection-name {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #1f2937;
        }

        .detection-description {
          font-size: 0.6875rem;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Collapsed state */
        .color-legend.collapsed .legend-toggle {
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default ColorLegend;
