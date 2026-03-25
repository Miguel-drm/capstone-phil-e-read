import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  readingSessionService,
  type ReadingSession,
} from "@/services/readingSessionService";
import { UnifiedStoryService } from "@/services/UnifiedStoryService";
import type { Story } from "@/types/Story";
import {
  ArrowLeftIcon,
  XCircleIcon,
  BookOpenIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import "pdfjs-dist/build/pdf.worker.entry";
import {
  calculateOralReadingScore,
  calculateReadingSpeedWPM,
  formatElapsedTime,
} from "@/utils/readingMetrics";
import { studentService } from "@/services/studentService";
import Swal from "sweetalert2";
import { db } from "@/config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { isrResultService } from "@/services/ISRresultService";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile } from "@/services/authService";
import gsap from "gsap";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Helper to check if a word index matches the current word
function isWordCurrent(realWordIndex: number, currentWordIndex: number): boolean {
  return realWordIndex === currentWordIndex;
}

// Helper to get miscue color based on type
function getMiscueColor(miscueType: string): string {
  switch (miscueType) {
    case 'mispronunciation':
      return 'bg-red-200 text-red-900 border-2 border-red-400';
    case 'omission':
      // Circular background for omission (DepEd Phil-IRI standard)
      return 'bg-orange-200 text-orange-900 border-4 border-orange-600 rounded-full';
    case 'substitution':
      return 'bg-yellow-200 text-yellow-900 border-2 border-yellow-400';
    case 'insertion':
      return 'bg-purple-200 text-purple-900 border-2 border-purple-400';
    case 'repetition':
      return 'bg-blue-200 text-blue-900 border-2 border-blue-400';
    case 'transposition':
      return 'bg-indigo-200 text-indigo-900 border-2 border-indigo-400';
    case 'reversal':
      return 'bg-pink-200 text-pink-900 border-2 border-pink-400';
    case 'selfCorrection':
      return 'bg-teal-200 text-teal-900 border-2 border-teal-400';
    default:
      return 'bg-gray-200 text-gray-900 border-2 border-gray-400';
  }
}

// Helper to get miscue marking style
function getMiscueMarkingStyle(miscueType: string): React.CSSProperties {
  switch (miscueType) {
    case 'mispronunciation':
      return { textDecoration: 'underline', textDecorationColor: '#dc2626', textDecorationThickness: '2px' };
    case 'omission':
      // Circular shape for omission (DepEd Phil-IRI standard)
      return { 
        borderRadius: '50%',
        aspectRatio: '1',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '3rem',
        minHeight: '3rem'
      };
    case 'substitution':
      return { textDecoration: 'underline', textDecorationColor: '#ca8a04', textDecorationThickness: '2px' };
    case 'insertion':
      return { border: '2px dashed #9333ea' };
    case 'repetition':
      return { border: '2px dotted #2563eb' };
    case 'transposition':
      return { border: '2px solid #4f46e5' };
    case 'reversal':
      return { border: '2px solid #db2777' };
    case 'selfCorrection':
      return { border: '2px solid #0d9488' };
    default:
      return {};
  }
}

const ReadingSessionPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [storyText, setStoryText] = useState<string>("");
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  // Lock to prevent re-processing the same/older word indices (race-condition guard).
  // This ref is the "source of truth" for gating word_match events.
  const currentWordIndexLockRef = useRef<number>(0);
  // Prevent frontend transcript-based fuzzy matching from fighting the backend's
  // deterministic `word_match` stream.
  const SERVER_MATCHING_ONLY = true;
  const [words, setWords] = useState<string[]>([]);
  // spokenWords removed - transposition detection now handled server-side (Requirements 3.5, 3.6)
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pdfContent, setPdfContent] = useState<string>("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false); // used in PDF fetch display logic
  const [pdfError, setPdfError] = useState<string | null>(null);
  const recommendedFont = useMemo(() => {
    // Prefer session grade over story level so class grade drives sizing
    const levelRaw =
      (currentSession as any)?.gradeLevel ||
      (currentSession as any)?.gradeName ||
      (currentStory as any)?.readingLevel ||
      (currentStory as any)?.level ||
      "";
    const levelMatch = String(levelRaw).match(/\d+/);
    const levelNum = levelMatch ? parseInt(levelMatch[0], 10) : 0;

    // More separation between grades
    let fontSize = "13px"; // default 4th–7th
    if (levelNum <= 1) fontSize = "20px";
    else if (levelNum === 2) fontSize = "18px";
    else if (levelNum === 3) fontSize = "16px";
    else fontSize = "13px";

    return {
      fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
      fontSize,
    };
  }, [currentStory, currentSession]);
  
  // Microphone device selection
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [micVolume, setMicVolume] = useState<number>(100);
  
  // Track if session has been started (to show Complete button)
  const [hasStarted, setHasStarted] = useState(false);
  
  // Store ISR result ID for quiz navigation
  const [isrResultId, setIsrResultId] = useState<string | null>(null);
  
  // Track if quiz has been completed
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);
  
  // Track selected word for manual correction
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [showCorrectionOptions, setShowCorrectionOptions] = useState(false);
  
  // Helper function to get CSS classes for miscue-based word coloring
  const getMiscueColorClasses = (miscueType: string | undefined): string => {
    switch (miscueType) {
      case 'correct':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-green-500'; // Green border for correct
      case 'mispronounce':
      case 'mispronunciation':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-yellow-500'; // Yellow border for mispronunciation
      case 'substitution':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-red-500'; // Red border for substitution
      case 'omission':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-orange-500'; // Orange border for omission
      case 'insertion':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-purple-500'; // Purple border for insertion
      case 'transposition':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-blue-500'; // Blue border for transposition
      case 'reversal':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-pink-500'; // Pink border for reversal
      case 'self_correct':
      case 'selfCorrection':
        return 'bg-transparent text-gray-900 font-semibold border-2 border-cyan-500'; // Cyan border for self-correction
      case 'current':
        return 'bg-yellow-100 text-yellow-900 font-semibold border-2 border-yellow-400'; // Yellow background for current word
      case 'unread':
      default:
        return 'bg-transparent text-gray-700 border border-gray-300'; // Gray for unread words
    }
  };

  const normalizeServerMiscueType = (rawType: string | undefined, isCorrect: boolean): string => {
    if (!rawType || rawType.trim().length === 0) {
      return isCorrect ? "correct" : "substitution";
    }
    const normalized = rawType.trim().toLowerCase();
    if (normalized === "mispronunciation") return "mispronounce";
    if (normalized === "self_correction" || normalized === "self_correct") return "self_correct";
    return normalized;
  };

  // Check if quiz has been completed when ISR result ID is available
  useEffect(() => {
    const checkQuizCompletion = async () => {
      if (!isrResultId) return;
      
      try {
        const isrResult = await isrResultService.getISRResultById(isrResultId);
        if (isrResult && isrResult.testId) {
          // Quiz has been completed (testId is set)
          setHasCompletedQuiz(true);
          console.log('✅ Quiz already completed for this session');
        } else {
          // Reset if testId is not present
          setHasCompletedQuiz(false);
        }
      } catch (error) {
        console.error('Error checking quiz completion:', error);
      }
    };
    
    checkQuizCompletion();
  }, [isrResultId]);
  
  // Re-check quiz completion when page becomes visible (user returns from quiz)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isrResultId) {
        console.log('🔄 Page visible again, re-checking quiz completion...');
        try {
          const isrResult = await isrResultService.getISRResultById(isrResultId);
          if (isrResult && isrResult.testId) {
            setHasCompletedQuiz(true);
            console.log('✅ Quiz completed - button will be disabled');
          }
        } catch (error) {
          console.error('Error re-checking quiz completion:', error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isrResultId]);
  
  // Enumerate available audio input devices
  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        
        // Set default device if not already selected
        if (!selectedMicId && audioInputs.length > 0) {
          setSelectedMicId(audioInputs[0].deviceId);
        }
        
        console.log('🎤 Available microphones:', audioInputs.map(d => d.label || d.deviceId));
      } catch (error) {
        // Requirement 5.4: Log device enumeration errors without crashing
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error('❌ Failed to enumerate audio devices:', {
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
        // Continue operation - user can still try to record with default device
      }
    };
    
    enumerateDevices();
    
    // Listen for device changes (e.g., plugging in a new mic)
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, [selectedMicId]);
  
  // Update gain node when mic volume changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = micVolume / 100;
    }
  }, [micVolume]);

  // Update frequency visualization when recording
  useEffect(() => {
    if (!isRecording || !analyserRef.current) return;

    let animationId: number;
    const updateFrequency = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(dataArray);
      }
      animationId = requestAnimationFrame(updateFrequency);
    };

    animationId = requestAnimationFrame(updateFrequency);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isRecording]);
  
  // Check Vosk connection status

  // Audio recording state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Audio and speech recognition refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const voskSocketRef = useRef<WebSocket | null>(null);
  const voskReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voskReconnectAttemptsRef = useRef<number>(0);
  const voskFinalTranscriptRef = useRef<string>(""); // Accumulate final results
  const voskConnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voskHeartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Vosk audio backpressure: enqueue ScriptProcessor chunks and send at a steady rate.
  // This prevents ws.bufferedAmount from growing unbounded (which causes Vosk lag).
  const voskAudioQueueRef = useRef<ArrayBuffer[]>([]);
  const voskAudioSenderIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voskAudioQueueMaxChunksRef = useRef<number>(96);
  const voskAudioMaxBufferedBytesRef = useRef<number>(1024 * 1024); // 1MB threshold
  const lastPositionRef = useRef<number>(0); // Track last position for phrase matching
  const lastWordTimestampRef = useRef<number>(0); // Track timestamp of last word for repetition detection
  const [transcript, setTranscript] = useState("");
  const [voskStatus, setVoskStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [wordsRead, setWordsRead] = useState(0);
  const [storyLanguage, setStoryLanguage] = useState<"english" | "tagalog">(
    "english"
  );
  const [storyVocabulary, setStoryVocabulary] = useState<Set<string>>(new Set());
  // Audio processing, speech detection, and pronunciation matching now handled server-side

  // Track which words have been correctly recognized (for green highlighting)
  const [recognizedWords, setRecognizedWords] = useState<Set<number>>(new Set());

  // 100% REAL-TIME: Track word colors for miscue-based highlighting
  // Map of word index to miscue type: 'correct' (green), 'mispronounce' (yellow), 'substitution' (red), 
  // 'omission' (orange), 'insertion' (purple), 'transposition' (blue), 'reversal' (pink), 'self_correct' (cyan), 'current' (yellow border), 'unread' (gray)
  const [wordColors, setWordColors] = useState<Map<number, 'correct' | 'mispronounce' | 'substitution' | 'omission' | 'insertion' | 'transposition' | 'reversal' | 'self_correct' | 'current' | 'unread'>>(new Map());

  // Heard Mic Display state
  const [partialText, setPartialText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [frequencyData, setFrequencyData] = useState<Uint8Array | undefined>();
  const [latency, setLatency] = useState<number>(0);  // 100% REAL-TIME: Track latency
  const [hybridMode, setHybridMode] = useState<'word_by_word' | 'multi_word'>('word_by_word');  // HYBRID: Current mode
  const [readingSpeed, setReadingSpeed] = useState<number>(0);  // HYBRID: Words per second
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Refs for auto-scrolling to current word
  const currentWordRef = useRef<HTMLSpanElement>(null);
  const storyContentRef = useRef<HTMLDivElement>(null);
  // Derived metrics are calculated from elapsed time and transcript

  // ============================================================================
  // PRONUNCIATION MATCHING REMOVED - Now handled by server
  // The server's word recognition enhancer handles all pronunciation matching
  // Frontend focuses on displaying server results and basic vocabulary filtering
  // ============================================================================

  // REMOVED: TAGALOG_PRONUNCIATION_DICTIONARY - Server handles pronunciation matching
  // REMOVED: buildStoryPronunciationMap - Server handles pronunciation variants
  // Frontend now only does basic vocabulary validation (word in story or not)

  // ============================================================================
  // VOSK CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Clean up all Vosk-related resources including WebSocket, audio nodes, and timers.
   * This function ensures proper cleanup to prevent memory leaks and resource conflicts.
   */
  const cleanupVosk = () => {
    console.log('🧹 [CLEANUP] Starting Vosk cleanup...');
    
    // Clear all timeouts and intervals
    if (voskReconnectTimeoutRef.current) {
      clearTimeout(voskReconnectTimeoutRef.current);
      voskReconnectTimeoutRef.current = null;
      console.log('🧹 [CLEANUP] Cleared reconnect timeout');
    }
    if (voskConnectionTimeoutRef.current) {
      clearTimeout(voskConnectionTimeoutRef.current);
      voskConnectionTimeoutRef.current = null;
      console.log('🧹 [CLEANUP] Cleared connection timeout');
    }
    if (voskHeartbeatIntervalRef.current) {
      clearInterval(voskHeartbeatIntervalRef.current);
      voskHeartbeatIntervalRef.current = null;
      console.log('🧹 [CLEANUP] Cleared heartbeat interval');
    }
    if (voskAudioSenderIntervalRef.current) {
      clearInterval(voskAudioSenderIntervalRef.current);
      voskAudioSenderIntervalRef.current = null;
      console.log('🧹 [CLEANUP] Cleared audio sender interval');
    }
    voskAudioQueueRef.current = [];

    // Disconnect audio nodes
    try {
      scriptNodeRef.current?.disconnect();
      console.log('🧹 [CLEANUP] Disconnected script node');
    } catch { }
    try {
      sourceNodeRef.current?.disconnect();
      console.log('🧹 [CLEANUP] Disconnected source node');
    } catch { }

    // Stop all audio tracks
    try {
      const stream = sourceNodeRef.current?.mediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log('🧹 [CLEANUP] Stopped audio tracks');
      }
    } catch { }

    // Close audio context
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        console.log('🧹 [CLEANUP] Closed audio context');
      }
    } catch { }

    // Close WebSocket with proper cleanup
    try {
      if (voskSocketRef.current) {
        const ws = voskSocketRef.current;
        console.log(`🧹 [CLEANUP] Closing WebSocket (readyState: ${ws.readyState})`);
        
        // Remove event listeners to prevent "Receiving end does not exist" errors
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, "Cleanup");
        }
        console.log('🧹 [CLEANUP] WebSocket closed');
      }
    } catch (error) {
      console.warn('🧹 [CLEANUP] Error closing WebSocket:', error);
    }

    // Clear refs
    scriptNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current = null;
    voskSocketRef.current = null;
    
    console.log('🧹 [CLEANUP] Vosk cleanup completed');
  };

  /**
   * Start a tiny sender loop that drains `voskAudioQueueRef` while respecting
   * `ws.bufferedAmount` to avoid building up a large WebSocket buffer.
   */
  const startVoskAudioSender = (ws: WebSocket) => {
    if (voskAudioSenderIntervalRef.current) {
      clearInterval(voskAudioSenderIntervalRef.current);
      voskAudioSenderIntervalRef.current = null;
    }

    voskAudioSenderIntervalRef.current = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;

      // Backpressure: if the underlying socket buffer is growing, pause sending.
      const bufferedAmount = (ws as any).bufferedAmount;
      if (typeof bufferedAmount === "number" && bufferedAmount > voskAudioMaxBufferedBytesRef.current) {
        return;
      }

      // Drain several chunks per cycle so 256-frame mic chunks keep up.
      // 256 @ 48kHz produces many chunks/second; single-send loops fall behind.
      let sendsThisTick = 0;
      const MAX_SENDS_PER_TICK = 8;
      while (sendsThisTick < MAX_SENDS_PER_TICK && voskAudioQueueRef.current.length > 0) {
        const nextBufferedAmount = (ws as any).bufferedAmount;
        if (typeof nextBufferedAmount === "number" && nextBufferedAmount > voskAudioMaxBufferedBytesRef.current) {
          break;
        }
        const chunk = voskAudioQueueRef.current.shift();
        if (!chunk) break;
        try {
          ws.send(chunk);
          sendsThisTick += 1;
        } catch (e) {
          console.warn("⚠️ Failed to send Vosk audio chunk:", e);
          break;
        }
      }
    }, 5);
  };

  /**
   * Attempt to reconnect to Vosk with exponential backoff.
   * Implements retry logic with increasing delays between attempts.
   */
  const attemptVoskReconnect = (startVoskFn: (isReconnect: boolean) => Promise<void>) => {
    // Maximum reconnection attempts to prevent infinite loops
    const MAX_RECONNECT_ATTEMPTS = 5;
    
    if (voskReconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`);
      setVoskStatus("disconnected");
      cleanupVosk();
      setIsRecording(false);
      alert(
        `Unable to connect to speech recognition service after ${MAX_RECONNECT_ATTEMPTS} attempts.\n\n` +
        `Please check:\n` +
        `1. Is the Vosk server running? (Local: ws://localhost:2700)\n` +
        `2. Is your internet connection working?\n` +
        `3. Try refreshing the page and starting again.`
      );
      return;
    }

    if (voskReconnectTimeoutRef.current) {
      clearTimeout(voskReconnectTimeoutRef.current);
    }

    voskReconnectAttemptsRef.current += 1;
    // ULTRA-FAST: Minimal delay for local connection (50ms base, max 500ms)
    const delay = Math.min(50 * Math.pow(2, voskReconnectAttemptsRef.current - 1), 500);

    console.log(`🔄 Attempting Vosk reconnect (attempt ${voskReconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);
    setVoskStatus("connecting");

    voskReconnectTimeoutRef.current = setTimeout(() => {
      if (isRecording && !isPaused && voskReconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
        cleanupVosk();
        startVoskFn(true);
      }
    }, delay);
  };

  /**
   * Initialize microphone access with optimal audio settings for Vosk.
   * Returns a MediaStream configured for speech recognition.
   * Uses the selected microphone device if available.
   * 
   * IMPROVED: Auto-detects microphone quality and applies optimal settings
   * - High-end mics: Minimal processing for best quality
   * - Low-end mics: Full processing for better recognition
   */
  const initializeMicrophone = async (): Promise<MediaStream> => {
    try {
      // Import audio configuration utility
      const { testMicrophoneAndRecommend } = await import('@/utils/audioConfig');
      
      // Test microphone and get recommended configuration
      const { config, recommendation } = await testMicrophoneAndRecommend(selectedMicId);
      
      console.log(`🎤 ${recommendation}`);
      console.log(`📊 Audio config:`, config.constraints);
      
      try {
        // Try with recommended settings
        const constraints = { ...config.constraints };
        if (selectedMicId) {
          constraints.deviceId = { exact: selectedMicId };
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: constraints,
        });
        
        console.log('✅ Microphone initialized with optimized settings');
        return stream;
        
      } catch (error) {
        console.warn('Failed with optimized settings, trying fallback:', error);
        
        // Fallback 1: Try with low-end settings (most compatible)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,  // Lower sample rate for compatibility
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              ...(selectedMicId && { deviceId: { exact: selectedMicId } })
            },
          });
          
          console.log('✅ Microphone initialized with fallback settings (low-end mode)');
          return stream;
          
        } catch (fallbackError) {
          console.warn('Failed with fallback settings, trying minimal:', fallbackError);
          
          // Fallback 2: Minimal settings (maximum compatibility)
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              ...(selectedMicId && { deviceId: selectedMicId })
            },
          });
          
          console.log('✅ Microphone initialized with minimal settings');
          return stream;
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize microphone:', error);
      throw error;
    }
  };

  /**
   * Create and configure audio context with audio processing nodes.
   * Sets up the audio pipeline for downsampling and sending to Vosk.
   */
  const setupAudioContext = async (stream: MediaStream): Promise<{
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
  }> => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const src = ctx.createMediaStreamSource(stream);
    // ULTRA-LOW LATENCY: Minimum valid buffer (256) = fastest processing, lowest latency
    // 256 samples @ 48kHz = ~5.33ms per chunk - minimum allowed by Web Audio API
    const script = ctx.createScriptProcessor(256, 1, 1);

    // Create analyser for frequency visualization
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyserRef.current = analyser;

    return { context: ctx, source: src, processor: script };
  };

  // Audio processing is now handled server-side
  // Frontend just sends raw Float32 audio data

  /**
   * Validate match result from server to ensure it has all required fields.
   * This prevents UI state corruption from malformed server responses.
   * Requirements: 5.5
   * 
   * @param result - The match result object to validate
   * @returns true if valid, false otherwise
   */
  const isValidMatchResult = (result: any): boolean => {
    if (!result) {
      console.error('❌ Invalid match result: result is null or undefined');
      return false;
    }

    // Check if result is an object (not a primitive or array)
    if (typeof result !== 'object' || Array.isArray(result)) {
      console.error('❌ Invalid match result: result must be an object, got:', typeof result);
      return false;
    }

    // Check for required fields
    const requiredFields = ['match_type', 'advance', 'new_position', 'miscue_count'];
    const missingFields = requiredFields.filter(field => !(field in result));

    if (missingFields.length > 0) {
      console.error('❌ Invalid match result: missing required fields:', missingFields);
      console.error('   Received:', result);
      return false;
    }

    // Validate field types
    if (typeof result.match_type !== 'string') {
      console.error('❌ Invalid match result: match_type must be a string, got:', typeof result.match_type);
      return false;
    }

    if (typeof result.advance !== 'boolean') {
      console.error('❌ Invalid match result: advance must be a boolean, got:', typeof result.advance);
      return false;
    }

    if (typeof result.new_position !== 'number') {
      console.error('❌ Invalid match result: new_position must be a number, got:', typeof result.new_position);
      return false;
    }

    if (typeof result.miscue_count !== 'number') {
      console.error('❌ Invalid match result: miscue_count must be a number, got:', typeof result.miscue_count);
      return false;
    }

    return true;
  };

  /**
   * Set up WebSocket message handlers for Vosk recognition results.
   * Processes both final and partial recognition results with vocabulary validation.
   */
  const setupVoskMessageHandlers = (ws: WebSocket) => {
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        // Handle server error messages (e.g., model not available)
        if (msg.error) {
          console.error(`❌ Server error: ${msg.error}`);
          if (msg.available_models) {
            console.error(`   Available models: ${msg.available_models.join(", ")}`);
            console.error(`   Requested language: ${msg.requested_language}`);
            
            // Show user-friendly error
            const availableModels = msg.available_models.join(" or ");
            const requestedLang = msg.requested_language === "english" ? "English" : "Tagalog";
            alert(
              `${requestedLang} model is not available on the server.\n\n` +
              `Available models: ${availableModels}\n\n` +
              `Please:\n` +
              `1. Use a story in ${availableModels} language, or\n` +
              `2. Start the server with the ${requestedLang.toLowerCase()} model loaded.\n\n` +
              `To load both models, run: cd VoskServer && python download_huggingface_model.py`
            );
          }
          cleanupVosk();
          setVoskStatus("disconnected");
          setIsRecording(false);
          return;
        }

        // Handle grammar constraint confirmation from server
        if (msg.status === "grammar_applied") {
          console.log(`✅ Server confirmed grammar constraint: ${msg.word_count} words`);
          return;
        }

        // DEBUGGING: Log all Vosk messages to diagnose recognition issues
        if (msg.text || msg.partial) {
          // AUDIO QUALITY CHECK: Check confidence scores if available
          let avgConfidence = 100;
          if (msg.result && Array.isArray(msg.result)) {
            const confidences = msg.result
              .filter((w: any) => w.conf !== undefined)
              .map((w: any) => w.conf * 100);
            
            if (confidences.length > 0) {
              avgConfidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
            }
          }
          
          // ULTRA-LOW LATENCY: Skip logging for instant processing
          // Logging adds 5-10ms overhead per message
          
          // REJECT LOW CONFIDENCE: If average confidence is below 40%, likely noise
          // DISABLED: User's voice is clear, don't filter based on confidence
          if (avgConfidence < 40) {
            // Don't return - process it anyway
          }
        }

        // ULTRA-FAST: Update display immediately without any delay
        // Update heard mic display with partial text
        if (msg.partial && msg.partial.trim()) {
          const rawPartial = msg.partial.trim();
          const filteredPartial = filterThroughVocabulary(rawPartial, storyVocabulary);
          const toShow =
            filteredPartial && filteredPartial.trim().length > 0 ? filteredPartial : rawPartial;

          const maxLen = 80;
          setPartialText(toShow.length > maxLen ? `${toShow.slice(0, maxLen - 3)}...` : toShow);
          
          // 100% REAL-TIME: Measure and track latency
          if (msg.timestamp) {
            const latencyMs = Date.now() - (msg.timestamp * 1000);
            setLatency(latencyMs);
            if (latencyMs > 50) {
              console.log(`⏱️ Partial latency: ${latencyMs}ms`);
            }
          }
        }

        // Update heard mic display with final text
        if (msg.text && msg.text.trim() && msg.final === true) {
          const filteredFinal = filterThroughVocabulary(msg.text.trim(), storyVocabulary);
          setFinalText(filteredFinal || msg.text.trim());
          setPartialText(""); // Clear partial when final is received
          
          // 100% REAL-TIME: Measure and track latency
          if (msg.timestamp) {
            const latencyMs = Date.now() - (msg.timestamp * 1000);
            setLatency(latencyMs);
            if (latencyMs > 50) {
              console.log(`⏱️ Final latency: ${latencyMs}ms`);
            }
          }
        }

        // 100% REAL-TIME: Handle word_match messages for miscue-based word coloring
        if (msg.type === 'word_match') {
          const { 
            word, expected_word, is_correct, position, advance, new_position, 
            words_read, total_miscues, timestamp, mode, reading_speed, buffer, 
            miscue_type, miscue_severity, server_position, server_words_read,
            reconciliation_timestamp 
          } = msg;
          
          console.log(`🎤 HEARD WORD: "${word}" at position ${position} -> ${is_correct ? 'CORRECT' : 'MISCUE'}`);
          
          // SIMPLIFIED INDEXING: Always trust the server's position and new_position
          const serverPosition = typeof position === "number" ? position : currentWordIndex;
          const nextPosition = typeof new_position === "number" ? new_position : serverPosition + 1;
          
          // Position reconciliation - sync with server immediately
          if (server_position !== undefined && server_position !== currentWordIndex) {
            console.log(`🔄 Syncing position: frontend=${currentWordIndex} -> server=${server_position}`);
            setCurrentWordIndex(server_position);
            currentWordIndexLockRef.current = server_position;
          }
          
          const normalizedMiscueType = normalizeServerMiscueType(miscue_type, is_correct);

          // Guard: empty/whitespace payloads should never advance/lock.
          const wordStr = String(word ?? "").trim();
          const expectedWordStr = String(expected_word ?? "").trim();
          if (!wordStr && !expectedWordStr) return;
          
          // Measure latency
          if (timestamp) {
            const latencyMs = Date.now() - (timestamp * 1000);
            setLatency(latencyMs);
            if (latencyMs > 30) {
              console.log(`⏱️ Word match latency: ${latencyMs}ms`);
            }
          }
          
          // Update hybrid mode and reading speed
          if (mode) {
            setHybridMode(mode);
          }
          if (reading_speed !== undefined) {
            setReadingSpeed(reading_speed);
          }
          
          // Log word match details
          const modeStr = mode === 'word_by_word' ? '1-by-1' : 'Multi';
          const miscueInfo = normalizedMiscueType ? ` [${normalizedMiscueType.toUpperCase()}:${miscue_severity}]` : '';
          console.log(`🎯 WORD MATCH [${modeStr}]: "${word}" vs "${expected_word}" = ${is_correct ? '✅' : '❌'}${miscueInfo}`);
          
          // Apply miscue-based word coloring at the correct position
          setWordColors(prev => new Map(prev).set(serverPosition, normalizedMiscueType as any));
          
          // ACCURATE INDEXING: Always advance when server says to advance OR when word is correct
          const shouldAdvance = Boolean(advance) || is_correct || normalizedMiscueType === "correct" || normalizedMiscueType === "self_correct";

          if (shouldAdvance) {
            console.log(`🟡 ADVANCING: position ${currentWordIndex} → ${nextPosition}`);
            setCurrentWordIndex(nextPosition);
            currentWordIndexLockRef.current = nextPosition;
            
            // Mark word as recognized if correct
            if (is_correct || normalizedMiscueType === 'correct' || normalizedMiscueType === 'self_correct') {
              setRecognizedWords(prev => new Set(prev).add(serverPosition));
              console.log(`✅ CORRECT: "${word}" at position ${serverPosition}`);
            } else {
              // Miscue but still advance
              setMiscues(prev => prev + 1);
              console.log(`❌ MISCUE: "${word}" (expected "${expected_word}") at position ${serverPosition}`);
            }
          } else {
            console.log(`⏸️ NOT ADVANCING: advance=${advance}, is_correct=${is_correct}, type=${normalizedMiscueType}`);
          }
          
          // Update words read counter
          if (typeof words_read === "number") {
            setWordsRead(words_read);
          }

          // Update "Heard" display with the word that was just processed
          const heardWord = String(word || expected_word || "").trim();
          if (heardWord.length > 0 && shouldAdvance) {
            setFinalText((prev) => {
              const trimmedPrev = prev.trim();
              return trimmedPrev ? `${trimmedPrev} ${heardWord}` : heardWord;
            });
            setPartialText("");
          }
          
          return; // Don't process further
        }

        // New backend session summary payload from PhilIRIEngine
        if (msg.type === "phil_iri_summary") {
          const accuracy = Number(msg.accuracy_rate || 0);
          console.log("📘 PHIL-IRI SUMMARY:", msg);
          setServerMetrics(prev => ({
            ...prev,
            accuracy,
            oralReadingScore: accuracy,
          }));
          return;
        }

        // Handle backend word matching results
        if (msg.match_result) {
          // Validate match result before processing
          if (!isValidMatchResult(msg.match_result)) {
            return;
          }

          const { match_type, new_position, details, advance } = msg.match_result;
          const metrics = msg.metrics;
          const word = msg.text;
          
          console.log(`🎯 Backend match: ${match_type} - ${details}`);
          
          // Get old position from ref (tracks last known position accurately)
          const oldPosition = lastPositionRef.current;
          
          /**
           * Single position update function - only updates when advance is true
           * This ensures position is updated exactly once per word
           * Gracefully handles delayed match results by preventing backwards position jumps
           * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2
           */
          const updatePosition = (newPos: number) => {
            if (advance && newPos !== undefined) {
              // Prevent backwards position jumps from delayed results (Requirement 5.2)
              // Only advance if new position is greater than current position
              if (newPos > oldPosition) {
                setCurrentWordIndex(newPos);
                lastPositionRef.current = newPos;
                currentWordIndexLockRef.current = Math.max(currentWordIndexLockRef.current, newPos);
                console.log(`🟡 Position updated from ${oldPosition} to ${newPos}`);
              } else if (newPos < oldPosition) {
                // Log but don't update - this is a delayed result arriving late
                console.log(`⚠️ Ignoring delayed result: would move position backwards from ${oldPosition} to ${newPos}`);
              } else {
                // newPos === oldPosition - duplicate result, ignore silently
                console.log(`⚠️ Ignoring duplicate result for position ${newPos}`);
              }
            }
          };
          
          /**
           * Validate that a spoken word is in the story vocabulary
           * REQUIREMENT: Only accept words that belong to the story
           */
          // IMPROVED: Smart vocabulary validation with fuzzy matching
          const isWordInStory = (spokenWord: string): boolean => {
            if (!spokenWord || !storyVocabulary || storyVocabulary.size === 0) {
              return true; // If no vocabulary loaded, accept all words
            }
            
            const normalized = spokenWord.toLowerCase().trim();
            
            // Direct match
            const isInVocab = Array.from(storyVocabulary).some(
              v => v.toLowerCase().trim() === normalized
            );
            
            if (isInVocab) {
              return true;
            }
            
            // Fuzzy matching for pronunciation variations
            const vocabArray = Array.from(storyVocabulary);
            for (const vocabWord of vocabArray) {
              const similarity = calculateSimilarity(normalized, vocabWord.toLowerCase().trim());
              if (similarity >= 0.70) { // 70% similarity threshold
                console.log(`   🔍 Fuzzy match: "${spokenWord}" ≈ "${vocabWord}" (${(similarity * 100).toFixed(1)}%)`);
                return true;
              }
            }
            
            // Debug: Log vocabulary check for words not found
            if (spokenWord.length > 2) {
              console.log(`   📋 Vocab check: "${spokenWord}" not found. Available: ${vocabArray.slice(0, 20).join(', ')}...`);
            }
            
            return false;
          };
          
          // Helper function for similarity calculation
          const calculateSimilarity = (word1: string, word2: string): number => {
            if (word1 === word2) return 1.0;
            
            const longer = word1.length > word2.length ? word1 : word2;
            const shorter = word1.length > word2.length ? word2 : word1;
            
            if (longer.length === 0) return 1.0;
            
            const editDistance = levenshteinDistance(longer, shorter);
            return (longer.length - editDistance) / longer.length;
          };
          
          // Levenshtein distance calculation
          const levenshteinDistance = (str1: string, str2: string): number => {
            const matrix = [];
            
            for (let i = 0; i <= str2.length; i++) {
              matrix[i] = [i];
            }
            
            for (let j = 0; j <= str1.length; j++) {
              matrix[0][j] = j;
            }
            
            for (let i = 1; i <= str2.length; i++) {
              for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                  matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                  matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                  );
                }
              }
            }
            
            return matrix[str2.length][str1.length];
          };
          
          switch (match_type) {
            case 'waiting_for_start':
              // Ignore - waiting for first word
              console.log(`⏳ Waiting for story to start, ignoring word`);
              // Reset position ref at start of session
              lastPositionRef.current = 0;
              // Don't mark anything - session hasn't started yet
              return;  // Don't update anything
              
            case 'pending':
              // Word is pending - waiting to see if next word matches
              // Check if word is in story vocabulary - if not, reject it
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring`);
                return; // Reject words not in the story
              }
              
              // Word is pending - waiting to see if next word matches
              // This could be an insertion
              console.log(`⏸️ Word pending: "${word}" - waiting for next word`);
              return;  // Don't mark anything yet
              
            case 'buffering':
              // Buffering words - check if it actually matches the expected word
              // If it does, mark it as correct immediately instead of waiting
              const expectedWord = words[oldPosition] || '';
              const normalizedSpoken = word.toLowerCase().trim();
              const normalizedExpected = expectedWord.toLowerCase().trim();
              
              // First check: is the word in the story vocabulary?
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring buffered word`);
                return; // Reject words not in the story
              }
              
              // Check if the buffered word matches the expected word
              if (normalizedSpoken === normalizedExpected) {
                console.log(`✅ Buffered word matches expected: "${word}" === "${expectedWord}"`);
                // Mark as correct immediately - use server's new_position
                updatePosition(new_position);
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
              } else {
                // Word doesn't match - trust server to handle transposition detection
                console.log(`📦 Buffering: "${word}" at position ${oldPosition} (doesn't match "${expectedWord}")`);
                // Don't update position for buffering - wait for server to advance
              }
              break;
              
            case 'correct':
              // Trust server's classification - no client-side transposition detection
              // Update position and mark word as recognized (correct)
              updatePosition(new_position);
              
              // Track timestamp for time-based repetition filtering
              lastWordTimestampRef.current = Date.now();
              
              // Mark the word at oldPosition as correctly read
              if (oldPosition >= 0 && oldPosition < words.length) {
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
              }
              break;
              
            // Track miscue types for visual display
            case 'omission':
              updatePosition(new_position);
              // Omission detection handled server-side
              setCurrentWordIndex(new_position);
              console.log(`⭕ Omission detected at position ${oldPosition}`);
              break;
              
            case 'mispronunciation':
              // Validate word is in story vocabulary
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring mispronunciation`);
                return; // Reject words not in the story
              }
              
              updatePosition(new_position);
              if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                countedMiscuePositionsRef.current.add(oldPosition);
                
                const expectedWord = words[oldPosition] || '';
                
                // Server already validated - just record the miscue
                setWordMiscues(prev => new Map(prev).set(oldPosition, 'mispronunciation'));
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, mispronunciation: prev.mispronunciation + 1 }));
                
                console.log(`🔊 Mispronunciation: "${word}" → "${expectedWord}"`);
              }
              setCurrentWordIndex(new_position);
              console.log(`� Mispronunciation detected at position ${oldPosition}`);
              break;
              
            case 'reversal':
              // Validate word is in story vocabulary
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring reversal`);
                return; // Reject words not in the story
              }
              
              updatePosition(new_position);
              if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                countedMiscuePositionsRef.current.add(oldPosition);
                setWordMiscues(prev => new Map(prev).set(oldPosition, 'reversal'));
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, reversal: prev.reversal + 1 }));
              }
              setCurrentWordIndex(new_position);
              console.log(`🔄 Reversal detected at position ${oldPosition}`);
              break;
              
            case 'substitution':
              // Validate word is in story vocabulary
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring substitution`);
                return; // Reject words not in the story
              }
              
              updatePosition(new_position);
              if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                countedMiscuePositionsRef.current.add(oldPosition);
                
                const expectedWord = words[oldPosition] || '';
                
                // Server already validated - just record the miscue
                setWordMiscues(prev => new Map(prev).set(oldPosition, 'substitution'));
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, substitution: prev.substitution + 1 }));
                
                // Store the spoken word for annotation display
                if (word) {
                  setWordMarkings(prev => new Map(prev).set(oldPosition, {
                    type: 'substitution',
                    marking: 'line-through',
                    spokenWord: word,
                    correctWord: expectedWord
                  }));
                }
                
                console.log(`🔄 Substitution: "${word}" → "${expectedWord}"`);
              }
              setCurrentWordIndex(new_position);
              console.log(`� Substitution detected at position ${oldPosition}: "${word}"`);
              break;
              
            case 'insertion':
              // Validate word is in story vocabulary
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring insertion`);
                return; // Reject words not in the story
              }
              
              updatePosition(new_position);
              // Insertions don't advance position, mark at current position
              if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                countedMiscuePositionsRef.current.add(oldPosition);
                setWordMiscues(prev => new Map(prev).set(oldPosition, 'insertion'));
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, insertion: prev.insertion + 1 }));
                if (word) {
                  setInsertedWords(prev => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(oldPosition) || [];
                    newMap.set(oldPosition, [...existing, word]);
                    return newMap;
                  });
                }
              }
              setCurrentWordIndex(new_position);
              console.log(`➕ Insertion detected at position ${oldPosition}: "${word}"`);
              break;
              
            case 'repetition':
              // Validate word is in story vocabulary
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring repetition`);
                return; // Reject words not in the story
              }
              
              updatePosition(new_position);
              
              // Track timestamp for time-based repetition filtering
              const currentTime = Date.now();
              const timeGapMs = currentTime - lastWordTimestampRef.current;
              lastWordTimestampRef.current = currentTime;
              
              if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                countedMiscuePositionsRef.current.add(oldPosition);
                setWordMiscues(prev => new Map(prev).set(oldPosition, 'repetition'));
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, repetition: prev.repetition + 1 }));
              }
              setCurrentWordIndex(new_position);
              console.log(`🔁 Repetition detected at position ${oldPosition} (time gap: ${timeGapMs}ms)`);
              break;
              
            case 'selfCorrection':
              // Validate word is in story vocabulary
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring self-correction`);
                return; // Reject words not in the story
              }
              
              updatePosition(new_position);
              // Self-corrections are NOT counted as miscues per DepEd standards
              // But we track them for comprehension assessment
              
              {
                const expectedWord = words[oldPosition] || '';
                
                // Server already validated - just record the self-correction
                setWordMiscues(prev => new Map(prev).set(oldPosition, 'selfCorrection'));
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
                
                console.log(`✅ Self-correction: "${word}" → "${expectedWord}"`);
              }
              setCurrentWordIndex(new_position);
              console.log(`✅ Self-correction detected at position ${oldPosition}`);
              break;
              
            case 'transposition':
              // Validate word is in story vocabulary
              if (!isWordInStory(word)) {
                console.log(`❌ REJECTED: "${word}" is NOT in story vocabulary - ignoring transposition`);
                return; // Reject words not in the story
              }
              
              updatePosition(new_position);
              if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                countedMiscuePositionsRef.current.add(oldPosition);
                setWordMiscues(prev => new Map(prev).set(oldPosition, 'transposition'));
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, transposition: prev.transposition + 1 }));
              }
              setCurrentWordIndex(new_position);
              console.log(`↔️ Transposition detected at position ${oldPosition}`);
              break;
          }
          
          // Update basic metrics from backend (source of truth)
          if (metrics) {
            console.log(`📊 Metrics: WPM=${metrics.wpm}, Words=${metrics.words_read}`);
            
            setWordsRead(metrics.words_read);
            
            setServerMetrics({
              wpm: metrics.wpm,
              accuracy: metrics.accuracy,
              oralReadingScore: metrics.oral_reading_score,
              wordsRead: metrics.words_read,
              totalMiscues: metrics.total_miscues || 0
            });
          }
          
          return;  // Exit early - backend handled everything
        }
        
        // Fallback: if backend doesn't provide match_result, use final text to keep UI responsive.
        if (msg.text && msg.text.trim() && msg.final === true) {
          const advanced = fallbackAdvanceFromFinalText(msg.text.trim());
          if (advanced) {
            console.log("⚠️ Backend match missing - applied fallback word advancement from final text");
            return;
          }
        }

        console.log("⚠️ Received message without match_result and no fallback advance");
      } catch (error) {
        console.error("Failed to process Vosk recognition result:", error);
      }
    };
  };

  /**
   * Set up WebSocket error and close handlers with reconnection logic.
   * Provides user-friendly error messages and automatic reconnection.
   */
  const setupVoskConnectionHandlers = (
    ws: WebSocket,
    isReconnect: boolean,
    startVoskFn: (isReconnect: boolean) => Promise<void>
  ) => {
    ws.onerror = (error) => {
      console.error("Speech recognition connection error:", error);

      // attemptVoskReconnect now handles the max attempts check internally
        attemptVoskReconnect(startVoskFn);
    };

    ws.onclose = (event) => {
      setVoskStatus("disconnected");
      const wsUrl = ws.url || "unknown";

      if (voskHeartbeatIntervalRef.current) {
        clearInterval(voskHeartbeatIntervalRef.current);
        voskHeartbeatIntervalRef.current = null;
      }

      // Detailed close code analysis
      const closeCodeMessages: { [key: number]: string } = {
        1000: "Normal closure",
        1001: "Going away (server restarting)",
        1002: "Protocol error",
        1003: "Unsupported data type",
        1006: "Abnormal closure (connection refused/unreachable)",
        1007: "Invalid data",
        1008: "Policy violation",
        1009: "Message too large",
        1011: "Internal server error",
        1012: "Service restart",
        1013: "Try again later",
        1014: "Bad gateway",
        1015: "TLS handshake failure"
      };

      const closeMessage = closeCodeMessages[event.code] || `Unknown code: ${event.code}`;
      const closeReason = event.reason || closeMessage;
      
      console.warn(`🔴 WebSocket closed:`);
      console.warn(`   URL: ${wsUrl}`);
      console.warn(`   Code: ${event.code} (${closeMessage})`);
      console.warn(`   Reason: ${closeReason}`);
      console.warn(`   Was clean: ${event.wasClean}`);

      // Provide specific guidance based on close code
      if (event.code === 1006) {
        console.error(`❌ Abnormal closure (1006) - Common causes:`);
        console.error(`   1. Local Vosk server is not running or crashed`);
        console.error(`   2. Wrong URL or service name`);
        console.error(`   3. Network/firewall blocking WebSocket connections`);
      } else if (event.code === 1008) {
        console.error(`❌ Policy violation (1008) - Service rejected connection`);
        if (closeReason && closeReason.includes("model not loaded")) {
          console.error(`   💡 The requested language model is not available on the server.`);
          console.error(`   💡 Available models: Check server logs or use a different language.`);
          console.error(`   💡 To fix: Download the model or start server with both models loaded.`);
          
          // Show user-friendly alert if not a reconnect attempt
          if (!isReconnect && isRecording) {
            const requestedLang = storyLanguage === "english" ? "English" : "Tagalog";
            alert(
              `The ${requestedLang} speech recognition model is not available on the server.\n\n` +
              `Please:\n` +
              `1. Switch to a story in the available language, or\n` +
              `2. Start the server with the ${requestedLang.toLowerCase()} model loaded.\n\n` +
              `To load models: cd VoskServer && python download_huggingface_model.py`
            );
            setIsRecording(false);
          }
        } else {
          console.error(`   Check server logs for specific error message`);
        }
      } else if (event.code === 1011) {
        console.error(`❌ Internal server error (1011) - Service crashed`);
        console.error(`   Check server logs for crash details`);
      }

      // Only attempt reconnect if recording is active and it wasn't a clean close
      if (isRecording && !isPaused && event.code !== 1000) {
        // attemptVoskReconnect now handles the max attempts check internally
        attemptVoskReconnect(startVoskFn);
      } else if (event.code === 1000) {
        // Clean close - don't reconnect
        console.log("✅ Connection closed cleanly (code 1000)");
        cleanupVosk();
        setVoskStatus("disconnected");
      } else if (!isRecording || isPaused) {
        // Not recording or paused - don't reconnect
        console.log("⏸️ Not reconnecting: recording stopped or paused");
        cleanupVosk();
        setVoskStatus("disconnected");
      }
    };
  };

  // ============================================================================
  // END VOSK CONNECTION MANAGEMENT
  // ============================================================================

  // Detailed miscue tracking (Phil-IRI format) - Following DepEd Table 4 Rules
  const [miscues, setMiscues] = useState(0); // Total miscues
  const [miscueTypes, setMiscueTypes] = useState({
    mispronunciation: 0,  // Maling Bigkas - Count as 1 error every mispronunciation (dialectal variations not counted)
    omission: 0,          // Pagkakaltas - Count as one error a word or phrase omitted
    substitution: 0,      // Pagpapalit - Count as one error every substitution
    insertion: 0,         // Pagsisisingit - Count a word or phrase inserted as one error
    repetition: 0,        // Pag-uulit - Count as one error every word or phrase repeated
    transposition: 0,     // Pagpapalit ng Lugar - Count as one error every transposition made
    reversal: 0,          // Paglilipat - Count as one error every reversal made
    selfCorrection: 0     // Self-Correction - Don't count as error (marked with 'S')
  });

  // Track miscues per word for visual highlighting - Following DepEd Phil-IRI marking system
  type MiscueType = 'mispronunciation' | 'omission' | 'substitution' | 'insertion' | 'repetition' | 'transposition' | 'reversal' | 'selfCorrection';
  const [wordMiscues, setWordMiscues] = useState<Map<number, MiscueType>>(new Map());

  // Track marking annotations for each word (following DepEd Table 4)
  const [wordMarkings, setWordMarkings] = useState<Map<number, {
    type: MiscueType;
    marking: string; // The actual marking (underline, circle, caret, etc.)
    spokenWord?: string; // What the child actually said
    correctWord: string; // What should have been said
    wrongWord?: string; // For self-correction: what they said wrong first
    isFirstWord?: boolean; // For transposition: true if this is the first word of the pair
  }>>(new Map());

  // Track inserted words (extra words child said) with their position
  const [insertedWords, setInsertedWords] = useState<Map<number, string[]>>(new Map());
  
  // Track repeated words (words said twice) with their position
  // @ts-expect-error - Unused variable kept for future feature
  const [repeatedWords, setRepeatedWords] = useState<Map<number, string[]>>(new Map());

  // Miscue Types Detection section removed - no longer needed

  // ⚡ OPTIMISTIC UI: Track expected position after optimistic moves
  const optimisticWordIndexRef = useRef<number>(0); // Where we expect to be after optimistic moves


  // Server-calculated metrics (backend is source of truth)
  const [serverMetrics, setServerMetrics] = useState<{
    wpm?: number;
    accuracy?: number;
    oralReadingScore?: number;
    wordsRead?: number;
    totalMiscues?: number;
  }>({});

  // ============================================================================
  // FAST READING OPTIMIZATION: Reading Speed Tracking
  // ============================================================================
  const [matchTimestamps, setMatchTimestamps] = useState<number[]>([]);
  const [currentReadingSpeed, setCurrentReadingSpeed] = useState<number>(0); // words per second
  
  // Calculate reading speed from recent matches
  const calculateReadingSpeed = () => {
    if (matchTimestamps.length < 2) return 0;
    
    // Use last 10 matches for speed calculation
    const recentMatches = matchTimestamps.slice(-10);
    const timeSpan = recentMatches[recentMatches.length - 1] - recentMatches[0];
    
    if (timeSpan === 0) return 0;
    
    const wordsPerSecond = (recentMatches.length - 1) / (timeSpan / 1000);
    return wordsPerSecond;
  };
  
  // Get optimal buffer size based on reading speed
  const getOptimalBufferSize = (wordsPerSecond: number) => {
    if (wordsPerSecond < 2) return 15;  // Slow reading
    if (wordsPerSecond < 4) return 25;  // Normal reading
    if (wordsPerSecond < 6) return 35;  // Fast reading
    return 50;  // Very fast reading (5-10 words/sec)
  };

  // Real-time Oral Reading Score (Accuracy) - use server value if available
  const oralReadingScore = useMemo(() => {
    // Prefer server-calculated score (more accurate)
    if (serverMetrics.oralReadingScore !== undefined) {
      return serverMetrics.oralReadingScore.toFixed(1);
    }
    // Fallback to client calculation
    if (words.length === 0) return "0.0";
    const score = calculateOralReadingScore(wordsRead, miscues, words.length);
    return score.toFixed(1);
  }, [serverMetrics.oralReadingScore, wordsRead, miscues, words.length]);

  // Real-time Reading Speed (WPM) - use server value if available
  const readingSpeedWPM = useMemo(() => {
    // Prefer server-calculated WPM (more accurate)
    if (serverMetrics.wpm !== undefined && serverMetrics.wpm > 0) {
      return serverMetrics.wpm.toString();
    }
    // Fallback to client calculation
    return elapsedTime > 0
      ? calculateReadingSpeedWPM(wordsRead, elapsedTime).toString()
      : "0";
  }, [serverMetrics.wpm, wordsRead, elapsedTime]);

  // Helper: Convert numbers to words (0-100)
  const numberToWord = (num: string): string => {
    const numberMap: { [key: string]: string } = {
      '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
      '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
      '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
      '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
      '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
      '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy',
      '80': 'eighty', '90': 'ninety', '100': 'hundred'
    };
    return numberMap[num] || num;
  };

  // Helper: Normalize text for comparison (lowercase, convert numbers to words, remove punctuation)
  const normalize = (text: string | undefined | null) => {
    if (!text) return '';
    let normalized = text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    // Convert standalone numbers to words
    normalized = normalized.replace(/\b\d+\b/g, (match) => numberToWord(match));
    return normalized;
  };

  // Helper: Check if a word contains any alphanumeric character
  const isWordAlphanumeric = (word: string) => /[a-zA-Z0-9]/.test(word);

  // Helper: Extract all readable words (alphanumeric only) from text, skipping punctuation/symbols
  function extractWordsFromText(text: string): string[] {
    // This regex matches words including contractions (e.g., "It's", "don't", "I'll")
    // \b\w+(?:'\w+)?\b matches: word boundary + word chars + optional apostrophe + more word chars
    return text.match(/\b\w+(?:'\w+)?\b/g) || [];
  }

  // Helper: Detect if a word is likely English (for language validation)
  function isLikelyEnglishWord(word: string): boolean {
    const normalized = normalize(word);

    // VERY CONSERVATIVE English-only patterns (only obvious English words)
    const englishPatterns = [
      /^(th|wh|sh|ch|ph)/i,  // English consonant clusters at start
      /ing$/i,                // -ing ending (rare in Tagalog)
      /tion$/i,               // -tion ending (English)
      /ness$/i,               // -ness ending (English)
      /ful$/i,                // -ful ending (English)
      /less$/i,               // -less ending (English)
      /ment$/i,               // -ment ending (English)
    ];

    // Check if word matches English patterns
    const hasEnglishPattern = englishPatterns.some(pattern => pattern.test(normalized));

    // VERY CONSERVATIVE English function words (only obvious English-only words)
    // Removed many ambiguous words that could be in other languages
    const englishFunctionWords = [
      'the', 'and', 'but', 'through', 'during',
      'being', 'would', 'should', 'could', 'might',
      'must', 'shall', 'these', 'those'
    ];

    return hasEnglishPattern || englishFunctionWords.includes(normalized);
  }

  // Helper: Detect if a word is likely Tagalog (for language validation)
  function isLikelyTagalogWord(word: string): boolean {
    const normalized = normalize(word);

    // Common Tagalog patterns
    const tagalogPatterns = [
      /^(ng|mga|ka|pa|na|ba|po|ma|naka|nag|mag|pag|um|in|an)/i,  // Tagalog particles/prefixes
      /ng$/i,                         // -ng ending (very common in Tagalog)
      /an$/i,                         // -an ending (common in Tagalog)
      /in$/i,                         // -in ending (Tagalog verb form)
      /ay$/i,                         // -ay ending (Tagalog)
      /han$/i,                        // -han ending (Tagalog)
      /hin$/i,                        // -hin ending (Tagalog)
    ];

    // Check if word matches Tagalog patterns
    const hasTagalogPattern = tagalogPatterns.some(pattern => pattern.test(normalized));

    // Common Tagalog function words and content words
    const tagalogFunctionWords = [
      'ang', 'ng', 'sa', 'mga', 'ay', 'na', 'pa', 'ba', 'po', 'opo',
      'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila',
      'ko', 'mo', 'niya', 'namin', 'natin', 'ninyo', 'nila',
      'ito', 'iyan', 'iyon', 'dito', 'diyan', 'doon',
      'may', 'mayroon', 'meron',  // "may" is Tagalog (there is/has)
      'si', 'ni', 'kay',          // Personal markers
      'nasa', 'sa', 'para',       // Prepositions
      'at', 'o', 'pero',          // Conjunctions
      'hindi', 'oo', 'opo',       // Yes/No
      'ano', 'sino', 'saan', 'kailan', 'bakit', 'paano', // Question words
      'dora', 'maria', 'juan',    // Common Filipino names
      'baka', 'aso', 'pusa',      // Common animals
      'bahay', 'sapa', 'ilog',    // Common places/things
      'katabi', 'kasama', 'kaibigan', // Common descriptive words
      'nila', 'namin', 'natin'    // Possessive pronouns
    ];

    return hasTagalogPattern || tagalogFunctionWords.includes(normalized);
  }

  // Levenshtein distance implementation
  function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const v0 = Array(b.length + 1).fill(0);
    const v1 = Array(b.length + 1).fill(0);
    for (let i = 0; i <= b.length; i++) v0[i] = i;
    for (let i = 0; i < a.length; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < b.length; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
    }
    return v1[b.length];
  }

  /**
   * Universal pronunciation matching for children's reading.
   * Now uses pronunciation dictionaries + advanced algorithms.
   * LANGUAGE-AWARE: Prevents cross-language false matches (e.g., English words in Tagalog stories)
   */
  function isWordMatch(spokenWord: string, expectedWord: string, checkLanguage: boolean = false): boolean {
    const normSpoken = normalize(spokenWord);
    const normExpected = normalize(expectedWord);
    if (!normSpoken || !normExpected) return false;

    // LANGUAGE VALIDATION: Only check when explicitly requested (for current expected word)
    if (checkLanguage) {
      // If reading Tagalog story, reject English words that don't match Tagalog expected words
      if (storyLanguage === 'tagalog') {
        const spokenIsEnglish = isLikelyEnglishWord(normSpoken);
        const expectedIsTagalog = isLikelyTagalogWord(normExpected);

        // If child said an English word but expected word is clearly Tagalog, reject
        if (spokenIsEnglish && expectedIsTagalog && normSpoken !== normExpected) {
          console.log(`⚠️ Language mismatch: Child said English word "${spokenWord}" in Tagalog story (expected Tagalog: "${expectedWord}")`);
          return false;
        }
      }

      // REVERSE: If reading English story, reject Tagalog words that don't match English expected words
      if (storyLanguage === 'english') {
        const spokenIsTagalog = isLikelyTagalogWord(normSpoken);
        const expectedIsEnglish = isLikelyEnglishWord(normExpected);

        // If child said a Tagalog word but expected word is clearly English, reject
        if (spokenIsTagalog && expectedIsEnglish && normSpoken !== normExpected) {
          console.log(`⚠️ Language mismatch: Child said Tagalog word "${spokenWord}" in English story (expected English: "${expectedWord}")`);
          return false;
        }
      }
    }

    // DISABLED: Local pronunciation dictionary - now using Dictionary API via Vosk server
    // The Vosk server will validate words using the Dictionary API
    // if (isPronunciationMatch(normSpoken, normExpected, storyLanguage)) {
    // Simple word matching - server handles complex matching
    // Just do basic normalization check
    return normSpoken === normExpected;
  }

  // Helper: Split text into display words and normalized words, and mark if each is alphanumeric
  const splitAndNormalizeWords = (text: string) => {
    const displayWords = text.split(/\s+/).filter(Boolean);
    const normalizedWords = displayWords.map(normalize);
    const isAlphanumeric = displayWords.map(isWordAlphanumeric);
    return { displayWords, normalizedWords, isAlphanumeric };
  };

  /**
   * Extract vocabulary from story text for vocabulary-constrained recognition.
   * Returns a Set of normalized words for efficient O(1) lookup.
   * Includes word variations (plurals, past tense, gerunds) to handle children's speech patterns.
   */
  const extractVocabulary = (text: string): Set<string> => {
    const vocabulary = new Set<string>();

    // Extract all words including contractions (e.g., "It's", "don't", "I'll")
    const words = text.match(/\b\w+(?:'\w+)?\b/g) || [];
    
    console.log(`🔍 Extracting vocabulary from ${words.length} raw words`);

    // Common phonetic variants to help Vosk accuracy
    const phoneticVariants: { [key: string]: string[] } = {
      'when': ['wen', 'wen', 'whn'],
      'the': ['da', 'de', 'thee', 'thuh'],
      'a': ['uh', 'ay', 'ah'],
      'she': ['shee', 'shi'],
      'he': ['hee', 'hi'],
      'heard': ['herd', 'hurd'],
      'rooster': ['roosta', 'ruster'],
      'crow': ['cro', 'krow']
    };

    for (const word of words) {
      const normalized = normalize(word);
      if (!normalized) continue;

      // Add the base word (always)
      vocabulary.add(normalized);

      // Add phonetic variants if available
      if (phoneticVariants[normalized]) {
        phoneticVariants[normalized].forEach(variant => vocabulary.add(variant));
      }

      // Contraction variations (useful for both languages)
      if (normalized.includes("'")) {
        vocabulary.add(normalized.replace("'", ''));
      }
      
      // Add common morphological variations
      if (normalized.length > 3) {
        vocabulary.add(normalized + 's');    // Plurals
        vocabulary.add(normalized + 'ed');   // Past tense
        vocabulary.add(normalized + 'ing');  // Gerunds
      }
    }
    
    // Log all vocabulary for debugging
    console.log(`✅ Final vocabulary (${vocabulary.size} words): ${Array.from(vocabulary).sort().join(', ')}`);

    return vocabulary;
  };

  /**
   * Detect the primary language of the story based on vocabulary analysis.
   * PRIORITIZES TAGALOG DETECTION - defaults to Tagalog if any Tagalog indicators found.
   * Returns 'english' or 'tagalog'.
   */
  const detectStoryLanguage = (vocabulary: Set<string>): 'english' | 'tagalog' => {
    console.log('🔍 [LANGUAGE-DETECT] Analyzing vocabulary:', Array.from(vocabulary));

    // Quick check for obvious Tagalog indicators - if ANY found, use Tagalog
    const vocabularyArray = Array.from(vocabulary);
    const obviousTagalogWords = ['nasa', 'may', 'si', 'ni', 'ang', 'sa', 'sapa', 'katabi', 'nila', 'tara', 'tayo', 'sabi', 'dora', 'mga', 'ay', 'na', 'pa', 'ba', 'po'];
    const hasObviousTagalog = obviousTagalogWords.some(word => 
      vocabularyArray.some(vocabWord => vocabWord.toLowerCase() === word.toLowerCase())
    );

    if (hasObviousTagalog) {
      console.log('🔍 [LANGUAGE-DETECT] Found obvious Tagalog words, FORCING Tagalog detection');
      return 'tagalog';
    }

    // Count Tagalog patterns - if ANY Tagalog patterns found, prefer Tagalog
    let tagalogCount = 0;
    let obviousEnglishCount = 0;

    for (const word of vocabulary) {
      const isTagalog = isLikelyTagalogWord(word);
      const isObviousEnglish = isLikelyEnglishWord(word); // Now very conservative
      
      if (isTagalog) {
        tagalogCount++;
        console.log(`   📝 "${word}" -> Tagalog`);
      }
      if (isObviousEnglish) {
        obviousEnglishCount++;
        console.log(`   📝 "${word}" -> English`);
      }
      if (!isTagalog && !isObviousEnglish) {
        console.log(`   ❓ "${word}" -> Unknown (assuming Tagalog)`);
        // Treat unknown words as potentially Tagalog
        tagalogCount++;
      }
    }

    console.log(`🔍 [LANGUAGE-DETECT] Results: Tagalog=${tagalogCount}, Obvious English=${obviousEnglishCount}`);

    // BIAS TOWARD TAGALOG: Only use English if there are obvious English words AND no Tagalog
    if (tagalogCount > 0) {
      console.log(`🔍 [LANGUAGE-DETECT] Detected: TAGALOG (found ${tagalogCount} Tagalog indicators)`);
      return 'tagalog';
    }
    
    console.log(`🔍 [LANGUAGE-DETECT] Detected: ENGLISH (no Tagalog indicators found)`);
    return 'english';
  };

  // REMOVED: buildStoryPronunciationMap - Server handles pronunciation matching
  // The server's word recognition enhancer handles all pronunciation variants

  /**
   * Filter recognized text through vocabulary validation.
   * ULTRA-STRICT MODE: Only accepts words that are actually in the story.
   * 
   * Blocks:
   * - Random words not in the story
   * - Background noise and filler words (um, uh, ah, etc.)
   * - Ghost words (the, a, an, etc.) unless they're the EXPECTED word
   * - Off-topic speech
   * - Common misrecognitions (ti → the, etc.)
   * 
   * Accepts:
   * - Exact matches from story
   * - Close pronunciation variants (90%+ similarity)
   * - Words that match the CURRENT expected word
   * 
   * Returns filtered text with only valid story words.
   */
  const filterThroughVocabulary = (text: string, vocabulary: Set<string>): string => {
    if (!text || !vocabulary || vocabulary.size === 0) {
      return text;
    }

    // Split text into words
    const words = text.split(/\s+/).filter(Boolean);

    // Get current expected word for context-aware filtering
    const currentExpectedWord = realWords[currentWordIndex] || '';
    const normalizedExpected = normalize(currentExpectedWord);

    // ULTRA-STRICT FILTERING: Only accept words that are clearly in the story
    const validWords = words.filter(word => {
      // Reject very short words (likely noise) - increased from 2 to 3
      if (word.length < 3) {
        console.log(`❌ Rejected "${word}": too short (< 3 chars)`);
        return false;
      }

      // Reject if contains mostly non-letters (noise/gibberish)
      const letterCount = (word.match(/[a-zA-Z]/g) || []).length;
      if (letterCount < word.length * 0.8) { // Increased from 70% to 80%
        console.log(`❌ Rejected "${word}": not enough letters (${letterCount}/${word.length})`);
        return false;
      }

      const normalized = normalize(word);

      // Reject <unk> and other Vosk artifacts
      if (normalized === 'unk' || normalized.includes('<') || normalized.includes('>')) {
        console.log(`❌ Rejected "${word}": Vosk artifact`);
        return false;
      }

      // GHOST WORD FILTER: Reject common ghost words UNLESS they match the expected word
      const commonGhostWords = new Set([
        'the', 'de', 'a', 'an', 'and', 'or', 'is', 'it', 'in', 'at', 'to', 'of', 'by', 'up',
        'be', 'do', 'go', 'so', 'we', 'he', 'me', 'my', 'um', 'uh', 'er', 'ah', 'oh', 'eh',
        'hm', 'hmm', 'mm', 'shh', 'psst', 'yeah', 'yep', 'nope', 'okay', 'ok'
      ]);
      
      if (commonGhostWords.has(normalized)) {
        // Only accept if it matches the current expected word
        if (normalized === normalizedExpected) {
          console.log(`✅ Accepted ghost word "${word}": matches expected word "${currentExpectedWord}"`);
          return true;
        }
        console.log(`❌ Rejected "${word}": ghost word (not expected word)`);
        return false;
      }

      // Strategy 1: Exact match in vocabulary
      if (vocabulary.has(normalized)) {
        console.log(`✅ Accepted "${word}": exact vocabulary match`);
        return true;
      }

      // Strategy 2: Check if it matches the CURRENT expected word (context-aware)
      // This is the most important check - does it match what we're expecting RIGHT NOW?
      if (normalizedExpected && isWordMatch(word, currentExpectedWord, false)) {
        console.log(`✅ Accepted "${word}": matches current expected word "${currentExpectedWord}"`);
        return true;
      }

      // Strategy 3: VERY STRICT fuzzy matching (90%+ similarity, same first letter)
      // Only for words that are EXTREMELY similar - raised from 80% to 90%
      for (const vocabWord of vocabulary) {
        // Skip if length difference is too large (child won't drop/add 2+ letters)
        if (Math.abs(normalized.length - vocabWord.length) > 1) { // Reduced from 2 to 1
          continue;
        }

        const distance = levenshtein(normalized, vocabWord);
        const maxLength = Math.max(normalized.length, vocabWord.length);
        const similarity = maxLength > 0 ? (1 - (distance / maxLength)) * 100 : 0;

        // ULTRA-STRICT: 90% similarity + must share first letter
        const sameFirstLetter = normalized[0] === vocabWord[0];

        if (similarity >= 90 && sameFirstLetter) { // Increased from 80% to 90%
          console.log(`✅ Accepted "${word}": ultra-strict fuzzy match with "${vocabWord}" (${similarity.toFixed(0)}% similar)`);
          return true;
        }
      }

      console.log(`❌ Rejected "${word}": no match in vocabulary (expected: "${currentExpectedWord}")`);
      return false;
    });

    // If no words passed the filter, return empty string
    if (validWords.length === 0) {
      console.log(`🚫 All words rejected from: "${text}"`);
      return "";
    }

    console.log(`✅ Accepted words: "${validWords.join(' ')}" from: "${text}"`);
    return validWords.join(" ");
  };

  // Fallback path: if backend doesn't send match_result, advance using final recognized words.
  const fallbackAdvanceFromFinalText = (recognizedText: string): boolean => {
    if (!recognizedText?.trim() || words.length === 0) return false;

    const filtered = filterThroughVocabulary(recognizedText, storyVocabulary);
    if (!filtered) return false;

    const normalizeWord = (value: string) =>
      value.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "").trim();

    const spokenWords = filtered
      .split(/\s+/)
      .map(normalizeWord)
      .filter(Boolean);

    if (spokenWords.length === 0) return false;

    let pointer = Math.max(lastPositionRef.current || 0, currentWordIndexLockRef.current || 0);
    let advanced = 0;

    for (const spoken of spokenWords) {
      const expected = normalizeWord(words[pointer] || "");
      if (!expected) break;
      if (spoken === expected) {
        setRecognizedWords((prev) => new Set(prev).add(pointer));
        pointer += 1;
        advanced += 1;
      }
    }

    if (advanced > 0) {
      lastPositionRef.current = pointer;
      setCurrentWordIndex(pointer);
      currentWordIndexLockRef.current = pointer;
      setWordsRead((prev) => Math.max(prev, pointer));
      return true;
    }

    return false;
  };

  // Start recording and speech recognition
  const handleStartRecording = () => {
    if (currentSession?.status === "completed") {
      alert("This session is already completed. Recording is disabled.");
      return;
    }
    // Call the actual startRecording function
    startRecording();
  };

  // Actual recording start
  const preloadVoskConnection = async () => {
    console.log('🔄 [Teacher] preloadVoskConnection called - storyLanguage:', storyLanguage, 'words:', words.length);
    
    const useVosk = storyLanguage === 'tagalog' || storyLanguage === 'english';
    if (!useVosk) {
      console.log('⚠️ [Teacher] Not using Vosk - language:', storyLanguage);
      return;
    }
    
    // Prevent duplicate connections
    if (voskSocketRef.current && voskSocketRef.current.readyState === WebSocket.OPEN) {
      console.log('✅ [Teacher] Vosk already connected - skipping preload');
      return;
    }
    
    // Close any existing connection that's not open
    if (voskSocketRef.current) {
      try {
        voskSocketRef.current.close();
      } catch (e) {
        console.warn('[Teacher] Error closing existing Vosk connection:', e);
      }
    }
    
    // Helper to get WebSocket URLs
    const getLocalWsUrl = (lang: string) => {
      const normalizedLang = (lang === "tl" || lang === "tagalog") ? "tagalog" : "english";
      console.log(`🌐 [WebSocket URL] Language: ${lang} -> ${normalizedLang}`);
      return `ws://localhost:2700/?lang=${normalizedLang}`;
    };
    
    // Try local server only
    const localUrl = getLocalWsUrl(storyLanguage);
    
    console.log('🔍 [Teacher] Connecting to local Vosk server:', localUrl);
    setVoskStatus('connecting');
    
    // Try local server first with quick timeout
    const tryLocalServer = () => {
      return new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(localUrl);
        ws.binaryType = 'arraybuffer';
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Local server timeout'));
        }, 2000); // 2 second timeout for local
        
        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ [Teacher] Connected to LOCAL Vosk server');
          resolve(ws);
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Local server not available'));
        };
      });
    };
    
    try {
      // Connect to local server only
      let ws: WebSocket;
      ws = await tryLocalServer();
      console.log('🏠 [Teacher] Using LOCAL Vosk server');
      
      voskSocketRef.current = ws;
      ws.binaryType = 'arraybuffer';
      
      // Connection already established, set up handlers
      setVoskStatus('connected');
      
      // Send story vocabulary for server-side filtering
      if (words.length > 0) {
        const vocabulary = Array.from(new Set(words.map((w: string) => w.toLowerCase())));
        ws.send(JSON.stringify({
          config: {
            vocabulary: vocabulary,
            expected_words: words.map((w: string) => w.toLowerCase())
          }
        }));
        console.log(`📚 [Teacher] Sent vocabulary: ${vocabulary.length} unique words`);
      }
      
      ws.onerror = (error) => {
        console.warn('⚠️ [Teacher] Vosk connection error:', error);
        setVoskStatus('disconnected');
      };
      
      ws.onclose = () => {
        console.log('🔌 [Teacher] Vosk connection closed');
        setVoskStatus('disconnected');
      };
      
      // Handle messages (word matching results)
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          
          if (msg.match_result) {
            // Validate match result before processing
            if (!isValidMatchResult(msg.match_result)) {
              console.error('❌ Skipping invalid match result - UI state not updated');
              return;
            }

            const { match_type, new_position, details } = msg.match_result;
            const metrics = msg.metrics;
            const word = msg.text;
            
            console.log(`🎯 [Teacher] Backend match: ${match_type} - ${details}`);
            
            if (new_position !== undefined) {
              setCurrentWordIndex(new_position);
            }
            
            switch (match_type) {
              case 'correct':
                const correctWordIndex = new_position - 1;
                setRecognizedWords(prev => new Set(prev).add(correctWordIndex));
                break;
                
              case 'insertion':
                const insertedWord = msg.match_result.inserted_word || word;
                const insertionWordIndex = new_position - 1;
                setRecognizedWords(prev => {
                  const newSet = new Set(prev);
                  newSet.add(insertionWordIndex);
                  return newSet;
                });
                setInsertedWords((prev: Map<number, string[]>) => {
                  const newMap = new Map(prev);
                  const existing = newMap.get(insertionWordIndex) || [];
                  newMap.set(insertionWordIndex, [...existing, insertedWord]);
                  return newMap;
                });
                break;
            }
            
            if (metrics) {
              setWordsRead(metrics.words_read);
              setMiscues(metrics.total_miscues);
            }
          }
        } catch {}
      };
      
    } catch (error) {
      // Requirement 5.4: Log Vosk server connection errors with details
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error('❌ [Teacher] Failed to connect to local Vosk server:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        language: storyLanguage,
        timestamp: new Date().toISOString()
      });
      setVoskStatus('disconnected');
      voskSocketRef.current = null;
    }
  };

  // Actual recording start
  const startRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
    setHasStarted(true); // Mark that session has started
    setTranscript("");
    setPartialText("");
    setFinalText("");
    voskFinalTranscriptRef.current = ""; // Reset Vosk transcript accumulator
    setWordsRead(0);
    // reset derived metrics
    setElapsedTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setCurrentWordIndex(0);
    currentWordIndexLockRef.current = 0;
    voskReconnectAttemptsRef.current = 0; // Reset reconnect attempts
    lastWordTimestampRef.current = Date.now(); // Reset timestamp for next session
    
    // ⚡ OPTIMISTIC UI: Reset optimistic tracking
    optimisticWordIndexRef.current = 0;
    
    // Clear all word markings from previous session
    setWordMiscues(new Map());
    setWordMarkings(new Map());
    setInsertedWords(new Map());
    setRecognizedWords(new Set());

    // --- MediaRecorder ---
    // Note: MediaRecorder failure is non-blocking - speech recognition will still work
    if (navigator.mediaDevices && window.MediaRecorder) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          const audioChunks: BlobPart[] = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
          };
          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            setAudioBlob(audioBlob);
            setAudioUrl(URL.createObjectURL(audioBlob));
          };
          // Requirement 5.4: Add error handler for MediaRecorder
          mediaRecorder.onerror = (event) => {
            console.error("❌ MediaRecorder error:", {
              error: event,
              timestamp: new Date().toISOString()
            });
            // Continue operation - speech recognition still works
          };
          mediaRecorder.start();
        })
        .catch((error) => {
          // Requirement 5.4: Log MediaRecorder errors without crashing
          // MediaRecorder failed, but don't block speech recognition
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.warn("⚠️ MediaRecorder failed (audio recording disabled):", {
            error: errorMessage,
            timestamp: new Date().toISOString()
          });
          // Don't set isRecording(false) - allow speech recognition to proceed
        });
    } else {
      console.warn("⚠️ MediaRecorder not supported in this browser. Speech recognition will still work.");
      // Don't stop recording - speech recognition can still work
    }

    // Use Vosk for both Tagalog and English stories
    const useVosk = storyLanguage === "tagalog" || storyLanguage === "english";
      if (useVosk) {
        try {
        // WebSocket URL selection - local server only
        // Uses: ws://localhost:2700
        // Can be configured via environment variable:
        // - VITE_VOSK_LOCAL_PORT: Local server port (default: 2700)
        const getVoskWsUrl = async (lang: string): Promise<string> => {
          const env = (import.meta as any)?.env || {};
          
          // Helper to ensure URL has proper format (with / before query params)
          const formatWsUrl = (baseUrl: string, language: string) => {
            // Remove trailing slash if present, then add /?lang=...
            const cleanUrl = baseUrl.replace(/\/$/, '');
            return `${cleanUrl}/?lang=${language}`;
          };
          
          // Get local server port (default: 2700)
          const localPort = env.VITE_VOSK_LOCAL_PORT || "2700";
          const localUrl = `ws://localhost:${localPort}`;
          
          // Connect to local server only
          const localWsUrl = formatWsUrl(localUrl, lang);
          console.log(`✅ Connecting to LOCAL Vosk server`);
          console.log(`   Using: ${localWsUrl}`);
          console.log(`   Status: Connecting to local server (port ${localPort})`);
          return localWsUrl;
        };
        
        const startVosk = async (isReconnect: boolean = false) => {
          const wsUrl = await getVoskWsUrl(storyLanguage);

          console.log(`🎯 Connecting to LOCAL Vosk server for ${storyLanguage} recognition`);
          
          if (!isReconnect) {
            voskReconnectAttemptsRef.current = 0;
            voskFinalTranscriptRef.current = "";
          }

          try {
            // Initialize microphone
            const stream = await initializeMicrophone();

            // Setup audio context and processing nodes
            const { context: ctx, source: src, processor: script } = await setupAudioContext(stream);
            audioContextRef.current = ctx;
            sourceNodeRef.current = src;
            scriptNodeRef.current = script;
            
            // Create gain node for mic volume control
            const gainNode = ctx.createGain();
            gainNode.gain.value = micVolume / 100;
            gainNodeRef.current = gainNode;

            // Connect audio nodes: source -> gain -> script -> destination
            src.connect(gainNode);
            gainNode.connect(script);
            script.connect(ctx.destination);
            
            // Ensure audio context is running
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
            console.log('✅ Audio nodes connected - microphone is active');

            setVoskStatus("connecting");

            // Connection timeout for local server
            const connectionTimeout = 1000; // 1s for local connection (ultra-fast)
            const connectionStartTime = Date.now();
            
            console.log(`🔌 Connecting to LOCAL server: ${wsUrl}`);
            console.log(`   Timeout: ${connectionTimeout}ms (local connection should be fast)`);
            console.log(`🌐 Service: ${storyLanguage === "english" ? "English" : "Tagalog"} Vosk WebSocket`);
            
            // Pre-connection diagnostic
            const urlObj = new URL(wsUrl);
            console.log(`📋 Diagnostic Info:`);
            console.log(`   - Host: ${urlObj.hostname}`);
            console.log(`   - Protocol: ${urlObj.protocol}`);
            console.log(`   - Language: ${urlObj.searchParams.get("lang") || "not specified"}`);
            
            // Monitor connection state periodically
            const stateCheckInterval = setInterval(() => {
              if (voskSocketRef.current) {
                const state = voskSocketRef.current.readyState;
                const elapsed = ((Date.now() - connectionStartTime) / 1000).toFixed(1);
                const stateNames: { [key: number]: string } = { 0: "CONNECTING", 1: "OPEN", 2: "CLOSING", 3: "CLOSED" };
                const stateName = stateNames[state] || `UNKNOWN(${state})`;
                
                if (state === 0) { // Still connecting
                  console.log(`⏳ Still connecting... (${elapsed}s) - State: ${stateName}`);
                } else if (state === 1) { // Open
                  clearInterval(stateCheckInterval);
                  console.log(`✅ Connection opened in ${elapsed}s`);
                } else if (state === 3) { // Closed
                  clearInterval(stateCheckInterval);
                  console.warn(`❌ Connection closed before timeout (${elapsed}s) - State: ${stateName}`);
                }
              }
            }, 2000); // Check every 2 seconds

            // Create WebSocket connection with ultra-low latency settings
            let ws: WebSocket;
            try {
              console.log(`🔌 [WebSocket] Creating connection to: ${wsUrl}`);
              console.log(`🔌 [WebSocket] Current voskSocketRef state:`, voskSocketRef.current?.readyState);
              
              // Clean up any existing connection first
              if (voskSocketRef.current) {
                console.log(`🔌 [WebSocket] Cleaning up existing connection (state: ${voskSocketRef.current.readyState})`);
                cleanupVosk();
                // Wait a moment for cleanup to complete
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              ws = new WebSocket(wsUrl);
              voskSocketRef.current = ws;
              ws.binaryType = "arraybuffer";
              
              console.log(`🔌 [WebSocket] Connection created, readyState: ${ws.readyState}`);
              
              // Add immediate error handler to catch connection issues
              ws.addEventListener('error', (error) => {
                console.error(`❌ [WebSocket] Connection error:`, error);
                console.error(`❌ [WebSocket] Error type: ${error.type}`);
                console.error(`❌ [WebSocket] ReadyState: ${ws.readyState}`);
              });
              
              ws.addEventListener('open', () => {
                console.log(`✅ [WebSocket] Connection opened successfully`);
              });
              
              ws.addEventListener('close', (event) => {
                console.log(`🔴 [WebSocket] Connection closed: code=${event.code}, reason="${event.reason}", clean=${event.wasClean}`);
              });
            
            // ULTRA-LOW LATENCY: Optimize WebSocket for instant communication
            // Note: These are browser-level optimizations
            // The actual TCP_NODELAY is handled by the server
            
            // Keep the socket path quiet to avoid UI-thread console spam.
            } catch (error) {
              clearInterval(stateCheckInterval);
              // Requirement 5.4: Log WebSocket creation errors with details
              const errorMessage = error instanceof Error ? error.message : "Unknown error";
              console.error("❌ Failed to create WebSocket:", {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date().toISOString()
              });
              setVoskStatus("disconnected");
              throw error;
            }
            
            // Connection timeout handler
            voskConnectionTimeoutRef.current = setTimeout(() => {
              clearInterval(stateCheckInterval);
              
              if (voskSocketRef.current?.readyState !== WebSocket.OPEN) {
                const state = voskSocketRef.current?.readyState;
                const elapsed = ((Date.now() - connectionStartTime) / 1000).toFixed(1);
                const stateNames: { [key: number]: string } = { 0: "CONNECTING", 1: "OPEN", 2: "CLOSING", 3: "CLOSED" };
                const stateName = state !== undefined ? (stateNames[state] || `UNKNOWN(${state})`) : "UNKNOWN";
                
                console.error(`⏱️ Vosk connection timeout after ${elapsed}s (state: ${stateName})`);
                console.error(`   URL: ${wsUrl}`);
                
                // Provide specific troubleshooting based on state
                if (state === 0) { // Still CONNECTING
                  console.error(`❌ Connection timed out while still connecting. Possible causes:`);
                  console.error(`   1. Local Vosk server is not running`);
                  console.error(`   2. Service is not responding`);
                  console.error(`   3. Network/firewall blocking WebSocket connections`);
                } else if (state === 3) { // CLOSED
                  console.error(`❌ Connection closed before timeout. Possible causes:`);
                  console.error(`   1. Local Vosk server is not running`);
                  console.error(`   2. Service crashed - check server logs for errors`);
                  console.error(`   3. Environment variables not set - verify SERVICE_LANGUAGE=${storyLanguage}`);
                  console.error(`   4. Wrong URL - verify localhost:2700 is correct`);
                }
                
                if (voskSocketRef.current) {
                  voskSocketRef.current.close();
                }
                setVoskStatus("disconnected");
                attemptVoskReconnect(startVosk);
              } else {
                clearInterval(stateCheckInterval);
              }
            }, connectionTimeout);

            ws.onopen = () => {
              if (voskConnectionTimeoutRef.current) {
                clearTimeout(voskConnectionTimeoutRef.current);
                voskConnectionTimeoutRef.current = null;
              }
              
              // Clear state check interval
              clearInterval(stateCheckInterval);

              voskReconnectAttemptsRef.current = 0;
              setVoskStatus("connected");
              const connectionTime = ((Date.now() - connectionStartTime) / 1000).toFixed(2);
              console.log(`✅ WebSocket connected successfully to ${wsUrl} (took ${connectionTime}s)`);

              // OPEN VOCABULARY: Let Vosk recognize any words without constraints
              // Word matching will handle validation on the backend
              if (realWords && realWords.length > 0) {
                const vocabularyList =
                  storyVocabulary.size > 0
                    ? Array.from(storyVocabulary)
                    : Array.from(new Set(realWords.map((w) => w.toLowerCase())));
                // Send both vocabulary/grammar and expected words for stronger backend matching.
                const config1 = JSON.stringify({
                  config: {
                    words: true,
                    max_alternatives: 0,
                    grammar: vocabularyList,
                    vocabulary: vocabularyList,
                    expected_words: realWords  // For BACKEND word matching only
                  }
                });

                console.log(`🎯 Vosk configured with OPEN VOCABULARY (no constraints)`);
                console.log(`📝 Sending ${realWords.length} expected words for backend matching only`);
                console.log(`📚 Vocabulary size: ${vocabularyList.length} words`);
                console.log(`📚 First 10 vocabulary words: ${vocabularyList.slice(0, 10).join(', ')}`);
                console.log(`📚 Expected words: ${realWords.slice(0, 10).join(', ')}`);

                // Send config
                try {
                  ws.send(config1);
                  console.log('✓ Sent Vosk config - open vocabulary mode');
                } catch (e) {
                  console.warn('Failed to send config:', e);
                }
              }

              // Send audio format configuration to server
              try {
                const audioConfig = JSON.stringify({
                  audio_format: {
                    format: "Float32",
                    sample_rate: ctx.sampleRate || 48000,
                    channels: 1
                  }
                });
                ws.send(audioConfig);
                console.log(`✓ Sent audio format: Float32 @ ${ctx.sampleRate}Hz`);
              } catch (e) {
                console.warn('Failed to send audio format config:', e);
              }

              // Start heartbeat
              voskHeartbeatIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  try {
                    ws.send(new ArrayBuffer(0));
                  } catch (e) {
                    console.warn("Heartbeat send failed:", e);
                    attemptVoskReconnect(startVosk);
                  }
                }
              }, 30000);

              // EXTREME SPEED: Instant audio sending without any overhead
              startVoskAudioSender(ws);
              script.onaudioprocess = (e: AudioProcessingEvent) => {
                if (ws.readyState !== WebSocket.OPEN) return;

                // Copy the current chunk so we don't reuse a buffer that can be mutated next tick.
                const channel = e.inputBuffer.getChannelData(0);
                const floatCopy = new Float32Array(channel);
                const chunkBuffer = floatCopy.buffer;

                // Bounded queue: keep latency low by dropping oldest chunks if the sender falls behind.
                if (voskAudioQueueRef.current.length >= voskAudioQueueMaxChunksRef.current) {
                  voskAudioQueueRef.current.shift();
                }
                voskAudioQueueRef.current.push(chunkBuffer);
              };
              // Audio nodes already connected earlier - no need to reconnect here
            };

            setupVoskMessageHandlers(ws);
            setupVoskConnectionHandlers(ws, isReconnect, startVosk);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("❌ Failed to initialize speech recognition:", {
              error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
              isReconnect,
              timestamp: new Date().toISOString()
            });
            cleanupVosk();
            setVoskStatus("disconnected");

            if (!isReconnect) {
              // Requirement 5.4: Show user-friendly error messages
              // Provide specific error messages based on error type
              if (errorMessage.includes("Permission denied") || errorMessage.includes("NotAllowedError")) {
                alert(
                  "Microphone access denied.\n\n" +
                  "Please:\n" +
                  "1. Allow microphone access in your browser settings\n" +
                  "2. Refresh the page\n" +
                  "3. Try again"
                );
              } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("DevicesNotFoundError")) {
                alert(
                  "No microphone found.\n\n" +
                  "Please:\n" +
                  "1. Connect a microphone to your device\n" +
                  "2. Refresh the page\n" +
                  "3. Try again"
                );
              } else if (errorMessage.includes("NotReadableError") || errorMessage.includes("TrackStartError")) {
                alert(
                  "Microphone is in use by another application.\n\n" +
                  "Please:\n" +
                  "1. Close other applications using the microphone\n" +
                  "2. Refresh the page\n" +
                  "3. Try again"
                );
              } else {
                alert(
                  "Failed to start speech recognition.\n\n" +
                  "Please:\n" +
                  "1. Check your microphone is connected and working\n" +
                  "2. Refresh the page\n" +
                  "3. Try again\n\n" +
                  "If the problem persists, contact support."
                );
              }
              setIsRecording(false);
            }
          }
        };

        // Start Vosk
        startVosk().catch((error) => {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("❌ Failed to start speech recognition service:", {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            language: storyLanguage,
            timestamp: new Date().toISOString()
          });
          // Requirement 5.4: Show user-friendly error message
          alert(
            "Unable to start speech recognition.\n\n" +
            "Please check:\n" +
            "1. Your internet connection is working\n" +
            "2. Your microphone is connected and working\n" +
            "3. The speech recognition service is available\n\n" +
            "Then try again."
          );
          setIsRecording(false);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("❌ Failed to initialize speech recognition:", {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        // Requirement 5.4: Show user-friendly error message
        alert(
          "Unable to initialize speech recognition.\n\n" +
          "Please:\n" +
          "1. Refresh the page\n" +
          "2. Check your microphone permissions\n" +
          "3. Try again\n\n" +
          "If the problem persists, contact support."
        );
        setIsRecording(false);
      }
    }
  };

  // Handle Vosk language switching - reconnect with new language if needed
  const previousLanguageRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only reconnect if language actually changed and Vosk is already connected
    if (
      voskSocketRef.current && 
      voskSocketRef.current.readyState === WebSocket.OPEN && 
      isRecording && 
      !isPaused &&
      previousLanguageRef.current !== null && // Ensure this isn't the initial load
      previousLanguageRef.current !== storyLanguage // Language actually changed
    ) {
      console.log(`🔄 Language changed to ${storyLanguage}, reconnecting Vosk with new language...`);
      cleanupVosk();
      voskFinalTranscriptRef.current = ""; // Reset transcript
      voskReconnectAttemptsRef.current = 0;

      // Small delay before reconnecting to ensure cleanup completes
      setTimeout(async () => {
        if (isRecording && !isPaused) {
          // Use same fallback logic as main Vosk initialization
          const getVoskWsUrl = async (lang: string): Promise<string> => {
            const env = (import.meta as any)?.env || {};
            
            const formatWsUrl = (baseUrl: string, language: string) => {
              const cleanUrl = baseUrl.replace(/\/$/, '');
              return `${cleanUrl}/?lang=${language}`;
            };
            
            const localPort = env.VITE_VOSK_LOCAL_PORT || "2700";
            const localUrl = `ws://localhost:${localPort}`;
            
            // Connect to local server only
            const localWsUrl = formatWsUrl(localUrl, lang);
            console.log(`✅ Connecting to LOCAL Vosk server for ${lang} recognition`);
            console.log(`   Using: ${localWsUrl}`);
            console.log(`   Status: Connecting to local server (port ${localPort})`);
            return localWsUrl;
          };
          
          const wsUrl = await getVoskWsUrl(storyLanguage);
          
          console.log(`🎯 Reconnecting to LOCAL Vosk server for ${storyLanguage} recognition`);

          // Restart Vosk with new language (using improved audio settings)
          const startVosk = async () => {
            try {
              // Use same improved audio settings as main Vosk initialization
              let stream: MediaStream;
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  audio: {
                    channelCount: 1,
                    sampleRate: 48000,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                  },
                });
              } catch (error) {
                stream = await navigator.mediaDevices.getUserMedia({
                  audio: {
                    channelCount: 1,
                    sampleRate: 48000
                  },
                });
              }

              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
              if (ctx.state === 'suspended') {
                await ctx.resume();
              }

              audioContextRef.current = ctx;
              const src = ctx.createMediaStreamSource(stream);
              sourceNodeRef.current = src;
              // ULTRA-LOW LATENCY: Minimum valid buffer (256) = fastest processing, lowest latency
              // 256 samples @ 48kHz = ~5.33ms per chunk - minimum allowed by Web Audio API
              const script = ctx.createScriptProcessor(256, 1, 1);
              scriptNodeRef.current = script;
              
              // Create gain node for mic volume control
              const gainNode = ctx.createGain();
              gainNode.gain.value = micVolume / 100;
              gainNodeRef.current = gainNode;

              // Connect audio nodes: source -> gain -> script -> destination
              src.connect(gainNode);
              gainNode.connect(script);
              script.connect(ctx.destination);
              
              // Ensure audio context is running (already done above, but double-check)
              if (ctx.state === 'suspended') {
                await ctx.resume();
              }
              console.log('✅ Audio nodes connected (reconnect) - microphone is active');

              // Audio processing now handled server-side

              setVoskStatus("connecting");
              const ws = new WebSocket(wsUrl);
              voskSocketRef.current = ws;
              ws.binaryType = "arraybuffer";

              ws.onopen = () => {
                voskReconnectAttemptsRef.current = 0;
                setVoskStatus("connected");

                // OPEN VOCABULARY: Let Vosk recognize any words without constraints
                // Word matching will handle validation on the backend
                if (realWords && realWords.length > 0) {
                  // Send expected words for backend matching only (no grammar constraint)
                  const config1 = JSON.stringify({
                    config: {
                      words: true,
                      max_alternatives: 0,
                      expected_words: realWords
                    }
                  });

                  console.log(`🎯 Vosk configured with OPEN VOCABULARY (reconnect)`);
                  console.log(`📝 Sending ${realWords.length} expected words for backend matching only`);

                  try {
                    ws.send(config1);
                    console.log('✓ Sent Vosk config - open vocabulary mode (reconnect)');
                  } catch (e) {
                    console.warn('Failed to send config:', e);
                  }
                }

                voskHeartbeatIntervalRef.current = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    try {
                      ws.send(new ArrayBuffer(0));
                    } catch (e) {
                      console.warn("Heartbeat send failed:", e);
                    }
                  }
                }, 30000);

                // Send audio format configuration to server
                  try {
                  const audioConfig = JSON.stringify({
                    audio_format: {
                      format: "Float32",
                      sample_rate: ctx.sampleRate || 48000,
                      channels: 1
                    }
                  });
                  ws.send(audioConfig);
                  console.log(`✓ Sent audio format: Float32 @ ${ctx.sampleRate}Hz`);
                } catch (e) {
                  console.warn('Failed to send audio format config:', e);
                }

                // Vosk audio backpressure: enqueue and drain steadily.
                voskAudioQueueRef.current = [];
                startVoskAudioSender(ws);
                script.onaudioprocess = (e: AudioProcessingEvent) => {
                  if (ws.readyState !== WebSocket.OPEN) return;

                  const channel = e.inputBuffer.getChannelData(0);
                  const floatCopy = new Float32Array(channel);

                  if (voskAudioQueueRef.current.length >= voskAudioQueueMaxChunksRef.current) {
                    voskAudioQueueRef.current.shift();
                  }
                  voskAudioQueueRef.current.push(floatCopy.buffer);
                };
                // Audio nodes already connected earlier - no need to reconnect here
              };

              ws.onmessage = (evt) => {
                try {
                  const msg = JSON.parse(evt.data);
                  if (msg.text && msg.text.trim()) {
                    // Filter through vocabulary validation
                    const filteredText = filterThroughVocabulary(msg.text.trim(), storyVocabulary);

                    // Only update transcript if we have valid words
                    if (filteredText) {
                      voskFinalTranscriptRef.current += (voskFinalTranscriptRef.current ? " " : "") + filteredText;
                      setTranscript(voskFinalTranscriptRef.current);
                    }
                  } else if (msg.partial && msg.partial.trim()) {
                    // Partial results are no longer displayed in UI
                  }
                } catch (error) {
                  // Requirement 5.4: Log Vosk message parsing errors without crashing
                  const errorMessage = error instanceof Error ? error.message : "Unknown error";
                  console.warn("⚠️ Error parsing Vosk message:", {
                    error: errorMessage,
                    timestamp: new Date().toISOString()
                  });
                  // Continue operation - don't crash the app
                }
              };

              ws.onerror = () => {
                setVoskStatus("disconnected");
                console.warn("Vosk reconnection failed after language change");
              };

              ws.onclose = () => {
                setVoskStatus("disconnected");
              };
            } catch (error) {
              // Requirement 5.4: Log language switching reconnection errors
              const errorMessage = error instanceof Error ? error.message : "Unknown error";
              console.warn("⚠️ Failed to reconnect Vosk with new language:", {
                error: errorMessage,
                language: storyLanguage,
                timestamp: new Date().toISOString()
              });
              setVoskStatus("disconnected");
            }
          };

          startVosk();
        }
      }, 100);
    }
    
    // Update the previous language reference
    previousLanguageRef.current = storyLanguage;
  }, [storyLanguage]);

  // Stop recording and speech recognition
  const handleStopRecording = async () => {
    try {
      setIsRecording(false);
      setIsPaused(false);

      // Stop MediaRecorder
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream
            .getTracks()
            .forEach((track) => track.stop());
        } catch (error) {
          // Requirement 5.4: Log media recorder stop errors without crashing
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.warn("⚠️ Error stopping media recorder:", {
            error: errorMessage,
            timestamp: new Date().toISOString()
          });
          // Continue operation - don't crash the app
        }
      }

      // Cleanup Vosk (includes all cleanup logic)
      cleanupVosk();

      // Reset state
      voskFinalTranscriptRef.current = "";
      voskReconnectAttemptsRef.current = 0;

      // ============================================================================
      // DEPED RULE: Mark all remaining unread words as OMISSION
      // ============================================================================
      // When the session ends, any words that were not read should be marked as omissions
      // Gray words = skipped/unread = Omission according to DepEd Phil-IRI marking system
      const realWords = words.filter(w => /\w+/.test(w)); // Filter out punctuation
      const lastReadIndex = currentWordIndex; // Current position when stopped
      
      console.log(`📋 Session stopped at word ${lastReadIndex} of ${realWords.length}`);
      console.log(`📋 Marking remaining ${realWords.length - lastReadIndex} unread words as omissions...`);
      
      // Mark all words from current position to end as omissions
      for (let i = lastReadIndex; i < realWords.length; i++) {
        // Skip if already marked with a miscue
        if (wordMiscues.has(i) || recognizedWords.has(i)) {
          continue;
        }
        
        // Mark as omission
        if (!countedMiscuePositionsRef.current.has(i)) {
          countedMiscuePositionsRef.current.add(i);
          setMiscues(prev => prev + 1);
          setMiscueTypes(prev => ({ ...prev, omission: prev.omission + 1 }));
          setWordMiscues(prev => new Map(prev).set(i, 'omission'));
          setWordMarkings(prev => new Map(prev).set(i, {
            type: 'omission',
            marking: `Circle omitted word`,
            spokenWord: '',
            correctWord: realWords[i]
          }));
          console.log(`⭕ Word ${i} "${realWords[i]}" marked as omission (unread at session end)`);
        }
      }
      
      console.log(`✅ Marked all unread words as omissions per DepEd rules`);

      // If Tagalog story, optionally send audio to backend Whisper for better transcription
      const enableServerTranscribe =
        (import.meta as any)?.env?.VITE_ENABLE_SERVER_TRANSCRIBE === "true";
      if (audioBlob && storyLanguage === "tagalog" && enableServerTranscribe) {
        try {
          const form = new FormData();
          form.append("audio", audioBlob, "audio.webm");
          form.append("language", "fil");
          const resp = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.text) {
              setTranscript(data.text);
            }
          } else {
            console.warn("Server transcription service unavailable");
          }
        } catch (e) {
          console.warn("Unable to connect to transcription service:", e);
        }
      }
    } catch (error) {
      // Requirement 5.4: Log stop recording errors with details
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Error stopping recording:", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      // Requirement 5.4: Show user-friendly error message
      alert(
        "An error occurred while stopping the recording.\n\n" +
        "Your progress has been saved and you can continue.\n\n" +
        "If you experience issues, please refresh the page."
      );
    }
  };

  // Wait for MediaRecorder to finalize audio (audioBlob/audioUrl set) with timeout
  const waitForAudioFinalization = async (
    timeoutMs: number = 2000
  ): Promise<void> => {
    if (!isRecording && (audioBlob || audioUrl)) return;
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const done =
          !!audioBlob || !!audioUrl || Date.now() - start > timeoutMs;
        if (done) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  // Update elapsed time as time passes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setElapsedTime((prev: number) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  const loadPdfContent = async (pdfUrl: string) => {
    try {
      setIsLoadingPdf(true);
      setPdfError(null);

      const response = await fetch(pdfUrl);
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `Failed to fetch PDF: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `PDF Error: ${errorData.error}`;
          }
        } catch (parseError) {
          // If we can't parse JSON, use the status text
          console.warn("Could not parse error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      // Get the PDF as an array buffer
      const pdfArrayBuffer = await response.arrayBuffer();

      // Check if we received valid PDF data (should start with %PDF-)
      const firstBytes = new Uint8Array(pdfArrayBuffer.slice(0, 5));
      const header = new TextDecoder().decode(firstBytes);
      if (!header.startsWith("%PDF-")) {
        throw new Error("Invalid PDF data: Missing PDF header");
      }

      // Load the PDF using PDF.js
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: pdfArrayBuffer,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;

        let fullText = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .filter((item): item is TextItem => "str" in item)
            .map((item) => item.str)
            .join(" ");
          fullText += pageText + "\n\n";
        }

        setPdfContent(fullText);

        // Split content into words and update state
        const wordArray = fullText
          .split(/\s+/)
          .filter((word: string) => word.length > 0);
        setWords(wordArray);
      } catch (pdfError) {
        console.error("Error processing PDF:", pdfError);
        throw pdfError;
      }
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : "Failed to load PDF"
      );
      throw error;
    } finally {
      setIsLoadingPdf(false);
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        console.error("No session ID provided");
        setError("No session ID provided");
        return;
      }

      try {
        setIsLoading(true);

        const sessionData = await readingSessionService.getSessionById(
          sessionId
        );

        if (!sessionData) {
          throw new Error("Session not found");
        }

        setCurrentSession(sessionData);

        // If session is completed, load the saved results
        if (sessionData.status === 'completed' && sessionData.wordsRead !== undefined) {
          console.log('📊 Loading completed session results...');
          
          // Restore session state
          setWordsRead(sessionData.wordsRead || 0);
          setMiscues(sessionData.totalMiscues || 0);
          setElapsedTime(sessionData.elapsedTime || 0);
          setTranscript(sessionData.transcript || '');
          setAudioUrl(sessionData.audioUrl || null);
          
          // Restore miscue types breakdown
          if (sessionData.miscueTypes) {
            setMiscueTypes(sessionData.miscueTypes);
          }
          
          // Restore word markings
          if (sessionData.recognizedWords) {
            setRecognizedWords(new Set(sessionData.recognizedWords));
          }
          if (sessionData.wordMiscues) {
            const restoredMiscues = new Map(Object.entries(sessionData.wordMiscues).map(([k, v]) => [parseInt(k), v]));
            console.log('🔴 Restored wordMiscues count:', restoredMiscues.size);
            console.log('🔴 Restored wordMiscues data:', Object.entries(sessionData.wordMiscues));
            setWordMiscues(restoredMiscues);
          } else {
            console.warn('⚠️ No wordMiscues found in session data!');
          }
          if (sessionData.wordMarkings) {
            const restoredMarkings = new Map(Object.entries(sessionData.wordMarkings).map(([k, v]) => [parseInt(k), v]));
            console.log('📝 Restored wordMarkings count:', restoredMarkings.size);
            console.log('📝 Restored wordMarkings data:', Object.entries(sessionData.wordMarkings));
            console.log('📝 Sample marking at index 0:', restoredMarkings.get(0));
            console.log('📝 Sample marking at index 2:', restoredMarkings.get(2));
            setWordMarkings(restoredMarkings);
          } else {
            console.warn('⚠️ No wordMarkings found in session data!');
          }
          if (sessionData.insertedWords) {
            setInsertedWords(new Map(Object.entries(sessionData.insertedWords).map(([k, v]) => [parseInt(k), v])));
          }
          
          // Set current word index to the last word read
          if (sessionData.currentWordIndex !== undefined) {
            setCurrentWordIndex(sessionData.currentWordIndex);
          }
          
          console.log('✅ Completed session results loaded:', {
            wordsRead: sessionData.wordsRead,
            miscues: sessionData.totalMiscues,
            miscueTypes: sessionData.miscueTypes,
            recognizedWords: sessionData.recognizedWords?.length || 0,
            status: sessionData.status,
            isCompleted: sessionData.status === 'completed'
          });
          
          // Check if quiz has been completed for this session
          // Get student ID to check for ISR results
          const firstStudent = sessionData.students[0];
          const studentId = typeof firstStudent === 'string' ? firstStudent : firstStudent.id;
          
          if (studentId) {
            try {
              // Fetch ISR results for this student
              const isrResults = await isrResultService.getISRResultsByStudent(studentId);
              
              // Find ISR result that matches this session
              const matchingResult = isrResults.find((result: any) => 
                result.sessionId === sessionId || 
                (result.sessionTitle === sessionData.title && result.book === sessionData.book)
              );
              
              if (matchingResult) {
                console.log('📋 Found ISR result for this session:', (matchingResult as any)._id || matchingResult.id);
                const resultId = (matchingResult as any)._id || matchingResult.id;
                setIsrResultId(resultId);
                
                // Check if quiz is completed (testId is set)
                if (matchingResult.testId) {
                  setHasCompletedQuiz(true);
                  console.log('✅ Quiz already completed for this session');
                }
              }
            } catch (error) {
              console.error('Error checking for existing ISR results:', error);
            }
          }
        }

        // Resolve story robustly:
        // 1) try lookup from list by id/title, 2) fallback direct id fetch from sessionData.book.
        let resolvedStoryId: string | undefined;
        try {
          const stories = await UnifiedStoryService.getInstance().getStories({});
          const story = stories.find(
            (s: Story) => s._id === sessionData.book || s.title === sessionData.book
          );
          resolvedStoryId = story?._id;
        } catch (listErr) {
          console.warn("Story list lookup failed, will try direct story fetch:", listErr);
        }

        if (!resolvedStoryId && sessionData.book) {
          resolvedStoryId = String(sessionData.book);
        }

        if (!resolvedStoryId) {
          throw new Error("Story not found");
        }

        try {
          // Get the full story details
          const fullStory = await UnifiedStoryService.getInstance().getStoryById(resolvedStoryId);

          if (!fullStory) {
            throw new Error("Failed to fetch story details");
          }

          // Store current story for ISR result saving
          setCurrentStory(fullStory);

          // Set story language for speech recognition - automatically detect from story
          if (fullStory.language) {
            // Normalize language value (handle case variations)
            const normalizedLang = String(fullStory.language).toLowerCase().trim();

            // Map story language to internal format
            let internalLanguage: "english" | "tagalog" = "english"; // Default

            if (normalizedLang === "tagalog" || normalizedLang === "filipino") {
              internalLanguage = "tagalog";
            } else if (normalizedLang === "english") {
              internalLanguage = "english";
            } else {
              // Unknown language value, default to english
              console.warn(`Unknown story language value: "${fullStory.language}", defaulting to English`);
              internalLanguage = "english";
            }

            console.log('📖 [Teacher] Setting story language:', internalLanguage, '(from:', fullStory.language, ')');
            // Only set language if it's different to prevent unnecessary useEffect triggers
            if (storyLanguage !== internalLanguage) {
              setStoryLanguage(internalLanguage);
            } else {
              console.log('📖 [Teacher] Language unchanged, skipping setStoryLanguage');
            }
          } else {
            // Default to English if no language is specified
            console.log('📖 [Teacher] Setting default story language: english');
            // Only set language if it's different to prevent unnecessary useEffect triggers
            if (storyLanguage !== "english") {
              setStoryLanguage("english");
            } else {
              console.log('📖 [Teacher] Language unchanged, skipping setStoryLanguage');
            }
          }

          // Set text content first (this is what we want to display)
          if (
            fullStory.textContent &&
            fullStory.textContent.trim().length > 0
          ) {
            // Don't trim the text to preserve leading/trailing whitespace for proper formatting
            setStoryText(fullStory.textContent);
            const wordArray = fullStory.textContent
              .split(/\s+/)
              .filter((word: string) => word.length > 0);
            console.log('📖 [Teacher] Setting words:', wordArray.length, 'words');
            setWords(wordArray);
            
            // Story words initialized

            // Extract vocabulary for vocabulary-constrained recognition
            const vocabulary = extractVocabulary(fullStory.textContent);
            setStoryVocabulary(vocabulary);
            console.log(`📚 Story vocabulary extracted: ${vocabulary.size} words - Sample: ${Array.from(vocabulary).slice(0, 15).join(', ')}`);

            // Detect story language based on vocabulary
            const detectedLanguage = detectStoryLanguage(vocabulary);

            // Pronunciation matching now handled by server
            console.log(`📚 Story loaded: ${vocabulary.size} vocabulary words, language: ${fullStory.language || 'auto-detect'}`);
            
            // Server handles all dictionary validation now
            console.log(`� Story vocabulary: ${wordArray.length} words`);

            // Only override the language if it wasn't already set from story metadata
            // Only set language if it's different to prevent unnecessary useEffect triggers
            if (storyLanguage !== detectedLanguage) {
              console.log(`🌐 [LANGUAGE] Setting story language from ${storyLanguage} to ${detectedLanguage}`);
              setStoryLanguage(detectedLanguage);
            } else if (!fullStory.language) {
              console.log('📖 [Teacher] Auto-detected language unchanged, skipping setStoryLanguage');
            }
          }

          // Try to load PDF content only if the story has a PDF
          if (fullStory.hasPdf) {
            try {
              const pdfUrl = UnifiedStoryService.getInstance().getStoryPdfUrl(
                resolvedStoryId
              );
              await loadPdfContent(pdfUrl);
            } catch (pdfError) {
              console.warn(
                "PDF loading failed, but text content is available:",
                pdfError
              );
              // Don't throw error here since we have text content
              // Set a flag to indicate PDF failed
              setPdfError(
                pdfError instanceof Error
                  ? pdfError.message
                  : "PDF loading failed"
              );
            }
          } else {
            // Story doesn't have a PDF, set a friendly message
            setPdfError("This story doesn't have a PDF file. Reading session will use text content only.");
          }
        } catch (error) {
          console.error("Error fetching story content:", error);
          if (error instanceof Error) {
            throw new Error(`Failed to load story content: ${error.message}`);
          } else {
            throw new Error("Failed to load story content: Unknown error");
          }
        }
      } catch (error: any) {
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          stack: error.stack,
          response: error.response?.data,
        });
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);
  
  // Preload Vosk connection as soon as we have story data (even during loading)
  useEffect(() => {
    console.log('🔍 [Teacher] Preload useEffect triggered - words:', words.length, 'storyLanguage:', storyLanguage, 'isLoading:', isLoading);
    
    // Start preloading as soon as we have words and language (don't wait for loading to finish)
    if (words.length > 0 && storyLanguage) {
      console.log('📚 [Teacher] Story data available - preloading Vosk connection NOW (during loading)...');
      preloadVoskConnection();
    } else {
      console.log('⏳ [Teacher] Waiting for story data - words:', words.length, 'language:', storyLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.length, storyLanguage]);

  const handleGoBack = () => {
    navigate(-1);
  };

  /**
   * Handle word click for manual correction
   * Enables teachers to select a word and show correction options
   * Requirements: 5.1
   */
  const handleWordClick = (wordIndex: number) => {
    // Only allow correction when not recording
    if (isRecording) {
      return;
    }
    
    // Toggle selection - if clicking the same word, deselect it
    if (selectedWordIndex === wordIndex) {
      setSelectedWordIndex(null);
      setShowCorrectionOptions(false);
    } else {
      setSelectedWordIndex(wordIndex);
      setShowCorrectionOptions(true);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setElapsedTime((prev: number) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, isPaused]);

  // const [isAlphanumericArr, setIsAlphanumericArr] = useState<boolean[]>([]);
  useEffect(() => {
    if (storyText && storyText.trim().length > 0) {
      const { displayWords } = splitAndNormalizeWords(storyText);
      setWords(displayWords);
    } else if (pdfContent && pdfContent.trim().length > 0) {
      const { displayWords } = splitAndNormalizeWords(pdfContent);
      setWords(displayWords);
    }
  }, [storyText, pdfContent]);

  // State for real words (for matching/highlighting)
  const [realWords, setRealWords] = useState<string[]>([]);

  // When loading storyText/pdfContent, extract real words for matching
  useEffect(() => {
    let text = "";
    if (storyText && storyText.trim().length > 0) {
      text = storyText;
    } else if (pdfContent && pdfContent.trim().length > 0) {
      text = pdfContent;
    }
    if (text) {
      setRealWords(extractWordsFromText(text));

      // Extract vocabulary for vocabulary-constrained recognition
      const vocabulary = extractVocabulary(text);
      setStoryVocabulary(vocabulary);
      console.log(`📚 Story vocabulary extracted from PDF: ${vocabulary.size} words - Sample: ${Array.from(vocabulary).slice(0, 15).join(', ')}`);

      // Detect story language (but don't override if already set from database)
      const detectedLanguage = detectStoryLanguage(vocabulary);
      
      // Only use auto-detection as fallback - database language takes precedence
      // This is handled in the main useEffect where story is loaded
      console.log(`📚 Story loaded: ${vocabulary.size} vocabulary words, detected language: ${detectedLanguage}`);
    } else {
      setRealWords([]);
      setStoryVocabulary(new Set());
    }
  }, [storyText, pdfContent]);

  // Optimized word matching with memoization and caching
  const lastTranscriptRef = useRef<string>("");
  const lastProcessedIndexRef = useRef<number>(-1);
  const matchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMiscueWordRef = useRef<string>(""); // Track last miscue to avoid duplicates
  const processedTranscriptWordsRef = useRef<number>(0); // Track how many transcript words we've processed
  const countedMiscuePositionsRef = useRef<Set<number>>(new Set()); // Track which word positions have been counted

  // Cache for similarity calculations to avoid redundant computations
  const similarityCache = useRef<Map<string, number>>(new Map());

  // Memoized function to calculate similarity with caching
  const getCachedSimilarity = useMemo(() => {
    return (word1: string, word2: string): number => {
      const key = `${word1}|${word2}`;
      const reverseKey = `${word2}|${word1}`;

      // Check cache
      if (similarityCache.current.has(key)) {
        return similarityCache.current.get(key)!;
      }
      if (similarityCache.current.has(reverseKey)) {
        return similarityCache.current.get(reverseKey)!;
      }

      // Calculate and cache
      const norm1 = normalize(word1);
      const norm2 = normalize(word2);
      const distance = levenshtein(norm1, norm2);
      const maxLength = Math.max(norm1.length, norm2.length);
      const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;

      similarityCache.current.set(key, similarity);

      // Limit cache size to prevent memory issues
      if (similarityCache.current.size > 1000) {
        const firstKey = similarityCache.current.keys().next().value;
        if (firstKey) {
          similarityCache.current.delete(firstKey);
        }
      }

      return similarity;
    };
  }, []);

  // Stuck detection: Track how long we've been on the same word
  const stuckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastWordIndexRef = useRef<number>(-1);
  const stuckStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (SERVER_MATCHING_ONLY) return;
    if (!transcript || !realWords.length || currentWordIndex >= realWords.length) return;

    // Skip validation if optimistic mode is active
    if (optimisticWordIndexRef.current > currentWordIndex) {
      console.log('⚡ Skipping slow validation (optimistic mode active)');
      return;
    }

    // Process if transcript changed OR if we moved to a new word
    const transcriptChanged = transcript !== lastTranscriptRef.current;
    const indexChanged = currentWordIndex !== lastProcessedIndexRef.current;

    if (!transcriptChanged && !indexChanged) return;

    lastTranscriptRef.current = transcript;
    lastProcessedIndexRef.current = currentWordIndex;

    // Reset stuck timer when word changes
    if (currentWordIndex !== lastWordIndexRef.current) {
      lastWordIndexRef.current = currentWordIndex;
      stuckStartTimeRef.current = Date.now();

      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
      }

      // DISABLED AUTO-ADVANCE: Causing too many false omissions
      // The omission detection in the main matching logic (line 2777) is more accurate
      // because it checks if the child has read 2+ words ahead, not just time-based
      // 
      // Previous issue: Child struggles with "lungga" for 7 seconds -> auto-advance marks as omission
      // Better approach: Only mark omission when child clearly reads the NEXT word (already implemented below)
      //
      // If we need auto-advance in the future, increase timeout to 15+ seconds and add better checks
    }

    // Clear any pending match check
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
    }

    // ZERO DELAY RECOGNITION: 5ms delay - absolute minimum to avoid interim results
    // User requirement: "if i say 'bata' the mic heard instant get the 'bata' word with 0 delay"
    matchTimeoutRef.current = setTimeout(() => {
      // STRICT FILTERING: Only process real words (2+ chars, mostly letters)
      const transcriptWords = transcript.split(/\s+/).filter(word => {
        if (!word || word.length < 2) return false; // Reject noise/single chars
        const letterCount = (word.match(/[a-zA-Z]/g) || []).length;
        return letterCount >= word.length * 0.7; // At least 70% letters
      });

      if (transcriptWords.length === 0) return;

      // ADAPTIVE BUFFER: Adjust buffer size based on reading speed
      // Fast readers need larger buffers to prevent losing words
      const readingSpeed = calculateReadingSpeed();
      const optimalBufferSize = getOptimalBufferSize(readingSpeed);
      
      if (transcriptWords.length > optimalBufferSize) {
        console.log(`⚡ ADAPTIVE TRIM: Reading speed ${readingSpeed.toFixed(1)} words/sec → buffer size ${optimalBufferSize}`);
        console.log(`   Keeping last ${optimalBufferSize} words (had ${transcriptWords.length})`);
        const trimmedWords = transcriptWords.slice(-optimalBufferSize);
        voskFinalTranscriptRef.current = trimmedWords.join(' ');
        setTranscript(trimmedWords.join(' '));
        // Don't reset processedTranscriptWordsRef - let it track naturally
      }

      const expectedWord = realWords[currentWordIndex];

      console.log(`🎤 Full transcript: "${transcript}"`);
      console.log(`📝 Expected word: "${expectedWord}" at index ${currentWordIndex}`);

      // INSTANT RECOGNITION: Check if the last word is a partial match (word being spoken)
      // This provides instant feedback as the child speaks
      if (transcriptWords.length > 0) {
        const lastWord = transcriptWords[transcriptWords.length - 1];
        const normLastWord = normalize(lastWord);
        const normExpected = normalize(expectedWord);

        // Check if last word is the start of expected word (partial match)
        if (normExpected.startsWith(normLastWord) && normLastWord.length >= 3) {
          console.log(`⚡ PARTIAL MATCH: "${lastWord}" is start of "${expectedWord}" - waiting for completion...`);
          // Don't advance yet, but this helps with instant visual feedback
        }

        // CHILD-FRIENDLY: Check if expected word starts with last word (e.g., "aso" for "asong")
        // This catches cases where child drops the ending - lowered to 60% for children
        // CRITICAL: Only match if this is the FIRST word in transcript (most recent)
        // This prevents false matches from older words
        const isFirstWord = transcriptWords.indexOf(lastWord) === 0;
        if (isFirstWord && normExpected.startsWith(normLastWord) && normLastWord.length >= 2) {
          const similarity = normLastWord.length / normExpected.length;
          if (similarity >= 0.60) {  // CHILD-FRIENDLY: 60% of the word (was 75%)
            console.log(`⚡ NEAR-COMPLETE MATCH: "${lastWord}" is 60%+ of "${expectedWord}" - accepting!`);

            // Mark this word as recognized (for green highlighting)
            setRecognizedWords(prev => new Set(prev).add(currentWordIndex));

            // Increment wordsRead since word was recognized
            setWordsRead(prev => Math.min(prev + 1, words.length));
            console.log(`📊 Words Read incremented to ${Math.min(wordsRead + 1, words.length)}`);

            // Move yellow highlight to next word
            const newIndex = currentWordIndex + 1;
            
            // ⚡ OPTIMISTIC UI: Only move if not already at expected position
            if (newIndex !== optimisticWordIndexRef.current) {
              setCurrentWordIndex(newIndex);
              optimisticWordIndexRef.current = newIndex;
              console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex}`);
            } else {
              console.log(`✓ Yellow already at position ${newIndex} (optimistic move was correct)`);
            }

            // Remove the first word (matched) and keep remaining words
            const remainingWords = transcriptWords.slice(1); // Remove first word
            voskFinalTranscriptRef.current = remainingWords.join(' ');
            setTranscript(remainingWords.join(' '));
            processedTranscriptWordsRef.current = 0;
            console.log(`🧹 Removed near-complete match "${lastWord}", kept ${remainingWords.length} remaining words: [${remainingWords.join(', ')}]`);

            return;
          }
        }
      }

      // ULTRA-FAST: Check ALL words in transcript for matches (not just first)
      // Process multiple words in one go for jet-speed recognition
      console.log(`🔎 Checking ALL ${transcriptWords.length} words in transcript: [${transcriptWords.join(', ')}]`);

      // ADAPTIVE MATCHING: Use fuzzy matching for fast reading
      const isFastReading = currentReadingSpeed > 4; // More than 4 words per second
      let wordsMatched = 0;
      let currentTranscriptIndex = 0;
      const matchedWordIndices: number[] = []; // Track all matched word indices
      // insertedWords removed - insertion detection now handled by backend
      
      if (isFastReading && transcriptWords.length >= 3) {
        console.log(`⚡ FAST READING: Using fuzzy sequence matching for ${transcriptWords.length} words`);
        
        // Try to match each transcript word to nearby story words (within 3 positions)
        for (let i = 0; i < transcriptWords.length && currentWordIndex + wordsMatched < realWords.length; i++) {
          const spokenWord = transcriptWords[i];
          let foundMatch = false;
          
          // Check current position and next 2 positions
          for (let offset = 0; offset <= 2 && currentWordIndex + wordsMatched + offset < realWords.length; offset++) {
            const expectedWord = realWords[currentWordIndex + wordsMatched + offset];
            
            if (isWordMatch(spokenWord, expectedWord, true)) {
              console.log(`✅ FUZZY MATCH #${wordsMatched + 1}: "${spokenWord}" = "${expectedWord}" (offset: ${offset})`);
              
              // If offset > 0, we skipped some words (but don't mark as omission during fast reading)
              if (offset > 0) {
                console.log(`   ⚠️ Skipped ${offset} word(s) during fast reading - not marking as omission yet`);
              }
              
              matchedWordIndices.push(currentWordIndex + wordsMatched + offset);
              wordsMatched += offset + 1;
              foundMatch = true;
              break;
            }
          }
          
          if (!foundMatch) {
            // No match found, stop processing
            break;
          }
        }
      } else {
        // Normal sequential matching for slow/normal reading
        while (currentTranscriptIndex < transcriptWords.length && currentWordIndex + wordsMatched < realWords.length) {
          const spokenWord = transcriptWords[currentTranscriptIndex];
          const expectedWordToMatch = realWords[currentWordIndex + wordsMatched];
          
          if (isWordMatch(spokenWord, expectedWordToMatch, true)) {
            console.log(`✅ MATCH #${wordsMatched + 1}: "${spokenWord}" = "${expectedWordToMatch}"`);
            
            // Track this matched word index
            matchedWordIndices.push(currentWordIndex + wordsMatched);
            
            wordsMatched++;
            currentTranscriptIndex++;
          } else {
            // INSERTION DETECTION: Now handled by backend phrase matcher
            // Old frontend insertion detection disabled to prevent double-counting
            
            // No match, stop trying to match more words
            break;
          }
        }
      }

      if (wordsMatched > 0) {
        console.log(`🚀 MATCHED ${wordsMatched} WORDS IN SEQUENCE!`);
        
        // Mark ALL matched words as recognized (green highlighting) in ONE state update
        setRecognizedWords(prev => {
          const newSet = new Set(prev);
          matchedWordIndices.forEach(idx => newSet.add(idx));
          return newSet;
        });
        console.log(`✅ Marked ${matchedWordIndices.length} words as CORRECT: indices [${matchedWordIndices.join(', ')}]`);
        
        // FAST READING: Track match timestamps for reading speed calculation
        const now = Date.now();
        setMatchTimestamps(prev => {
          const updated = [...prev];
          // Add timestamp for each matched word
          for (let i = 0; i < wordsMatched; i++) {
            updated.push(now);
          }
          // Keep only last 20 timestamps
          return updated.slice(-20);
        });
        
        // Update current reading speed
        const newSpeed = calculateReadingSpeed();
        setCurrentReadingSpeed(newSpeed);
        if (newSpeed > 0) {
          console.log(`📊 Reading speed: ${newSpeed.toFixed(1)} words/second`);
        }
        
        // Insertion detection now handled by backend phrase matcher
        // Old frontend insertion processing removed to prevent double-counting
        
        // Update wordsRead
        setWordsRead(prev => Math.min(prev + wordsMatched, words.length));
        
        // Move yellow highlight forward by number of matched words
        const newIndex = currentWordIndex + wordsMatched;
        
        // ⚡ OPTIMISTIC UI: Only move if not already at expected position
        if (newIndex !== optimisticWordIndexRef.current) {
          setCurrentWordIndex(newIndex);
          optimisticWordIndexRef.current = newIndex;
          console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex} (+${wordsMatched} words)`);
        } else {
          console.log(`✓ Yellow already at position ${newIndex} (optimistic move was correct)`);
        }
        console.log(`📊 Words Read incremented to ${Math.min(wordsRead + wordsMatched, words.length)}`);

        // Reset and mark as processed
        lastMiscueWordRef.current = "";

        // Remove matched words from transcript
        const remainingWords = transcriptWords.slice(wordsMatched);
        voskFinalTranscriptRef.current = remainingWords.join(' ');
        setTranscript(remainingWords.join(' '));
        processedTranscriptWordsRef.current = 0;
        console.log(`🧹 Removed ${wordsMatched} matched words, kept ${remainingWords.length} remaining words: [${remainingWords.join(', ')}]`);

        // NO cooldown - allow continuous processing for fast readers
        console.log("✅ Matches detected, keeping audio processing active");

        return; // Exit early
      } else {
        console.log(`   ✗ "${expectedWord}" NOT found in transcript`);

        // PRIORITY CHECK: Split-word match (check BEFORE omission detection)
        // Example: Child says "aso pa" for "asong" - this is a mispronunciation, NOT an omission
        let foundSplitWordMatch = false;
        if (transcriptWords.length >= 2) {
          for (let i = 0; i < transcriptWords.length - 1; i++) {
            const word1 = transcriptWords[i];
            const word2 = transcriptWords[i + 1];
            const combinedSpoken = normalize(word1 + word2);
            const normalizedExpected = normalize(expectedWord);
            const similarity = getCachedSimilarity(combinedSpoken, normalizedExpected);

            // Also check with space
            const combinedWithSpace = normalize(word1 + " " + word2);
            const similarityWithSpace = getCachedSimilarity(combinedWithSpace, normalizedExpected);
            const bestSimilarity = Math.max(similarity, similarityWithSpace);

            // CHILD-FRIENDLY: Increase threshold to 65% to reduce false positives
            // The 55% threshold was causing "niya sa" to repeatedly match "niyang"
            if (bestSimilarity >= 0.65) {
              console.log(`✅ SPLIT-WORD DETECTED! "${word1} ${word2}" = "${expectedWord}" (${(bestSimilarity * 100).toFixed(0)}% similar) - NOT an omission`);
              foundSplitWordMatch = true;
              break;
            }
          }
        }

        // SKIP-AHEAD DETECTION: Check if child skipped this word and read a future word
        // Example: Story is "May isang asong", child says "May asong" (skipped "isang")
        // ENHANCED: Check up to 5 words ahead to catch multiple skipped words
        // STRICT: Only check the LAST 2 words spoken (most recent) to avoid false positives
        // SAFETY: Only enable after child has read at least 1 word to prevent false omissions at start
        // CRITICAL: Skip this check if we found a split-word match (to prevent false omissions)
        // ADAPTIVE: During fast reading (>4 words/sec), be more lenient to avoid false omissions
        const hasStartedReading = wordsRead > 0 || currentWordIndex > 0;
        const isFastReading = currentReadingSpeed > 4;
        const shouldCheckOmission = !isFastReading || (Date.now() - (matchTimestamps[matchTimestamps.length - 1] || 0) > 1500);
        
        if (transcriptWords.length > 0 && currentWordIndex < realWords.length - 1 && hasStartedReading && !foundSplitWordMatch && shouldCheckOmission) {
          if (isFastReading) {
            console.log(`⚡ FAST READING MODE: Being lenient with omission detection (${currentReadingSpeed.toFixed(1)} words/sec)`);
          }
          // Check the LAST 5 words (most recent) to catch skip-ahead
          // Increased from 2 to 5 to handle cases where child reads multiple words ahead
          const recentWordsToCheck = transcriptWords.slice(-5);

          // Check up to 5 words ahead in the story
          const maxLookAhead = Math.min(5, realWords.length - currentWordIndex - 1);
          let foundFutureWordAt = -1;
          let matchedFutureWord = '';

          for (let i = 1; i <= maxLookAhead; i++) {
            const futureExpectedWord = realWords[currentWordIndex + i];

            // Check if any recent word matches this future word
            const foundMatch = recentWordsToCheck.some(w => {
              const normSpoken = normalize(w);
              const normFuture = normalize(futureExpectedWord);
              if (normSpoken === normFuture) return true;

              // Also check similarity (strict threshold)
              const distance = levenshtein(normSpoken, normFuture);
              const maxLength = Math.max(normSpoken.length, normFuture.length);
              const similarity = 1 - (distance / maxLength);
              return similarity >= 0.90; // Strict threshold
            });

            if (foundMatch) {
              foundFutureWordAt = i;
              matchedFutureWord = futureExpectedWord;
              break; // Found the first future word match
            }
          }

          if (foundFutureWordAt > 0) {
            // Child skipped one or more words!
            // Mark the CURRENT word as omission (the first skipped word)
            if (!countedMiscuePositionsRef.current.has(currentWordIndex)) {
              const skippedCount = foundFutureWordAt; // Number of words skipped
              const futureWordPosition = currentWordIndex + foundFutureWordAt;

              console.log(`⚠️ OMISSION DETECTED! Child skipped "${expectedWord}" (position ${currentWordIndex}) and jumped to "${matchedFutureWord}" (position ${futureWordPosition})`);
              console.log(`   → Skipped ${skippedCount} word(s) - DepEd Rule: Circle omitted word`);

              countedMiscuePositionsRef.current.add(currentWordIndex);
              setMiscues(prev => prev + 1);
              setMiscueTypes(prev => ({ ...prev, omission: prev.omission + 1 }));
              setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'omission'));
              setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
                type: 'omission',
                marking: `Circle omitted word: "${expectedWord}"`,
                spokenWord: '',
                correctWord: expectedWord
              }));

              // Increment wordsRead for the omitted word (child skipped it, but it counts as attempted)
              setWordsRead(prev => Math.min(prev + 1, words.length));
              console.log(`📊 Words Read incremented to ${Math.min(wordsRead + 1, words.length)} (omission counted)`);

              // AUTO-ADVANCE: Move yellow highlight to where the child actually is
              // CRITICAL FIX: Advance to futureWordPosition (where child jumped to), not just +1
              // This prevents marking the landing word as omission
              // Example: Child at "na", skips "naglalakad", says "sa"
              //   - Mark "naglalakad" as omission ✅
              //   - Advance to "sa" (futureWordPosition) ✅
              //   - Don't mark "sa" as omission ✅
              const newIndex = futureWordPosition;
              setCurrentWordIndex(newIndex);
              console.log(`⚠️ Omission marked - auto-advancing yellow highlight from ${currentWordIndex} to ${newIndex} (where child is)`);
              
              // Mark the landing word as recognized (child said it correctly)
              setRecognizedWords(prev => new Set(prev).add(futureWordPosition));
              console.log(`✅ Marked word ${futureWordPosition} "${matchedFutureWord}" as recognized (landing word after skip)`);
              
              // Clear transcript to prevent re-processing
              voskFinalTranscriptRef.current = "";
              setTranscript("");
              processedTranscriptWordsRef.current = 0;
            } else {
              console.log(`⚠️ Omission already marked for word "${expectedWord}" at index ${currentWordIndex} - skipping duplicate`);
              
              // CRITICAL FIX: Clear transcript even for duplicate omissions
              // Otherwise transcript accumulates and causes runaway processing
              voskFinalTranscriptRef.current = "";
              setTranscript("");
              processedTranscriptWordsRef.current = 0;
              console.log(`🧹 Cleared accumulated transcript to prevent runaway processing`);
            }

            return; // Exit to allow state update to trigger re-render
          }
        }
      }

      // JET-SPEED: Check RECENT words (last 3 words only - reduced from 5)
      // This reduces fuzzy matching overhead while still catching fast readers
      const recentWordsCount = Math.min(3, transcriptWords.length);
      const recentWords = transcriptWords.slice(-recentWordsCount);

      // Also track NEW words for miscue detection
      const newWordsStart = processedTranscriptWordsRef.current;
      const newWords = transcriptWords.slice(newWordsStart);

      console.log(`🔍 Checking ${recentWords.length} RECENT words: [${recentWords.join(', ')}]`);
      if (newWords.length > 0) {
        console.log(`   (${newWords.length} are NEW from position ${newWordsStart})`);
      }

      // If no recent words, don't process
      if (recentWords.length === 0) return;

      // Use recentWords for matching (to catch fast readers)
      // But use newWords for miscue detection (to avoid counting same word multiple times)
      const wordsToCheck = recentWords;
      const wordsForMiscueDetection = newWords; // ONLY check NEW words, never fall back to recentWords

      // AUTO-ADVANCE REMOVED: matched and wordsAdvanced variables no longer used
      // let matched = false;
      // let wordsAdvanced = 0;

      // Process each spoken word sequentially - no skipping allowed
      for (const spokenWord of wordsToCheck) {
        const normalizedSpoken = normalize(spokenWord);
        const normalizedExpected = normalize(expectedWord);

        // First check: exact word match (with language validation)
        // CRITICAL: Only match if this is the FIRST word in recent words (most recent)
        // This prevents false matches from older words in the transcript
        const isFirstRecentWord = wordsToCheck.indexOf(spokenWord) === 0;
        if (isFirstRecentWord && isWordMatch(spokenWord, expectedWord, true)) {
          console.log(`✅ MATCH! "${spokenWord}" = "${expectedWord}" - recognized as first word`);
          
          // Mark this word as recognized
          setRecognizedWords(prev => new Set(prev).add(currentWordIndex));
          
          // Increment wordsRead since word was recognized
          setWordsRead(prev => Math.min(prev + 1, words.length));
          
          // Move highlight to next word
          const newIndex = currentWordIndex + 1;
          setCurrentWordIndex(newIndex);
          console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex}`);
          console.log(`📊 Words Read incremented to ${Math.min(wordsRead + 1, words.length)}`);
          
          // Remove matched word from transcript
          const wordIndex = transcriptWords.indexOf(spokenWord);
          if (wordIndex >= 0) {
            const remainingWords = transcriptWords.slice(wordIndex + 1);
            voskFinalTranscriptRef.current = remainingWords.join(' ');
            setTranscript(remainingWords.join(' '));
            processedTranscriptWordsRef.current = 0;
            console.log(`🧹 Removed matched word "${spokenWord}", kept ${remainingWords.length} remaining words`);
          }
          
          return; // Exit early to prevent further processing
        }

        // Check if multiple spoken words combine to form the expected word
        // Example: "panda sal" should match "pandesal", "lungga ng" should match "lunggang"
        if (wordsToCheck.length >= 2) {
          const currentIdx = wordsToCheck.indexOf(spokenWord);
          if (currentIdx >= 0 && currentIdx < wordsToCheck.length - 1) {
            const nextSpokenWord = wordsToCheck[currentIdx + 1];
            const combinedSpoken = normalize(spokenWord + nextSpokenWord);
            const similarity = getCachedSimilarity(combinedSpoken, normalizedExpected);

            // Also check with space (for words like "lungga ng" -> "lunggang")
            const combinedWithSpace = normalize(spokenWord + " " + nextSpokenWord);
            const similarityWithSpace = getCachedSimilarity(combinedWithSpace, normalizedExpected);
            const bestSimilarity = Math.max(similarity, similarityWithSpace);

            // CHILD-FRIENDLY: Increase threshold to 70% and auto-advance for better UX
            // Children often split words naturally, we should accept and move forward
            if (bestSimilarity >= 0.70) {
              console.log(`✅ SPLIT-WORD MATCH! "${spokenWord} ${nextSpokenWord}" = "${expectedWord}" (${(bestSimilarity * 100).toFixed(0)}% similar)`);
              console.log(`   This is a mispronunciation where child split the word into parts`);

              // Count as mispronunciation
              if (!countedMiscuePositionsRef.current.has(currentWordIndex)) {
                countedMiscuePositionsRef.current.add(currentWordIndex);
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, mispronunciation: prev.mispronunciation + 1 }));
                setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'mispronunciation'));
                setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
                  type: 'mispronunciation',
                  marking: `Underline "${expectedWord}" and write phonetic spelling "${spokenWord} ${nextSpokenWord}" above`,
                  spokenWord: `${spokenWord} ${nextSpokenWord}`,
                  correctWord: expectedWord
                }));
              }

              // Increment wordsRead - child read the word (split into parts)
              setWordsRead(prev => Math.min(prev + 1, words.length));
              console.log(`📊 Words Read incremented to ${Math.min(wordsRead + 1, words.length)} (split-word match)`);

              // Mark this word as recognized (for green highlighting)
              setRecognizedWords(prev => new Set(prev).add(currentWordIndex));

              // Move yellow highlight to next word
              const newIndex = currentWordIndex + 1;
              setCurrentWordIndex(newIndex);
              console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex} after split-word match`);

              // Clear transcript to prevent re-matching
              voskFinalTranscriptRef.current = "";
              setTranscript("");
              processedTranscriptWordsRef.current = 0;
              console.log("🧹 Cleared transcript after split-word match");

              return; // Exit early
            }
          }
        }

        // Second check: compound word (child said multiple words together)
        // Example: "henoticed" from "he" + "noticed", "loski" from "lost" + "key"

        // Check if this word contains the current expected word AND the next word
        if (currentWordIndex + 1 < realWords.length) {
          const nextExpectedWord = realWords[currentWordIndex + 1];
          const normalizedExpected = normalize(expectedWord);
          const normalizedNext = normalize(nextExpectedWord);

          // JET-SPEED: Simplified compound check - only exact concat and high similarity
          const concatenated = normalizedExpected + normalizedNext;
          const isExactConcat = normalizedSpoken === concatenated;
          
          // Only calculate similarity if not exact match (saves CPU)
          const similarity = isExactConcat ? 1.0 : getCachedSimilarity(normalizedSpoken, concatenated);
          const isHighSimilarity = similarity >= 0.85;

          // REMOVED: containsBothInOrder, isMediumSimilarity, isBlend checks for speed
          // These were causing excessive CPU usage with minimal benefit

          // Match only if exact or very similar (85%+)
          if (isExactConcat || isHighSimilarity) {
            console.log(`✅ COMPOUND MATCH! "${spokenWord}" = "${expectedWord}" + "${nextExpectedWord}" - but not auto-advancing`);
            // AUTO-ADVANCE REMOVED: Teacher must manually advance
            // wordsAdvanced = 2;
            // matched = true;

            // Remove the compound word and keep remaining words
            const compoundWordIndex = wordsToCheck.indexOf(spokenWord);
            if (compoundWordIndex >= 0) {
              const remainingWords = transcriptWords.slice(compoundWordIndex + 1);
              voskFinalTranscriptRef.current = remainingWords.join(' ');
              setTranscript(remainingWords.join(' '));
              processedTranscriptWordsRef.current = 0;
              console.log(`🧹 Removed compound word, kept ${remainingWords.length} remaining words`);
            } else {
              voskFinalTranscriptRef.current = "";
              setTranscript("");
              processedTranscriptWordsRef.current = 0;
            }

            break;
          }
        }

        // Third check: 3-word compound (very fast reading)
        // Example: "henoticedsome" from "he" + "noticed" + "something"
        // AUTO-ADVANCE REMOVED: matched variable no longer used
        if (currentWordIndex + 2 < realWords.length) {
          const nextWord1 = realWords[currentWordIndex + 1];
          const nextWord2 = realWords[currentWordIndex + 2];
          const concatenated3 = normalize(expectedWord) + normalize(nextWord1) + normalize(nextWord2);
          const similarity3 = getCachedSimilarity(normalizedSpoken, concatenated3);

          if (similarity3 >= 0.75 || normalizedSpoken === concatenated3) { // Lowered from 0.80 to 0.75
            console.log(`✅ 3-WORD COMPOUND MATCH! "${spokenWord}" = "${expectedWord}" + "${nextWord1}" + "${nextWord2}" - but not auto-advancing`);
            // AUTO-ADVANCE REMOVED: Teacher must manually advance
            // wordsAdvanced = 3;
            // matched = true;

            // Clear transcript and reset Vosk

            if (voskSocketRef.current && voskSocketRef.current.readyState === WebSocket.OPEN) {
              try {
                voskSocketRef.current.send(JSON.stringify({ eof: 1 }));
                console.log("🧹 Cleared transcript and reset Vosk after 3-word compound match (30ms cooldown)");
              } catch (e) {
                console.log("🧹 Cleared transcript after 3-word compound match");
              }
            }

            break;
          }
        }
      }

      // AUTO-ADVANCE REMOVED: All advancement logic disabled
      // if (matched && wordsAdvanced > 0) {
      //   const newIndex = currentWordIndex + wordsAdvanced;
      //   setCurrentWordIndex(newIndex);
      //   setWordsRead(newIndex);

      //   // AGGRESSIVE CLEAR: Completely clear transcript after match
      //   processedTranscriptWordsRef.current = 0;
      //   voskFinalTranscriptRef.current = "";
      //   setTranscript("");

      //   // Note: Cooldown and Vosk reset already handled in the match blocks above
      //   // This avoids duplicate cooldowns
      // } else {
      // NO MATCH - Advanced miscue detection (7 types)
      console.log(`❌ No match found in recent words`);

      // Omission detection now handled by priority skip-ahead logic above
      let foundFutureWord = false;

      // 2-7. Other miscue types - analyze RECENT words (not just new ones)
      // CRITICAL FIX: Use wordsToCheck instead of newWords to catch all miscues
      // This ensures we detect miscues even if the word was already in the transcript
      if (!foundFutureWord && wordsToCheck.length > 0) {

        // 4. INSERTION - Now handled by backend phrase matcher
        // Old frontend insertion detection disabled to prevent double-counting
        const alreadyCountedMiscue = countedMiscuePositionsRef.current.has(currentWordIndex);

        if (false && newWords.length > 0 && !alreadyCountedMiscue) { // DISABLED - backend handles insertions
          console.log(`🔍 INSERTION CHECK: Analyzing ${newWords.length} new words: [${newWords.join(', ')}]`);
          let insertionCount = 0;
          const insertedWordsList: string[] = [];

          for (const word of newWords) {
            const normalizedWord = normalize(word);
            console.log(`   Checking word: "${word}" (normalized: "${normalizedWord}")`);

            // CRITICAL FIX: Check if word matches EXPECTED word at current position
            // Not just ANY word in the story
            // Example: Story "naglalakad sa" → Child "naglalakad doon sa"
            //   "doon" doesn't match "sa" (expected word) → INSERTION
            const expectedWord = realWords[currentWordIndex];
            const matchesExpectedWord = isWordMatch(word, expectedWord);
            
            // Also check if it matches the NEXT expected word (might be reading ahead)
            const nextExpectedWord = currentWordIndex + 1 < realWords.length ? realWords[currentWordIndex + 1] : '';
            const matchesNextWord = nextExpectedWord && isWordMatch(word, nextExpectedWord);
            
            // Only skip insertion if it matches current or next expected word
            const matchesAnyStoryWord = matchesExpectedWord || matchesNextWord;
            
            console.log(`   Expected: "${expectedWord}", Next: "${nextExpectedWord}"`);
            console.log(`   Matches expected position: ${matchesAnyStoryWord}`);

            // ENHANCED CHECK: Is this word a fragment/compound of ANY story words?
            // Check both nearby words AND all story words for compounds
            let isLikelyFragment = false;

            // First check: nearby words (current position ± 5 words)
            for (let i = 0; i <= 5 && currentWordIndex + i < realWords.length; i++) {
              const nearbyWord = normalize(realWords[currentWordIndex + i]);
              // If the "inserted" word is contained in a nearby story word, it's likely a fragment
              if (nearbyWord.includes(normalizedWord) || normalizedWord.includes(nearbyWord)) {
                isLikelyFragment = true;
                console.log(`   ℹ️ "${word}" is likely a fragment of nearby word "${realWords[currentWordIndex + i]}" - not counting as insertion`);
                break;
              }

              // COMPOUND CHECK: Check if this "inserted" word is a compound of two nearby words
              if (currentWordIndex + i + 1 < realWords.length) {
                const nextNearbyWord = normalize(realWords[currentWordIndex + i + 1]);
                const compound = nearbyWord + nextNearbyWord;
                if (normalizedWord === compound || compound.includes(normalizedWord) || normalizedWord.includes(compound)) {
                  isLikelyFragment = true;
                  console.log(`   ℹ️ "${word}" is likely a compound of "${realWords[currentWordIndex + i]}" + "${realWords[currentWordIndex + i + 1]}" - not counting as insertion`);
                  break;
                }
              }
            }

            // Second check: ALL story words for compound matches (e.g., "aman" = "a" + "man")
            // This catches cases where speech recognition joins words that appear anywhere in the story
            if (!isLikelyFragment) {
              for (let i = 0; i < realWords.length - 1; i++) {
                const word1 = normalize(realWords[i]);
                const word2 = normalize(realWords[i + 1]);
                const compound = word1 + word2;

                // Check if the "inserted" word is a compound of ANY two consecutive story words
                if (normalizedWord === compound) {
                  isLikelyFragment = true;
                  console.log(`   ℹ️ "${word}" is a compound of story words "${realWords[i]}" + "${realWords[i + 1]}" (positions ${i} and ${i + 1}) - not counting as insertion`);
                  break;
                }

                // Also check high similarity (90%+) for speech recognition errors
                const similarity = getCachedSimilarity(normalizedWord, compound);
                if (similarity >= 0.90) {
                  isLikelyFragment = true;
                  console.log(`   ℹ️ "${word}" is ${(similarity * 100).toFixed(0)}% similar to compound "${realWords[i]} ${realWords[i + 1]}" - not counting as insertion`);
                  break;
                }
              }
            }

            // Third check: Check if word is a compound of ANY two story words (not necessarily consecutive)
            // This catches "aman" from "a" (position 8) + "man" (position 15)
            if (!isLikelyFragment && normalizedWord.length >= 4) {
              for (let i = 0; i < realWords.length; i++) {
                for (let j = i + 1; j < Math.min(i + 10, realWords.length); j++) {
                  const word1 = normalize(realWords[i]);
                  const word2 = normalize(realWords[j]);
                  const compound = word1 + word2;

                  if (normalizedWord === compound) {
                    isLikelyFragment = true;
                    console.log(`   ℹ️ "${word}" is a compound of non-consecutive story words "${realWords[i]}" (pos ${i}) + "${realWords[j]}" (pos ${j}) - not counting as insertion`);
                    break;
                  }
                }
                if (isLikelyFragment) break;
              }
            }

            // Only count as insertion if:
            // 1. Word doesn't match any story word
            // 2. Word is NOT a fragment of nearby words
            // 3. Word is not a pure filler sound (um, uh, ah)
            // 4. Word has at least 2 characters
            // RELAXED: Allow common words like "the", "a", "and" as insertions
            // RELAXED: Reduced minimum length from 4 to 2 characters
            const pureFillerSounds = ['um', 'uh', 'ah', 'eh', 'hmm', 'mm'];
            const isPureFillerSound = pureFillerSounds.includes(normalizedWord);

            if (!matchesAnyStoryWord && !isLikelyFragment && !isPureFillerSound && word.length >= 2 && /[a-z]/i.test(word)) {
              insertionCount++;
              insertedWordsList.push(word);
              console.log(`⚠️ INSERTION! Child added extra word: "${word}" (not in story)`);
            } else if (matchesAnyStoryWord) {
              console.log(`   ℹ️ "${word}" matches a story word - not counting as insertion`);
            } else if (isLikelyFragment) {
              console.log(`   ℹ️ "${word}" is a fragment - not counting as insertion`);
            } else if (isPureFillerSound) {
              console.log(`   ℹ️ "${word}" is a filler sound - not counting as insertion`);
            } else if (word.length < 2) {
              console.log(`   ℹ️ "${word}" is too short - not counting as insertion`);
            }
          }

          if (insertionCount > 0) {
            // Mark this position as counted to prevent double-counting
            countedMiscuePositionsRef.current.add(currentWordIndex);

            setMiscues(prev => prev + insertionCount);
            setMiscueTypes(prev => ({ ...prev, insertion: prev.insertion + insertionCount }));

            // Track inserted words at current position with DepEd marking
            setInsertedWords(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(currentWordIndex) || [];
              newMap.set(currentWordIndex, [...existing, ...insertedWordsList]);
              return newMap;
            });

            // Add DepEd marking for insertion
            setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
              type: 'insertion',
              marking: `Use caret (^) to show where word was inserted and write above: "${insertedWordsList.join(', ')}"`,
              spokenWord: insertedWordsList.join(' '),
              correctWord: realWords[currentWordIndex] || ''
            }));

            // CRITICAL: Check if the expected word is also in the recent words
            // If yes, log it but don't auto-advance
            const expectedWordFound = wordsToCheck.some(w => isWordMatch(w, expectedWord));
            if (expectedWordFound) {
              console.log(`✓ Expected word "${expectedWord}" found after insertion - but not auto-advancing`);
              // AUTO-ADVANCE REMOVED: Teacher must manually advance
              // const newIndex = currentWordIndex + 1;
              // setCurrentWordIndex(newIndex);
              // setWordsRead(newIndex);
              return; // Don't process further miscues for this word
            }
          }
        }

        // 5. REPETITION - Detect when child repeats words or phrases
        // DepEd Rule: Count as one error every word or phrase repeated. Underline the portion repeated.
        // CRITICAL FIX: Use recentWords instead of wordsForMiscueDetection to catch repetitions
        // wordsForMiscueDetection only contains NEW words, so it misses when someone repeats a word they just said

        if (recentWords.length >= 2) {
          // Method 1: Check if last 2 consecutive words are identical (e.g., "the the", "wanted wanted")
          const lastTwo = recentWords.slice(-2);
          const normalizedLast1 = normalize(lastTwo[0]);
          const normalizedLast2 = normalize(lastTwo[1]);

          if (normalizedLast1 === normalizedLast2 && normalizedLast1.length > 0) {
            // CRITICAL FIX: Find which story word was repeated and mark THAT position
            // Don't mark currentWordIndex - mark the word that was actually repeated!

            // Find which story word matches the repeated word
            let repeatedWordIndex = -1;
            for (let i = Math.max(0, currentWordIndex - 3); i <= currentWordIndex && i < realWords.length; i++) {
              if (isWordMatch(lastTwo[0], realWords[i])) {
                repeatedWordIndex = i;
                break;
              }
            }

            // If we found the repeated word in the story, mark it
            if (repeatedWordIndex >= 0) {
              const alreadyCountedRepetition = wordMiscues.get(repeatedWordIndex) === 'repetition';

              if (!alreadyCountedRepetition) {
                console.log(`⚠️ REPETITION! Child repeated "${lastTwo[0]}" (story word #${repeatedWordIndex}: "${realWords[repeatedWordIndex]}") - DepEd Rule: Underline repeated portion`);
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, repetition: prev.repetition + 1 }));
                setWordMiscues(prev => new Map(prev).set(repeatedWordIndex, 'repetition'));
                setWordMarkings(prev => new Map(prev).set(repeatedWordIndex, {
                  type: 'repetition',
                  marking: `Underline repeated portion: "${lastTwo[0]}"`,
                  spokenWord: `${lastTwo[0]} ${lastTwo[1]}`,
                  correctWord: realWords[repeatedWordIndex]
                }));

                // Mark this transcript position as processed to avoid double-counting
                processedTranscriptWordsRef.current = transcriptWords.length;
                return; // Don't count as other miscue types
              }
            }
          }

          // Method 2: Check for phrase repetition (2 words repeated CONSECUTIVELY)
          // Example: "in the in the" (phrase said twice in a row)
          // BUT: Ignore if the phrase naturally appears in the story (e.g., "gutom na gutom na")
          if (recentWords.length >= 4) {
            const lastFour = recentWords.slice(-4);
            const firstPair = normalize(lastFour[0]) + ' ' + normalize(lastFour[1]);
            const secondPair = normalize(lastFour[2]) + ' ' + normalize(lastFour[3]);

            if (firstPair === secondPair && firstPair.length > 0) {
              // Check if this phrase pattern exists in the story
              // Look for the phrase appearing multiple times in the upcoming story words
              let isValidPhraseRepetition = false;
              const lookAheadRange = 8; // Check next 8 words in story

              // Count how many times the phrase appears in the upcoming story
              let phraseCountInStory = 0;
              for (let i = Math.max(0, currentWordIndex - 2); i < Math.min(currentWordIndex + lookAheadRange, realWords.length - 1); i++) {
                if (isWordMatch(lastFour[0], realWords[i]) && isWordMatch(lastFour[1], realWords[i + 1])) {
                  phraseCountInStory++;
                }
              }

              // If the phrase appears 2+ times in the story, it's valid
              if (phraseCountInStory >= 2) {
                isValidPhraseRepetition = true;
                console.log(`   ℹ️ Phrase "${lastFour[0]} ${lastFour[1]}" repeated twice is valid - appears ${phraseCountInStory} times in story`);
              }

              if (!isValidPhraseRepetition) {
                // CRITICAL FIX: Find which story word position the phrase starts at
                let repeatedPhraseIndex = -1;
                for (let i = Math.max(0, currentWordIndex - 3); i <= currentWordIndex && i < realWords.length - 1; i++) {
                  if (isWordMatch(lastFour[0], realWords[i]) && isWordMatch(lastFour[1], realWords[i + 1])) {
                    repeatedPhraseIndex = i;
                    break;
                  }
                }

                if (repeatedPhraseIndex >= 0) {
                  const alreadyCountedRepetition = wordMiscues.get(repeatedPhraseIndex) === 'repetition';

                  if (!alreadyCountedRepetition) {
                    console.log(`⚠️ REPETITION! Child repeated phrase "${lastFour[0]} ${lastFour[1]}" (story position #${repeatedPhraseIndex}) - DepEd Rule: Underline repeated portion`);
                    setMiscues(prev => prev + 1);
                    setMiscueTypes(prev => ({ ...prev, repetition: prev.repetition + 1 }));
                    setWordMiscues(prev => new Map(prev).set(repeatedPhraseIndex, 'repetition'));
                    setWordMarkings(prev => new Map(prev).set(repeatedPhraseIndex, {
                      type: 'repetition',
                      marking: `Underline repeated phrase: "${lastFour[0]} ${lastFour[1]}"`,
                      spokenWord: `${lastFour[0]} ${lastFour[1]} ${lastFour[2]} ${lastFour[3]}`,
                      correctWord: `${realWords[repeatedPhraseIndex]} ${realWords[repeatedPhraseIndex + 1]}`
                    }));

                    // Mark this transcript position as processed
                    processedTranscriptWordsRef.current = transcriptWords.length;
                    return;
                  }
                }
              }
            }
          }
        }

        // OPTIMIZED: Only analyze the LAST NEW word for substitution/mispronunciation
        // This prevents counting the same word multiple times
        // CRITICAL FIX: Use wordsForMiscueDetection instead of wordsToCheck
        // This ensures we only check NEW words, not old words that were already processed
        if (wordsForMiscueDetection.length === 0) return;

        const lastWord = wordsForMiscueDetection[wordsForMiscueDetection.length - 1];
        const isActualWord = lastWord.length >= 3; // Raised from 2 to 3 to filter noise
        const miscueKey = `${currentWordIndex}-${lastWord}`; // Unique key for this miscue

        // CRITICAL: Check if this word position already has been counted (using ref for immediate check)
        const alreadyCounted = countedMiscuePositionsRef.current.has(currentWordIndex);

        // Only count if it's a new miscue (not already counted)
        if (isActualWord && !isWordMatch(lastWord, expectedWord) && lastMiscueWordRef.current !== miscueKey && !alreadyCounted) {
          // Mark this position as counted IMMEDIATELY to prevent duplicates
          countedMiscuePositionsRef.current.add(currentWordIndex);

          // 6. TRANSPOSITION - Word order changed (DepEd Rule: Count as one error every transposition made)
          // Use transpositional symbol over and under the letters or words transposed
          
          // FIRST: Check if this word matches the NEXT expected word (potential transposition)
          if (currentWordIndex + 1 < realWords.length) {
            const nextExpectedWord = realWords[currentWordIndex + 1];
            if (isWordMatch(lastWord, nextExpectedWord)) {
              console.log(`⏳ POTENTIAL TRANSPOSITION: "${lastWord}" matches next expected word "${nextExpectedWord}" - waiting for "${expectedWord}"`);
              // Don't mark as miscue yet - wait to see if next word completes the transposition
              return;
            }
          }

          const isNewWord = newWords.includes(lastWord);

          if (isNewWord && wordsForMiscueDetection.length >= 2) {
            // Check if they said the NEXT word before the current word
            if (currentWordIndex + 1 < realWords.length) {
              const nextExpectedWord = realWords[currentWordIndex + 1];
              const secondLastWord = wordsForMiscueDetection[wordsForMiscueDetection.length - 2];

              console.log(`🔄 TRANSPOSITION CHECK: lastWord="${lastWord}", secondLastWord="${secondLastWord}", expected="${expectedWord}", next="${nextExpectedWord}"`);

              // Pattern: They said word[i+1] then word[i] (swapped order)
              if (isWordMatch(secondLastWord, nextExpectedWord) && isWordMatch(lastWord, expectedWord)) {
                console.log(`⚠️ TRANSPOSITION! Child swapped "${expectedWord}" and "${nextExpectedWord}" - DepEd Rule: Use transpositional symbol`);
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, transposition: prev.transposition + 1 }));
                
                // Mark BOTH transposed words with the transpositional symbol
                setWordMiscues(prev => {
                  const newMap = new Map(prev);
                  newMap.set(currentWordIndex, 'transposition');
                  newMap.set(currentWordIndex + 1, 'transposition');
                  return newMap;
                });
                
                // Add marking for BOTH words
                setWordMarkings(prev => {
                  const newMap = new Map(prev);
                  newMap.set(currentWordIndex, {
                    type: 'transposition',
                    marking: `Transpositional symbol over and under "${expectedWord}"`,
                    spokenWord: `${secondLastWord} ${lastWord}`,
                    correctWord: `${expectedWord} ${nextExpectedWord}`,
                    isFirstWord: true  // Mark as first word of transposition pair
                  });
                  newMap.set(currentWordIndex + 1, {
                    type: 'transposition',
                    marking: `Transpositional symbol over and under "${nextExpectedWord}"`,
                    spokenWord: `${secondLastWord} ${lastWord}`,
                    correctWord: `${expectedWord} ${nextExpectedWord}`,
                    isFirstWord: false  // Mark as second word of transposition pair
                  });
                  return newMap;
                });
                
                lastMiscueWordRef.current = miscueKey;
                return;
              }
            }

            // Don't count saying a previous word as transposition - it's likely repetition or re-reading
          }

          // REMOVED: Client-side mispronunciation vs substitution classification
          // The similarity calculation below was used to classify between mispronunciation (75%+ similarity)
          // and substitution (<75% similarity). This is now handled server-side.
          // Requirements: 3.3, 3.5, 3.6

          // Check for self-correction first (DepEd Rule: Don't count self-correction as error)
          // Pattern: child says wrong word for CURRENT position, then corrects themselves
          // CRITICAL: Only detect if previous word was attempting the SAME expected word
          if (wordsForMiscueDetection.length >= 2) {
            const previousWord = wordsForMiscueDetection[wordsForMiscueDetection.length - 2];
            
            // Self-correction only happens when:
            // 1. Current word matches expected word (correct)
            // 2. Previous word doesn't match expected word (was wrong)
            // 3. Previous word was also attempting THIS SAME word (not a different word in the story)
            // Check if previous word matches ANY other word in the story - if yes, it's not self-correction
            const isPreviousWordInStory = realWords.some((storyWord, idx) => 
              idx !== currentWordIndex && isWordMatch(previousWord, storyWord)
            );
            
            if (isWordMatch(lastWord, expectedWord) && 
                !isWordMatch(previousWord, expectedWord) && 
                !isPreviousWordInStory) {
              console.log(`✓ SELF-CORRECTION! Child corrected "${previousWord}" to "${lastWord}" - DepEd Rule: Mark with 'S', don't count as error`);
              setMiscueTypes(prev => ({ ...prev, selfCorrection: prev.selfCorrection + 1 }));
              setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'selfCorrection'));
              setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
                type: 'selfCorrection',
                marking: `Write 'S' above self-corrected word`,
                spokenWord: `${previousWord} → ${lastWord}`,
                correctWord: expectedWord
              }));

              // AUTO-ADVANCE REMOVED: Teacher must manually advance
              // const newIndex = currentWordIndex + 1;
              // setCurrentWordIndex(newIndex);
              // setWordsRead(newIndex);
              processedTranscriptWordsRef.current = transcriptWords.length;
              return;
            }
          }

          // REMOVED: Client-side substitution vs mispronunciation classification
          // Server now handles all miscue detection including substitution/mispronunciation classification
          // Requirements: 3.3, 3.5, 3.6
          // The server uses similarity thresholds and other heuristics to classify miscues
          // Frontend now only displays server results without performing additional detection
          
          // Note: This client-side detection block has been removed as part of task 4.3
          // All miscue detection is now consolidated server-side in word_matcher.py
          // The server sends match_result with the correct classification which is handled
          // in the WebSocket message handler above (lines 764-842)
        }
      }

      // AUTO-ADVANCE REMOVED: matched variable no longer used
      // Reset miscue tracking when word advances
      // if (matched) {
      //   lastMiscueWordRef.current = "";
      // }

      // Mark these words as processed
      processedTranscriptWordsRef.current = transcriptWords.length;
    }, 5); // 5ms delay - ZERO DELAY recognition (absolute minimum for stability)

    return () => {
      if (matchTimeoutRef.current) {
        clearTimeout(matchTimeoutRef.current);
      }
    };
  }, [transcript, realWords, currentWordIndex]);

  // Reset miscues at the start of each session
  useEffect(() => {
    setMiscues(0);
    setMiscueTypes({
      mispronunciation: 0,
      omission: 0,
      substitution: 0,
      insertion: 0,
      repetition: 0,
      transposition: 0,
      reversal: 0,
      selfCorrection: 0
    });
    setWordsRead(0);
    setCurrentWordIndex(0);
    currentWordIndexLockRef.current = 0;
    setWordMiscues(new Map());
    setWordMarkings(new Map());
    setInsertedWords(new Map());
    setRecognizedWords(new Set()); // Reset recognized words
    processedTranscriptWordsRef.current = 0;
    lastMiscueWordRef.current = "";
    countedMiscuePositionsRef.current.clear(); // Reset counted positions
  }, [sessionId]);

  // Cleanup Vosk on component unmount
  useEffect(() => {
    return () => {
      cleanupVosk();
    };
  }, []);

  const [studentNames, setStudentNames] = useState<{ [id: string]: string }>(
    {}
  );
  const [completedStudents, setCompletedStudents] = useState<{
    [id: string]: boolean;
  }>({});

  // Quiz: resolve matching test automatically and student mapping
  const [tests, setTests] = useState<
    {
      id: string; testName: string; storyId?: string; storyTitle?: string; storySet?: any;
    }[]
  >([]);

  // Extract student names from currentSession (students now contains both id and name)
  useEffect(() => {
    if (!currentSession?.students) return;

    // If students is an array of objects with id and name, use them directly
    const names: { [id: string]: string } = {};
    currentSession.students.forEach((student) => {
      // Handle both old format (string[]) and new format ({id, name}[])
      if (typeof student === 'string') {
        // Old format: just ID, fetch name
        names[student] = student; // Temporary, will be fetched below
      } else if (student && typeof student === 'object' && 'id' in student && 'name' in student) {
        // New format: object with id and name
        names[student.id] = student.name;
      }
    });

    // For old format strings, try to fetch names (backward compatibility)
    const idsToFetch = currentSession.students
      .filter(s => typeof s === 'string')
      .map(s => s as string);

    if (idsToFetch.length > 0) {
      Promise.all(
        idsToFetch.map(async (id) => {
          try {
            const student = await studentService.getStudent(id);
            if (student && student.name) {
              names[id] = student.name;
            } else {
              names[id] = id; // Fallback to ID if name not found
            }
          } catch (e) {
            names[id] = id; // Fallback to ID on error
          }
        })
      ).then(() => setStudentNames(names));
    } else {
      setStudentNames(names);
    }
  }, [currentSession]);

  // Fetch available tests (admin-authored)
  useEffect(() => {
    const loadTests = async () => {
      try {
        const qs = await getDocs(collection(db, "tests"));
        const list: {
          id: string;
          testName: string;
          storyId?: string;
          storyTitle?: string;
        }[] = [];
        qs.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            testName: data?.testName || "Untitled Test",
            storyId: data?.storyId,
            storyTitle:
              data?.storyTitle || data?.book || data?.linkedStoryTitle,
          });
        });
        setTests(list);
      } catch (e) {
        // silent fail; button will remain disabled if no tests
      }
    };
    loadTests();
  }, []);

  // Resolve the matching test for the story linked to this session
  useEffect(() => {
    if (!currentSession) return;
    const storyKey = (currentSession.book || "").toString().trim();
    if (!storyKey && !currentStory) {
      console.log("⚠️ No story key found in currentSession.book");
      return;
    }

    console.log("🔍 Looking for test matching story:", storyKey);
    console.log("📚 Available tests:", tests.map(t => ({ id: t.id, name: t.testName, storyId: t.storyId, storyTitle: t.storyTitle })));

    // Helper function to normalize strings for comparison (handle different apostrophe types)
    const normalizeForMatch = (str: string) => {
      return str.toLowerCase()
        .replace(/['’]/g, "'")  // Normalize curly apostrophes to straight apostrophe
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();
    };

    const normalizedStoryKey = storyKey ? normalizeForMatch(storyKey) : "";
    const normalizedStoryTitle = currentStory?.title ? normalizeForMatch(currentStory.title) : "";
    const storySet = (currentStory as any)?.storySet || (currentStory as any)?.set || (currentSession as any)?.storySet || "";
    const normalizedStorySet = storySet ? normalizeForMatch(storySet) : "";

    // Collect possible story IDs to match against test.storyId
    const storyIdCandidates = [
      currentSession.book || "",
      (currentStory as any)?.id || "",
      (currentStory as any)?._id || "",
      (currentStory as any)?.storyId || ""
    ].filter(Boolean);

    console.log("🔑 Normalized story key:", normalizedStoryKey, "Story IDs:", storyIdCandidates);

    // Filter tests by story set if available; if none remain, fall back to all tests
    let candidateTests = tests;
    if (normalizedStorySet) {
      const filtered = tests.filter(t => (t as any).storySet && normalizeForMatch(String((t as any).storySet)) === normalizedStorySet);
      if (filtered.length > 0) {
        candidateTests = filtered;
      }
    }

    // STRICT MATCHING WITH SET CONTEXT: Only match by storyId or normalized title, within the set-filtered list
    const match = candidateTests.find(
      (t) =>
        // Strategy 1: Exact storyId match (any candidate)
        (t.storyId && storyIdCandidates.some(id => id === t.storyId)) ||
        // Strategy 2: Exact storyTitle match (with normalization) using session book/title or currentStory.title
        (t.storyTitle && (
          (normalizedStoryKey && normalizeForMatch(t.storyTitle) === normalizedStoryKey) ||
          (normalizedStoryTitle && normalizeForMatch(t.storyTitle) === normalizedStoryTitle)
        ))
    );

    if (match) {
      console.log("✅ Test found:", match.testName, "ID:", match.id);
    } else {
      console.log("❌ No matching test found for story:", storyKey);
      console.log("💡 Tip: Make sure the quiz has storyId set to:", currentSession.book);
    }
  }, [tests, currentSession]);

  // GSAP: Configure for 99fps performance
  useEffect(() => {
    gsap.ticker.fps(99);
    return () => {
      gsap.ticker.fps(60); // Reset to default on unmount
    };
  }, []);

  // GSAP: Smooth sliding yellow highlight animation (karaoke-style)
  const yellowHighlightRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    console.log(`🟡 HIGHLIGHT EFFECT: currentWordIndex=${currentWordIndex}, isRecording=${isRecording}, currentWordRef=${!!currentWordRef.current}, yellowHighlightRef=${!!yellowHighlightRef.current}`);
    
    if (currentWordRef.current && isRecording && yellowHighlightRef.current && storyContentRef.current) {
      const wordElement = currentWordRef.current;
      const highlight = yellowHighlightRef.current;
      
      console.log(`🟡 HIGHLIGHT MOVING: Moving to word at index ${currentWordIndex}`);
      
      // Get positions relative to the scrollable container
      const wordRect = wordElement.getBoundingClientRect();
      
      // Calculate position accounting for scroll
      const left = wordElement.offsetLeft;
      const top = wordElement.offsetTop;
      
      // Smooth slide animation to new word position
      gsap.to(highlight, {
        left: left,
        top: top,
        width: wordRect.width,
        height: wordRect.height,
        duration: 0.4,
        ease: 'power2.out',
        opacity: 1,
      });
      
      // Subtle scale animation on the word itself
      gsap.killTweensOf(wordElement);
      gsap.fromTo(
        wordElement,
        {
          scale: 1,
        },
        {
          scale: 1.08,
          duration: 0.3,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
        }
      );
    }
  }, [currentWordIndex, isRecording]);

  // GSAP: Animate recognized words with smooth color transition
  useEffect(() => {
    recognizedWords.forEach((wordIndex) => {
      const wordElement = document.querySelector(`[data-word-index="${wordIndex}"]`);
      if (wordElement && !wordElement.classList.contains('gsap-animated')) {
        wordElement.classList.add('gsap-animated');
        
        // Kill any existing animations
        gsap.killTweensOf(wordElement);
        
        // Smooth transition to green (correct word)
        gsap.to(wordElement, {
          backgroundColor: 'rgba(220, 252, 231, 1)', // green-100
          color: 'rgba(22, 101, 52, 1)', // green-800
          scale: 1,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    });
  }, [recognizedWords]);

  // GSAP: Animate miscue markings when they appear (subtle fade-in only)
  useEffect(() => {
    wordMiscues.forEach((_miscueType, wordIndex) => {
      const wordElement = document.querySelector(`[data-word-index="${wordIndex}"]`);
      if (wordElement && !wordElement.classList.contains('gsap-miscue-animated')) {
        wordElement.classList.add('gsap-miscue-animated');
        
        // Kill any existing animations
        gsap.killTweensOf(wordElement);
        
        // Subtle fade-in for miscue marking (no shake)
        gsap.fromTo(
          wordElement,
          {
            opacity: 0.5,
          },
          {
            opacity: 1,
            duration: 0.3,
            ease: 'power2.out',
          }
        );
      }
    });
  }, [wordMiscues]);

  // Auto-scroll to keep yellow highlight centered (karaoke-style)
  useEffect(() => {
    if (currentWordRef.current && storyContentRef.current && isRecording) {
      const wordElement = currentWordRef.current;
      const container = storyContentRef.current;

      // Calculate position relative to container
      const wordRect = wordElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate the middle threshold (30% from top and bottom)
      const middleThresholdTop = containerRect.top + (containerRect.height * 0.3);
      const middleThresholdBottom = containerRect.bottom - (containerRect.height * 0.3);

      // Check if word is outside the middle zone
      const isAboveMiddle = wordRect.top < middleThresholdTop;
      const isBelowMiddle = wordRect.bottom > middleThresholdBottom;

      if (isAboveMiddle || isBelowMiddle) {
        // GSAP smooth scroll to center the word in view
        const scrollOffset = wordElement.offsetTop - (container.clientHeight / 2) + (wordRect.height / 2);
        gsap.to(container, {
          scrollTop: scrollOffset,
          duration: 0.6,
          ease: 'power2.out',
        });
      }
    }
  }, [currentWordIndex, isRecording]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col items-center justify-center h-screen">
          <p className="text-red-600">Failed to load reading session</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = (currentSession?.status as any) === "completed";

  // Function to save ISR result to MongoDB
  const saveISRResult = async (
    studentId: string,
    studentName: string
  ) => {
    try {
      // Validate required fields
      if (!studentId || studentId.trim() === "") {
        throw new Error("Student ID is required to save ISR result");
      }

      if (!currentSession || !currentStory) {
        console.warn("Cannot save ISR result: missing session or story data");
        return;
      }

      // Get teacher information
      let teacherName = "Teacher";
      let schoolName = "";
      try {
        const profile = await getUserProfile();
        teacherName = profile?.displayName || profile?.email || "Teacher";
        schoolName = profile?.school || "";
      } catch (error) {
        console.warn("Could not fetch teacher profile:", error);
      }

      // Format reading time (convert seconds to "M:SS minuto")
      const formatReadingTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, "0")} minuto`;
      };

      // Calculate word reading score percentage
      const calculateWordReadingScore = (): number => {
        if (words.length === 0) return 0;
        const correctWords = wordsRead - miscues;
        const percentage = (correctWords / words.length) * 100;
        return Math.max(0, Math.min(100, percentage)); // Clamp between 0-100
      };

      // Determine word reading level based on score
      const getWordReadingLevel = (score: number): "Independent" | "Instructional" | "Frustration" => {
        if (score >= 95) return "Independent";
        if (score >= 90) return "Instructional";
        return "Frustration";
      };

      // Determine comprehension level (default to Frustration since quiz comes later)
      const getComprehensionLevel = (): "Independent" | "Instructional" | "Frustration" => {
        // Quiz data not available yet, default to Frustration
        return "Frustration";
      };

      // Get story set (A, B, C, or D) - default to 'A' if not available
      const getStorySet = (): "A" | "B" | "C" | "D" => {
        const storySet = (currentStory as any)?.storySet || (currentStory as any)?.set || "A";
        if (["A", "B", "C", "D"].includes(storySet)) {
          return storySet as "A" | "B" | "C" | "D";
        }
        return "A";
      };

      // Get story level (reading level)
      const getStoryLevel = (): string => {
        return (currentStory as any)?.readingLevel || (currentStory as any)?.level || "4";
      };

      // Use the actual tracked miscue types from the reading session
      const miscueBreakdown = {
        mispronunciation: miscueTypes.mispronunciation || 0,
        omission: miscueTypes.omission || 0,
        substitution: miscueTypes.substitution || 0,
        insertion: miscueTypes.insertion || 0,
        repetition: miscueTypes.repetition || 0,
        transposition: miscueTypes.transposition || 0,
        reversal: miscueTypes.reversal || 0,
        totalMiscues: miscues,
      };

      const wordReadingScore = calculateWordReadingScore();
      const wordReadingLevel = getWordReadingLevel(wordReadingScore);

      // Map story language to ISR language format
      const isrLanguage: "English" | "Filipino" =
        storyLanguage === "tagalog" ? "Filipino" : "English";

      // Get student grade/section if available
      let gradeSection = "";
      try {
        const student = await studentService.getStudent(studentId);
        if (student?.grade) {
          gradeSection = student.grade;
        }
      } catch (error) {
        console.warn("Could not fetch student grade:", error);
      }

      // Validate teacherId
      const teacherIdValue = currentSession.teacherId || currentUser?.uid;
      if (!teacherIdValue || teacherIdValue.trim() === "") {
        throw new Error("Teacher ID is required to save ISR result");
      }

      // Create ISR result data matching MongoDB document structure
      const isrResultData = {
        studentId: studentId.trim(), // Ensure it's a valid string
        studentName: studentName.trim(),
        teacherId: teacherIdValue.trim(),
        teacherName: teacherName.trim(),
        gradeSection: gradeSection || undefined, // Use undefined instead of empty string
        school: schoolName || undefined, // Use undefined instead of empty string
        formTitle: "Phil-IRI Form 3A",
        language: isrLanguage,
        sessionId: sessionId && sessionId.trim() !== "" ? sessionId.trim() : undefined, // Optional field
        sessionTitle: currentSession.title || undefined,
        book: currentSession.book || currentStory.title || undefined,
        testId: undefined, // Optional - can be added later when quiz is completed
        testName: undefined, // Optional - can be added later when quiz is completed
        assessmentDate: new Date(),
        partA: {
          readingTime: formatReadingTime(elapsedTime),
          readingRate: parseInt(readingSpeedWPM) || 0,
          correctAnswers: 0, // Quiz comes later
          percentage: 0, // Quiz comes later
          comprehensionLevel: getComprehensionLevel(),
          answers: [], // Quiz answers come later
        },
        partB: {
          wordReading: {
            selection: currentSession.book || currentStory.title || "",
            level: getStoryLevel(),
            set: getStorySet(),
          },
          miscues: miscueBreakdown,
          wordsInPassage: words.length,
          wordReadingScore: wordReadingScore,
          wordReadingLevel: wordReadingLevel,
        },
      };

      // Save to MongoDB and store the result ID
      const resultId = await isrResultService.createISRResult(isrResultData);
      setIsrResultId(resultId);
      console.log('✅ ISR result saved with ID:', resultId);
    } catch (error) {
      console.error("Error saving ISR result to MongoDB:", error);
      throw error; // Re-throw to show error to user
    }
  };

  // Retry/Reset reading session
  const handleRetrySession = () => {
    // Stop any ongoing recording
    if (isRecording) {
      handleStopRecording();
    }
    
    // Reset all session state
    setCurrentWordIndex(0);
    currentWordIndexLockRef.current = 0;
    setWordsRead(0);
    setMiscues(0);
    setMiscueTypes({ omission: 0, substitution: 0, insertion: 0, mispronunciation: 0, repetition: 0, transposition: 0, reversal: 0, selfCorrection: 0 });
    setElapsedTime(0);
    setTranscript('');
    setRecognizedWords(new Set());
    setWordMiscues(new Map());
    setWordMarkings(new Map());
    setInsertedWords(new Map());
    setAudioBlob(null);
    lastWordTimestampRef.current = Date.now(); // Reset timestamp for next session
    setAudioUrl(null);
    setIsRecording(false);
    setHasStarted(false);
    
    // Show confirmation
    Swal.fire({
      icon: 'success',
      title: 'Session Reset!',
      text: 'You can start a new reading session now.',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleCompleteSession = async () => {
    if (!sessionId || !currentSession) return;

    try {
      // If recording is active, stop and wait for audio to finalize
      if (isRecording) {
        await handleStopRecording();
        await waitForAudioFinalization(2500);
      }

      // Show SweetAlert2 success popup
      await Swal.fire({
        icon: "success",
        title: "Session Completed!",
        text: "All data has been saved successfully.",
        confirmButtonText: "OK",
      });

      // Optionally navigate back to sessions list
      // navigate('/teacher/reading');
    } catch (error) {
      console.error("Failed to complete session:", error);
      alert("Failed to complete session. Please try again.");
    }
  };

  // Download audio handler
  const handleDownloadAudio = () => {
    if (!audioBlob || !audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${currentSession?.title || "audio-recording"}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 flex flex-col">
      {/* Title */}
      <header className="w-full px-4 sm:px-8 pt-4 sm:pt-8 pb-6 sm:pb-8 relative z-50 bg-gradient-to-br from-blue-50 via-white to-purple-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center px-3 py-2 text-sm sm:text-base font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-sm z-50 relative min-h-[44px] min-w-[44px] touch-manipulation"
              title="Back"
            >
              <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-blue-900 truncate">
              {currentSession?.title || "Reading Session"}
            </h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Vosk Connection Indicator - Always visible */}
            {true && (
              <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                voskStatus === "connected"
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : voskStatus === "connecting"
                    ? "bg-yellow-100 text-yellow-700 border border-yellow-300 animate-pulse"
                    : "bg-red-100 text-red-700 border border-red-300"
              }`}
              title={`Vosk Server: ${voskStatus}`}>
                <span className={`w-2 h-2 rounded-full ${
                  voskStatus === "connected"
                    ? "bg-green-500"
                    : voskStatus === "connecting"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-red-500"
                }`}></span>
                <span className="hidden sm:inline">Vosk: {voskStatus.charAt(0).toUpperCase() + voskStatus.slice(1)}</span>
                <span className="sm:hidden">{voskStatus === "connected" ? "✓" : voskStatus === "connecting" ? "..." : "✗"}</span>
              </div>
            )}
            
            {/* 100% REAL-TIME: Latency Indicator */}
            {isRecording && latency > 0 && (
              <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold ${
                latency < 20
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : latency < 50
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-orange-100 text-orange-700 border border-orange-300"
              }`}
              title={`Connection latency: ${latency}ms`}>
                <span className={`w-2 h-2 rounded-full ${
                  latency < 20
                    ? "bg-green-500"
                    : latency < 50
                      ? "bg-blue-500"
                      : "bg-orange-500"
                }`}></span>
                <span className="hidden sm:inline">⏱️ {latency}ms</span>
                <span className="sm:hidden">{latency}ms</span>
              </div>
            )}
            
            {/* HYBRID: Mode and Reading Speed Indicator */}
            {isRecording && readingSpeed > 0 && (
              <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold bg-purple-100 text-purple-700 border border-purple-300`}
              title={`Recognition mode: ${hybridMode === 'word_by_word' ? '1-by-1 (word-by-word)' : 'Multi-word (phrase)'}, Reading speed: ${readingSpeed.toFixed(1)} words/sec`}>
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="hidden sm:inline">{hybridMode === 'word_by_word' ? '1-by-1' : 'Multi'} • {readingSpeed.toFixed(1)}wps</span>
                <span className="sm:hidden">{hybridMode === 'word_by_word' ? '1' : 'M'} {readingSpeed.toFixed(1)}</span>
              </div>
            )}
            
            {/* Heard Indicator - Always visible when recording */}
            {isRecording && finalText && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-red-100 to-pink-100 border-2 border-red-300 shadow-md animate-pulse">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-red-700">Heard:</span>
                  <span className="text-xs sm:text-sm font-extrabold text-red-900 bg-white/60 px-2 py-0.5 rounded-full">
                    {finalText}
                  </span>
                </div>
              </div>
            )}
            {currentSession && (
              <span
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm sm:text-base font-semibold transition-all duration-200
                ${currentSession.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : currentSession.status === "in-progress"
                      ? "bg-blue-100 text-blue-700 animate-pulse"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
              >
                {currentSession.status.charAt(0).toUpperCase() +
                  currentSession.status.slice(1)}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Story Content + Progress Side by Side */}
      <section className="w-full px-4 pt-6 sm:px-8 mb-6 flex flex-col lg:flex-row gap-4 lg:gap-8 relative z-10">
        {/* Story Content */}
        <div className="flex-1">
          {/* Miscue Legend */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Miscue Color Guide:</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 border-2 border-green-500 rounded">✅ Correct</span>
              <span className="px-2 py-1 border-2 border-yellow-500 rounded">🔤 Mispronounce</span>
              <span className="px-2 py-1 border-2 border-red-500 rounded">🔄 Substitution</span>
              <span className="px-2 py-1 border-2 border-orange-500 rounded">⏭️ Omission</span>
              <span className="px-2 py-1 border-2 border-purple-500 rounded">➕ Insertion</span>
              <span className="px-2 py-1 border-2 border-blue-500 rounded">🔀 Transposition</span>
              <span className="px-2 py-1 border-2 border-pink-500 rounded">↩️ Reversal</span>
              <span className="px-2 py-1 border-2 border-cyan-500 rounded">✏️ Self-Correct</span>
            </div>
          </div>
          
          <div className="relative bg-white/80 rounded-2xl lg:rounded-3xl border border-blue-100 p-4 sm:p-6 lg:p-10 overflow-hidden max-h-[40rem] lg:max-h-[48rem]">
            {/* Progress Bar - GSAP animated */}
            <div
              ref={(el) => {
                if (el && isRecording) {
                  const progress = Math.min((currentWordIndex / words.length) * 100, 100);
                  gsap.to(el, {
                    width: `${progress}%`,
                    duration: 0.5,
                    ease: 'power2.out',
                  });
                }
              }}
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-t-3xl"
              style={{
                width: '0%',
              }}
            ></div>
            <div className="mb-4 sm:mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900 flex items-center gap-3">
                <BookOpenIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-blue-500" />
                {currentStory?.title || "Story"}
              </h3>
              <div className="flex items-center gap-3 sm:gap-6 text-sm sm:text-base lg:text-lg text-blue-700">
                <span>{words.length} words</span>
                {isLoadingPdf && <span className="hidden sm:inline">•</span>}
                {isLoadingPdf && <span>Loading PDF…</span>}
              </div>
            </div>
            <div
              ref={storyContentRef}
              className="max-h-[20rem] sm:max-h-[30rem] lg:max-h-[38rem] overflow-y-auto custom-scrollbar prose prose-blue bg-white/60 rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 leading-relaxed tracking-wide relative"
              style={recommendedFont}
            >
              {/* Yellow border square (karaoke-style indicator) */}
              {isRecording && (
                <div
                  ref={yellowHighlightRef}
                  className="absolute pointer-events-none rounded-lg"
                  style={{
                    backgroundColor: 'transparent', // No background fill
                    border: '4px solid #FCD34D', // Yellow-400 border
                    boxShadow: '0 0 15px rgba(252, 211, 77, 0.6), inset 0 0 10px rgba(252, 211, 77, 0.2)',
                    transition: 'none', // GSAP handles all transitions
                    zIndex: 5,
                    opacity: 0,
                    left: 0,
                    top: 0,
                    width: 0,
                    height: 0,
                  }}
                />
              )}
              {storyText || pdfContent ? (
                (storyText ? storyText : pdfContent)
                  .split("\n")  // Split by single line break to preserve original formatting
                  .filter((p) => p.trim().length > 0)
                  .map((paragraph, paragraphIndex, paragraphs) => {
                    // Detect leading whitespace before trimming
                    const leadingMatch = paragraph.match(/^(\s+)/);
                    const leadingSpaces = leadingMatch ? leadingMatch[1] : '';
                    
                    // Debug logging removed - was causing excessive console spam on every render
                    
                    const wordsInParagraph = paragraph.trim().split(/\s+/);
                    // Calculate the starting real word index for this paragraph
                    const paragraphStartIndex = paragraphs
                      .slice(0, paragraphIndex)
                      .reduce((acc, p) => {
                        const paraWords = p.trim().split(/\s+/);
                        return acc + paraWords.filter(w => /\w+/.test(w)).length;
                      }, 0);

                    return (
                      <div
                        key={paragraphIndex}
                        className="mb-4 sm:mb-6 lg:mb-8 last:mb-0"
                      >
                        <p 
                          className="text-gray-800 leading-relaxed flex flex-wrap gap-y-1 sm:gap-y-2 lg:gap-y-3" 
                          style={{ 
                            whiteSpace: 'pre-wrap',
                            textAlign: (currentStory as any)?.textAlign || 'left',
                            justifyContent: (currentStory as any)?.textAlign === 'center' ? 'center' : 
                                          (currentStory as any)?.textAlign === 'right' ? 'flex-end' : 'flex-start'
                          }}
                        >
                          {leadingSpaces && leadingSpaces.length > 0 && (
                            <span 
                              style={{ 
                                width: `${leadingSpaces.length * 1}ch`,
                                minWidth: `${leadingSpaces.length * 1}ch`,
                                flexShrink: 0,
                                display: 'inline-block'
                              }}
                              title={`Indent: ${leadingSpaces.length} spaces`}
                            />
                          )}
                          {wordsInParagraph.map((word, wordIndex) => {
                            const isSpecialChar = !/\w+/.test(word);

                            // Calculate real word index (only count alphanumeric words)
                            let realWordIndex = -1;
                            if (!isSpecialChar) {
                              let count = 0;
                              for (let i = 0; i <= wordIndex; i++) {
                                if (/\w+/.test(wordsInParagraph[i])) {
                                  if (i === wordIndex) {
                                    realWordIndex = paragraphStartIndex + count;
                                    break;
                                  }
                                  count++;
                                }
                              }
                            }

                            const isCurrent = !isSpecialChar && isWordCurrent(realWordIndex, currentWordIndex);
                            
                            return (
                              <React.Fragment key={`${paragraphIndex}-${wordIndex}`}>
                                {/* Simple word display */}
                                {!isSpecialChar && (
                                  <span
                                    ref={isCurrent ? currentWordRef : null}
                                    data-word-index={realWordIndex}
                                    onClick={() => handleWordClick(realWordIndex)}
                                    className={`mr-1 sm:mr-2 lg:mr-3 mb-2 sm:mb-3 px-2 sm:px-3 py-1 sm:py-2 font-serif text-sm sm:text-lg lg:text-2xl rounded cursor-pointer transition-all ${
                                      getMiscueColorClasses(wordColors.get(realWordIndex)) || 
                                      (isCurrent && isRecording && !isCompleted 
                                        ? 'bg-transparent border-4 border-yellow-400 font-semibold animate-pulse' 
                                        : 'bg-transparent border-2 border-transparent')
                                    } ${selectedWordIndex === realWordIndex ? 'border-2 border-blue-500' : ''}`}
                                    style={{
                                      fontFamily: recommendedFont.fontFamily,
                                      fontSize: recommendedFont.fontSize,
                                    }}
                                  >
                                    {word}
                                  </span>
                                )}
                                {/* Special characters (punctuation) rendered as-is */}
                                {isSpecialChar && (
                                  <span
                                    className="inline-block mr-1 sm:mr-2 lg:mr-3 mb-2 sm:mb-3 px-2 sm:px-3 py-1 sm:py-2 rounded font-serif text-sm sm:text-lg lg:text-2xl text-gray-400 bg-transparent pointer-events-none select-none"
                                    style={{
                                      fontFamily: recommendedFont.fontFamily,
                                      fontSize: recommendedFont.fontSize,
                                    }}
                                  >
                                    {word}
                                  </span>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </p>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-16">
                  <div className="bg-gray-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Story Loaded</h3>
                  <p className="text-gray-500 text-sm">Please select a story to begin the reading session</p>
                </div>
              )}
            </div>
            {(pdfError || error) && !storyText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-3xl shadow-xl z-10 p-8">
                <div className="bg-red-50 rounded-full p-6 mb-6">
                  <XCircleIcon className="h-20 w-20 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">Unable to Load Story</h3>
                <p className="text-gray-600 text-center max-w-md mb-2">
                  We couldn't load the story content for this reading session.
                </p>
                <p className="text-sm text-gray-500 text-center max-w-md mb-6">
                  This might be a temporary connection issue. Please try refreshing the page.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all font-semibold flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Page
                  </button>
                  <button
                    onClick={() => navigate('/teacher/reading')}
                    className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-semibold"
                  >
                    Go Back
                  </button>
                </div>
                {(pdfError || error) && (
                  <details className="mt-6 text-xs text-gray-400 cursor-pointer">
                    <summary className="hover:text-gray-600">Technical details</summary>
                    <p className="mt-2 font-mono bg-gray-100 p-2 rounded">{pdfError || error}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Progress Column - Only show after Complete button is clicked */}
        {isCompleted && (
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-4">
              {/* Students */}
              <div className="rounded-lg sm:rounded-xl bg-blue-100 p-2 sm:p-3 lg:p-4 flex flex-col items-center">
                <span className="text-blue-700 font-bold text-sm sm:text-base lg:text-lg mb-1 flex items-center gap-1 sm:gap-2">
                  <UserGroupIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  <span className="hidden sm:inline">Students</span>
                  <span className="sm:hidden">Students</span>
                </span>
                <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
                  {currentSession?.students.map(
                    (student, idx: number) => {
                      // Handle both old format (string) and new format ({id, name})
                      const studentId = typeof student === 'string' ? student : student.id;
                      const studentName = typeof student === 'string'
                        ? (studentNames[student] || student)
                        : student.name;

                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800"
                        >
                          <span className="truncate max-w-[60px] sm:max-w-none">
                            {studentName}
                          </span>
                          {completedStudents[studentId] && (
                            <span className="ml-1 inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-[10px] font-semibold">
                              ✓
                            </span>
                          )}
                        </span>
                      );
                    }
                  )}
                </div>
              </div>
              {/* Words Read */}
              <div className="rounded-lg sm:rounded-xl bg-blue-100 p-2 sm:p-3 lg:p-4 flex flex-col items-center">
                <span className="text-blue-700 font-bold text-xs sm:text-sm lg:text-lg">
                  Words Read
                </span>
                <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-blue-700 mt-1">
                  {Math.min(wordsRead, words.length)}
                </span>
              </div>

              {/* Oral Reading Score */}
              <div className="rounded-lg sm:rounded-xl bg-yellow-100 p-2 sm:p-3 lg:p-4 flex flex-col items-center">
                <span className="text-yellow-700 font-bold text-xs sm:text-sm lg:text-lg">
                  Oral Reading Score
                </span>
                <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-yellow-700 mt-1">
                  {oralReadingScore}%
                </span>
              </div>
              {/* Reading Speed */}
              <div className="rounded-lg sm:rounded-xl bg-green-100 p-2 sm:p-3 lg:p-4 flex flex-col items-center">
                <span className="text-green-700 font-bold text-xs sm:text-sm lg:text-lg">
                  Reading Speed
                </span>
                <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-green-700 mt-1">
                  {readingSpeedWPM} WPM
                </span>
              </div>
              {/* Elapsed */}
              <div className="rounded-lg sm:rounded-xl bg-yellow-100 p-2 sm:p-3 lg:p-4 flex flex-col items-center">
                <span className="text-yellow-700 font-bold text-xs sm:text-sm lg:text-lg">
                  Elapsed
                </span>
                <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-yellow-700 mt-1">
                  {formatElapsedTime(elapsedTime)}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Session Controls */}
      {!isCompleted && (
        <section className="w-full px-4 sm:px-8 pb-8 relative z-10">
          <div className="relative bg-white/80 rounded-2xl lg:rounded-3xl border border-blue-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center gap-4 sm:gap-6">
            {/* Microphone Selection Dropdown - Top Right */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-blue-100">
                <label htmlFor="mic-select" className="text-xs sm:text-sm font-semibold text-blue-900">
                  Microphone:
                </label>
                <select
                  id="mic-select"
                  value={selectedMicId}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                  disabled={isRecording}
                  className="px-2 py-1 text-xs sm:text-sm border border-blue-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed max-w-[150px] sm:max-w-[250px]"
                >
                  {audioDevices.length === 0 ? (
                    <option value="">No microphones</option>
                  ) : (
                    audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Mic ${device.deviceId.slice(0, 8)}...`}
                      </option>
                    ))
                  )}
                </select>
                {/* Hear Me Test Button */}
                <button
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({
                        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
                      });
                      
                      const audioContext = new AudioContext();
                      const source = audioContext.createMediaStreamSource(stream);
                      const analyser = audioContext.createAnalyser();
                      analyser.fftSize = 256;
                      
                      const delayNode = audioContext.createDelay(0.1);
                      delayNode.delayTime.value = 0.1;
                      source.connect(analyser);
                      source.connect(delayNode);
                      delayNode.connect(audioContext.destination);
                      
                      Swal.fire({
                        html: `
                          <div style="text-align: center; padding: 10px 0;">
                            <h2 style="font-size: 24px; font-weight: 700; color: #1f2937; margin-bottom: 8px;">Testing Microphone</h2>
                            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Speak now — you should hear yourself!</p>
                            <div id="audio-bars" style="display: flex; justify-content: center; align-items: end; gap: 4px; height: 60px; margin-bottom: 20px;">
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                              <div class="audio-bar" style="width: 8px; background: linear-gradient(to top, #10b981, #34d399); border-radius: 4px; height: 8px;"></div>
                            </div>
                            <p style="color: #9ca3af; font-size: 12px;">Click Stop when done testing</p>
                          </div>
                        `,
                        showConfirmButton: true,
                        confirmButtonText: 'Stop Test',
                        confirmButtonColor: '#ef4444',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didOpen: () => {
                          const bars = document.querySelectorAll('.audio-bar');
                          const dataArray = new Uint8Array(analyser.frequencyBinCount);
                          let animationId: number = 0;
                          const animateBars = () => {
                            analyser.getByteFrequencyData(dataArray);
                            bars.forEach((bar, i) => {
                              const value = dataArray[i * 2] || 0;
                              const height = Math.max(8, (value / 255) * 60);
                              (bar as HTMLElement).style.height = height + 'px';
                            });
                            animationId = requestAnimationFrame(animateBars);
                          };
                          void animationId;
                          animateBars();
                        }
                      }).then(() => {
                        source.disconnect();
                        analyser.disconnect();
                        delayNode.disconnect();
                        stream.getTracks().forEach(track => track.stop());
                        audioContext.close();
                      });
                    } catch (error) {
                      // Requirement 5.4: Log microphone test errors with details
                      const errorMessage = error instanceof Error ? error.message : "Unknown error";
                      console.error('❌ Mic test error:', {
                        error: errorMessage,
                        stack: error instanceof Error ? error.stack : undefined,
                        selectedMicId,
                        timestamp: new Date().toISOString()
                      });
                      // Requirement 5.4: Show user-friendly error message
                      Swal.fire({
                        title: 'Microphone Error',
                        text: 'Could not access the microphone. Please check that:\n\n' +
                              '1. Microphone permissions are granted\n' +
                              '2. The selected microphone is connected\n' +
                              '3. No other application is using the microphone',
                        icon: 'error',
                        confirmButtonColor: '#3b82f6'
                      });
                    }
                  }}
                  disabled={isRecording}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Test your microphone"
                >
                  Test
                </button>
              </div>
              {/* Mic Input Sensitivity Slider */}
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-blue-100 mt-2">
                <label htmlFor="mic-input" className="text-xs sm:text-sm font-semibold text-blue-900 whitespace-nowrap">
                  Input Gain:
                </label>
                <input
                  type="range"
                  id="mic-input"
                  min="0"
                  max="200"
                  value={micVolume}
                  onChange={(e) => setMicVolume(Number(e.target.value))}
                  disabled={isRecording}
                  className="w-24 sm:w-32 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xs sm:text-sm text-gray-600 min-w-[2.5rem] text-right">{micVolume}%</span>
              </div>
            </div>
            
            {/* Language selector + Vosk status badge */}
            <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 -mt-2 -mb-2">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* Status indicator dot - only shows when recording is active */}
                {isRecording && (storyLanguage === "tagalog" || storyLanguage === "english") && (
                  <span
                    className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${voskStatus === "connected"
                      ? "bg-green-500"
                      : voskStatus === "connecting"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                      }`}
                    title={`Vosk: ${voskStatus}`}
                  ></span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 mb-2">
              <h4 className="text-base sm:text-lg font-bold text-blue-900">
                Controls
              </h4>
            </div>
            <div className="flex flex-row flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6 w-full">
              {!isRecording ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <button
                    onClick={handleStartRecording}
                    className="flex items-center justify-center gap-2 sm:gap-3 px-8 sm:px-12 lg:px-16 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg sm:text-xl lg:text-2xl font-bold hover:scale-105 hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg"
                  >
                    <span>Start</span>
                  </button>
                  <p className="text-sm text-gray-500 text-center">
                    Click to begin recording the student's reading
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-red-600">Recording in Progress</span>
                  </div>
                  <button
                    onClick={handleDownloadAudio}
                    disabled={!audioUrl}
                    className="flex items-center justify-center gap-2 sm:gap-3 px-8 sm:px-12 lg:px-16 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-green-400 to-blue-400 text-white text-lg sm:text-xl lg:text-2xl font-bold hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download audio recording"
                  >
                    <span>Download Audio</span>
                  </button>
                </div>
              )}
              {!isCompleted && hasStarted && (
                <button
                  onClick={handleCompleteSession}
                  className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 text-white text-base sm:text-lg lg:text-xl font-bold hover:scale-105 transition-all duration-200"
                  title="Complete"
                >
                  <span>Complete</span>
                </button>
              )}
              {isRecording && (
                <button
                  onClick={handleRetrySession}
                  className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-base sm:text-lg lg:text-xl font-bold hover:scale-105 transition-all duration-200"
                  title="Retry"
                >
                  <span>Retry</span>
                </button>
              )}
            </div>
            
            {/* Miscue tracking section removed - will be rebuilt */}
          </div>
        </section>
      )}

      {/* Heard Mic Display - Real-time recognized text with live updates */}
      {isRecording && (
        <section className="w-full px-4 sm:px-8 pb-8 relative z-10">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border-2 border-blue-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                </span>
                Recognized Text (Real-time)
              </h3>
              
              {/* Partial text - shows as user is speaking */}
              {partialText && (
                <div className="mb-4 p-3 bg-blue-100 rounded-lg border-l-4 border-blue-500 animate-pulse">
                  <p className="text-xs font-semibold text-blue-700 mb-1">🎤 LISTENING (Partial):</p>
                  <p className="text-blue-900 font-medium text-base">{partialText}</p>
                </div>
              )}
              
              {/* Final text - shows when word is confirmed */}
              {finalText && (
                <div className="p-3 bg-green-100 rounded-lg border-l-4 border-green-500">
                  <p className="text-xs font-semibold text-green-700 mb-1">✓ RECOGNIZED (Final):</p>
                  <p className="text-green-900 font-bold text-lg">{finalText}</p>
                </div>
              )}
              
              {/* Listening state - when no text yet */}
              {!partialText && !finalText && (
                <div className="p-3 bg-gray-100 rounded-lg border-l-4 border-gray-400 animate-pulse">
                  <p className="text-gray-600 italic flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    Listening for voice input...
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Bottom Quiz Button - Only show when session is completed */}
      {isCompleted && (
        <div className="w-full px-4 sm:px-8 py-4 mt-auto bg-white/80 border-t border-blue-100">
          <div className="max-w-6xl mx-auto">
            <button
              onClick={async () => {
                // Prevent action if quiz already completed
                if (hasCompletedQuiz) {
                  console.log('⚠️ Quiz already completed, button should be disabled');
                  return;
                }
                
                if (!currentSession || !currentStory) return;
                
                // Get student info
                const firstStudent = currentSession.students[0];
                const studentId = typeof firstStudent === 'string' ? firstStudent : firstStudent.id;
                const studentName = typeof firstStudent === 'string' ? firstStudent : firstStudent.name;
                
                try {
                  // Query Firebase to find a test that matches this story
                  // Tests are stored in Firebase with storyId linking to MongoDB story _id
                  const storyId = (currentStory as any)?._id || (currentStory as any)?.id;
                  
                  console.log('🔍 Searching for quiz matching story:', {
                    title: currentStory.title,
                    storyId: storyId
                  });
                  
                  if (!storyId) {
                    console.error('❌ Story has no ID field');
                    Swal.fire({
                      icon: 'error',
                      title: 'Error',
                      text: 'Story ID not found. Cannot search for quiz.',
                      confirmButtonColor: '#3b82f6'
                    });
                    return;
                  }
                  
                  const testsRef = collection(db, 'tests');
                  const testsSnapshot = await getDocs(testsRef);
                  
                  console.log(`📚 Found ${testsSnapshot.size} total tests in Firebase`);
                  
                  let matchingTestId: string | null = null;
                  const allTests: any[] = [];
                  
                  // Search for a test with matching storyId
                  testsSnapshot.forEach((doc) => {
                    const testData = doc.data();
                    const testStoryId = testData.storyId;
                    const testName = testData.testName || 'Untitled';
                    
                    allTests.push({ 
                      id: doc.id, 
                      testName, 
                      storyId: testStoryId 
                    });
                    
                    // Check if test's storyId matches current story's ID
                    if (testStoryId && testStoryId === storyId) {
                      matchingTestId = doc.id;
                      console.log('✅ Found matching test:', { 
                        testId: doc.id, 
                        testName, 
                        storyId: testStoryId,
                        matchedWith: storyId
                      });
                    }
                  });
                  
                  // Log all available tests for debugging
                  if (!matchingTestId) {
                    console.log('❌ No matching test found.');
                    console.log('Looking for test with storyId:', storyId);
                    console.log('Available tests:', allTests);
                  }
                  
                  if (!matchingTestId) {
                    // Show error if no quiz is available
                    Swal.fire({
                      icon: 'warning',
                      title: 'No Quiz Available',
                      html: `There is no quiz associated with this story yet.<br><br>
                             <strong>Story:</strong> ${currentStory.title}<br>
                             <strong>Story ID:</strong> <code>${storyId}</code><br><br>
                             Please create a quiz in the Admin Resources page and select this story when creating the quiz.`,
                      confirmButtonText: 'Got it',
                      confirmButtonColor: '#3b82f6'
                    });
                    return;
                  }
                  
                  // Navigate to StudentTestPage with all necessary data
                  navigate(`/student/test/${matchingTestId}`, {
                    state: {
                      studentId,
                      studentName,
                      teacherId: currentUser?.uid,
                      isrResultId, // Pass the ISR result ID so quiz can update it
                      fromReadingSession: true
                    }
                  });
                } catch (error) {
                  console.error('Error finding quiz:', error);
                  Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to check for available quizzes. Please try again.',
                    confirmButtonColor: '#3b82f6'
                  });
                }
              }}
              disabled={hasCompletedQuiz}
              className={`w-full py-4 rounded-2xl text-white font-bold text-lg transition-all duration-200 ${
                hasCompletedQuiz
                  ? 'bg-gray-400 cursor-not-allowed opacity-75'
                  : 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 hover:scale-[1.01]'
              }`}
            >
              {hasCompletedQuiz ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Already Taken Quiz
                </span>
              ) : (
                'Start Comprehension Quiz'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Correction Options Panel */}
      {showCorrectionOptions && selectedWordIndex !== null && (
        <div className="fixed bottom-6 right-6 z-40 bg-white rounded-lg shadow-lg p-4 border border-gray-200">
          <div className="mb-3">
            <p className="text-sm font-semibold text-gray-700">
              Word: <span className="text-blue-600">{words[selectedWordIndex]}</span>
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowCorrectionOptions(false);
                setSelectedWordIndex(null);
              }}
              className="w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded transition-colors"
            >
              Mark as Correct
            </button>
            <button
              onClick={() => {
                setShowCorrectionOptions(false);
                setSelectedWordIndex(null);
              }}
              className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors"
            >
              Mark as Miscue
            </button>
            <button
              onClick={() => {
                setShowCorrectionOptions(false);
                setSelectedWordIndex(null);
              }}
              className="w-full px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white text-sm font-medium rounded transition-colors"
            >
              Clear Marking
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default ReadingSessionPage;