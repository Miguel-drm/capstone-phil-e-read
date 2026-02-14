/**
 * HeardMicDisplay Component
 * 
 * Displays real-time audio input visualization and recognized words from the microphone.
 * Shows what the student is currently saying during the reading session.
 * 
 * Features:
 * - Real-time audio waveform visualization
 * - Partial and final recognized words
 * - Confidence indicator
 * - Microphone status indicator
 */

import React, { useEffect, useRef } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/solid';

export interface HeardMicDisplayProps {
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
  /** Optional className for custom styling */
  className?: string;
}

export const HeardMicDisplay: React.FC<HeardMicDisplayProps> = ({
  partialText = '',
  finalText = '',
  isRecording,
  voskStatus,
  frequencyData,
  confidence = 0,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Draw audio waveform visualization
  useEffect(() => {
    if (!canvasRef.current || !frequencyData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars
      const barWidth = canvas.width / frequencyData.length;
      const barGap = 2;
      const effectiveBarWidth = barWidth - barGap;

      for (let i = 0; i < frequencyData.length; i++) {
        const value = frequencyData[i];
        const percent = value / 255;
        const barHeight = (percent * canvas.height) * 0.8;

        // Gradient color based on frequency
        const hue = (i / frequencyData.length) * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
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
        return { color: 'bg-green-100 text-green-700', text: 'Listening', icon: '🎤' };
      case 'connecting':
        return { color: 'bg-yellow-100 text-yellow-700', text: 'Connecting...', icon: '⏳' };
      case 'disconnected':
        return { color: 'bg-red-100 text-red-700', text: 'Disconnected', icon: '❌' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`heard-mic-display ${className}`}>
      <div className="bg-white rounded-xl border border-blue-200 shadow-lg overflow-hidden">
        {/* Header with status */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MicrophoneIcon className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900">Microphone Input</h3>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
              <span className="mr-1">{statusInfo.icon}</span>
              {statusInfo.text}
            </div>
          </div>
        </div>

        {/* Audio visualization */}
        <div className="px-4 py-3 bg-gray-50 border-b border-blue-100">
          <canvas
            ref={canvasRef}
            width={300}
            height={60}
            className="w-full h-16 rounded-lg bg-gray-100"
          />
        </div>

        {/* Recognized text display */}
        <div className="px-4 py-4 space-y-3">
          {/* Final recognized text */}
          {finalText && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Final:</p>
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-green-900">{finalText}</p>
              </div>
            </div>
          )}

          {/* Partial/interim text */}
          {partialText && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Interim:</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <p className="text-sm text-blue-900 italic">{partialText}</p>
              </div>
            </div>
          )}

          {/* No text detected */}
          {!finalText && !partialText && isRecording && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-500 italic">Waiting for speech...</p>
            </div>
          )}

          {!isRecording && !finalText && !partialText && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-500 italic">Microphone not active</p>
            </div>
          )}
        </div>

        {/* Confidence indicator */}
        {confidence > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-blue-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-600">Confidence</p>
              <p className="text-xs font-bold text-gray-700">{confidence}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .heard-mic-display {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
        }
      `}</style>
    </div>
  );
};

export default HeardMicDisplay;
