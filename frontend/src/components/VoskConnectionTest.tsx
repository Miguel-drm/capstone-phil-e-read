import React, { useState } from 'react';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface ConnectionTestResult {
  url: string;
  status: 'testing' | 'success' | 'failed';
  message: string;
  latency?: number;
}

const VoskConnectionTest: React.FC = () => {
  const [results, setResults] = useState<ConnectionTestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async (url: string, language: 'tagalog' | 'english' = 'tagalog') => {
    const testUrl = `${url}?lang=${language}`;
    const startTime = Date.now();
    
    return new Promise<ConnectionTestResult>((resolve) => {
      const ws = new WebSocket(testUrl);
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve({
            url: testUrl,
            status: 'failed',
            message: 'Connection timeout (60s) - Service may be sleeping or unavailable',
            latency: Date.now() - startTime
          });
        }
      }, 60000);

      ws.onopen = () => {
        const latency = Date.now() - startTime;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            url: testUrl,
            status: 'success',
            message: `Connected successfully in ${latency}ms`,
            latency
          });
        }
      };

      ws.onerror = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const latency = Date.now() - startTime;
          resolve({
            url: testUrl,
            status: 'failed',
            message: `Connection failed: ${error.type || 'Unknown error'}`,
            latency
          });
        }
      };

      ws.onclose = (event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const latency = Date.now() - startTime;
          let message = `Connection closed (code: ${event.code})`;
          
          if (event.code === 1006) {
            message += ' - Abnormal closure (service may be sleeping or unavailable)';
          } else if (event.code === 1008) {
            message += ` - ${event.reason || 'Policy violation'}`;
          }
          
          resolve({
            url: testUrl,
            status: 'failed',
            message,
            latency
          });
        }
      };
    });
  };

  const runTests = async () => {
    setIsTesting(true);
    setResults([]);

    const env = (import.meta as any)?.env || {};
    const localPort = env.VITE_VOSK_LOCAL_PORT || "2700";
    const localUrl = `ws://localhost:${localPort}`;
    
    const formatWsUrl = (baseUrl: string, language: string) => {
      const cleanUrl = baseUrl.replace(/\/$/, '');
      return `${cleanUrl}/?lang=${language}`;
    };
    

    
    // Test local server first for both languages
    const testLocalConnection = (lang: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const testWs = new WebSocket(formatWsUrl(localUrl, lang));
        const timeout = setTimeout(() => {
          testWs.close();
          resolve(false);
        }, 2000);
        
        testWs.onopen = () => {
          clearTimeout(timeout);
          testWs.close();
          resolve(true);
        };
        
        testWs.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
    };
    
    // Test both languages (local only)
    const testUrls: Array<{ url: string; lang: 'tagalog' | 'english' }> = [];
    
    // Test Tagalog
    console.log(`🔍 Testing local Vosk server for Tagalog...`);
    const isLocalTagalog = await testLocalConnection('tagalog');
    if (isLocalTagalog) {
      testUrls.push({ url: formatWsUrl(localUrl, 'tagalog'), lang: 'tagalog' });
    }
    
    // Test English
    console.log(`🔍 Testing local Vosk server for English...`);
    const isLocalEnglish = await testLocalConnection('english');
    if (isLocalEnglish) {
      testUrls.push({ url: formatWsUrl(localUrl, 'english'), lang: 'english' });
    }

    for (const test of testUrls) {
      setResults(prev => [...prev, {
        url: test.url,
        status: 'testing',
        message: 'Testing local server...'
      }]);

      // Extract base URL (remove ?lang=...)
      const baseUrl = test.url.split('?')[0];
      const result = await testConnection(baseUrl, test.lang);
      setResults(prev => {
        const updated = [...prev];
        const index = updated.findIndex(r => r.url === result.url);
        if (index >= 0) {
          updated[index] = result;
        } else {
          updated.push(result);
        }
        return updated;
      });

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsTesting(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Connection Diagnostic</h3>
        <button
          onClick={runTests}
          disabled={isTesting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 ${
                result.status === 'success'
                  ? 'bg-green-50 border-green-200'
                  : result.status === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.status === 'success' && (
                  <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                {result.status === 'failed' && (
                  <XCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                {result.status === 'testing' && (
                  <ClockIcon className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5 animate-spin" />
                )}
                <div className="flex-1">
                  <p className="font-mono text-sm text-gray-700 mb-1 break-all">{result.url}</p>
                  {result.url.startsWith('ws://localhost:') && (
                    <p className="text-xs text-blue-600 mb-1">📍 Local Server</p>
                  )}
                  <p className={`text-sm font-medium ${
                    result.status === 'success' ? 'text-green-700' :
                    result.status === 'failed' ? 'text-red-700' : 'text-yellow-700'
                  }`}>
                    {result.message}
                  </p>
                  {result.latency !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                      Latency: {result.latency}ms
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !isTesting && (
        <p className="text-sm text-gray-500 text-center py-4">
          Click "Test Connection" to diagnose WebSocket connectivity issues
        </p>
      )}
    </div>
  );
};

export default VoskConnectionTest;

