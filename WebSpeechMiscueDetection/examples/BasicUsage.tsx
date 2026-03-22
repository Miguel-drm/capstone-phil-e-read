/**
 * Basic Usage Example for WebSpeech Miscue Detection
 * Demonstrates how to integrate the system into a React application
 */

import React, { useState, useEffect } from 'react';
import { 
  useWebSpeechMiscueDetection,
  useMiscueStatistics,
  usePerformanceMonitoring,
  useWebSpeechCompatibility,
  MiscueEvent,
  PerformanceMetrics
} from '../index';

interface BasicUsageProps {
  storyWords: string[];
  language?: 'english' | 'tagalog';
}

export const BasicUsageExample: React.FC<BasicUsageProps> = ({ 
  storyWords, 
  language = 'english' 
}) => {
  // Main miscue detection hook
  const [detectionState, detectionActions] = useWebSpeechMiscueDetection({
    storyWords,
    language,
    realTimeMode: true,
    confidenceThreshold: 0.7,
    phonetic: true,
    autoStart: false
  });

  // Statistics hook
  const miscueStats = useMiscueStatistics(detectionState.detectedMiscues);

  // Performance monitoring hook
  const performanceTrends = usePerformanceMonitoring(detectionState.performanceMetrics);

  // Browser compatibility hook
  const compatibility = useWebSpeechCompatibility();

  // Local state for UI
  const [isRecording, setIsRecording] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Handle start/stop recording
  const handleToggleRecording = async () => {
    if (isRecording) {
      detectionActions.stop();
      setIsRecording(false);
    } else {
      try {
        await detectionActions.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };

  // Handle reset
  const handleReset = () => {
    detectionActions.reset();
    setIsRecording(false);
  };

  // Render compatibility warning if needed
  if (!compatibility.isSupported) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          WebSpeech Not Supported
        </h3>
        <p className="text-red-700 mb-4">
          Your browser ({compatibility.browserName}) does not support the WebSpeech API.
        </p>
        <ul className="list-disc list-inside text-red-600">
          {compatibility.recommendations.map((rec, index) => (
            <li key={index}>{rec}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          WebSpeech Miscue Detection
        </h1>
        <p className="text-gray-600">
          Real-time reading miscue detection using WebSpeech API
        </p>
      </div>

      {/* Browser Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Browser Compatibility</h3>
        <p className="text-blue-700">
          {compatibility.browserName} {compatibility.features.continuous ? '✅' : '❌'} Continuous |
          {compatibility.features.interimResults ? '✅' : '❌'} Interim Results |
          {compatibility.features.maxAlternatives ? '✅' : '❌'} Alternatives
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Controls</h2>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              detectionState.isActive ? 'bg-green-500' : 'bg-gray-400'
            }`}></span>
            <span className="text-sm text-gray-600">
              {detectionState.isActive ? 'Recording' : 'Stopped'}
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleToggleRecording}
            disabled={detectionState.isLoading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isRecording
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {detectionState.isLoading ? 'Loading...' : isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>

          <button
            onClick={handleReset}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {detectionState.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">Error:</p>
            <p className="text-red-700">{detectionState.error.message}</p>
          </div>
        )}
      </div>

      {/* Current Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reading Progress</h2>
        
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Position: {detectionState.currentPosition + 1} / {storyWords.length}</span>
            <span>{Math.round((detectionState.currentPosition / storyWords.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(detectionState.currentPosition / storyWords.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {detectionState.detectedMiscues.length}
            </div>
            <div className="text-sm text-gray-600">Total Miscues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {detectionState.performanceMetrics?.accuracy.toFixed(1) || '0.0'}%
            </div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {detectionState.performanceMetrics?.wpm.toFixed(0) || '0'}
            </div>
            <div className="text-sm text-gray-600">WPM</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {detectionState.performanceMetrics?.oralReadingScore.toFixed(1) || '0.0'}
            </div>
            <div className="text-sm text-gray-600">ORS</div>
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      {performanceTrends.recommendations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-4">Recommendations</h2>
          <ul className="space-y-2">
            {performanceTrends.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-yellow-600">💡</span>
                <span className="text-yellow-800">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed Information */}
      {showDetails && (
        <div className="space-y-6">
          {/* Recent Miscues */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Miscues</h2>
            {detectionState.detectedMiscues.length === 0 ? (
              <p className="text-gray-600">No miscues detected yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {detectionState.detectedMiscues.slice(-10).reverse().map((miscue, index) => (
                  <div key={miscue.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        miscue.type === 'correct' ? 'bg-green-100 text-green-800' :
                        miscue.type === 'mispronunciation' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {miscue.type}
                      </span>
                      <span className="font-medium">"{miscue.spokenWord}"</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-800">"{miscue.expectedWord}"</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Position {miscue.position + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Miscue Statistics */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Miscue Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(miscueStats.byType).map(([type, count]) => (
                <div key={type} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">{count}</div>
                  <div className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Export Data</h2>
            <button
              onClick={() => {
                const data = detectionActions.exportMetrics();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `miscue-detection-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Download Metrics (JSON)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BasicUsageExample;