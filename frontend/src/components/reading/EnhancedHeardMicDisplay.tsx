/**
 * Enhanced HeardMicDisplay Component
 * 
 * Displays real-time audio input with advanced visualization and miscue type detection.
 * Shows what the student is saying with immediate feedback on miscue types.
 * 
 * NEW FEATURES:
 * - Real-time miscue type detection and display
 * - Color-coded word display matching miscue types
 * - Confidence meter with visual feedback
 * - Word-by-word history with miscue indicators
 * - Enhanced audio waveform with frequency analysis
 * - Pronunciation accuracy indicator
 */

import React, { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { DETECTION_COLORS, type DetectionType } from '@/utils/detectionColors';

export interface WordWithMiscue {
  word: string;
  miscueType: DetectionType;
  confidence: number;
  timestamp: number;
}

export interface EnhancedHeardMicDisplayProps {
  /** Current partial recognition text */
  partialText?: string;
  /** Final recognized text */
  finalText?: string;
  /** Whether microphone is currently recording */
  isRecording: boolean;
  /** Vosk connection status */
  voskStatus: 'disconnected' | 'connecting' | 'connected';
  /** Audio frequency data for visualization */
  frequencyData?: Uint8Array;
  /** Confidence level (0-100) */
  confidence?: number;
  /** Current expected word */
  expectedWord?: string;
  /** Detected miscue type for current word */
  currentMiscueType?: DetectionType;
  /** History of recognized words with miscue types */
  wordHistory?: WordWithMiscue[];
  /** Optional className for custom styling */
  className?: string;
}

export const EnhancedHeardMicDisplay: React.FC<EnhancedHeardMiscDisplayProps> = ({
  partialText = '',
  finalText = '',
  isRecording,
  voskStatus,
  frequencyData,
  confidence = 0,
  expectedWord = '',
  currentMiscueType = 'unread',
  wordHistory = [],
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Calculate audio level from frequency data
  useEffect(() => {
    if (!frequencyData) {
      setAudioLevel(0);
      return;
    }

    const average = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
    const level = Math.min(100, (average / 255) * 100);
    setAudioLevel(level);
  }, [frequencyData]);

  // Draw enhanced audio waveform visualization
  useEffect(() => {
    if (!canvasRef.current || !frequencyData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#f0f9ff');
      gradient.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars with enhanced styling
      const barWidth = canvas.width / frequencyData.length;
      const barGap = 1;
      const effectiveBarWidth = Math.max(1, barWidth - barGap);

      for (let i = 0; i < frequencyData.length; i++) {
        const value = frequencyData[i];
        const percent = value / 255;
        const barHeight = (percent * canvas.height) * 0.9;

        // Create gradient for each bar
        const barGradient = ctx.createLinearGradient(
          i * barWidth,
          canvas.height - barHeight,
          i * barWidth,
          canvas.height
        );

        // Color based on audio level and frequency
        if (percent > 0.7) {
          barGradient.addColorStop(0, '#ef4444'); // red
          barGradient.addColorStop(1, '#f87171');
        } else if (percent > 0.4) {
          barGradient.addColorStop(0, '#3b82f6'); // blue
          barGradient.addColorStop(1, '#60a5fa');
        } else {
          barGradient.addColorStop(0, '#10b981'); // green
          barGradient.addColorStop(1, '#34d399');
        }

        ctx.fillStyle = barGradient;
        ctx.fillRect(
          i * barWidth + barGap / 2,
          canvas.height - barHeight,
          effectiveBarWidth,
          barHeight
        );
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [frequencyData]);

  // Determine status color and text
  const getStatusInfo = () => {
    switch (voskStatus) {
      case 'connected':
        return { 
          color: 'bg-green-100 text-green-700 border-green-300', 
          text: 'Listening', 
          icon: '🎤',
          pulse: true
        };
      case 'connecting':
        return { 
          color: 'bg-yellow-100 text-yellow-700 border-yellow-300', 
          text: 'Connecting...', 
          icon: '⏳',
          pulse: false
        };
      case 'disconnected':
        return { 
          color: 'bg-red-100 text-red-700 border-red-300', 
          text: 'Disconnected', 
          icon: '❌',
          pulse: false
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Get miscue type display info
  const getMiscueTypeInfo = (type: DetectionType) => {
    const colors = DETECTION_COLORS[type];
    const labels: Record<DetectionType, string> = {
      correct: 'Correct',
      omission: 'Omission',
      substitution: 'Substitution',
      insertion: 'Insertion',
      mispronunciation: 'Mispronunciation',
      repetition: 'Repetition',
      transposition: 'Transposition',
      reversal: 'Reversal',
      self_correction: 'Self-Correction',
      unread: 'Waiting'
    };

    return {
      label: labels[type],
      color: colors.backgroundColor,
      textColor: colors.textColor,
      borderColor: colors.borderColor
    };
  };

  const currentMiscueInfo = getMiscueTypeInfo(currentMiscueType);

  // Get confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return 'from-green-400 to-green-600';
    if (conf >= 60) return 'from-blue-400 to-blue-600';
    if (conf >= 40) return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  return (
    <div className={`enhanced-heard-mic-display ${className}`}>
      <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-2xl overflow-hidden">
        {/* Header with status and expected word */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full bg-white/20 ${statusInfo.pulse ? 'animate-pulse' : ''}`}>
                <MicrophoneIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Microphone Input</h3>
                <p className="text-xs text-blue-100">Real-time speech recognition</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${statusInfo.color}`}>
              <span className="mr-2">{statusInfo.icon}</span>
              {statusInfo.text}
            </div>
          </div>

          {/* Expected word display */}
          {expectedWord && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <p className="text-xs font-semibold text-blue-100 mb-1">Expected Word:</p>
              <p className="text-2xl font-bold text-white tracking-wide">{expectedWord}</p>
            </div>
          )}
        </div>

        {/* Audio visualization */}
        <div className="px-6 py-4 bg-gradient-to-b from-blue-50 to-white border-b-2 border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Audio Level</p>
            <p className="text-sm font-bold text-blue-600">{audioLevel.toFixed(0)}%</p>
          </div>
          <canvas
            ref={canvasRef}
            width={400}
            height={80}
            className="w-full h-20 rounded-xl shadow-inner border-2 border-blue-200"
          />
        </div>

        {/* Recognized text display with miscue type */}
        <div className="px-6 py-5 space-y-4">
          {/* Current miscue type indicator */}
          {currentMiscueType !== 'unread' && (
            <div 
              className="rounded-xl px-4 py-3 border-2 shadow-md"
              style={{
                backgroundColor: currentMiscueInfo.color,
                borderColor: currentMiscueInfo.borderColor
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-75" style={{ color: currentMiscueInfo.textColor }}>
                    Detection Type:
                  </p>
                  <p className="text-lg font-bold" style={{ color: currentMiscueInfo.textColor }}>
                    {currentMiscueInfo.label}
                  </p>
                </div>
                {currentMiscueType === 'correct' ? (
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircleIcon className="h-8 w-8 text-red-600" />
                )}
              </div>
            </div>
          )}

          {/* Final recognized text */}
          {finalText && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Final Recognition:</p>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl px-4 py-3 shadow-md">
                <p className="text-lg font-bold text-green-900">{finalText}</p>
              </div>
            </div>
          )}

          {/* Partial/interim text */}
          {partialText && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Interim Recognition:</p>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl px-4 py-3 shadow-md">
                <p className="text-lg text-blue-900 italic font-medium">{partialText}</p>
              </div>
            </div>
          )}

          {/* No text detected */}
          {!finalText && !partialText && isRecording && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-3">
              <p className="text-base text-gray-500 italic text-center">
                🎤 Waiting for speech...
              </p>
            </div>
          )}

          {!isRecording && !finalText && !partialText && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-3">
              <p className="text-base text-gray-500 italic text-center">
                ⏸️ Microphone not active
              </p>
            </div>
          )}
        </div>

        {/* Confidence indicator */}
        {confidence > 0 && (
          <div className="px-6 py-4 bg-gradient-to-b from-white to-gray-50 border-t-2 border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-700">Recognition Confidence</p>
              <p className="text-lg font-black text-gray-900">{confidence}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner border border-gray-300">
              <div
                className={`bg-gradient-to-r ${getConfidenceColor(confidence)} h-4 rounded-full transition-all duration-500 ease-out shadow-md`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        )}

        {/* Word history with miscue types */}
        {wordHistory.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t-2 border-blue-100">
            <p className="text-sm font-bold text-gray-700 mb-3">Recent Words:</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {wordHistory.slice(-10).reverse().map((item, index) => {
                const miscueInfo = getMiscueTypeInfo(item.miscueType);
                return (
                  <div
                    key={`${item.timestamp}-${index}`}
                    className="px-3 py-2 rounded-lg border-2 shadow-sm text-sm font-medium transition-all hover:scale-105"
                    style={{
                      backgroundColor: miscueInfo.color,
                      color: miscueInfo.textColor,
                      borderColor: miscueInfo.borderColor
                    }}
                    title={`${miscueInfo.label} - ${item.confidence}% confidence`}
                  >
                    {item.word}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .enhanced-heard-mic-display {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default EnhancedHeardMicDisplay;
