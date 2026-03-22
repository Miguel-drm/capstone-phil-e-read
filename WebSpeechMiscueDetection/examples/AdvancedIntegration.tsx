/**
 * Advanced Integration Example
 * Shows how to integrate WebSpeech miscue detection with existing systems
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  WebSpeechMiscueProvider,
  useWebSpeechMiscue,
  MiscueEvent,
  PerformanceMetrics
} from '../index';
import { RealTimeMiscueAnalyzer } from '../advanced/RealTimeMiscueAnalyzer';
import { AdaptiveLearningEngine } from '../advanced/AdaptiveLearningEngine';

interface AdvancedIntegrationProps {
  storyWords: string[];
  language?: 'english' | 'tagalog';
  userId: string;
  onComplete?: (results: any) => void;
}

// Main component that uses the WebSpeech miscue detection
const AdvancedReadingSession: React.FC<{
  storyWords: string[];
  currentPosition: number;
  onMiscueDetected: (miscue: MiscueEvent) => void;
  onPositionAdvanced: (position: number) => void;
}> = ({ storyWords, currentPosition, onMiscueDetected, onPositionAdvanced }) => {
  
  const {
    isActive,
    detectedMiscues,
    performanceMetrics,
    riskLevel,
    interventionNeeded,
    recommendations,
    start,
    stop,
    reset,
    exportData
  } = useWebSpeechMiscue();

  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Handle intervention needed
  useEffect(() => {
    if (interventionNeeded && !showInterventionModal) {
      setShowInterventionModal(true);
    }
  }, [interventionNeeded, showInterventionModal]);

  // Check if session is complete
  useEffect(() => {
    if (currentPosition >= storyWords.length - 1 && detectedMiscues.length > 0) {
      setSessionComplete(true);
    }
  }, [currentPosition, storyWords.length, detectedMiscues.length]);

  // Render story words with miscue highlighting
  const renderStoryWords = () => {
    return storyWords.map((word, index) => {
      const miscue = detectedMiscues.find(m => m.position === index);
      const isCurrent = index === currentPosition;
      
      let className = 'inline-block px-2 py-1 m-1 rounded transition-all duration-200 ';
      
      if (isCurrent) {
        className += 'bg-blue-200 border-2 border-blue-500 ';
      } else if (miscue) {
        switch (miscue.type) {
          case 'correct':
            className += 'bg-green-100 border border-green-400 ';
            break;
          case 'mispronunciation':
            className += 'bg-yellow-100 border border-yellow-400 ';
            break;
          case 'substitution':
            className += 'bg-red-100 border border-red-400 ';
            break;
          case 'omission':
            className += 'bg-orange-100 border border-orange-400 ';
            break;
          default:
            className += 'bg-purple-100 border border-purple-400 ';
        }
      } else {
        className += 'bg-gray-50 border border-gray-200 ';
      }

      return (
        <span
          key={index}
          className={className}
          title={miscue ? `${miscue.type}: "${miscue.spokenWord}" → "${miscue.expectedWord}"` : word}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Control Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Advanced Reading Session</h2>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              riskLevel === 'low' ? 'bg-green-100 text-green-800' :
              riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              Risk: {riskLevel.toUpperCase()}
            </div>
            <button
              onClick={isActive ? stop : start}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isActive ? 'Stop Detection' : 'Start Detection'}
            </button>
          </div>
        </div>

        {/* Real-time Metrics */}
        {performanceMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{performanceMetrics.totalWords}</div>
              <div className="text-sm text-gray-600">Words Read</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{performanceMetrics.accuracy.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{performanceMetrics.wpm.toFixed(0)}</div>
              <div className="text-sm text-gray-600">WPM</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{performanceMetrics.totalMiscues}</div>
              <div className="text-sm text-gray-600">Miscues</div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-800 mb-2">Real-time Recommendations:</h3>
            <ul className="space-y-1">
              {recommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-yellow-600">💡</span>
                  <span className="text-yellow-800 text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Story Display */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Story Text</h3>
        <div className="text-lg leading-relaxed">
          {renderStoryWords()}
        </div>
      </div>

      {/* Recent Miscues */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Miscues</h3>
        {detectedMiscues.length === 0 ? (
          <p className="text-gray-600">No miscues detected yet.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {detectedMiscues.slice(-5).reverse().map((miscue) => (
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

      {/* Intervention Modal */}
      {showInterventionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-red-800 mb-4">Intervention Needed</h3>
            <p className="text-gray-700 mb-4">
              The system has detected patterns that suggest the reader may need additional support.
            </p>
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Recommendations:</h4>
              <ul className="space-y-1">
                {recommendations.slice(0, 3).map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    <span className="text-gray-700 text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowInterventionModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Continue
              </button>
              <button
                onClick={() => {
                  stop();
                  setShowInterventionModal(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Pause Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Complete Modal */}
      {sessionComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-green-800 mb-4">Session Complete!</h3>
            <p className="text-gray-700 mb-4">
              Great job! The reading session has been completed.
            </p>
            {performanceMetrics && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Final Results:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Accuracy: {performanceMetrics.accuracy.toFixed(1)}%</div>
                  <div>WPM: {performanceMetrics.wpm.toFixed(0)}</div>
                  <div>Total Words: {performanceMetrics.totalWords}</div>
                  <div>Miscues: {performanceMetrics.totalMiscues}</div>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const data = exportData();
                  console.log('Session data:', data);
                  setSessionComplete(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Export Results
              </button>
              <button
                onClick={() => {
                  reset();
                  setSessionComplete(false);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                New Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main wrapper component
export const AdvancedIntegrationExample: React.FC<AdvancedIntegrationProps> = ({
  storyWords,
  language = 'english',
  userId,
  onComplete
}) => {
  const [currentPosition, setCurrentPosition] = useState(0);
  const [allMiscues, setAllMiscues] = useState<MiscueEvent[]>([]);

  const handleMiscueDetected = useCallback((miscue: MiscueEvent) => {
    setAllMiscues(prev => [...prev, miscue]);
    console.log('🎯 Miscue detected:', miscue);
  }, []);

  const handlePositionAdvanced = useCallback((position: number) => {
    setCurrentPosition(position);
    console.log('📍 Position advanced to:', position);
  }, []);

  const handlePerformanceUpdate = useCallback((metrics: PerformanceMetrics) => {
    console.log('📊 Performance updated:', metrics);
    
    // Check if session is complete
    if (metrics.totalWords >= storyWords.length && onComplete) {
      onComplete({
        metrics,
        miscues: allMiscues,
        finalPosition: currentPosition
      });
    }
  }, [storyWords.length, allMiscues, currentPosition, onComplete]);

  return (
    <WebSpeechMiscueProvider
      storyWords={storyWords}
      language={language}
      userId={userId}
      onMiscueDetected={handleMiscueDetected}
      onPositionAdvanced={handlePositionAdvanced}
      onPerformanceUpdate={handlePerformanceUpdate}
    >
      <AdvancedReadingSession
        storyWords={storyWords}
        currentPosition={currentPosition}
        onMiscueDetected={handleMiscueDetected}
        onPositionAdvanced={handlePositionAdvanced}
      />
    </WebSpeechMiscueProvider>
  );
};

export default AdvancedIntegrationExample;