import React, { useState, useEffect, useRef } from 'react';
import { 
  SignalIcon, 
  XCircleIcon, 
  CheckCircleIcon,
  MicrophoneIcon,
  ChartBarIcon,
  ClockIcon,
  LanguageIcon
} from '@heroicons/react/24/outline';
import VoskConnectionTest from '@/components/VoskConnectionTest';

interface RecognitionMessage {
  text?: string;
  partial?: string;
  status?: string;
  word_count?: number;
  timestamp: number;
  type: 'final' | 'partial' | 'status';
}

const VoskMonitor: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [selectedLanguage, setSelectedLanguage] = useState<'tagalog' | 'english'>('tagalog');
  const [messages, setMessages] = useState<RecognitionMessage[]>([]);
  const [stats, setStats] = useState({
    totalMessages: 0,
    finalResults: 0,
    partialResults: 0,
    connectedAt: null as Date | null,
    connectionDuration: 0,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // Railway WebSocket URLs - default to Tagalog service
  // Can be configured via VITE_VOSK_WS_URL_TAGALOG or VITE_VOSK_WS_URL
  const env = (import.meta as any)?.env || {};
  const WS_URL = env.VITE_VOSK_WS_URL_TAGALOG || env.VITE_VOSK_WS_URL || 
                 'wss://vigilant-celebration.up.railway.app';

  // Connect to WebSocket
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setConnectionStatus('connecting');
    const wsUrl = `${WS_URL}?lang=${selectedLanguage}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setConnectionStatus('connected');
      setStats(prev => ({ ...prev, connectedAt: new Date() }));
      console.log('✅ WebSocket connected to', wsUrl);
      
      // Start heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(new ArrayBuffer(0));
          } catch (e) {
            console.warn('Heartbeat failed:', e);
            clearInterval(heartbeatInterval);
          }
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        // Handle binary audio data (just acknowledge, don't process)
        if (event.data instanceof ArrayBuffer) {
          return;
        }

        const data = JSON.parse(event.data);
        const timestamp = Date.now();

        if (data.status === 'grammar_applied') {
          addMessage({
            type: 'status',
            status: 'grammar_applied',
            word_count: data.word_count,
            timestamp,
          });
        } else if (data.text) {
          console.log('📝 Final result received:', data.text);
          addMessage({
            type: 'final',
            text: data.text,
            timestamp,
          });
          setStats(prev => ({ ...prev, finalResults: prev.finalResults + 1 }));
        } else if (data.partial) {
          console.log('📝 Partial result received:', data.partial);
          addMessage({
            type: 'partial',
            partial: data.partial,
            timestamp,
          });
          setStats(prev => ({ ...prev, partialResults: prev.partialResults + 1 }));
        } else {
          console.log('📨 Other message:', data);
        }

        setLastActivity(new Date());
        setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
      } catch (error) {
        console.error('Error parsing message:', error, 'Raw data:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      console.log('WebSocket closed');
      
      // Auto-reconnect after 3 seconds
      if (isRecording) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };
  };

  const addMessage = (message: RecognitionMessage) => {
    setMessages(prev => {
      const newMessages = [message, ...prev].slice(0, 100); // Keep last 100 messages
      return newMessages;
    });
  };

  // Start audio monitoring
  const startAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
      audioContextRef.current = ctx;
      
      // Resume audio context if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const src = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = src;
      const script = ctx.createScriptProcessor(2048, 1, 1);
      scriptNodeRef.current = script;

      // Audio buffer for speech detection
      const audioBuffer: Int16Array[] = [];
      const MAX_BUFFER_SIZE = 5;
      let speechStartDetected = false;
      let consecutiveSpeechFrames = 0;
      let consecutiveSilenceFrames = 0;
      let lastEofTime = 0;

      script.onaudioprocess = (e: AudioProcessingEvent) => {
        const channel = e.inputBuffer.getChannelData(0);
        
        // Calculate RMS (audio level) - improved calculation
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < channel.length; i++) {
          const abs = Math.abs(channel[i]);
          sum += channel[i] * channel[i];
          if (abs > peak) peak = abs;
        }
        const rms = Math.sqrt(sum / channel.length);
        const level = Math.min(100, (rms * 500)); // Better scaling
        setAudioLevel(level);

        // Detect speech
        const SILENCE_THRESHOLD = 0.005;
        const PEAK_THRESHOLD = 0.02;
        const isSpeechDetected = rms > SILENCE_THRESHOLD && peak > PEAK_THRESHOLD;

        if (isSpeechDetected) {
          consecutiveSpeechFrames++;
          consecutiveSilenceFrames = 0;
        } else {
          consecutiveSilenceFrames++;
          consecutiveSpeechFrames = 0;
        }

        // Send audio to WebSocket if connected and recording
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Improved downsampling to 16kHz for Vosk
          const downsampleTo16k = (input: Float32Array): Int16Array => {
            const targetRate = 16000;
            const ratio = ctx.sampleRate / targetRate;
            const newLength = Math.floor(input.length / ratio);
            const result = new Int16Array(newLength);
            const filterLength = Math.min(32, Math.floor(input.length / 2));

            for (let i = 0; i < newLength; i++) {
              const srcIndex = i * ratio;
              const srcStart = Math.max(0, Math.floor(srcIndex - filterLength));
              const srcEnd = Math.min(input.length, Math.ceil(srcIndex + filterLength));

              let sum = 0;
              let weightSum = 0;

              for (let j = srcStart; j < srcEnd; j++) {
                const offset = j - srcIndex;
                if (Math.abs(offset) < 0.5) {
                  const weight = 1 - Math.abs(offset);
                  sum += input[j] * weight;
                  weightSum += weight;
                } else {
                  const sinc = Math.sin(Math.PI * offset) / (Math.PI * offset);
                  const window = 0.5 * (1 + Math.cos(Math.PI * offset / filterLength));
                  const weight = sinc * window;
                  sum += input[j] * weight;
                  weightSum += Math.abs(weight);
                }
              }

              const sample = weightSum > 0 ? sum / weightSum : 0;
              const clamped = Math.max(-1, Math.min(1, sample));
              result[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
            }
            return result;
          };

          const pcm16 = downsampleTo16k(channel);

          // Buffer audio for speech start detection
          audioBuffer.push(pcm16);
          if (audioBuffer.length > MAX_BUFFER_SIZE) {
            audioBuffer.shift();
          }

          // Always send audio when recording (for continuous recognition)
          // This ensures we're always sending audio data to the server
          if (isRecordingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            // Send audio continuously - Vosk will handle silence detection
            try {
              wsRef.current.send(pcm16.buffer);
              // Log every 100th chunk to avoid spam
              if (Math.random() < 0.01) {
                console.log('🎤 Sending audio chunk, level:', level.toFixed(1) + '%');
              }
            } catch (e) {
              console.error('Failed to send audio:', e);
            }
          }

          // Send EOF after silence to force finalization
          const now = Date.now();
          if (speechStartDetected && consecutiveSilenceFrames >= 5 && (now - lastEofTime) > 200) {
            try {
              wsRef.current.send(JSON.stringify({ eof: 1 }));
              console.log('🔚 Sent EOF to Vosk after silence');
              lastEofTime = now;
            } catch (e) {
              console.warn('Failed to send EOF:', e);
            }
            speechStartDetected = false;
            audioBuffer.length = 0;
          }
        }
      };

      src.connect(script);
      script.connect(ctx.destination);
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting audio monitoring:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  // Stop audio monitoring
  const stopAudioMonitoring = () => {
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setAudioLevel(0);
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setStats(prev => ({ ...prev, connectedAt: null }));
  };

  // Update connection duration
  useEffect(() => {
    if (connectionStatus === 'connected' && stats.connectedAt) {
      statsIntervalRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - stats.connectedAt!.getTime()) / 1000);
        setStats(prev => ({ ...prev, connectionDuration: duration }));
      }, 1000);
    } else {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [connectionStatus, stats.connectedAt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioMonitoring();
      disconnectWebSocket();
    };
  }, []);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Vosk WebSocket Monitor
              </h1>
              <p className="text-gray-600">
                Real-time monitoring for {WS_URL}
              </p>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                connectionStatus === 'connected' 
                  ? 'bg-green-100 text-green-800' 
                  : connectionStatus === 'connecting'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {connectionStatus === 'connected' ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : connectionStatus === 'connecting' ? (
                  <SignalIcon className="h-5 w-5 animate-pulse" />
                ) : (
                  <XCircleIcon className="h-5 w-5" />
                )}
                <span className="font-semibold capitalize">{connectionStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Diagnostic */}
        <VoskConnectionTest />

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Language Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <LanguageIcon className="h-4 w-4 inline mr-1" />
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value as 'tagalog' | 'english');
                  if (connectionStatus === 'connected') {
                    disconnectWebSocket();
                    setTimeout(() => connectWebSocket(), 500);
                  }
                }}
                disabled={connectionStatus === 'connected'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="tagalog">Tagalog</option>
                <option value="english">English</option>
              </select>
            </div>

            {/* Connection Controls */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Connection
              </label>
              <div className="flex gap-2">
                {connectionStatus === 'disconnected' ? (
                  <button
                    onClick={connectWebSocket}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={disconnectWebSocket}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Audio Controls */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MicrophoneIcon className="h-4 w-4 inline mr-1" />
                Audio Monitoring
              </label>
              <button
                onClick={isRecording ? stopAudioMonitoring : startAudioMonitoring}
                disabled={connectionStatus !== 'connected'}
                className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                  isRecording
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
                }`}
              >
                {isRecording ? 'Stop Monitoring' : 'Start Monitoring'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalMessages}</p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Final Results</p>
                <p className="text-3xl font-bold text-green-600">{stats.finalResults}</p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Partial Results</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.partialResults}</p>
              </div>
              <SignalIcon className="h-8 w-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Connection Time</p>
                <p className="text-3xl font-bold text-purple-600">
                  {stats.connectedAt ? formatDuration(stats.connectionDuration) : '0:00'}
                </p>
              </div>
              <ClockIcon className="h-8 w-8 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Audio Level Indicator */}
        {isRecording && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Audio Level</h3>
              <span className={`text-sm font-semibold ${
                audioLevel < 5 ? 'text-red-600' : audioLevel < 20 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {Math.round(audioLevel)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-100 ${
                  audioLevel > 50 ? 'bg-green-500' : audioLevel > 20 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, audioLevel)}%` }}
              />
            </div>
            {audioLevel < 5 && (
              <p className="text-sm text-red-600 italic">
                ⚠️ Audio level is very low. Check microphone permissions and speak louder or move closer to the microphone.
              </p>
            )}
            {audioLevel >= 5 && audioLevel < 20 && (
              <p className="text-sm text-yellow-600 italic">
                💡 Audio level is low. Speak louder for better recognition.
              </p>
            )}
          </div>
        )}

        {/* Messages Log */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recognition Messages</h3>
            <button
              onClick={() => setMessages([])}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No messages yet. Connect and start monitoring to see recognition results.</p>
            ) : (
              <div className="space-y-2">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-l-4 ${
                      msg.type === 'final'
                        ? 'bg-green-50 border-green-500'
                        : msg.type === 'partial'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {msg.type === 'final' && (
                          <div>
                            <span className="text-xs font-semibold text-green-700 uppercase">Final</span>
                            <p className="text-gray-900 font-medium mt-1">{msg.text}</p>
                          </div>
                        )}
                        {msg.type === 'partial' && (
                          <div>
                            <span className="text-xs font-semibold text-yellow-700 uppercase">Partial</span>
                            <p className="text-gray-900 font-medium mt-1">{msg.partial}</p>
                          </div>
                        )}
                        {msg.type === 'status' && (
                          <div>
                            <span className="text-xs font-semibold text-blue-700 uppercase">Status</span>
                            <p className="text-gray-900 font-medium mt-1">
                              Grammar applied: {msg.word_count} words
                            </p>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-4">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Last Activity */}
        {lastActivity && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Last activity: {lastActivity.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoskMonitor;

