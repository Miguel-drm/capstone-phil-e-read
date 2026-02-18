import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  readingSessionService,
  type ReadingSession,
} from "@/services/readingSessionService";
import { UnifiedStoryService } from "@/services/UnifiedStoryService";
import type { Story } from "@/types/Story";
import { useWordStateManager, type WordState } from "@/hooks/useWordStateManager";
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
// import { doubleMetaphone } from "double-metaphone"; // Disabled - server handles pronunciation matching
import { isrResultService } from "@/services/ISRresultService";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile } from "@/services/authService";
import gsap from "gsap";
import { buildReversedStoryCache } from "@detection/reversal";
import { validateWithDetectionOrder } from "@detection/adjacentwordtransposition";
import { ColorLegend } from "@/components/reading/ColorLegend";
import { WordDisplay } from "@/components/reading/WordDisplay";
import { HeardMicDisplay } from "@/components/reading/HeardMicDisplay";
import { useAdvancedWordMatching } from "@/hooks/useAdvancedWordMatching";
import { MiscueTogglePanel } from "@/components/reading/MiscueTogglePanel";
import { useMiscueToggle } from "@/hooks/useMiscueToggle";
import { shouldRecordMiscue } from "@/utils/miscueFilter";
import { useAdvancedSubstitutionDetection } from "@/hooks/useAdvancedSubstitutionDetection";
import { useAdvancedMispronunciationDetection } from "@/hooks/useAdvancedMispronunciationDetection";
import { useAdvancedSelfCorrectionDetection } from "@/hooks/useAdvancedSelfCorrectionDetection";
import { useReadingMiscueOrchestrator } from "@/hooks/useReadingMiscueOrchestrator";
import { convertOrchestratorToLegacy, type LegacyMiscueType } from "@/utils/orchestratorIntegrationAdapter";
import type { SpokenWordWithMetadata } from "@detection/readingMiscueOrchestrator";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

  // Initialize WordStateManager for word-by-word tracking
  // Requirements: 1.2, 3.1
  const wordStateManager = useWordStateManager();

  // Initialize advanced word matching with performance optimization
  const advancedMatcher = useAdvancedWordMatching({
    minConfidence: 70,
    language: 'english', // Will be updated based on story language
    enableMetrics: false, // Set to true for debugging
    enableCaching: true
  });

  // Initialize miscue toggle hook for filtering miscue types
  const { toggleState, toggleMiscue } = useMiscueToggle();

  // Initialize advanced substitution detection
  const substitutionDetector = useAdvancedSubstitutionDetection({
    minConfidence: 60,
    language: 'english',
    strictMode: false,
    enableLogging: false
  });

  // Initialize advanced mispronunciation detection
  const mispronunciationDetector = useAdvancedMispronunciationDetection({
    minConfidence: 60,
    language: 'english',
    strictMode: false,
    enableLogging: false
  });

  // Initialize advanced self-correction detection
  const selfCorrectionDetector = useAdvancedSelfCorrectionDetection({
    minConfidence: 60,
    language: 'english',
    strictMode: false,
    enableLogging: false
  });

  // Initialize reading miscue orchestrator for single-pass miscue detection
  const orchestrator = useReadingMiscueOrchestrator({
    language: 'english',
    minConfidence: 0.5,
    omissionTimeWindowMs: 2000,
    enableLogging: false,
    enableSelfCorrection: true
  });

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [words, setWords] = useState<string[]>([]);
  const [spokenWords, setSpokenWords] = useState<string[]>([]); // Track spoken words for transposition detection
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
  
  // Countdown modal state
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
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
        console.error('Failed to enumerate audio devices:', error);
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
  
  // Countdown effect - preload Vosk connection during countdown
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (showCountdown && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (showCountdown && countdown === 0) {
      // Countdown finished, start recording
      setShowCountdown(false);
      startRecordingAfterCountdown();
      setCountdown(5); // Reset for next time
    }
    
    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showCountdown, countdown]);
  
  // Check Vosk connection status during countdown
  useEffect(() => {
    if (showCountdown && countdown === 5 && words.length > 0) {
      // Check if Vosk is already connected from preload
      const isConnected = voskSocketRef.current && voskSocketRef.current.readyState === WebSocket.OPEN;
      if (isConnected) {
        console.log('✅ [Teacher] Vosk already connected - ready to start!');
      } else {
        console.log('⏳ [Teacher] Vosk still connecting...');
        // Try to connect if not already connected
        preloadVoskConnection();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountdown, countdown]);

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
  const lastPositionRef = useRef<number>(0); // Track last position for phrase matching
  const bufferedWordsRef = useRef<Array<{ word: string; position: number }>>([]); // Track buffered words for transposition detection
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

  // Heard Mic Display state
  const [partialText, setPartialText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [frequencyData, setFrequencyData] = useState<Uint8Array | undefined>();
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
    // Clear all timeouts and intervals
    if (voskReconnectTimeoutRef.current) {
      clearTimeout(voskReconnectTimeoutRef.current);
      voskReconnectTimeoutRef.current = null;
    }
    if (voskConnectionTimeoutRef.current) {
      clearTimeout(voskConnectionTimeoutRef.current);
      voskConnectionTimeoutRef.current = null;
    }
    if (voskHeartbeatIntervalRef.current) {
      clearInterval(voskHeartbeatIntervalRef.current);
      voskHeartbeatIntervalRef.current = null;
    }

    // Disconnect audio nodes
    try {
      scriptNodeRef.current?.disconnect();
    } catch { }
    try {
      sourceNodeRef.current?.disconnect();
    } catch { }

    // Stop all audio tracks
    try {
      const stream = sourceNodeRef.current?.mediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    } catch { }

    // Close audio context
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    } catch { }

    // Close WebSocket
    try {
      if (voskSocketRef.current) {
        voskSocketRef.current.close(1000, "Cleanup");
      }
    } catch { }

    // Clear refs
    scriptNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current = null;
    voskSocketRef.current = null;
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
        `1. Is the Vosk server running? (Local: ws://localhost:2700 or Railway)\n` +
        `2. Is your internet connection working?\n` +
        `3. Try refreshing the page and starting again.`
      );
      return;
    }

    if (voskReconnectTimeoutRef.current) {
      clearTimeout(voskReconnectTimeoutRef.current);
    }

    voskReconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, voskReconnectAttemptsRef.current - 1), 10000);

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
   */
  const initializeMicrophone = async (): Promise<MediaStream> => {
    const audioConstraints: MediaTrackConstraints = {
      channelCount: 1,
      sampleRate: 48000,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      ...(selectedMicId && { deviceId: { exact: selectedMicId } })
    };
    
    try {
      // Vosk works best with minimal audio processing
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
    } catch (error) {
      console.warn('Failed with selected device, trying default:', error);
      // Fallback to default settings if constraints are not supported
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          ...(selectedMicId && { deviceId: selectedMicId })
        },
      });
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
    // Smaller buffer (2048) = faster processing, lower latency for real-time recognition
    const script = ctx.createScriptProcessor(2048, 1, 1);

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
   * Process orchestrator results and apply to component state
   * 
   * Converts orchestrator results to legacy format and updates all relevant state variables
   * for backward compatibility with existing UI components.
   */
  const applyOrchestratorResults = (orchestratorResult: any) => {
    if (!orchestratorResult || !orchestratorResult.sessionResult) {
      console.warn('⚠️ Invalid orchestrator result');
      return;
    }

    try {
      const legacyResult = convertOrchestratorToLegacy(orchestratorResult.sessionResult);

      // Update miscue counts
      setMiscues(legacyResult.totalMiscues);
      setMiscueTypes(legacyResult.miscueTypes);

      // Update word-level miscue tracking
      setWordMiscues(legacyResult.wordMiscues);

      // Update inserted words tracking
      setInsertedWords(legacyResult.insertedWords);

      // Update recognized words (correct words)
      const correctPositions = new Set<number>();
      for (const miscue of orchestratorResult.sessionResult.miscues) {
        if (miscue.miscueType === 'correct') {
          correctPositions.add(miscue.referencePosition);
        }
      }
      setRecognizedWords(correctPositions);

      // Log orchestrator results for debugging
      console.log('✅ Orchestrator results applied:', {
        totalMiscues: legacyResult.totalMiscues,
        accuracy: legacyResult.accuracy,
        breakdown: legacyResult.miscueTypes,
        processingTime: orchestratorResult.metrics?.processingTimeMs
      });
    } catch (error) {
      console.error('❌ Error applying orchestrator results:', error);
    }
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
          console.log('📨 Vosk message:', {
            text: msg.text || '(none)',
            partial: msg.partial || '(none)',
            result: msg.result || '(none)'
          });
        }

        // Update heard mic display with partial text
        if (msg.partial && msg.partial.trim()) {
          setPartialText(msg.partial.trim());
        }

        // Update heard mic display with final text
        if (msg.text && msg.text.trim()) {
          setFinalText(msg.text.trim());
          setPartialText(""); // Clear partial when final is received
        }

        // NEW: Handle backend word matching results
        if (msg.match_result) {
          const { match_type, new_position, details, session_state } = msg.match_result;
          const metrics = msg.metrics;
          const word = msg.text;
          
          console.log(`🎯 Backend match: ${match_type} - ${details}`);
          
          // Get old position from ref (tracks last known position accurately)
          const oldPosition = lastPositionRef.current;
          
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
              // This could be an insertion
              console.log(`⏸️ Word pending: "${word}" - waiting for next word`);
              return;  // Don't mark anything yet
              
            case 'buffering':
              // Buffering words - check if it actually matches the expected word
              // If it does, mark it as correct immediately instead of waiting
              const expectedWord = words[oldPosition] || '';
              const normalizedSpoken = word.toLowerCase().trim();
              const normalizedExpected = expectedWord.toLowerCase().trim();
              
              // Check if the buffered word matches the expected word
              if (normalizedSpoken === normalizedExpected) {
                console.log(`✅ Buffered word matches expected: "${word}" === "${expectedWord}"`);
                // Mark as correct immediately
                setCurrentWordIndex(oldPosition + 1);
                lastPositionRef.current = oldPosition + 1;
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
                wordStateManager.updateWordStatus(oldPosition, 'correct');
                wordStateManager.advanceToWord(oldPosition + 1);
                bufferedWordsRef.current = []; // Clear buffer
              } else {
                // Word doesn't match - store for transposition detection
                bufferedWordsRef.current.push({ word, position: oldPosition });
                console.log(`📦 Buffering: "${word}" at position ${oldPosition} (doesn't match "${expectedWord}")`);
                // Update position to show progress
                if (session_state) {
                  setCurrentWordIndex(session_state.current_position);
                  lastPositionRef.current = session_state.current_position;
                }
              }
              break;
              
            case 'correct':
              // Check if this is a transposition (buffered word + current word are swapped)
              if (bufferedWordsRef.current.length > 0) {
                const bufferedWord = bufferedWordsRef.current[0];
                const expectedCurrent = words[oldPosition] || '';
                const expectedNext = words[oldPosition + 1] || '';
                
                // Check if: buffered word matches next expected word AND current word matches current expected word
                // This means they were spoken in reverse order (transposition)
                const isTransposition = 
                  bufferedWord.word.toLowerCase() === expectedNext.toLowerCase() &&
                  word.toLowerCase() === expectedCurrent.toLowerCase();
                
                if (isTransposition && bufferedWord.position === oldPosition) {
                  console.log(`↔️ TRANSPOSITION DETECTED: "${bufferedWord.word}" and "${word}" are swapped!`);
                  // Check if transposition is enabled before recording
                  if (shouldRecordMiscue('transposition', toggleState)) {
                    // Mark BOTH words as transposition
                    setMiscues(prev => prev + 1);
                    setMiscueTypes(prev => ({
                      ...prev,
                      transposition: prev.transposition + 1
                    }));
                    // Mark the first word (buffered) as transposition
                    setWordMiscues(prev => new Map(prev).set(oldPosition, 'transposition'));
                    setRecognizedWords(prev => new Set(prev).add(oldPosition));
                    // Mark the second word as transposition too
                    setWordMiscues(prev => new Map(prev).set(oldPosition + 1, 'transposition'));
                    setRecognizedWords(prev => new Set(prev).add(oldPosition + 1));
                    // Update WordStateManager
                    wordStateManager.updateWordStatus(oldPosition, 'miscue', 'transposition', bufferedWord.word);
                    wordStateManager.updateWordStatus(oldPosition + 1, 'miscue', 'transposition', word);
                  }
                  // Advance past both words
                  setCurrentWordIndex(new_position);
                  lastPositionRef.current = new_position;
                  bufferedWordsRef.current = []; // Clear buffer
                  break;
                }
              }
              
              // Not a transposition - normal correct handling
              // Update position and mark word as recognized (correct)
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              
              // Track timestamp for time-based repetition filtering
              lastWordTimestampRef.current = Date.now();
              
              // Mark the word at oldPosition as correctly read
              if (oldPosition >= 0 && oldPosition < words.length) {
                setRecognizedWords(prev => new Set(prev).add(oldPosition));
              }
              // Update WordStateManager: mark current word as correct and advance
              // Requirements: 1.2, 1.3, 2.1
              wordStateManager.updateWordStatus(oldPosition, 'correct');
              wordStateManager.advanceToWord(new_position);
              console.log(`🟡 Position updated from ${oldPosition} to ${new_position}`);
              bufferedWordsRef.current = []; // Clear buffer
              break;
              
            // Track miscue types for visual display
            case 'omission':
              bufferedWordsRef.current = []; // Clear buffer
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              // Check if omission is enabled before recording
              if (shouldRecordMiscue('omission', toggleState)) {
                // Mark omitted words between old and new position
                for (let i = oldPosition; i < new_position; i++) {
                  if (!countedMiscuePositionsRef.current.has(i)) {
                    countedMiscuePositionsRef.current.add(i);
                    setWordMiscues(prev => new Map(prev).set(i, 'omission'));
                    setMiscues(prev => prev + 1);
                    setMiscueTypes(prev => ({ ...prev, omission: prev.omission + 1 }));
                    // Update WordStateManager: mark omitted word
                    // Requirements: 1.2, 1.3, 2.2, 2.4
                    wordStateManager.updateWordStatus(i, 'miscue', 'omission', '');
                  }
                }
              }
              wordStateManager.advanceToWord(new_position);
              console.log(`⭕ Omission detected at position ${oldPosition}`);
              break;
              
            case 'mispronunciation':
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              // Check if mispronunciation is enabled before recording
              if (shouldRecordMiscue('mispronunciation', toggleState)) {
                if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                  countedMiscuePositionsRef.current.add(oldPosition);
                  
                  // Use advanced mispronunciation detection for confidence scoring
                  const expectedWord = words[oldPosition] || '';
                  const mispronunciationAnalysis = mispronunciationDetector.detectWord(word, expectedWord);
                  
                  // Only record if confidence is above threshold
                  if (mispronunciationAnalysis.confidence >= 60) {
                    setWordMiscues(prev => new Map(prev).set(oldPosition, 'mispronunciation'));
                    setRecognizedWords(prev => new Set(prev).add(oldPosition));
                    setMiscues(prev => prev + 1);
                    setMiscueTypes(prev => ({ ...prev, mispronunciation: prev.mispronunciation + 1 }));
                    
                    // Update WordStateManager
                    wordStateManager.updateWordStatus(oldPosition, 'miscue', 'mispronunciation', word);
                    
                    // Log detailed analysis for debugging
                    console.log(`🔊 Mispronunciation: "${word}" → "${expectedWord}" (confidence: ${mispronunciationAnalysis.confidence}%, severity: ${mispronunciationAnalysis.severity}, reason: ${mispronunciationAnalysis.reason})`);
                  } else {
                    // Low confidence - might not be a mispronunciation
                    console.log(`⚠️ Low confidence mispronunciation: "${word}" → "${expectedWord}" (${mispronunciationAnalysis.confidence}%)`);
                  }
                }
              }
              wordStateManager.advanceToWord(new_position);
              console.log(`🔴 Mispronunciation detected at position ${oldPosition}`);
              break;
              
            case 'reversal':
              bufferedWordsRef.current = []; // Clear buffer
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              // Check if reversal is enabled before recording
              if (shouldRecordMiscue('reversal', toggleState)) {
                if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                  countedMiscuePositionsRef.current.add(oldPosition);
                  setWordMiscues(prev => new Map(prev).set(oldPosition, 'reversal'));
                  setRecognizedWords(prev => new Set(prev).add(oldPosition));
                  setMiscues(prev => prev + 1);
                  setMiscueTypes(prev => ({ ...prev, reversal: prev.reversal + 1 }));
                  // Update WordStateManager
                  // Requirements: 1.2, 1.3, 2.2, 2.4
                  wordStateManager.updateWordStatus(oldPosition, 'miscue', 'reversal', word);
                }
              }
              wordStateManager.advanceToWord(new_position);
              console.log(`🔄 Reversal detected at position ${oldPosition}`);
              break;
              
            case 'substitution':
              bufferedWordsRef.current = []; // Clear buffer
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              // Check if substitution is enabled before recording
              if (shouldRecordMiscue('substitution', toggleState)) {
                if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                  countedMiscuePositionsRef.current.add(oldPosition);
                  
                  // Use advanced substitution detection for confidence scoring
                  const expectedWord = words[oldPosition] || '';
                  const substitutionAnalysis = substitutionDetector.detectWord(word, expectedWord);
                  
                  // Only record if confidence is above threshold
                  if (substitutionAnalysis.confidence >= 60) {
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
                    
                    // Update WordStateManager
                    wordStateManager.updateWordStatus(oldPosition, 'miscue', 'substitution', word);
                    
                    // Log detailed analysis for debugging
                    console.log(`🔄 Substitution: "${word}" → "${expectedWord}" (confidence: ${substitutionAnalysis.confidence}%, reason: ${substitutionAnalysis.reason})`);
                  } else {
                    // Low confidence - might be a different miscue type
                    console.log(`⚠️ Low confidence substitution: "${word}" → "${expectedWord}" (${substitutionAnalysis.confidence}%)`);
                  }
                }
              }
              wordStateManager.advanceToWord(new_position);
              console.log(`🟡 Substitution detected at position ${oldPosition}: "${word}"`);
              break;
              
            case 'insertion':
              bufferedWordsRef.current = []; // Clear buffer
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              // Check if insertion is enabled before recording
              if (shouldRecordMiscue('insertion', toggleState)) {
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
                  // Update WordStateManager
                  // Requirements: 1.2, 1.3, 2.2, 2.4
                  wordStateManager.updateWordStatus(oldPosition, 'miscue', 'insertion', word);
                }
              }
              wordStateManager.advanceToWord(new_position);
              console.log(`➕ Insertion detected at position ${oldPosition}: "${word}"`);
              break;
              
            case 'repetition':
              bufferedWordsRef.current = []; // Clear buffer
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              
              // Track timestamp for time-based repetition filtering
              const currentTime = Date.now();
              const timeGapMs = currentTime - lastWordTimestampRef.current;
              lastWordTimestampRef.current = currentTime;
              
              // Check if repetition is enabled before recording
              if (shouldRecordMiscue('repetition', toggleState)) {
                if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                  countedMiscuePositionsRef.current.add(oldPosition);
                  setWordMiscues(prev => new Map(prev).set(oldPosition, 'repetition'));
                  setRecognizedWords(prev => new Set(prev).add(oldPosition));
                  setMiscues(prev => prev + 1);
                  setMiscueTypes(prev => ({ ...prev, repetition: prev.repetition + 1 }));
                  // Update WordStateManager
                  // Requirements: 1.2, 1.3, 2.2, 2.4
                  wordStateManager.updateWordStatus(oldPosition, 'miscue', 'repetition', word);
                }
              }
              wordStateManager.advanceToWord(new_position);
              console.log(`🔁 Repetition detected at position ${oldPosition} (time gap: ${timeGapMs}ms)`);
              break;
              
            case 'selfCorrection':
              bufferedWordsRef.current = []; // Clear buffer
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              // Check if selfCorrection is enabled before recording
              if (shouldRecordMiscue('selfCorrection', toggleState)) {
                // Self-corrections are NOT counted as miscues per DepEd standards
                // But we track them for comprehension assessment
                
                // Use advanced self-correction detection for analysis
                const expectedWord = words[oldPosition] || '';
                const selfCorrectionAnalysis = selfCorrectionDetector.detectCorrection(
                  word,
                  expectedWord,
                  Date.now() - lastWordTimestampRef.current // Time between error and correction
                );
                
                if (selfCorrectionAnalysis.matchType === 'self_correction') {
                  setWordMiscues(prev => new Map(prev).set(oldPosition, 'selfCorrection'));
                  setRecognizedWords(prev => new Set(prev).add(oldPosition));
                  
                  // Log detailed analysis for debugging
                  console.log(`✅ Self-correction: "${word}" → "${expectedWord}" (confidence: ${selfCorrectionAnalysis.confidence || 0}%, pattern: ${selfCorrectionAnalysis.patternType || 'unknown'})`);
                  console.log(`   Details: ${selfCorrectionAnalysis.details}`);
                } else {
                  // Not a self-correction, treat as regular word
                  console.log(`⚠️ Not a self-correction: "${word}" → "${expectedWord}" (${selfCorrectionAnalysis.confidence || 0}%)`);
                }
              }
              // Update WordStateManager: mark as self-correction (not counted as miscue)
              // Requirements: 1.2, 1.3, 2.2, 2.4
              wordStateManager.updateWordStatus(oldPosition, 'miscue', 'self_correction', word);
              wordStateManager.advanceToWord(new_position);
              console.log(`✅ Self-correction detected at position ${oldPosition}`);
              break;
              
            case 'transposition':
              bufferedWordsRef.current = []; // Clear buffer
              setCurrentWordIndex(new_position);
              lastPositionRef.current = new_position;
              // Check if transposition is enabled before recording
              if (shouldRecordMiscue('transposition', toggleState)) {
                if (!countedMiscuePositionsRef.current.has(oldPosition)) {
                  countedMiscuePositionsRef.current.add(oldPosition);
                  setWordMiscues(prev => new Map(prev).set(oldPosition, 'transposition'));
                  setRecognizedWords(prev => new Set(prev).add(oldPosition));
                  setMiscues(prev => prev + 1);
                  setMiscueTypes(prev => ({ ...prev, transposition: prev.transposition + 1 }));
                  // Update WordStateManager
                  // Requirements: 1.2, 1.3, 2.2, 2.4
                  wordStateManager.updateWordStatus(oldPosition, 'miscue', 'transposition', word);
                }
              }
              wordStateManager.advanceToWord(new_position);
              console.log(`↔️ Transposition detected at position ${oldPosition}`);
              break;
          }
          
          // 🎼 ORCHESTRATOR VALIDATION (Parallel Processing - Phase 1)
          // Add orchestrator validation asynchronously (non-blocking)
          // This allows us to compare orchestrator results with existing logic
          if (words.length > 0 && spokenWords.length > 0) {
            // Collect the current spoken word
            const newSpokenWords = [...spokenWords, word];
            
            // Call orchestrator asynchronously
            orchestrator.processSession(newSpokenWords, words, {
              language: storyLanguage,
              minConfidence: 0.5,
              enableLogging: false
            }).then(result => {
              if (result.success && result.sessionResult) {
                // Log orchestrator results for comparison
                console.log('🎼 Orchestrator validation:', {
                  totalMiscues: result.sessionResult.totalMiscues,
                  accuracy: result.sessionResult.accuracy,
                  breakdown: result.sessionResult.miscueBreakdown,
                  processingTime: result.metrics?.processingTimeMs
                });
                
                // Compare with existing logic
                const legacyResult = convertOrchestratorToLegacy(result.sessionResult);
                if (legacyResult.totalMiscues !== miscues) {
                  console.warn('⚠️ Orchestrator miscue count differs:', {
                    existing: miscues,
                    orchestrator: legacyResult.totalMiscues,
                    difference: legacyResult.totalMiscues - miscues
                  });
                }
                
                // Log accuracy comparison
                if (Math.abs(legacyResult.accuracy - (wordsRead / words.length * 100)) > 5) {
                  console.warn('⚠️ Orchestrator accuracy differs:', {
                    existing: (wordsRead / words.length * 100).toFixed(1),
                    orchestrator: legacyResult.accuracy.toFixed(1)
                  });
                }
              } else {
                console.warn('⚠️ Orchestrator validation failed:', result.error);
              }
            }).catch(error => {
              console.error('❌ Orchestrator error:', error);
            });
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
        
        // FALLBACK: Old format (for backward compatibility) - use client-side detection
        if (msg.text && msg.text.trim()) {
          const originalText = msg.text.trim();
          console.log(`🎯 Vosk recognized (final - old format): "${originalText}"`);
          
          const filteredText = filterThroughVocabulary(originalText, storyVocabulary);

          if (filteredText) {
            console.log(`✅ Vocabulary filter: Accepted "${filteredText}"`);
            voskFinalTranscriptRef.current += (voskFinalTranscriptRef.current ? " " : "") + filteredText;
            setTranscript(voskFinalTranscriptRef.current);
            
            // Collect spoken word for transposition detection
            const newSpokenWords = [...spokenWords, filteredText];
            setSpokenWords(newSpokenWords);
            
            // Use detection order: CORRECT → REVERSAL → TRANSPOSITION → INCORRECT
            const detectionOrderResult = validateWithDetectionOrder(
              newSpokenWords,
              words,
              currentWordIndex,
              { language: storyLanguage }
            );
            
            switch (detectionOrderResult.type) {
              case 'correct':
                console.log(`✅ Detection order: ${detectionOrderResult.details}`);
                setCurrentWordIndex(currentWordIndex + 1);
                lastPositionRef.current = currentWordIndex + 1;
                setWordsRead(prev => prev + 1);
                setRecognizedWords(prev => new Set(prev).add(currentWordIndex));
                setSpokenWords([]); // Reset for next word
                break;
                
              case 'reversal':
                console.log(`🔄 Detection order: ${detectionOrderResult.details}`);
                // Mark as reversal miscue - position does NOT advance
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({
                  ...prev,
                  reversal: prev.reversal + 1
                }));
                setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'reversal'));
                setRecognizedWords(prev => new Set(prev).add(currentWordIndex));
                setSpokenWords([]); // Reset for next word
                break;
                
              case 'transposition':
                console.log(`↔️ Detection order: ${detectionOrderResult.details}`);
                // Mark as transposition miscue - position does NOT advance
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({
                  ...prev,
                  transposition: prev.transposition + 1
                }));
                setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'transposition'));
                setRecognizedWords(prev => new Set(prev).add(currentWordIndex));
                setSpokenWords([]); // Reset for next word
                break;
                
              case 'incorrect':
                console.log(`❌ Detection order: ${detectionOrderResult.details}`);
                // Don't advance position, keep collecting words for potential transposition
                // Only reset if we have enough words to know it's not a transposition
                if (newSpokenWords.length >= 2) {
                  setSpokenWords([]); // Reset after checking both words
                }
                break;
            }
          }
        } else if (msg.partial && msg.partial.trim()) {
          const originalPartial = msg.partial.trim();
          console.log(`🎯 Vosk recognized (partial): "${originalPartial}"`);
          // Partial results are no longer displayed in UI
        }
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
        console.error(`   1. Railway service is not running or crashed`);
        console.error(`   2. Service is sleeping (free tier) - wait 30-60 seconds`);
        console.error(`   3. Wrong URL or service name`);
        console.error(`   4. Network/firewall blocking WebSocket connections`);
        console.error(`   5. Railway proxy not configured for WebSocket`);
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
          console.error(`   Check Railway logs for specific error message`);
        }
      } else if (event.code === 1011) {
        console.error(`❌ Internal server error (1011) - Service crashed`);
        console.error(`   Check Railway logs for crash details`);
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



  // Speech recognition provider toggle (Vosk vs Web Speech API)
  const [useWebSpeech, setUseWebSpeech] = useState(false);
  const recognitionRef = useRef<any>(null); // Web Speech API recognition instance
  const [webSpeechStatus, setWebSpeechStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const shouldRestartWebSpeechRef = useRef<boolean>(false); // Track if we should auto-restart
  
  // ⚡ OPTIMISTIC UI: Track expected position after optimistic moves
  const optimisticWordIndexRef = useRef<number>(0); // Where we expect to be after optimistic moves
  
  // 👷 MULTI-WORKER: WebSocket connection to multi-worker backend
  const multiWorkerWsRef = useRef<WebSocket | null>(null);
  const [multiWorkerStatus, setMultiWorkerStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  // @ts-expect-error - Unused variable kept for future feature
  const [useMultiWorker, setUseMultiWorker] = useState(true); // Enable by default

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

    // Common English-only patterns
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

    // Common English function words
    // NOTE: Removed "may" because it's also a common Tagalog word (meaning "there is/has")
    const englishFunctionWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'might',
      'can', 'must', 'shall', 'this', 'that', 'these', 'those'
    ];

    return hasEnglishPattern || englishFunctionWords.includes(normalized);
  }

  // Helper: Detect if a word is likely Tagalog (for language validation)
  function isLikelyTagalogWord(word: string): boolean {
    const normalized = normalize(word);

    // Common Tagalog patterns
    const tagalogPatterns = [
      /^(ng|mga|ka|pa|na|ba|po)/i,  // Tagalog particles/prefixes
      /ng$/i,                         // -ng ending (very common in Tagalog)
      /an$/i,                         // -an ending (common in Tagalog)
      /in$/i,                         // -in ending (Tagalog verb form)
      /ay$/i,                         // -ay ending (Tagalog)
    ];

    // Check if word matches Tagalog patterns
    const hasTagalogPattern = tagalogPatterns.some(pattern => pattern.test(normalized));

    // Common Tagalog function words
    const tagalogFunctionWords = [
      'ang', 'ng', 'sa', 'mga', 'ay', 'na', 'pa', 'ba', 'po', 'opo',
      'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila',
      'ko', 'mo', 'niya', 'namin', 'natin', 'ninyo', 'nila',
      'ito', 'iyan', 'iyon', 'dito', 'diyan', 'doon',
      'may', 'mayroon', 'meron'  // Added: "may" is Tagalog (there is/has)
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
   * Now uses advanced algorithms: Damerau-Levenshtein, Double Metaphone, Needleman-Wunsch.
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

    // Use advanced word matching with multiple algorithms
    const confidence = advancedMatcher.matchWord(normSpoken, normExpected);
    
    // Log detailed matching info for debugging (optional)
    if (confidence.overallConfidence >= 70 && confidence.overallConfidence < 95) {
      console.log(`🎯 Advanced Match: "${spokenWord}" ≈ "${expectedWord}" (confidence: ${confidence.overallConfidence}%, type: ${confidence.matchType})`);
    }

    return confidence.overallConfidence >= 70;
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

    return vocabulary;
  };

  /**
   * Detect the primary language of the story based on vocabulary analysis.
   * Uses existing isLikelyEnglishWord and isLikelyTagalogWord functions.
   * Returns 'english' or 'tagalog', defaulting to 'english' if inconclusive.
   */
  const detectStoryLanguage = (vocabulary: Set<string>): 'english' | 'tagalog' => {
    let englishCount = 0;
    let tagalogCount = 0;

    // Count words that match English vs Tagalog patterns
    for (const word of vocabulary) {
      if (isLikelyEnglishWord(word)) {
        englishCount++;
      }
      if (isLikelyTagalogWord(word)) {
        tagalogCount++;
      }
    }

    // Return the language with more matches
    // Default to English if counts are equal or both are zero
    if (tagalogCount > englishCount) {
      return 'tagalog';
    }
    return 'english';
  };

  // REMOVED: buildStoryPronunciationMap - Server handles pronunciation matching
  // The server's word recognition enhancer handles all pronunciation variants

  /**
   * Filter recognized text through vocabulary validation.
   * STRICT MODE: Only accepts words from the current story.
   * 
   * Blocks:
   * - Random words not in the story
   * - Background noise and filler words
   * - Off-topic speech
   * - English words (when reading Tagalog story)
   * 
   * Accepts:
   * - Exact matches from story
   * - Pronunciation variants (tau → tao, kumaen → kumain)
   * - Morphological variants (asong → aso, kumain → kain)
   * - Compound word parts (lakad from naglalakad)
   * 
   * Returns filtered text with only valid story words.
   */
  const filterThroughVocabulary = (text: string, vocabulary: Set<string>): string => {
    if (!text || !vocabulary || vocabulary.size === 0) {
      return text;
    }

    // Split text into words
    const words = text.split(/\s+/).filter(Boolean);

    // CHILD-FRIENDLY FILTERING: Accept exact matches + close pronunciation variants
    // Optimized for children who may mispronounce words
    const validWords = words.filter(word => {
      // Reject very short words (likely noise)
      if (word.length < 2) return false;

      // Reject if contains mostly non-letters (noise/gibberish)
      const letterCount = (word.match(/[a-zA-Z]/g) || []).length;
      if (letterCount < word.length * 0.7) return false; // At least 70% letters

      const normalized = normalize(word);

      // Reject <unk> and other Vosk artifacts
      if (normalized === 'unk' || normalized.includes('<') || normalized.includes('>')) {
        return false;
      }

      // Strategy 1: Exact match in vocabulary
      if (vocabulary.has(normalized)) {
        return true;
      }

      // Strategy 2: Check with pronunciation variants using isWordMatch
      // This handles child mispronunciations like "tau" for "tao", "kumaen" for "kumain"
      for (const vocabWord of vocabulary) {
        if (isWordMatch(word, vocabWord, false)) {
          return true;
        }
      }

      // Strategy 3: STRICT fuzzy matching for child pronunciation only
      // Only for words that are VERY similar (80%+) and same length
      // This prevents "gurong" from matching "tulong" or "ano" from matching "ang"
      for (const vocabWord of vocabulary) {
        // Skip if length difference is too large (child won't drop/add 3+ letters)
        if (Math.abs(normalized.length - vocabWord.length) > 2) {
          continue;
        }

        const distance = levenshtein(normalized, vocabWord);
        const maxLength = Math.max(normalized.length, vocabWord.length);
        const similarity = maxLength > 0 ? (1 - (distance / maxLength)) * 100 : 0;

        // STRICT: 80% similarity + must share first letter (prevents "ano" → "ang")
        const sameFirstLetter = normalized[0] === vocabWord[0];

        if (similarity >= 80 && sameFirstLetter) {
          console.log(`🎯 Fuzzy match: "${normalized}" ≈ "${vocabWord}" (${similarity.toFixed(0)}% similar)`);
          return true;
        }
      }

      return false;
    });

    // If no words passed the filter, return empty string
    if (validWords.length === 0) {
      return "";
    }

    return validWords.join(" ");
  };



  // 👷 MULTI-WORKER: Connect to multi-worker backend
  const connectMultiWorker = () => {
    if (!useMultiWorker || !useWebSpeech) return;
    
    console.log('👷 Connecting to multi-worker backend...');
    setMultiWorkerStatus('connecting');
    
    const ws = new WebSocket('ws://localhost:2702');
    
    ws.onopen = () => {
      console.log('✅ Multi-worker backend connected!');
      setMultiWorkerStatus('connected');
      
      // Initialize session with story words
      ws.send(JSON.stringify({
        type: 'init',
        story_words: words,
        language: storyLanguage
      }));
      
      console.log(`👷 Initialized multi-worker session: ${words.length} words, ${storyLanguage}`);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'validation_result') {
          // Worker 1 or 2 responded with validation
          console.log(`👷 Worker validation: Word ${data.index} - ${data.correct ? '✅ Correct' : '❌ ' + data.error_type}`);
          
          // Update UI based on worker result
          if (!data.correct && data.error_type) {
            // Mark error from Worker 2
            setWordMiscues(prev => new Map(prev).set(data.index, data.error_type as any));
            setMiscues(prev => prev + 1);
          }
        }
        
        if (data.type === 'metrics_update') {
          // Worker 3 responded with metrics
          console.log(`👷 Worker metrics: WPM=${data.wpm.toFixed(0)}, Accuracy=${data.accuracy.toFixed(1)}%`);
          
          // Update server metrics
          setServerMetrics({
            wpm: data.wpm,
            accuracy: data.accuracy,
            oralReadingScore: data.accuracy,
            wordsRead: data.words_read,
            totalMiscues: data.total_miscues
          });
        }
        
        if (data.type === 'init_success') {
          console.log(`✅ Multi-worker session initialized: ${data.total_words} words, ${data.workers} workers`);
        }
      } catch (error) {
        console.error('Error processing multi-worker message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ Multi-worker connection error:', error);
      setMultiWorkerStatus('disconnected');
    };
    
    ws.onclose = () => {
      console.log('Multi-worker connection closed');
      setMultiWorkerStatus('disconnected');
    };
    
    multiWorkerWsRef.current = ws;
  };
  
  // 👷 MULTI-WORKER: Disconnect from backend
  const disconnectMultiWorker = () => {
    if (multiWorkerWsRef.current) {
      multiWorkerWsRef.current.close();
      multiWorkerWsRef.current = null;
      setMultiWorkerStatus('disconnected');
      console.log('Multi-worker disconnected');
    }
  };

  // Start recording and speech recognition
  const handleStartRecording = () => {
    if (currentSession?.status === "completed") {
      alert("This session is already completed. Recording is disabled.");
      return;
    }
    // Show countdown modal first
    setShowCountdown(true);
    setCountdown(5);
  };

  // Initialize Web Speech API
  const initializeWebSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Web Speech API is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Get interim results for faster response
    recognition.lang = storyLanguage === 'tagalog' ? 'tl-PH' : 'en-US';
    recognition.maxAlternatives = 1;

    // Track what we've already processed to avoid duplicates
    let processedWordCount = 0;
    let networkErrorCount = 0;
    const MAX_NETWORK_ERRORS = 3;

    recognition.onstart = () => {
      console.log('✅ Web Speech API started successfully');
      setWebSpeechStatus('connected');
      networkErrorCount = 0; // Reset error count on successful start
    };

    recognition.onresult = (event: any) => {
      // Mark as connected when we start receiving results
      setWebSpeechStatus('connected');
      
      // 👷 WORKER 5: Use BOTH interim and final results to catch all words
      let allTranscript = '';
      // @ts-expect-error - Unused variable kept for future feature
      let hasNewFinalWords = false;
      
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          allTranscript += event.results[i][0].transcript + ' ';
          hasNewFinalWords = true;
        } else {
          // Also process interim results for faster detection
          const interimText = event.results[i][0].transcript;
          if (interimText.trim()) {
            console.log(`👂 Worker 5: Interim result: "${interimText}"`);
          }
        }
      }
      
      if (allTranscript.trim()) {
        // Split into words
        const allWords = allTranscript.trim().split(/\s+/).filter(Boolean);
        
        // Only process NEW words (words we haven't seen before)
        const newWords = allWords.slice(processedWordCount);
        
        if (newWords.length > 0) {
          console.log(`🎤 Web Speech: ${newWords.length} new word(s): [${newWords.join(', ')}]`);
          
          // Process each new word
          for (const word of newWords) {
            const filteredWord = filterThroughVocabulary(word, storyVocabulary);
            if (filteredWord) {
              console.log(`✅ Accepted: "${filteredWord}"`);
              
              // ⚡ OPTIMISTIC UI: Move yellow highlight IMMEDIATELY (before validation)
              const currentIndex = optimisticWordIndexRef.current;
              const nextIndex = Math.min(currentIndex + 1, words.length - 1);
              
              setCurrentWordIndex(nextIndex);
              optimisticWordIndexRef.current = nextIndex;
              console.log(`⚡ INSTANT: Yellow moved from ${currentIndex} to ${nextIndex} (optimistic)`);
              
              // ⚡ INSTANT VALIDATION: Mark word as correct immediately
              setRecognizedWords(prev => new Set(prev).add(currentIndex));
              setWordsRead(prev => Math.min(prev + 1, words.length));
              console.log(`✅ INSTANT: Word ${currentIndex} marked correct`);
              
              // 👷 MULTI-WORKER: Send word to backend for parallel processing
              if (multiWorkerWsRef.current && multiWorkerWsRef.current.readyState === WebSocket.OPEN) {
                multiWorkerWsRef.current.send(JSON.stringify({
                  type: 'word_spoken',
                  word: filteredWord,
                  index: currentIndex,
                  timestamp: Date.now(),
                  confidence: 0.95
                }));
                console.log(`👷 Sent to 5 workers: "${filteredWord}" at index ${currentIndex}`);
              }
              
              // Add to transcript for background validation (optional double-check)
              voskFinalTranscriptRef.current += (voskFinalTranscriptRef.current ? " " : "") + filteredWord;
              setTranscript(voskFinalTranscriptRef.current);
            } else {
              console.log(`❌ Rejected: "${word}" (not in vocabulary)`);
              console.log(`👂 Worker 5: Monitoring for missed word...`);
            }
          }
          
          // Update processed count
          processedWordCount = allWords.length;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Web Speech error:', event.error);
      
      if (event.error === 'no-speech') {
        console.log('⚠️ No speech detected, continuing...');
        // Don't show alert - this is normal during pauses
      } else if (event.error === 'network') {
        networkErrorCount++;
        console.error(`❌ Network error #${networkErrorCount} - Web Speech API connection issue`);
        
        // If we've had too many network errors, stop trying and suggest Vosk
        if (networkErrorCount >= MAX_NETWORK_ERRORS) {
          shouldRestartWebSpeechRef.current = false; // Disable auto-restart
          setWebSpeechStatus('disconnected');
          setIsRecording(false);
          alert(
            `Web Speech API is experiencing repeated network errors (${networkErrorCount} failures).\n\n` +
            `This usually means:\n` +
            `1. Web Speech API doesn't support this language well (Tagalog has limited support)\n` +
            `2. Google's speech service is temporarily unavailable\n` +
            `3. Your network connection is unstable\n\n` +
            `Recommendation: Switch to Vosk for better reliability, especially for Tagalog.`
          );
        }
      } else if (event.error === 'aborted') {
        console.log('⚠️ Recognition aborted, will restart...');
      } else if (event.error === 'not-allowed') {
        shouldRestartWebSpeechRef.current = false; // Disable auto-restart
        alert('Microphone access denied. Please allow microphone access and try again.');
        setIsRecording(false);
        setWebSpeechStatus('disconnected');
      } else if (event.error === 'service-not-allowed') {
        shouldRestartWebSpeechRef.current = false; // Disable auto-restart
        alert('Web Speech API is not available. Please check your internet connection or try using Vosk instead.');
        setIsRecording(false);
        setWebSpeechStatus('disconnected');
      } else {
        console.error(`❌ Web Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('🔄 Web Speech API ended, checking if should restart...');
      console.log(`   shouldRestart: ${shouldRestartWebSpeechRef.current}, networkErrors: ${networkErrorCount}/${MAX_NETWORK_ERRORS}`);
      
      // Reset processed count when recognition ends
      processedWordCount = 0;
      setWebSpeechStatus('disconnected');
      
      // Auto-restart if we should be running AND we haven't hit the error limit
      if (shouldRestartWebSpeechRef.current && networkErrorCount < MAX_NETWORK_ERRORS) {
        try {
          // Small delay before restart to avoid rapid restart loops
          setTimeout(() => {
            if (shouldRestartWebSpeechRef.current) {
              setWebSpeechStatus('connecting');
              recognition.start();
              console.log('✅ Web Speech API restarted');
            }
          }, 100);
        } catch (e) {
          console.warn('Recognition restart failed:', e);
          setWebSpeechStatus('disconnected');
        }
      } else if (networkErrorCount >= MAX_NETWORK_ERRORS) {
        console.error('❌ Too many network errors, stopping Web Speech API');
        setWebSpeechStatus('disconnected');
        shouldRestartWebSpeechRef.current = false;
      } else {
        console.log('⏹️ Not restarting - shouldRestart is false');
      }
    };

    return recognition;
  };

  // Preload Vosk connection (called during loading or countdown)
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
      return `ws://localhost:2700/?lang=${normalizedLang}`;
    };
    
    const getRailwayWsUrl = (lang: string) => {
      const env = (import.meta as any)?.env || {};
      const railwayUrl = env.VITE_VOSK_WS_URL || "wss://philiready-websocket-production.up.railway.app";
      const normalizedLang = (lang === "tl" || lang === "tagalog") ? "tagalog" : "english";
      return `${railwayUrl}?lang=${normalizedLang}`;
    };
    
    // Try local server first, then Railway
    const localUrl = getLocalWsUrl(storyLanguage);
    const railwayUrl = getRailwayWsUrl(storyLanguage);
    
    console.log('🔍 [Teacher] Checking local Vosk server:', localUrl);
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
    
    // Try Railway server
    const tryRailwayServer = () => {
      return new Promise<WebSocket>((resolve, reject) => {
        console.log('🌐 [Teacher] Trying Railway Vosk server:', railwayUrl);
        const ws = new WebSocket(railwayUrl);
        ws.binaryType = 'arraybuffer';
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Railway server timeout'));
        }, 5000); // 5 second timeout for Railway
        
        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ [Teacher] Connected to RAILWAY Vosk server');
          resolve(ws);
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Railway server not available'));
        };
      });
    };
    
    try {
      // Try local first
      let ws: WebSocket;
      try {
        ws = await tryLocalServer();
        console.log('🏠 [Teacher] Using LOCAL Vosk server');
      } catch (localError) {
        console.log('⚠️ [Teacher] Local server not available, trying Railway...');
        ws = await tryRailwayServer();
        console.log('☁️ [Teacher] Using RAILWAY Vosk server');
      }
      
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
                // Update WordStateManager
                // Requirements: 1.2, 1.3, 2.1
                wordStateManager.updateWordStatus(correctWordIndex, 'correct');
                wordStateManager.advanceToWord(new_position);
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
                // Update WordStateManager
                // Requirements: 1.2, 1.3, 2.2, 2.4
                wordStateManager.updateWordStatus(insertionWordIndex, 'miscue', 'insertion', insertedWord);
                wordStateManager.advanceToWord(new_position);
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
      console.error('❌ [Teacher] Failed to connect to both local and Railway Vosk servers:', error);
      setVoskStatus('disconnected');
      voskSocketRef.current = null;
    }
  };

  // Actual recording start after countdown
  const startRecordingAfterCountdown = () => {
    setIsRecording(true);
    setIsPaused(false);
    setHasStarted(true); // Mark that session has started
    setTranscript("");
    voskFinalTranscriptRef.current = ""; // Reset Vosk transcript accumulator
    setWordsRead(0);
    // reset derived metrics
    setElapsedTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setCurrentWordIndex(0);
    voskReconnectAttemptsRef.current = 0; // Reset reconnect attempts
    
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
          mediaRecorder.start();
        })
        .catch((error) => {
          // MediaRecorder failed, but don't block speech recognition
          console.warn("MediaRecorder failed (audio recording disabled):", error);
          // Don't set isRecording(false) - allow speech recognition to proceed
        });
    } else {
      console.warn("MediaRecorder not supported in this browser. Speech recognition will still work.");
      // Don't stop recording - speech recognition can still work
    }

    // Choose speech recognition provider based on toggle
    if (useWebSpeech) {
      // Use Web Speech API
      console.log('🎤 Starting Web Speech API for', storyLanguage);
      setWebSpeechStatus('connecting');
      shouldRestartWebSpeechRef.current = true; // Enable auto-restart
      
      // 👷 MULTI-WORKER: Connect to backend
      if (useMultiWorker) {
        connectMultiWorker();
      }
      
      const recognition = initializeWebSpeech();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
          console.log('✅ Web Speech API start requested');
        } catch (error) {
          console.error('Failed to start Web Speech API:', error);
          setWebSpeechStatus('disconnected');
          shouldRestartWebSpeechRef.current = false;
          alert('Failed to start Web Speech API. Please check microphone permissions and try again.');
          setIsRecording(false);
        }
      } else {
        setWebSpeechStatus('disconnected');
        shouldRestartWebSpeechRef.current = false;
        setIsRecording(false);
      }
    } else {
      // Use Vosk for both Tagalog and English stories
      const useVosk = storyLanguage === "tagalog" || storyLanguage === "english";
      if (useVosk) {
        try {
        // WebSocket URL selection with local server fallback
        // Priority: 1. Local server (ws://localhost:2700) 2. Railway (deployed)
        // Can be configured via environment variables:
        // - VITE_VOSK_WS_URL_TAGALOG: Tagalog WebSocket URL
        // - VITE_VOSK_WS_URL_ENGLISH: English WebSocket URL
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
          
          // Get Railway URLs
          // Single Railway deployment handles both languages via ?lang= parameter
          const getRailwayUrl = (language: string) => {
            // Use environment variable if set, otherwise use default Railway URL
            const railwayUrl = env.VITE_VOSK_WS_URL || "wss://philiready-websocket-production.up.railway.app";
            
            // Normalize language parameter
            const normalizedLang = (language === "tl" || language === "tagalog") ? "tagalog" : "english";
            
            return formatWsUrl(railwayUrl, normalizedLang);
          };
          
          // Try local server first (quick test with 2 second timeout)
          const testLocalConnection = (): Promise<boolean> => {
            return new Promise((resolve) => {
              const testUrl = formatWsUrl(localUrl, lang);
              console.log(`🔍 Test connection URL: ${testUrl} (lang=${lang})`);
              const testWs = new WebSocket(testUrl);
              const timeout = setTimeout(() => {
                testWs.close();
                resolve(false);
              }, 2000); // 2 second timeout for local server
              
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
          
          // Test local server first (priority: local > Railway)
          console.log(`🔍 Testing local Vosk server at ${localUrl}...`);
          const isLocalAvailable = await testLocalConnection();
          
          if (isLocalAvailable) {
            const localWsUrl = formatWsUrl(localUrl, lang);
            console.log(`✅ Local Vosk server is running and ready!`);
            console.log(`   Using: ${localWsUrl}`);
            console.log(`   Status: Connected to local server (port ${localPort})`);
            return localWsUrl;
          } else {
            const railwayUrl = getRailwayUrl(lang);
            console.log(`⚠️ Local Vosk server not available at ${localUrl}`);
            console.log(`   Falling back to Railway deployment: ${railwayUrl}`);
            console.log(`   💡 To use local server, start it with: cd VoskServer && python server.py`);
            return railwayUrl;
          }
        };
        
        const startVosk = async (isReconnect: boolean = false) => {
          const wsUrl = await getVoskWsUrl(storyLanguage);
          const isLocal = wsUrl.startsWith('ws://localhost:');

          
          if (isLocal) {
            console.log(`🎯 Using LOCAL Vosk server for ${storyLanguage} recognition`);
          } else {
            console.log(`🌐 Using RAILWAY Vosk server for ${storyLanguage} recognition`);
          }
          
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

            // Connection timeout - shorter for local, longer for Railway (may need time to wake up)
            const connectionTimeout = isLocal ? 5000 : 20000; // 5s for local, 20s for Railway
            const connectionStartTime = Date.now();
            
            if (isLocal) {
              console.log(`🔌 Connecting to LOCAL server: ${wsUrl}`);
              console.log(`   Timeout: ${connectionTimeout}ms (local connection should be fast)`);
            } else {
              console.log(`🔌 Connecting to RAILWAY server: ${wsUrl}`);
              console.log(`   Timeout: ${connectionTimeout}ms (Railway may need time to wake up)`);
            }
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

            // Create WebSocket connection with error handling
            let ws: WebSocket;
            try {
              ws = new WebSocket(wsUrl);
            voskSocketRef.current = ws;
            ws.binaryType = "arraybuffer";
            } catch (error) {
              clearInterval(stateCheckInterval);
              console.error("❌ Failed to create WebSocket:", error);
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
                  console.error(`   1. Railway service is sleeping (free tier) - first connection takes 30-60s`);
                  console.error(`   2. Service is not responding - check Railway dashboard`);
                  console.error(`   3. Network/firewall blocking WebSocket connections`);
                  console.error(`   4. Railway proxy issue - service may need restart`);
                } else if (state === 3) { // CLOSED
                  console.error(`❌ Connection closed before timeout. Possible causes:`);
                  console.error(`   1. Railway service is not running - check Railway dashboard`);
                  console.error(`   2. Service crashed - check Railway logs for errors`);
                  console.error(`   3. Environment variables not set - verify SERVICE_LANGUAGE=${storyLanguage}`);
                  console.error(`   4. Wrong URL - verify service name in Railway`);
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

              // ACCURACY: Send vocabulary and expected words to server for accurate filtering and metrics
              if (storyVocabulary.size > 0) {
                const vocabularyList = Array.from(storyVocabulary);
                
                // ADD REVERSED WORDS: Include reversed versions of story words so Vosk can hear reversals
                // This allows detection of reversal errors like "map" for "pam", "tac" for "cat"
                const reversedWords = new Set<string>();
                for (const word of vocabularyList) {
                  const normalized = word.toLowerCase().trim();
                  // Only reverse words with 2+ characters (avoid single letter reversals)
                  if (normalized.length >= 2) {
                    const reversed = normalized.split('').reverse().join('');
                    reversedWords.add(reversed);
                  }
                }
                
                // Combine original vocabulary with reversed words
                const enhancedVocabulary = [...vocabularyList, ...Array.from(reversedWords)];
                
                // Send original words (with case) for backend matching
                const expectedWordsList = realWords;  // Keep original case for backend

                // Enhanced config with vocabulary and expected words for BACKEND WORD MATCHING
                const config1 = JSON.stringify({
                  config: {
                    words: true,
                    max_alternatives: 0,
                    grammar: enhancedVocabulary,  // Send story vocabulary + reversed words to Vosk
                    vocabulary: enhancedVocabulary,  // For server-side filtering
                    expected_words: expectedWordsList,  // For BACKEND word matching (original case)
                    use_phrase_mode: true  // Enable phrase-level matching (Option 2) for 85-95% accuracy
                  }
                });

                console.log(`🎯 Vosk configured with GRAMMAR CONSTRAINT + REVERSED WORDS + SERVER-SIDE FILTERING`);
                console.log(`📝 Sending ${vocabularyList.length} story words + ${reversedWords.size} reversed words to Vosk`);
                console.log(`📝 Total vocabulary: ${enhancedVocabulary.length} words`);
                console.log(`📝 Sending ${expectedWordsList.length} expected words for accuracy calculation`);
                console.log(`📝 Vocabulary sample (first 20):`, enhancedVocabulary.slice(0, 20).join(', '));

                // Send config
                try {
                  ws.send(config1);
                  console.log('✓ Sent Vosk config with grammar constraint + reversed words + server-side filtering');
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

              // Simplified audio processing - just send raw Float32 audio to server
              // Server handles downsampling, format conversion, and speech detection
              let audioChunkCount = 0;
              script.onaudioprocess = (e: AudioProcessingEvent) => {
                try {
                    audioChunkCount++;
                    
                    if (ws.readyState === WebSocket.OPEN) {
                    const channel = e.inputBuffer.getChannelData(0);
                    
                    // AUDIO AMPLIFICATION: Moderate boost for accuracy (1.5x amplification)
                    // Reduced from 2x to minimize noise and maximize Vosk accuracy
                    const amplifiedChannel = new Float32Array(channel.length);
                    const amplificationFactor = 1.5;
                    
                    for (let i = 0; i < channel.length; i++) {
                      // Amplify but prevent clipping (keep between -1.0 and 1.0)
                      amplifiedChannel[i] = Math.max(-1.0, Math.min(1.0, channel[i] * amplificationFactor));
                    }
                    
                    // Check audio levels every 50 chunks
                    if (audioChunkCount % 50 === 0) {
                      const maxLevel = Math.max(...Array.from(amplifiedChannel).map(Math.abs));
                      const avgLevel = Array.from(amplifiedChannel).reduce((sum, val) => sum + Math.abs(val), 0) / amplifiedChannel.length;
                      console.log(`📊 Audio chunk ${audioChunkCount}: max=${maxLevel.toFixed(4)}, avg=${avgLevel.toFixed(4)}, amplified=2x`);
                      
                      if (maxLevel > 0.001) {
                        console.log(`🎤 Audio amplified for quiet voices`);
                      }
                    }
                    
                    // Send amplified audio - server will handle processing
                    ws.send(amplifiedChannel.buffer);
                    } else if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
                      attemptVoskReconnect(startVosk);
                  }
                } catch (error) {
                  console.warn("Error sending audio:", error);
                }
              };
              // Audio nodes already connected earlier - no need to reconnect here
            };

            setupVoskMessageHandlers(ws);
            setupVoskConnectionHandlers(ws, isReconnect, startVosk);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Failed to initialize speech recognition:", errorMessage, error);
            cleanupVosk();
            setVoskStatus("disconnected");

            if (!isReconnect) {
              // Provide specific error messages based on error type
              if (errorMessage.includes("Permission denied") || errorMessage.includes("NotAllowedError")) {
                alert("Microphone access denied. Please allow microphone access in your browser settings and try again.");
              } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("DevicesNotFoundError")) {
                alert("No microphone found. Please connect a microphone and try again.");
              } else {
                alert("Failed to start speech recognition. Please check your microphone and try again.");
              }
              setIsRecording(false);
            }
          }
        };


        // Start Vosk
        startVosk().catch((error) => {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Failed to start speech recognition service:", errorMessage, error);
          alert("Unable to start speech recognition. Please check your internet connection and microphone, then try again.");
          setIsRecording(false);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to initialize speech recognition:", errorMessage, error);
        alert("Unable to initialize speech recognition. Please refresh the page and try again.");
        setIsRecording(false);
      }
    }
  }
};



  // Handle Vosk language switching - reconnect with new language if needed
  useEffect(() => {
    // If Vosk is connected and language changes, reconnect with new language
    if (voskSocketRef.current && voskSocketRef.current.readyState === WebSocket.OPEN && isRecording && !isPaused) {
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
            
            const getRailwayUrl = (language: string) => {
              if (language === "tagalog" || language === "tl") {
                const tagalogUrl = env.VITE_VOSK_WS_URL_TAGALOG;
                if (tagalogUrl) {
                  return formatWsUrl(tagalogUrl, "tagalog");
                }
                return formatWsUrl("wss://vigilant-celebration.up.railway.app", "tagalog");
              } else if (language === "english" || language === "en") {
                const englishUrl = env.VITE_VOSK_WS_URL_ENGLISH;
                if (englishUrl) {
                  return formatWsUrl(englishUrl, "english");
                }
                return formatWsUrl("wss://philiready-websocket-english.up.railway.app", "english");
              }
              const tagalogUrl = env.VITE_VOSK_WS_URL_TAGALOG;
              if (tagalogUrl) {
                return formatWsUrl(tagalogUrl, "tagalog");
              }
              return formatWsUrl("wss://vigilant-celebration.up.railway.app", "tagalog");
            };
            
            const testLocalConnection = (): Promise<boolean> => {
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
            
            // Test local server first (priority: local > Railway)
            console.log(`🔍 Testing local Vosk server at ${localUrl}...`);
            const isLocalAvailable = await testLocalConnection();
            
            if (isLocalAvailable) {
              const localWsUrl = formatWsUrl(localUrl, lang);
              console.log(`✅ Local Vosk server is running and ready!`);
              console.log(`   Using: ${localWsUrl}`);
              console.log(`   Status: Connected to local server (port ${localPort})`);
              return localWsUrl;
            } else {
              const railwayUrl = getRailwayUrl(lang);
              console.log(`⚠️ Local Vosk server not available at ${localUrl}`);
              console.log(`   Falling back to Railway deployment: ${railwayUrl}`);
              console.log(`   💡 To use local server, start it with: cd VoskServer && python server.py`);
              return railwayUrl;
            }
          };
          
          const wsUrl = await getVoskWsUrl(storyLanguage);
          const isLocal = wsUrl.startsWith('ws://localhost:');
          
          if (isLocal) {
            console.log(`🎯 Reconnecting to LOCAL Vosk server for ${storyLanguage} recognition`);
          } else {
            console.log(`🌐 Reconnecting to RAILWAY Vosk server for ${storyLanguage} recognition`);
          }

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
              // Smaller buffer (2048) = faster processing, lower latency for real-time recognition
              const script = ctx.createScriptProcessor(2048, 1, 1);
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

                // Send vocabulary constraint to Vosk for 100% accurate word recognition
                if (storyVocabulary.size > 0) {
                  const vocabularyList = Array.from(storyVocabulary);
                  
                  // ADD REVERSED WORDS: Include reversed versions of story words so Vosk can hear reversals
                  const reversedWords = new Set<string>();
                  for (const word of vocabularyList) {
                    const normalized = word.toLowerCase().trim();
                    if (normalized.length >= 2) {
                      const reversed = normalized.split('').reverse().join('');
                      reversedWords.add(reversed);
                    }
                  }
                  
                  // Combine original vocabulary with reversed words
                  const enhancedVocabulary = [...vocabularyList, ...Array.from(reversedWords)];

                  // Try multiple Vosk configuration formats for compatibility
                  const config1 = JSON.stringify({
                    config: {
                      words: true,
                      max_alternatives: 0,
                      grammar: enhancedVocabulary
                    }
                  });

                  const config2 = JSON.stringify({
                    config: {
                      sample_rate: 16000,
                      words: true,
                      max_alternatives: 0,
                      word_list: enhancedVocabulary
                    }
                  });

                  console.log(`🎯 Sending ${vocabularyList.length} story words + ${reversedWords.size} reversed words to Vosk (reconnect)`);
                  console.log(`📝 Total vocabulary: ${enhancedVocabulary.length} words`);
                  console.log(`📝 Vocabulary sample (first 20):`, enhancedVocabulary.slice(0, 20).join(', '));

                  try {
                    ws.send(config1);
                    console.log('✓ Sent grammar config format 1 (reconnect)');
                  } catch (e) {
                    console.warn('Failed to send config1:', e);
                  }

                  try {
                    ws.send(config2);
                    console.log('✓ Sent word_list config format 2 (reconnect)');
                  } catch (e) {
                    console.warn('Failed to send config2:', e);
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

                // Simplified audio processing - just send raw Float32 audio to server
                // Server handles downsampling, format conversion, and speech detection
                let audioChunkCount = 0;
                script.onaudioprocess = (e: AudioProcessingEvent) => {
                  try {
                      audioChunkCount++;
                      // Log every 100 chunks to verify audio is being processed
                      if (audioChunkCount % 100 === 0) {
                        console.log(`📊 Audio processing active (reconnect): ${audioChunkCount} chunks processed`);
                      }
                      
                      if (ws.readyState === WebSocket.OPEN) {
                      const channel = e.inputBuffer.getChannelData(0);
                      
                      // AUDIO AMPLIFICATION: Moderate boost for accuracy (1.5x amplification)
                      // Reduced from 3x to minimize noise and maximize Vosk accuracy
                      const amplifiedChannel = new Float32Array(channel.length);
                      const amplificationFactor = 1.5;
                      
                      for (let i = 0; i < channel.length; i++) {
                        amplifiedChannel[i] = Math.max(-1.0, Math.min(1.0, channel[i] * amplificationFactor));
                      }
                      
                      // Send amplified audio - server will handle processing
                      ws.send(amplifiedChannel.buffer);
                      }
                  } catch (error) {
                    console.warn("Error sending audio:", error);
                  }
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
                  console.warn("Error parsing Vosk message:", error);
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
              console.warn("Failed to reconnect Vosk with new language:", error);
              setVoskStatus("disconnected");
            }
          };

          startVosk();
        }
      }, 100);
    }
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
          console.warn("Error stopping media recorder:", error);
        }
      }

      // Cleanup speech recognition
      if (useWebSpeech && recognitionRef.current) {
        try {
          shouldRestartWebSpeechRef.current = false; // Disable auto-restart
          recognitionRef.current.stop();
          recognitionRef.current = null;
          setWebSpeechStatus('disconnected');
          console.log('✅ Web Speech API stopped');
          
          // 👷 MULTI-WORKER: Disconnect from backend
          disconnectMultiWorker();
        } catch (error) {
          console.warn('Error stopping Web Speech API:', error);
        }
      } else {
        // Cleanup Vosk (includes all cleanup logic)
        cleanupVosk();
      }

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
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error stopping recording:", errorMessage, error);
      alert("An error occurred while stopping the recording. Your progress has been saved.");
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
        
        // Build reversed words cache for efficient reversal detection
        buildReversedStoryCache(wordArray);
        console.log(`🔄 Reversal detection cache built from PDF`);
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

        // Get all stories
        const stories = await UnifiedStoryService.getInstance().getStories({});

        // Extract story by _id or title for compatibility
        const story = stories.find(
          (s: Story) =>
            s._id === sessionData.book || s.title === sessionData.book
        );

        if (!story || !story._id) {
          throw new Error("Story not found");
        }

        try {
          // Get the full story details
          const fullStory =
            await UnifiedStoryService.getInstance().getStoryById(story._id);

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
            setStoryLanguage(internalLanguage);
          } else {
            // Default to English if no language is specified
            console.log('📖 [Teacher] Setting default story language: english');
            setStoryLanguage("english");
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
            
            // Build reversed words cache for efficient reversal detection
            const cache = buildReversedStoryCache(wordArray);
            
            // Log the reversed words cache for debugging
            const reversedWordsList = Array.from(cache.reversedToOriginal.entries())
              .map(([reversed, original]) => `"${reversed}" (← "${original}")`)
              .join(', ');
            console.log(`🔄 Reversal detection cache built: ${cache.reversedToOriginal.size} reversed words available`);
            if (reversedWordsList) {
              console.log(`   Reversed words: ${reversedWordsList}`);
            }
            
            // Initialize WordStateManager with story words
            // Requirements: 1.1, 1.4
            wordStateManager.initialize(wordArray);

            // Extract vocabulary for vocabulary-constrained recognition
            const vocabulary = extractVocabulary(fullStory.textContent);
            setStoryVocabulary(vocabulary);

            // Pronunciation matching now handled by server
            console.log(`📚 Story loaded: ${vocabulary.size} vocabulary words, language: ${fullStory.language || 'auto-detect'}`);

            // Detect story language based on vocabulary
            const detectedLanguage = detectStoryLanguage(vocabulary);

            // Only override the language if it wasn't already set from story metadata
            // This allows manual language setting to take precedence
            if (!fullStory.language) {
              setStoryLanguage(detectedLanguage);
            }
          }

          // Try to load PDF content only if the story has a PDF
          if (fullStory.hasPdf) {
            try {
              const pdfUrl = UnifiedStoryService.getInstance().getStoryPdfUrl(
                story._id
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
    if (!transcript || !realWords.length || currentWordIndex >= realWords.length) return;

    // ⚡ OPTIMISTIC MODE: Skip slow validation when using Web Speech
    // Web Speech already marks words instantly, no need for background validation
    if (useWebSpeech && isRecording) {
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
          const normSpoken = normalize(lastWord);
          const normExpected = normalize(expectedWord);

          // 7. REVERSAL - Letters/words reversed (DepEd Rule: Count as one error every reversal made)
          const isReversal = normSpoken === normExpected.split('').reverse().join('') ||
            (normSpoken === 'saw' && normExpected === 'was') ||
            (normSpoken === 'was' && normExpected === 'saw') ||
            (normSpoken === 'on' && normExpected === 'no') ||
            (normSpoken === 'no' && normExpected === 'on') ||
            (normSpoken === 'bad' && normExpected === 'dab') ||
            (normSpoken === 'dab' && normExpected === 'bad');

          if (isReversal) {
            console.log(`⚠️ REVERSAL! Child said "${lastWord}" (reversed "${expectedWord}") - DepEd Rule: Write correct word above`);
            setMiscues(prev => prev + 1);
            setMiscueTypes(prev => ({ ...prev, reversal: prev.reversal + 1 }));
            setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'reversal'));
            setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
              type: 'reversal',
              marking: `Write "${expectedWord}" above "${lastWord}"`,
              spokenWord: lastWord,
              correctWord: expectedWord
            }));
            lastMiscueWordRef.current = miscueKey;
            return;
          }

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

          // 2. MISPRONUNCIATION vs 3. SUBSTITUTION - Following DepEd Phil-IRI rules
          const similarity = getCachedSimilarity(lastWord, expectedWord);

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

          // CRITICAL FIX: If isWordMatch considers it correct (accent/pronunciation variation),
          // do NOT mark as mispronunciation or substitution at all!
          // DepEd Rule: Dialectal variations should not be counted as errors
          if (isWordMatch(lastWord, expectedWord)) {
            console.log(`✓ Dialectal variation accepted: "${lastWord}" for "${expectedWord}" - DepEd Rule: Don't count dialectal variations`);
            // Don't count as miscue - it's an acceptable pronunciation
            return;
          }

          // Calculate similarity to determine miscue type
          // DepEd Guidelines:
          // - Mispronunciation: Similar sounding word (75%+ similarity)
          // - Substitution: Different word entirely (<75% similarity)

          // SPECIAL CASE: Check if spoken word is just the expected word with ending dropped
          // Example: "aso" for "asong", "bata" for "batang"
          // This is very common in Tagalog and should be treated as mispronunciation, not substitution
          const normalizedSpoken = normalize(lastWord);
          const normalizedExpected = normalize(expectedWord);
          const isDroppedEnding = normalizedExpected.startsWith(normalizedSpoken) &&
            normalizedSpoken.length >= 3 &&
            normalizedSpoken.length / normalizedExpected.length >= 0.6;

          if (isDroppedEnding) {
            // Treat as mispronunciation (dropped ending) instead of substitution
            console.log(`⚠️ MISPRONUNCIATION (dropped ending)! Child said "${lastWord}" instead of "${expectedWord}" - DepEd Rule: Underline and write phonetic spelling above`);
            setMiscues(prev => prev + 1);
            setMiscueTypes(prev => ({ ...prev, mispronunciation: prev.mispronunciation + 1 }));
            setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'mispronunciation'));
            setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
              type: 'mispronunciation',
              marking: `Underline "${expectedWord}" and write phonetic spelling "${lastWord}" above (dropped ending)`,
              spokenWord: lastWord,
              correctWord: expectedWord
            }));

            // Increment wordsRead - child read the word (with mispronunciation)
            setWordsRead(prev => Math.min(prev + 1, words.length));
            console.log(`📊 Words Read incremented to ${Math.min(wordsRead + 1, words.length)} (mispronunciation counted)`);
            
            // AUTO-ADVANCE: Move yellow highlight to next word after mispronunciation
            const newIndex = currentWordIndex + 1;
            setCurrentWordIndex(newIndex);
            console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex} (mispronunciation auto-advance)`);
            
            // Clear transcript to prevent false matches
            const isFirstWord = transcriptWords.indexOf(lastWord) === 0;
            if (isFirstWord) {
              voskFinalTranscriptRef.current = "";
              setTranscript("");
              processedTranscriptWordsRef.current = 0;
              console.log(`🧹 Cleared transcript after mispronunciation`);
            }
            
            processedTranscriptWordsRef.current = transcriptWords.length;
          } else if (similarity >= 0.75) {
            // Very similar (75%+) - MISPRONUNCIATION
            // DepEd Rule: Count as 1 error every mispronunciation
            // Marking: Underline text, write phonetic spelling above
            console.log(`⚠️ MISPRONUNCIATION! Child said "${lastWord}" instead of "${expectedWord}" (${(similarity * 100).toFixed(0)}% similar) - DepEd Rule: Underline and write phonetic spelling above`);
            setMiscues(prev => prev + 1);
            setMiscueTypes(prev => ({ ...prev, mispronunciation: prev.mispronunciation + 1 }));
            setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'mispronunciation'));
            setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
              type: 'mispronunciation',
              marking: `Underline "${expectedWord}" and write phonetic spelling "${lastWord}" above`,
              spokenWord: lastWord,
              correctWord: expectedWord
            }));

            // Increment wordsRead - child read the word (with mispronunciation)
            setWordsRead(prev => Math.min(prev + 1, words.length));
            console.log(`📊 Words Read incremented to ${Math.min(wordsRead + 1, words.length)} (mispronunciation counted)`);
            
            // AUTO-ADVANCE: Move yellow highlight to next word after mispronunciation
            const newIndex = currentWordIndex + 1;
            setCurrentWordIndex(newIndex);
            console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex} (mispronunciation auto-advance)`);
            
            // Clear transcript to prevent false matches (only if first word)
            const isFirstWord = transcriptWords.indexOf(lastWord) === 0;
            if (isFirstWord) {
              voskFinalTranscriptRef.current = "";
              setTranscript("");
              processedTranscriptWordsRef.current = 0;
              console.log(`🧹 Cleared transcript after mispronunciation`);
            }

            // Mark this word as processed so it won't be reused for next expected word
            processedTranscriptWordsRef.current = transcriptWords.length;
          } else {
            // Different word (<75% similarity) - SUBSTITUTION
            // DepEd Rule: Count as 1 error every substitution
            // Marking: Underline text, write substituted word above

            // EXCEPTION: Check if the spoken word matches a nearby story word
            // This could be reading ahead/behind, not a true substitution
            const nearbyRange = 3; // Check 3 words before and after
            const startIdx = Math.max(0, currentWordIndex - nearbyRange);
            const endIdx = Math.min(realWords.length, currentWordIndex + nearbyRange + 1);
            const nearbyWords = realWords.slice(startIdx, endIdx);

            const matchesNearbyWord = nearbyWords.some(nearbyWord => isWordMatch(lastWord, nearbyWord));

            if (matchesNearbyWord) {
              console.log(`✓ Word "${lastWord}" matches a nearby story word, likely reading ahead/behind - not counting as substitution`);
              // This is likely a transposition or the child reading ahead/behind
              return;
            }

            // True substitution - completely different word
            console.log(`⚠️ SUBSTITUTION! Child said "${lastWord}" instead of "${expectedWord}" (${(similarity * 100).toFixed(0)}% similar) - DepEd Rule: Underline and write substituted word above`);
            setMiscues(prev => prev + 1);
            setMiscueTypes(prev => ({ ...prev, substitution: prev.substitution + 1 }));
            setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'substitution'));
            setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
              type: 'substitution',
              marking: `Underline "${expectedWord}" and write substituted word "${lastWord}" above`,
              spokenWord: lastWord,
              correctWord: expectedWord
            }));

            // CRITICAL: Increment wordsRead even for substitutions
            // The child DID read a word (just the wrong one), so it counts toward words read
            // The miscue is tracked separately
            setWordsRead(prev => Math.min(prev + 1, words.length));
            console.log(`📊 Words Read incremented to ${Math.min(wordsRead + 1, words.length)} (substitution counted)`);

            // AUTO-ADVANCE: Move yellow highlight to next word after substitution
            // This allows reading to continue naturally while tracking the error
            const newIndex = currentWordIndex + 1;
            setCurrentWordIndex(newIndex);
            console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex} (substitution auto-advance)`);

            // CRITICAL FIX: Always clear the transcript after substitution
            // Without this, the transcript keeps accumulating and the same word
            // gets matched against every subsequent expected word, causing runaway advancement
            voskFinalTranscriptRef.current = "";
            setTranscript("");
            processedTranscriptWordsRef.current = 0;
            console.log(`🧹 Cleared transcript after substitution to prevent runaway matching`);
            
            return; // Exit early to prevent further processing
          }

          lastMiscueWordRef.current = miscueKey;
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
    if (currentWordRef.current && isRecording && yellowHighlightRef.current && storyContentRef.current) {
      const wordElement = currentWordRef.current;
      const highlight = yellowHighlightRef.current;
      
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
        {isLoading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : !currentSession ? (
          <div className="flex flex-col items-center justify-center h-screen">
            <p className="text-red-600">Failed to load reading session</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : null}
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

      // CRITICAL FIX: Build complete wordMarkings including end-of-session omissions
      // The state updates from handleStopRecording haven't been applied yet, so we need to
      // manually add the omissions for unread words
      const finalWordMarkings = new Map(wordMarkings);
      const finalWordMiscues = new Map(wordMiscues);
      const realWords = words.filter(w => /\w+/.test(w));
      const lastReadIndex = currentWordIndex;
      
      // Mark all correctly read words as recognized (green highlighting)
      // Words that were read (up to lastReadIndex) and don't have miscues are correct
      const finalRecognizedWords = new Set(recognizedWords);
      for (let i = 0; i < lastReadIndex; i++) {
        if (!finalWordMiscues.has(i)) {
          finalRecognizedWords.add(i);
        }
      }
      setRecognizedWords(finalRecognizedWords);
      
      // Add omissions for all unread words at the end
      for (let i = lastReadIndex; i < realWords.length; i++) {
        if (!finalWordMiscues.has(i) && !recognizedWords.has(i)) {
          finalWordMiscues.set(i, 'omission');
          finalWordMarkings.set(i, {
            type: 'omission',
            marking: `Circle omitted word`,
            spokenWord: '',
            correctWord: realWords[i]
          });
        }
      }

      // CRITICAL: Recalculate miscue types from finalWordMiscues to include end-of-session omissions
      const finalMiscueTypes = {
        omission: 0,
        substitution: 0,
        insertion: 0,
        mispronunciation: 0,
        repetition: 0,
        transposition: 0,
        reversal: 0,
        selfCorrection: 0
      };
      
      // Count miscues, but handle transposition specially (count as ONE per pair, not two)
      finalWordMiscues.forEach((miscueType, wordIndex) => {
        if (miscueType in finalMiscueTypes) {
          // For transposition, only count the FIRST word of the pair (DepEd: count as one error per transposition)
          if (miscueType === 'transposition') {
            const marking = finalWordMarkings.get(wordIndex);
            // Only count if this is the first word of the transposition pair
            if (marking?.isFirstWord === true) {
              finalMiscueTypes.transposition++;
            }
            // Skip the second word of the pair (isFirstWord === false)
          } else {
            finalMiscueTypes[miscueType as keyof typeof finalMiscueTypes]++;
          }
        }
      });
      
      // Calculate total miscues (transposition counts as 1, not 2)
      const finalTotalMiscues = 
        finalMiscueTypes.omission +
        finalMiscueTypes.substitution +
        finalMiscueTypes.insertion +
        finalMiscueTypes.mispronunciation +
        finalMiscueTypes.repetition +
        finalMiscueTypes.transposition +
        finalMiscueTypes.reversal;
      // Note: selfCorrection is NOT counted as an error per DepEd rules
      
      console.log('📊 Final miscue counts:', {
        total: finalTotalMiscues,
        breakdown: finalMiscueTypes,
        stateTotal: miscues,
        stateBreakdown: miscueTypes
      });

      // Clean wordMarkings to remove undefined values (Firebase doesn't accept undefined)
      const cleanedWordMarkings: any = {};
      finalWordMarkings.forEach((marking, index) => {
        const cleaned: any = {
          type: marking.type,
          marking: marking.marking,
          spokenWord: marking.spokenWord || '',
          correctWord: marking.correctWord || ''
        };
        
        // Only add optional properties if they exist
        if (marking.wrongWord) {
          cleaned.wrongWord = marking.wrongWord;
        }
        if (marking.isFirstWord !== undefined) {
          cleaned.isFirstWord = marking.isFirstWord;
        }
        
        cleanedWordMarkings[index] = cleaned;
      });

      // Prepare session results data
      const sessionResults: any = {
        status: "completed" as const,
        completedAt: new Date(),
        wordsRead,
        totalMiscues: finalTotalMiscues, // Use recalculated total
        miscueTypes: finalMiscueTypes, // Use recalculated breakdown including end omissions
        elapsedTime,
        readingSpeedWPM: parseInt(readingSpeedWPM) || 0,
        oralReadingScore: parseFloat(oralReadingScore) || 0,
        recognizedWords: Array.from(recognizedWords), // Convert Set to Array
        wordMiscues: Object.fromEntries(finalWordMiscues), // Use final miscues including end omissions
        wordMarkings: cleanedWordMarkings, // Use cleaned data
        insertedWords: Object.fromEntries(insertedWords), // Convert Map to Object
        transcript: transcript || "",
      };

      // Only add audioUrl if it exists (Firebase doesn't accept undefined)
      if (audioUrl) {
        sessionResults.audioUrl = audioUrl;
      }

      // Update session with results
      await readingSessionService.updateSession(sessionId, sessionResults);

      // Save ISR results to MongoDB for each student
      for (const student of currentSession.students) {
        // Handle both old format (string[]) and new format ({id, name}[])
        let studentId: string;
        let studentName: string;

        if (typeof student === 'string') {
          // Old format: just ID
          studentId = student;
          studentName = studentNames[studentId] || studentId;
        } else if (student && typeof student === 'object' && 'id' in student && 'name' in student) {
          // New format: object with id and name
          studentId = student.id;
          studentName = student.name;
        } else {
          console.warn('Invalid student format:', student);
          continue;
        }

        try {
          await saveISRResult(studentId, studentName);
          console.log(`Session completed for student: ${studentName} (${studentId})`);
        } catch (error) {
          console.error(`Failed to save ISR result for ${studentName}:`, error);
        }

        setCompletedStudents((prev) => ({ ...prev, [studentId]: true }));
      }

      // Update local state
      setCurrentSession({
        ...currentSession,
        ...sessionResults,
      });

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

  // Helper to check if a word index matches the current word
  function isWordCurrent(realWordIndex: number): boolean {
    return realWordIndex === currentWordIndex;
  }



  // Helper to get miscue color based on type
  // @ts-ignore - Function IS used in template literal on line 5089, TS analyzer bug
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
  // @ts-ignore - Function IS used in style spread on line 5104, TS analyzer bug
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
            {/* Heard Indicator - Always visible when recording */}
            {isRecording && finalText && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-red-100 to-pink-100 border-2 border-red-300 shadow-md animate-pulse">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                  </span>
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

                            const isCurrent = !isSpecialChar && isWordCurrent(realWordIndex);

                            return (
                              <React.Fragment key={`${paragraphIndex}-${wordIndex}`}>
                                {/* Use WordDisplay component for word-by-word marking */}
                                {!isSpecialChar && (
                                  <WordDisplay
                                    word={wordStateManager.getWord(realWordIndex) || {
                                      index: realWordIndex,
                                      text: word,
                                      status: 'pending',
                                    } as WordState}
                                    isCurrent={isCurrent && isRecording && !isCompleted}
                                    onClick={() => handleWordClick(realWordIndex)}
                                    isSelected={selectedWordIndex === realWordIndex}
                                    toggleState={toggleState}
                                    className={`mr-1 sm:mr-2 lg:mr-3 mb-2 sm:mb-3 px-2 sm:px-3 py-1 sm:py-2 font-serif text-sm sm:text-lg lg:text-2xl`}
                                  />
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
            {/* Color Legend - Positioned at bottom-left, visible during reading sessions */}
            <div className="absolute bottom-4 left-4 z-20">
              <ColorLegend 
                className="shadow-lg"
                initialCollapsed={true}
              />
            </div>
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
                      console.error('Mic test error:', error);
                      Swal.fire({
                        title: 'Microphone Error',
                        text: 'Could not access the microphone. Please check permissions.',
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
            
            {/* Language selector + STT Provider/Vosk status badge */}
            <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 -mt-2 -mb-2">
              {/* Speech Recognition Provider Toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-semibold text-blue-900">
                  Speech Recognition:
                </span>
                <button
                  onClick={() => {
                    if (isRecording) {
                      alert('Please stop recording before switching speech recognition provider.');
                      return;
                    }
                    
                    // Warn about Tagalog support
                    if (!useWebSpeech && storyLanguage === 'tagalog') {
                      const confirmed = confirm(
                        'Web Speech API has limited support for Tagalog and may not work reliably.\n\n' +
                        'For best results with Tagalog stories, we recommend using Vosk.\n\n' +
                        'Do you want to continue with Web Speech anyway?'
                      );
                      if (!confirmed) return;
                    }
                    
                    setUseWebSpeech(!useWebSpeech);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useWebSpeech ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  disabled={isRecording}
                  title={useWebSpeech 
                    ? 'Web Speech API (requires internet, best for English)' 
                    : 'Vosk (works offline, supports English & Tagalog)'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useWebSpeech ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs sm:text-sm text-gray-700 font-medium">
                  {useWebSpeech ? 'Web Speech' : 'Vosk'}
                </span>
                {useWebSpeech && (
                  <>
                    <span className="text-xs text-gray-500 italic">
                      {storyLanguage === 'tagalog' ? '(limited Tagalog support)' : '(requires internet)'}
                    </span>
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      ⚡ Instant Mode
                    </span>
                    {useMultiWorker && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        multiWorkerStatus === 'connected' 
                          ? 'text-blue-600 bg-blue-50' 
                          : multiWorkerStatus === 'connecting'
                          ? 'text-yellow-600 bg-yellow-50'
                          : 'text-gray-600 bg-gray-50'
                      }`}>
                        👷 {multiWorkerStatus === 'connected' ? '4 Workers' : multiWorkerStatus === 'connecting' ? 'Connecting...' : 'Workers Off'}
                      </span>
                    )}
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* Status indicator dot - only shows when recording is active */}
                {!useWebSpeech && isRecording && (storyLanguage === "tagalog" || storyLanguage === "english") && (
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
                {useWebSpeech && isRecording && (
                  <span
                    className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${webSpeechStatus === "connected"
                      ? "bg-green-500"
                      : webSpeechStatus === "connecting"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                      }`}
                    title={`Web Speech: ${webSpeechStatus}`}
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
            
            {/* Miscue Toggle Panel - Allow teachers to enable/disable specific miscue types */}
            <div className="w-full mt-6 pt-6 border-t border-blue-200">
              <MiscueTogglePanel
                toggleState={toggleState}
                onToggleChange={toggleMiscue}
                className="w-full"
              />
            </div>
          </div>
        </section>
      )}

      {/* Heard Mic Display - Shows real-time audio input and recognized words */}
      {isRecording && (
        <section className="w-full px-4 sm:px-8 pb-8 relative z-10">
          <div className="max-w-2xl mx-auto">
            <HeardMicDisplay
              partialText={partialText}
              finalText={finalText}
              isRecording={isRecording}
              voskStatus={voskStatus}
              frequencyData={frequencyData}
              className="shadow-lg"
            />
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

      {/* Countdown Modal */}
      {showCountdown && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          {/* Big Circular Container */}
          <div className="relative w-[500px] h-[500px] sm:w-[600px] sm:h-[600px]">
            {/* Background Circle with Gradient */}
            <svg className="w-full h-full" viewBox="0 0 600 600">
              <defs>
                <linearGradient id="circleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              {/* Main filled circle background */}
              <circle
                cx="300"
                cy="300"
                r="288"
                fill="url(#circleGradient)"
                className="drop-shadow-2xl"
              />
              {/* Progress ring background */}
              <circle
                cx="300"
                cy="300"
                r="270"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="20"
                fill="none"
              />
              {/* Animated progress ring */}
              <circle
                cx="300"
                cy="300"
                r="270"
                stroke="white"
                strokeWidth="20"
                fill="none"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - ((5 - countdown) / 5) * 100}
                strokeLinecap="butt"
                transform="rotate(-90 300 300)"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            
            {/* Content inside circle */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              {/* Countdown Number - GSAP animated */}
              <span
                ref={(el) => {
                  if (el && showCountdown) {
                    gsap.fromTo(
                      el,
                      {
                        scale: 0.5,
                        opacity: 0,
                        rotation: -180,
                      },
                      {
                        scale: 1.2,
                        opacity: 1,
                        rotation: 0,
                        duration: 0.5,
                        ease: 'back.out(2)',
                        onComplete: () => {
                          gsap.to(el, {
                            scale: 1,
                            duration: 0.3,
                            ease: 'power2.inOut',
                          });
                        },
                      }
                    );
                  }
                }}
                className="text-[180px] sm:text-[220px] font-black text-white drop-shadow-2xl leading-none"
              >
                {countdown}
              </span>
              
              {/* Instructions */}
              <div className="space-y-4 px-12 text-center">
                <h3 className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg">
                  Get Ready!
                </h3>
                <p className="text-3xl sm:text-4xl font-bold text-white/95 leading-tight">
                  Read LOUD and CLEAR
                </p>
              </div>
            </div>
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
};

export default ReadingSessionPage;