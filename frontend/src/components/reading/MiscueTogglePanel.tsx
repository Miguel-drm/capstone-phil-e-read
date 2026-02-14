/**
 * Miscue Toggle Panel Component
 * 
 * Allows teachers to enable/disable detection of specific miscue types
 * during reading sessions. Each miscue type can be toggled independently.
 */

import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export type MiscueType = 
  | 'correct'
  | 'mispronunciation'
  | 'omission'
  | 'substitution'
  | 'insertion'
  | 'repetition'
  | 'transposition'
  | 'reversal'
  | 'selfCorrection';

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

export interface MiscueTogglePanelProps {
  /** Current toggle state */
  toggleState: MiscueToggleState;
  /** Callback when toggle state changes */
  onToggleChange: (miscueType: MiscueType, enabled: boolean) => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Miscue descriptions for UI display
 */
const MISCUE_DESCRIPTIONS: Record<MiscueType, { label: string; description: string; color: string }> = {
  correct: {
    label: 'Correct',
    description: 'Word read accurately',
    color: 'bg-green-100 border-green-300'
  },
  mispronunciation: {
    label: 'Mispronunciation',
    description: 'Word mispronounced (similar sound)',
    color: 'bg-red-100 border-red-300'
  },
  omission: {
    label: 'Omission',
    description: 'Word skipped/omitted',
    color: 'bg-orange-100 border-orange-300'
  },
  substitution: {
    label: 'Substitution',
    description: 'Different word read instead',
    color: 'bg-yellow-100 border-yellow-300'
  },
  insertion: {
    label: 'Insertion',
    description: 'Extra word added',
    color: 'bg-blue-100 border-blue-300'
  },
  repetition: {
    label: 'Repetition',
    description: 'Word repeated',
    color: 'bg-purple-100 border-purple-300'
  },
  transposition: {
    label: 'Transposition',
    description: 'Words swapped/rearranged',
    color: 'bg-pink-100 border-pink-300'
  },
  reversal: {
    label: 'Reversal',
    description: 'Word read backwards',
    color: 'bg-indigo-100 border-indigo-300'
  },
  selfCorrection: {
    label: 'Self-Correction',
    description: 'Student corrected themselves',
    color: 'bg-teal-100 border-teal-300'
  }
};

/**
 * MiscueTogglePanel Component
 * 
 * Displays toggles for each miscue type, allowing teachers to
 * enable/disable detection during reading sessions.
 */
export const MiscueTogglePanel: React.FC<MiscueTogglePanelProps> = ({
  toggleState,
  onToggleChange,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const miscueTypes: MiscueType[] = [
    'correct',
    'mispronunciation',
    'omission',
    'substitution',
    'insertion',
    'repetition',
    'transposition',
    'reversal',
    'selfCorrection'
  ];

  const handleToggle = (miscueType: MiscueType) => {
    onToggleChange(miscueType, !toggleState[miscueType]);
  };

  const enabledCount = Object.values(toggleState).filter(Boolean).length;
  const totalCount = Object.keys(toggleState).length;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">Miscue Detection</h3>
          <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {enabledCount}/{totalCount} enabled
          </span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-600" />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          {miscueTypes.map((miscueType) => {
            const config = MISCUE_DESCRIPTIONS[miscueType];
            const isEnabled = toggleState[miscueType];

            return (
              <div
                key={miscueType}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  isEnabled
                    ? `${config.color} cursor-pointer`
                    : 'bg-gray-50 border-gray-200 opacity-60 cursor-pointer'
                }`}
                onClick={() => handleToggle(miscueType)}
              >
                {/* Toggle Checkbox */}
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(miscueType)}
                  className="w-5 h-5 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Label and Description */}
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{config.label}</div>
                  <div className="text-sm text-gray-600">{config.description}</div>
                </div>

                {/* Status Badge */}
                <div className="text-xs font-semibold">
                  {isEnabled ? (
                    <span className="text-green-700 bg-green-200 px-2 py-1 rounded">ON</span>
                  ) : (
                    <span className="text-gray-600 bg-gray-200 px-2 py-1 rounded">OFF</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Quick Actions */}
          <div className="flex gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                miscueTypes.forEach((type) => onToggleChange(type, true));
              }}
              className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={() => {
                miscueTypes.forEach((type) => onToggleChange(type, false));
              }}
              className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors"
            >
              Disable All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiscueTogglePanel;
