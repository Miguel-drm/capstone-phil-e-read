/**
 * Vosk Server Status Indicator
 * Shows Vosk server status and provides management options
 */

import React, { useState, useEffect } from 'react';
import { useVoskServerStatus, type VoskServerStatus } from '../../utils/voskServerManager';

interface VoskServerStatusIndicatorProps {
  onStatusChange?: (isAvailable: boolean) => void;
  showDetails?: boolean;
  className?: string;
}

export const VoskServerStatusIndicator: React.FC<VoskServerStatusIndicatorProps> = ({
  onStatusChange,
  showDetails = false,
  className = ''
}) => {
  const { status, isChecking, checkStatus, manager } = useVoskServerStatus();
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Notify parent of status changes
  useEffect(() => {
    if (status && onStatusChange) {
      onStatusChange(status.isRunning && status.isReachable);
    }
  }, [status, onStatusChange]);

  const getStatusColor = (status: VoskServerStatus | null) => {
    if (!status) return 'bg-gray-500';
    if (status.isRunning && status.isReachable) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = (status: VoskServerStatus | null) => {
    if (isChecking) return 'Checking...';
    if (!status) return 'Unknown';
    if (status.isRunning && status.isReachable) return 'Connected';
    return 'Disconnected';
  };

  const getStatusDescription = (status: VoskServerStatus | null) => {
    if (!status) return 'Server status unknown';
    if (status.isRunning && status.isReachable) {
      return `Connected to Vosk server at ${status.url}`;
    }
    
    // Show more helpful error messages
    if (status.error?.includes('consecutive failures')) {
      return `${status.error} - Check frequency reduced to avoid spam`;
    }
    
    return status.error || 'Server not reachable';
  };

  const handleRefresh = async () => {
    // Reset failure count before checking
    manager.resetFailureCount();
    await checkStatus();
  };

  const instructions = manager.getServerStartInstructions();
  const troubleshootingTips = manager.getTroubleshootingTips();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Status Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${getStatusColor(status)} ${
            isChecking ? 'animate-pulse' : ''
          }`}></span>
          <span className="text-sm font-medium text-gray-700">
            Vosk Server: {getStatusText(status)}
          </span>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={isChecking}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
        >
          {isChecking ? 'Checking...' : 'Refresh'}
        </button>

        {showDetails && (
          <button
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
          >
            Help
          </button>
        )}
      </div>

      {/* Status Description */}
      {showDetails && (
        <div className="text-sm text-gray-600">
          {getStatusDescription(status)}
        </div>
      )}

      {/* Server Not Running Warning */}
      {status && !status.isRunning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800 mb-2">
                Vosk Server Not Running
              </h4>
              <p className="text-yellow-700 text-sm mb-3">
                The Vosk speech recognition server is not running. Vosk features will be disabled until the server is started.
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                >
                  Show Start Instructions
                </button>
                
                <button
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                >
                  Troubleshooting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Instructions */}
      {showInstructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-3">How to Start Vosk Server</h4>
          
          <div className="space-y-4">
            {/* Windows Instructions */}
            <div>
              <h5 className="font-medium text-blue-700 mb-2">Windows:</h5>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-600">
                {instructions.windows.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Linux Instructions */}
            <div>
              <h5 className="font-medium text-blue-700 mb-2">Linux/Mac:</h5>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-600">
                {instructions.linux.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Docker Instructions */}
            <div>
              <h5 className="font-medium text-blue-700 mb-2">Docker:</h5>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-600">
                {instructions.docker.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-100 rounded">
            <p className="text-sm text-blue-800">
              <strong>Quick Start:</strong> Navigate to the VoskServer folder and run <code className="bg-blue-200 px-1 rounded">python server.py</code>
            </p>
          </div>
        </div>
      )}

      {/* Troubleshooting */}
      {showTroubleshooting && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">Troubleshooting Tips</h4>
          
          <ul className="space-y-2">
            {troubleshootingTips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-gray-500 text-sm">•</span>
                <span className="text-sm text-gray-700">{tip}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 p-3 bg-gray-100 rounded">
            <h5 className="font-medium text-gray-800 mb-2">Common Issues:</h5>
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <strong>Port 2700 in use:</strong> Run <code className="bg-gray-200 px-1 rounded">kill_port_2700.py</code> or restart your computer
              </div>
              <div>
                <strong>Python not found:</strong> Install Python 3.8+ and ensure it's in your PATH
              </div>
              <div>
                <strong>Missing dependencies:</strong> Run <code className="bg-gray-200 px-1 rounded">pip install -r requirements.txt</code>
              </div>
              <div>
                <strong>Model not found:</strong> Run <code className="bg-gray-200 px-1 rounded">python download_huggingface_model.py</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Server Details (for debugging) */}
      {showDetails && status && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h5 className="font-medium text-gray-800 mb-2">Server Details</h5>
          <div className="space-y-1 text-sm text-gray-600">
            <div>URL: {status.url}</div>
            <div>Port: {status.port}</div>
            <div>Last Checked: {new Date(status.lastChecked).toLocaleTimeString()}</div>
            {status.error && <div className="text-red-600">Error: {status.error}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoskServerStatusIndicator;