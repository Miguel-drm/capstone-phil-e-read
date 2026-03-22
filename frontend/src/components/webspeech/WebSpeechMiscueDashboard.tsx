/**
 * WebSpeech Miscue Dashboard
 * Dashboard component for displaying WebSpeech miscue detection results
 * Simplified version for immediate compatibility
 */

import React, { useEffect } from 'react';
import { useWebSpeechMiscue } from './WebSpeechMiscueProvider';

interface WebSpeechMiscueDashboardProps {
  className?: string;
  showDetails?: boolean;
  showAdvancedMetrics?: boolean;
  showRealTimeAnalysis?: boolean;
  onInterventionNeeded?: () => void;
}

export const WebSpeechMiscueDashboard: React.FC<WebSpeechMiscueDashboardProps> = ({
  className = '',
  showDetails = true,
  showAdvancedMetrics = false,
  showRealTimeAnalysis = false,
  onInterventionNeeded
}) => {
  const {
    isActive,
    isSupported,
    currentPosition,
    detectedMiscues,
    performanceMetrics,
    error,
    isLoading,
    riskLevel,
    interventionNeeded,
    recommendations,
    start,
    stop,
    reset
  } = useWebSpeechMiscue();

  // Call intervention callback when needed
  useEffect(() => {
    if (interventionNeeded && onInterventionNeeded) {
      onInterventionNeeded();
    }
  }, [interventionNeeded, onInterventionNeeded]);

  if (!isSupported) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-yellow-600">⚠️</span>
          <span className="text-yellow-800 font-medium">WebSpeech API Not Supported</span>
        </div>
        <p className="text-yellow-700 text-sm mt-2">
          Your browser doesn't support the WebSpeech API. Please use Chrome, Edge, or Safari for WebSpeech miscue detection.
        </p>
      </div>
    );
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">WebSpeech Miscue Detection</h3>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          <span className="text-sm text-gray-600">
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-red-600">❌</span>
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={start}
          disabled={isActive || isLoading}
          className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Starting...' : 'Start'}
        </button>
        <button
          onClick={stop}
          disabled={!isActive || isLoading}
          className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stop
        </button>
        <button
          onClick={reset}
          disabled={isLoading}
          className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">{currentPosition}</div>
          <div className="text-sm text-gray-600">Current Position</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">{detectedMiscues.length}</div>
          <div className="text-sm text-gray-600">Total Miscues</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {performanceMetrics ? performanceMetrics.accuracy.toFixed(1) : '0.0'}%
          </div>
          <div className="text-sm text-gray-600">Accuracy</div>
        </div>
        <div className={`border rounded-lg p-3 ${getRiskLevelColor(riskLevel)}`}>
          <div className="text-2xl font-bold capitalize">{riskLevel}</div>
          <div className="text-sm">Risk Level</div>
        </div>
      </div>

      {/* Intervention Alert */}
      {interventionNeeded && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-600">🚨</span>
            <span className="text-orange-800 font-medium">Intervention Recommended</span>
          </div>
          <div className="space-y-1">
            {recommendations.map((rec, index) => (
              <p key={index} className="text-orange-700 text-sm">• {rec}</p>
            ))}
          </div>
        </div>
      )}

      {/* Detailed View */}
      {showDetails && performanceMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Performance Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Words:</span>
              <span className="ml-2 font-medium">{performanceMetrics.totalWords}</span>
            </div>
            <div>
              <span className="text-gray-600">Correct Words:</span>
              <span className="ml-2 font-medium">{performanceMetrics.correctWords}</span>
            </div>
            <div>
              <span className="text-gray-600">WPM:</span>
              <span className="ml-2 font-medium">{performanceMetrics.wpm}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Miscues:</span>
              <span className="ml-2 font-medium">{performanceMetrics.totalMiscues}</span>
            </div>
          </div>

          {/* Miscue Breakdown */}
          {Object.keys(performanceMetrics.miscuesByType).length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium text-gray-900 mb-2">Miscue Types</h5>
              <div className="space-y-1">
                {Object.entries(performanceMetrics.miscuesByType).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-gray-600 capitalize">{type}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Miscues */}
      {detectedMiscues.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Recent Miscues</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {detectedMiscues.slice(-5).reverse().map((miscue) => (
              <div key={miscue.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                <div>
                  <span className="font-medium text-gray-900">{miscue.spokenWord}</span>
                  <span className="text-gray-500 mx-2">→</span>
                  <span className="text-gray-600">{miscue.expectedWord}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">
                    {miscue.type}
                  </span>
                  <span className="text-xs text-gray-500">#{miscue.position}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};