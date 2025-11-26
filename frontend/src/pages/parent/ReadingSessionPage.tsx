import React, {useEffect, useState, useRef, useMemo} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { readingSessionService, type ReadingSession } from '@/services/readingSessionService';
import { UnifiedStoryService } from '@/services/UnifiedStoryService';
import type { Story } from '@/types/Story';
import { ArrowLeftIcon, XCircleIcon, BookOpenIcon, UserGroupIcon, ChartBarIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import 'pdfjs-dist/build/pdf.worker.entry';
import {
  calculateOralReadingScore,
  calculateReadingSpeedWPM,
  formatElapsedTime
} from '@/utils/readingMetrics';
import { studentService } from '@/services/studentService';
import { formatDateHuman } from '@/utils/date';
import Swal from 'sweetalert2';
import { doubleMetaphone } from 'double-metaphone';
import ParentLoader from '../../components/parent/ParentLoader';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ReadingSessionPage: React.FC = () => {
  const [storyText, setStoryText] = useState<string>('');
  const { sessionId, storyId } = useParams<{ sessionId?: string; storyId?: string }>();
  const navigate = useNavigate();
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPracticeMode = !!storyId && !sessionId;

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [words, setWords] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pdfContent, setPdfContent] = useState<string>('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  // Countdown modal state
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  // Track if session has been started (to show Complete button)
  const [hasStarted, setHasStarted] = useState(false);
  
  // Countdown effect - preload Vosk connection during countdown
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      // Countdown finished, start recording
      setShowCountdown(false);
      startRecordingAfterCountdown();
      setCountdown(5); // Reset for next time
    }
  }, [showCountdown, countdown]);
  
  // Audio recording state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Audio and speech recognition refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voskSocketRef = useRef<WebSocket | null>(null);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState(''); // Real-time partial results
  const [sttProvider, setSttProvider] = useState<'vosk' | 'webspeech' | 'none'>('none');
  const [voskStatus, setVoskStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [wordsRead, setWordsRead] = useState(0);
  const [storyLanguage, setStoryLanguage] = useState<'english' | 'tagalog'>('english');
  

  // Add debug state
  

  // Add miscues state
  const [miscues, setMiscues] = useState(0);
  
  // Word markings for visual display of miscues
  const [wordMarkings, setWordMarkings] = useState<Map<number, {
    type: 'insertion' | 'substitution' | 'mispronunciation' | 'omission';
    spokenWord: string;
    correctWord: string;
  }>>(new Map());
  
  // Track correctly read words (for green highlighting)
  const [recognizedWords, setRecognizedWords] = useState<Set<number>>(new Set());
  
  // Track insertions as separate elements to display between words
  // Map: wordIndex -> array of inserted words that come AFTER this word
  const [insertedWordsAfter, setInsertedWordsAfter] = useState<Map<number, string[]>>(new Map());

  // Real-time Oral Reading Score (Accuracy) using useMemo
  const oralReadingScore = useMemo(() => {
    if (words.length === 0) return '0.0';
    const score = calculateOralReadingScore(wordsRead, miscues, words.length);
    return score.toFixed(1);
  }, [wordsRead, miscues, words.length]);

  // Debug logging for score and dependencies
  useEffect(() => {
    console.log('wordsRead:', wordsRead, 'miscues:', miscues, 'totalWords:', words.length, 'oralReadingScore:', oralReadingScore);
  }, [wordsRead, miscues, words.length, oralReadingScore]);
  
  // Check Vosk connection status during countdown
  useEffect(() => {
    if (showCountdown && countdown === 5 && words.length > 0) {
      // Check if Vosk is already connected from preload
      const isConnected = voskSocketRef.current && voskSocketRef.current.readyState === WebSocket.OPEN;
      if (isConnected) {
        console.log('✅ Vosk already connected - ready to start!');
      } else {
        console.log('⏳ Vosk still connecting...');
        // Try to connect if not already connected
        preloadVoskConnection();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountdown, countdown]);

  // Real-time Reading Speed (WPM)
  const readingSpeedWPM = elapsedTime > 0 ? calculateReadingSpeedWPM(wordsRead, elapsedTime).toString() : '0';

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
  const normalize = (text: string) => {
    let normalized = text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    // Convert standalone numbers to words
    normalized = normalized.replace(/\b\d+\b/g, (match) => numberToWord(match));
    return normalized;
  };


  // Helper: Extract all readable words (alphanumeric only) from text, skipping punctuation/symbols
  function extractWordsFromText(text: string): string[] {
    // This regex matches words with at least one alphanumeric character
    return text.match(/\b\w+\b/g) || [];
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
   * Improved pronunciation matching with Filipino accent tolerance.
   * Handles common pronunciation variations for Filipino English speakers.
   */
  function isWordMatch(spokenWord: string, expectedWord: string): boolean {
    const normSpoken = normalize(spokenWord);
    const normExpected = normalize(expectedWord);
    if (!normSpoken || !normExpected) return false;

    // Debug logging
    console.debug(`Comparing: "${normSpoken}" vs "${normExpected}"`);

    // Exact match
    if (normSpoken === normExpected) {
      console.debug("✓ Exact match");
      return true;
    }

    // Pronunciation matching is now handled server-side via:
    // - VoskServer/english_pronunciation_dictionary.py
    // - VoskServer/tagalog_pronunciation_dictionary.py
    // The server automatically applies pronunciation variants based on story language

    // Calculate similarity metrics
    const distance = levenshtein(normSpoken, normExpected);
    const maxLength = Math.max(normSpoken.length, normExpected.length);
    const similarity = 1 - (distance / maxLength);

    // SPECIAL CASE: Common Vosk mishearings for very short words
    // "the" is often misheard as "a" and vice versa
    const commonMishearings: { [key: string]: string[] } = {
      'a': ['the', 'uh', 'ah', 'ay'],
      'the': ['a', 'da', 'de'],
      'i': ['eye', 'aye'],
      'to': ['too', 'two']
    };
    
    if (commonMishearings[normExpected]?.includes(normSpoken)) {
      console.debug(`✓ Common mishearing: "${normSpoken}" accepted for "${normExpected}"`);
      return true;
    }

    // For single character words (like "a"), be very lenient
    if (normExpected.length === 1) {
      // Accept if first character matches or phonetically similar
      if (normSpoken.length === 1 || normSpoken.length === 2) {
        return similarity >= 0.5;  // Very lenient for single chars
      }
    }

    // For very short words (2-3 chars), be more lenient
    if (normExpected.length <= 3) {
      // Reduced from 85% to 70% for better recognition
      return similarity >= 0.70;
    }

    // For short words (4 chars), allow small variations
    if (normExpected.length === 4) {
      // Reduced from 75% to 65% for better recognition
      if (similarity >= 0.65) return true;
    }

    // For medium words (5-7 chars), be more lenient
    if (normExpected.length >= 5 && normExpected.length <= 7) {
      // Reduced from 70% to 60% for better recognition
      if (similarity >= 0.60) return true;
    }

    // Double Metaphone phonetic match for longer words
    const [primary1, secondary1] = doubleMetaphone(normSpoken);
    const [primary2, secondary2] = doubleMetaphone(normExpected);

    // Check if any phonetic codes match
    if (primary1 === primary2 ||
      (secondary1 && secondary1 === secondary2) ||
      (secondary1 && secondary1 === primary2) ||
      (primary1 === secondary2)) {
      // Additional validation: words should be similar length
      if (Math.abs(normSpoken.length - normExpected.length) <= 2) {
        return true;
      }
    }

    // For longer words (8+ chars), allow up to 2 character difference
    if (maxLength >= 8 && distance <= 2) {
      return true;
    }

    // For medium words (5-7 chars), allow 1 character difference
    if (maxLength >= 5 && maxLength < 8 && distance === 1) {
      return true;
    }
    
    return false;
  }

  

  // Start recording and speech recognition
  const handleStartRecording = () => {
    // Show countdown modal first
    setShowCountdown(true);
    setCountdown(5);
  };
  
  // Preload Vosk connection (called during loading or countdown)
  const preloadVoskConnection = async () => {
    console.log('🔄 preloadVoskConnection called - storyLanguage:', storyLanguage, 'words:', words.length);
    
    const useVosk = storyLanguage === 'tagalog' || storyLanguage === 'english';
    if (!useVosk) {
      console.log('⚠️ Not using Vosk - language:', storyLanguage);
      return;
    }
    
    // Prevent duplicate connections
    if (voskSocketRef.current && voskSocketRef.current.readyState === WebSocket.OPEN) {
      console.log('✅ Vosk already connected - skipping preload');
      return;
    }
    
    // Close any existing connection that's not open
    if (voskSocketRef.current) {
      try {
        voskSocketRef.current.close();
      } catch (e) {
        console.warn('Error closing existing Vosk connection:', e);
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
    
    console.log('🔍 Checking local Vosk server:', localUrl);
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
          console.log('✅ Connected to LOCAL Vosk server');
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
        console.log('🌐 Trying Railway Vosk server:', railwayUrl);
        const ws = new WebSocket(railwayUrl);
        ws.binaryType = 'arraybuffer';
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Railway server timeout'));
        }, 5000); // 5 second timeout for Railway
        
        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ Connected to RAILWAY Vosk server');
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
        console.log('🏠 Using LOCAL Vosk server');
      } catch (localError) {
        console.log('⚠️ Local server not available, trying Railway...');
        ws = await tryRailwayServer();
        console.log('☁️ Using RAILWAY Vosk server');
      }
      
      voskSocketRef.current = ws;
      ws.binaryType = 'arraybuffer';
      
      // Connection already established, set up handlers
      setVoskStatus('connected');
      setSttProvider('vosk');
      
      // Send story vocabulary for server-side filtering
      if (words.length > 0) {
        const vocabulary = Array.from(new Set(words.map((w: string) => w.toLowerCase())));
        ws.send(JSON.stringify({
          config: {
            vocabulary: vocabulary,
            expected_words: words.map((w: string) => w.toLowerCase())
          }
        }));
        console.log(`📚 Sent vocabulary: ${vocabulary.length} unique words`);
      }
      
      ws.onerror = (error) => {
        console.warn('⚠️ Vosk connection error:', error);
        setVoskStatus('disconnected');
      };
      
      ws.onclose = () => {
        console.log('🔌 Vosk connection closed');
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
            
            console.log(`🎯 Backend match: ${match_type} - ${details}`);
            
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
                setInsertedWordsAfter(prev => {
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
      console.error('❌ Failed to connect to both local and Railway Vosk servers:', error);
      setVoskStatus('disconnected');
      voskSocketRef.current = null;
    }
  };

  // Actual recording start after countdown
  const startRecordingAfterCountdown = () => {
    setIsRecording(true);
    setIsPaused(false);
    setHasStarted(true); // Mark that session has started
    setTranscript('');
    setPartialTranscript('');
    setWordsRead(0);
    
    setElapsedTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setCurrentWordIndex(0);

    // --- MediaRecorder ---
    if (navigator.mediaDevices && window.MediaRecorder) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const audioChunks: BlobPart[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          setAudioBlob(audioBlob);
          setAudioUrl(URL.createObjectURL(audioBlob));
        };
        mediaRecorder.start();
      }).catch(_err => {
        alert('Microphone access denied or not available.');
        setIsRecording(false);
      });
    } else {
      alert('MediaRecorder not supported in this browser.');
      setIsRecording(false);
    }

    // Choose STT path: Vosk (WS) for both Tagalog and English, else Web Speech
    // Check if Vosk is already preloaded during countdown
    const useVosk = storyLanguage === 'tagalog' || storyLanguage === 'english';
    if (useVosk) {
      // Check if Vosk was already preloaded during countdown
      const isVoskPreloaded = voskSocketRef.current && voskSocketRef.current.readyState === WebSocket.OPEN;
      
      if (isVoskPreloaded) {
        console.log('✅ Using preloaded Vosk connection - starting audio immediately!');
        
        // Start audio processing with preloaded connection
        try {
          const startVoskAudio = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 48000 } });
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
            audioContextRef.current = ctx;
            const src = ctx.createMediaStreamSource(stream);
            sourceNodeRef.current = src;
            const script = ctx.createScriptProcessor(2048, 1, 1);
            scriptNodeRef.current = script;

            // Downsample Float32 (48k) to Int16 (16k)
            const downsampleTo16k = (input: Float32Array): Int16Array => {
              const sampleRate = ctx.sampleRate || 48000;
              const ratio = sampleRate / 16000;
              const newLength = Math.floor(input.length / ratio);
              const result = new Int16Array(newLength);
              let idx = 0;
              let i = 0;
              while (idx < newLength) {
                const next = Math.floor((idx + 1) * ratio);
                let sum = 0;
                let count = 0;
                for (; i < next && i < input.length; i++) {
                  sum += input[i];
                  count++;
                }
                const sample = sum / (count || 1);
                const s = Math.max(-1, Math.min(1, sample));
                result[idx++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              return result;
            };

            src.connect(script);
            script.connect(ctx.destination);
            
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
            
            console.log('✅ Audio nodes connected - using preloaded Vosk connection');
            
            // Use the preloaded WebSocket
            const ws = voskSocketRef.current!;
            script.onaudioprocess = (e: AudioProcessingEvent) => {
              const channel = e.inputBuffer.getChannelData(0);
              const amplifiedChannel = new Float32Array(channel.length);
              const amplificationFactor = 1.5;
              for (let i = 0; i < channel.length; i++) {
                amplifiedChannel[i] = Math.max(-1.0, Math.min(1.0, channel[i] * amplificationFactor));
              }
              const pcm16 = downsampleTo16k(amplifiedChannel);
              if (ws.readyState === WebSocket.OPEN) ws.send(pcm16);
            };
          };
          
          startVoskAudio().catch(err => {
            console.warn('Failed to start audio with preloaded Vosk:', err);
            setIsRecording(false);
          });
        } catch (error) {
          console.warn('Error starting audio with preloaded Vosk:', error);
          setIsRecording(false);
        }
      } else {
        // Vosk not preloaded - connect now (fallback)
        console.log('⚠️ Vosk not preloaded, connecting now...');
        try {
          const getRailwayWsUrl = (lang: string) => {
            const env = (import.meta as any)?.env || {};
            const railwayUrl = env.VITE_VOSK_WS_URL || "wss://philiready-websocket-production.up.railway.app";
            const normalizedLang = (lang === "tl" || lang === "tagalog") ? "tagalog" : "english";
            return `${railwayUrl}?lang=${normalizedLang}`;
          };
          const wsUrl = getRailwayWsUrl(storyLanguage);
          const startVosk = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 48000 } });
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
            audioContextRef.current = ctx;
            const src = ctx.createMediaStreamSource(stream);
            sourceNodeRef.current = src;
            const script = ctx.createScriptProcessor(2048, 1, 1);
            scriptNodeRef.current = script;

            const downsampleTo16k = (input: Float32Array): Int16Array => {
              const sampleRate = ctx.sampleRate || 48000;
              const ratio = sampleRate / 16000;
              const newLength = Math.floor(input.length / ratio);
              const result = new Int16Array(newLength);
              let idx = 0;
              let i = 0;
              while (idx < newLength) {
                const next = Math.floor((idx + 1) * ratio);
                let sum = 0;
                let count = 0;
                for (; i < next && i < input.length; i++) {
                  sum += input[i];
                  count++;
                }
                const sample = sum / (count || 1);
                const s = Math.max(-1, Math.min(1, sample));
                result[idx++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              return result;
            };

            src.connect(script);
            script.connect(ctx.destination);
            
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
            console.log('✅ Audio nodes connected - microphone is active');

            setVoskStatus('connecting');
            const ws = new WebSocket(wsUrl);
            voskSocketRef.current = ws;
            ws.binaryType = 'arraybuffer';
            ws.onopen = () => {
              setVoskStatus('connected');
              setSttProvider('vosk');
              script.onaudioprocess = (e: AudioProcessingEvent) => {
                const channel = e.inputBuffer.getChannelData(0);
                const amplifiedChannel = new Float32Array(channel.length);
                const amplificationFactor = 1.5;
                for (let i = 0; i < channel.length; i++) {
                  amplifiedChannel[i] = Math.max(-1.0, Math.min(1.0, channel[i] * amplificationFactor));
                }
                const pcm16 = downsampleTo16k(amplifiedChannel);
                if (ws.readyState === WebSocket.OPEN) ws.send(pcm16);
              };
            };
            ws.onmessage = (evt) => {
              try {
                const msg = JSON.parse(evt.data);
                
                if (msg.match_result) {
                  const { match_type, new_position, details } = msg.match_result;
                  const metrics = msg.metrics;
                  const word = msg.text;
                  
                  console.log(`🎯 Backend match: ${match_type} - ${details}`);
                  
                  if (new_position !== undefined) {
                    setCurrentWordIndex(new_position);
                    console.log(`🟡 Position updated to ${new_position}`);
                  }
                  
                  switch (match_type) {
                    case 'waiting_for_start':
                      console.log(`⏳ Waiting for story to start, ignoring word`);
                      return;
                      
                    case 'pending':
                      console.log(`⏸️ Word pending: "${word}" - waiting for next word`);
                      return;
                      
                    case 'correct':
                      const correctWordIndex = new_position - 1;
                      setRecognizedWords(prev => new Set(prev).add(correctWordIndex));
                      console.log(`✅ Word ${correctWordIndex} marked correct`);
                      break;
                      
                    case 'omission':
                      console.log(`⚠️ Word marked as omission`);
                      break;
                      
                    case 'mispronunciation':
                      console.log(`⚠️ Word marked as mispronunciation`);
                    break;
                    
                  case 'substitution':
                    // Word substituted
                    console.log(`⚠️ Word marked as substitution`);
                    break;
                    
                  case 'insertion':
                    // Word inserted (extra word added)
                    const insertedWord = msg.match_result.inserted_word || word;
                    console.log(`⚠️ Insertion detected: "${insertedWord}"`);
                    console.log(`   new_position: ${new_position}, current word: "${word}"`);
                    
                    // Mark the word BEFORE the insertion with the inserted word
                    // new_position is the position AFTER advancing, so new_position - 1 is the word that was just read
                    const insertionWordIndex = new_position - 1;
                    
                    console.log(`   insertionWordIndex: ${insertionWordIndex}, word at that position: "${realWords[insertionWordIndex]}"`);
                    
                    // IMPORTANT: Mark the word as recognized (green) because it was read correctly
                    // The insertion happened AFTER this word
                    setRecognizedWords(prev => {
                      const newSet = new Set(prev);
                      newSet.add(insertionWordIndex);
                      console.log(`   Added ${insertionWordIndex} to recognizedWords, set now has:`, Array.from(newSet));
                      return newSet;
                    });
                    
                    // Add the inserted word to display AFTER this word
                    setInsertedWordsAfter(prev => {
                      const newMap = new Map(prev);
                      const existing = newMap.get(insertionWordIndex) || [];
                      newMap.set(insertionWordIndex, [...existing, insertedWord]);
                      return newMap;
                    });
                    
                    console.log(`📍 Marked insertion at word ${insertionWordIndex}: "${insertedWord}" inserted after "${realWords[insertionWordIndex]}"`);
                    break;
                }
                
                // Update metrics from backend (source of truth)
                if (metrics) {
                  console.log(`📊 Metrics: WPM=${metrics.wpm}, Accuracy=${metrics.oral_reading_score}%, Words=${metrics.words_read}, Miscues=${metrics.total_miscues}`);
                  
                  setWordsRead(metrics.words_read);
                  setMiscues(metrics.total_miscues);
                }
                
                return;  // Exit early - backend handled everything
              }
              
              // FALLBACK: Old format (for backward compatibility)
              // Process both final and partial results immediately for faster response
              if (msg.text) {
                // Final result - update transcript and clear partial
                setTranscript(msg.text);
                setPartialTranscript('');
              } else if (msg.partial) {
                // Partial result - update partial transcript immediately for instant feedback
                setPartialTranscript(msg.partial);
              }
            } catch {}
          };
          ws.onerror = () => {
            console.warn('Vosk WS error, falling back to Web Speech');
            cleanupVosk();
            setVoskStatus('disconnected');
            startWebSpeech();
          };
          ws.onclose = () => {
            setVoskStatus('disconnected');
          };
        };

        const cleanupVosk = () => {
          try { scriptNodeRef.current?.disconnect(); } catch {}
          try { sourceNodeRef.current?.disconnect(); } catch {}
          try { audioContextRef.current?.close(); } catch {}
          try { voskSocketRef.current?.close(); } catch {}
          scriptNodeRef.current = null;
          sourceNodeRef.current = null;
          audioContextRef.current = null;
          voskSocketRef.current = null;
        };

        const startWebSpeech = () => {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (!SpeechRecognition) {
            alert('SpeechRecognition not supported in this browser.');
            return;
          }
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          // Optimize for faster recognition
          recognition.maxAlternatives = 1; // Only get top result for speed
          const selectRecognitionLang = (lang: 'english' | 'tagalog') => {
            if (lang === 'tagalog') {
              const preferred = (navigator.languages || []).map(l => l.toLowerCase());
              if (preferred.includes('fil-ph')) return 'fil-PH';
              if (preferred.includes('tl-ph')) return 'tl-PH';
              return 'fil-PH';
            }
            return 'en-US';
          };
          recognition.lang = selectRecognitionLang(storyLanguage);
          setSttProvider('webspeech');
          let runningTranscript = '';
          recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) runningTranscript += event.results[i][0].transcript + ' ';
              else interim += event.results[i][0].transcript;
            }
            // Update final transcript and partial separately for instant feedback
            setTranscript(runningTranscript);
            setPartialTranscript(interim);
          };
          recognition.onerror = (e: any) => {
            console.warn('Speech recognition error:', e.error);
          };
          recognition.onend = () => {
            // Auto-restart if still recording
            if (isRecording && !isPaused && recognitionRef.current) {
              console.log('Speech recognition ended, restarting...');
              try {
                recognition.start();
              } catch (e) {
                console.warn('Failed to restart recognition:', e);
              }
            }
          };
          recognition.start();
        };

        // try Vosk, fallback to Web Speech
        startVosk().catch(() => {
          console.warn('Failed to start Vosk, using Web Speech');
          startWebSpeech();
        });
      } catch {
        // fallback
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'fil-PH';
          setSttProvider('webspeech');
          recognition.onresult = (e: any) => setTranscript(e.results[0][0].transcript || '');
          recognition.start();
        }
      }
    }
  };

  // Keep SpeechRecognition language in sync if story language changes while recording
  useEffect(() => {
    const rec: any = recognitionRef.current;
    if (!rec) return;
    const target = (storyLanguage === 'tagalog') ? ((navigator.languages || []).map(l => l.toLowerCase()).includes('fil-ph') ? 'fil-PH' : 'tl-PH') : 'en-US';
    try {
      if (rec.lang !== target) {
        // Some implementations require restart to apply new language
        const wasRunning = isRecording && !isPaused;
        try { rec.stop(); } catch {}
        rec.lang = target;
        if (wasRunning) {
          try { rec.start(); } catch {}
        }
      }
    } catch {}
  }, [storyLanguage, isRecording, isPaused]);

  // Stop recording and speech recognition
  const handleStopRecording = async () => {
    try {
      setIsRecording(false);
      setIsPaused(false);
      // Stop MediaRecorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      // Stop SpeechRecognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // Stop Vosk stream if active
      try { scriptNodeRef.current?.disconnect(); } catch {}
      try { sourceNodeRef.current?.disconnect(); } catch {}
      try { audioContextRef.current?.close(); } catch {}
      try { voskSocketRef.current?.close(); } catch {}
      scriptNodeRef.current = null;
      sourceNodeRef.current = null;
      audioContextRef.current = null;
      voskSocketRef.current = null;
      // If Tagalog story, optionally send audio to backend Whisper for better transcription
      const enableServerTranscribe = (import.meta as any)?.env?.VITE_ENABLE_SERVER_TRANSCRIBE === 'true';
      if (audioBlob && storyLanguage === 'tagalog' && enableServerTranscribe) {
        try {
          const form = new FormData();
          form.append('audio', audioBlob, 'audio.webm');
          form.append('language', 'fil');
          const resp = await fetch('/api/transcribe', { method: 'POST', body: form });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.text) {
              setTranscript(data.text);
            }
          } else {
            console.warn('Whisper transcription failed');
          }
        } catch (e) {
          console.warn('Error sending to Whisper:', e);
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
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
      setPdfError(null);
      
      console.log('Fetching PDF from URL:', pdfUrl);
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
          console.warn('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      // Get the PDF as an array buffer
      const pdfArrayBuffer = await response.arrayBuffer();
      console.log('Received array buffer of size:', pdfArrayBuffer.byteLength);

      // Check if we received valid PDF data (should start with %PDF-)
      const firstBytes = new Uint8Array(pdfArrayBuffer.slice(0, 5));
      const header = new TextDecoder().decode(firstBytes);
      console.log('PDF header:', header);
      if (!header.startsWith('%PDF-')) {
        throw new Error('Invalid PDF data: Missing PDF header');
      }

      // Load the PDF using PDF.js
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: pdfArrayBuffer,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdf.numPages);
        
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          console.log('Processing page', pageNum);
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .filter((item): item is TextItem => 'str' in item)
            .map(item => item.str)
            .join(' ');
          fullText += pageText + '\n\n';
        }

        console.log('Text extraction complete, text length:', fullText.length);
        setPdfContent(fullText);
        
        // Split content into words and update state
        const wordArray = fullText.split(/\s+/).filter((word: string) => word.length > 0);
        setWords(wordArray);
        console.log('PDF processing completed. Found', wordArray.length, 'words');
      } catch (pdfError) {
        console.error('Error processing PDF:', pdfError);
        throw pdfError;
      }
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Failed to load PDF');
      throw error;
    } finally {
      // PDF loading completed
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        if (isPracticeMode && storyId) {
          // Practice mode: load story by ID
          const fullStory = await UnifiedStoryService.getInstance().getStoryById(storyId);
          if (!fullStory) throw new Error('Story not found');

          // Language
          if (fullStory.language) {
            const internalLanguage = fullStory.language === 'none' ? 'tagalog' : 'english';
            console.log('📖 Setting story language:', internalLanguage, '(from:', fullStory.language, ')');
            setStoryLanguage(internalLanguage);
          } else {
            console.log('📖 Setting default story language: english');
            setStoryLanguage('english');
          }

          // Text content primary
          if (fullStory.textContent && fullStory.textContent.trim().length > 0) {
            setStoryText(fullStory.textContent.trim());
            const wordArray = fullStory.textContent.trim().split(/\s+/).filter((w: string) => w.length > 0);
            console.log('📖 Setting words:', wordArray.length, 'words');
            setWords(wordArray);
          }

          // PDF fallback (best-effort)
          try {
            const pdfUrl = UnifiedStoryService.getInstance().getStoryPdfUrl(fullStory._id as string);
            await loadPdfContent(pdfUrl);
          } catch (pdfError) {
            setPdfError(pdfError instanceof Error ? pdfError.message : 'PDF loading failed');
          }
        } else if (sessionId) {
          // Original session flow
          const sessionData = await readingSessionService.getSessionById(sessionId);
          if (!sessionData) throw new Error('Session not found');
          setCurrentSession(sessionData);

          // Match story by id or title
          const stories = await UnifiedStoryService.getInstance().getStories({});
          const story = stories.find((s: Story) => s._id === sessionData.book || s.title === sessionData.book);
          if (!story || !story._id) throw new Error('Story not found');

          const fullStory = await UnifiedStoryService.getInstance().getStoryById(story._id);
          if (!fullStory) throw new Error('Failed to fetch story details');

          if (fullStory.language) {
            const internalLanguage = fullStory.language === 'none' ? 'tagalog' : 'english';
            console.log('📖 Setting story language:', internalLanguage, '(from:', fullStory.language, ')');
            setStoryLanguage(internalLanguage);
          } else {
            console.log('📖 Setting default story language: english');
            setStoryLanguage('english');
          }

          if (fullStory.textContent && fullStory.textContent.trim().length > 0) {
            setStoryText(fullStory.textContent.trim());
            const wordArray = fullStory.textContent.trim().split(/\s+/).filter((w: string) => w.length > 0);
            console.log('📖 Setting words:', wordArray.length, 'words');
            setWords(wordArray);
          }

          try {
            const pdfUrl = UnifiedStoryService.getInstance().getStoryPdfUrl(story._id);
            await loadPdfContent(pdfUrl);
          } catch (pdfError) {
            setPdfError(pdfError instanceof Error ? pdfError.message : 'PDF loading failed');
          }
        } else {
          setError('No session or story specified');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isPracticeMode, storyId, sessionId]);
  
  // Preload Vosk connection as soon as we have story data (even during loading)
  useEffect(() => {
    console.log('🔍 Preload useEffect triggered - words:', words.length, 'storyLanguage:', storyLanguage, 'isLoading:', isLoading);
    
    // Start preloading as soon as we have words and language (don't wait for loading to finish)
    if (words.length > 0 && storyLanguage) {
      console.log('📚 Story data available - preloading Vosk connection NOW (during loading)...');
      preloadVoskConnection();
    } else {
      console.log('⏳ Waiting for story data - words:', words.length, 'language:', storyLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.length, storyLanguage]);

  const handleGoBack = () => {
    navigate(-1);
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

  

  // State for real words (for matching/highlighting)
  const [realWords, setRealWords] = useState<string[]>([]);

  // When loading storyText/pdfContent, extract real words for matching
  useEffect(() => {
    let text = '';
    if (storyText && storyText.trim().length > 0) {
      text = storyText;
    } else if (pdfContent && pdfContent.trim().length > 0) {
      text = pdfContent;
    }
    if (text) {
      setRealWords(extractWordsFromText(text));
    } else {
      setRealWords([]);
    }
  }, [storyText, pdfContent]);

  // Update the useEffect that tracks transcript and currentWordIndex, using realWords for matching
  // Check if new words in transcript match the current highlighted word
  useEffect(() => {
    if (!transcript || !realWords.length) return;

    const transcriptWords = transcript.split(/\s+/).filter(Boolean);
    if (transcriptWords.length === 0) return;

    // Only process the FIRST word in transcript to prevent over-advancement
    const spokenWord = transcriptWords[0];
    const currentExpectedWord = realWords[currentWordIndex];
    
    console.log('Checking word:', spokenWord);
    console.log('Expected word:', currentExpectedWord);
    console.log('Current index:', currentWordIndex);
    
    if (!currentExpectedWord) {
      // Reached end of story - clear transcript
      setTranscript('');
      return;
    }

    if (isWordMatch(spokenWord, currentExpectedWord)) {
      // Match found! Move to next word
      setCurrentWordIndex((prev) => prev + 1);
      setWordsRead((prev) => prev + 1);
      console.log('✓ Match:', spokenWord, '=', currentExpectedWord);
      
      // Remove the matched word from transcript
      const remainingWords = transcriptWords.slice(1);
      setTranscript(remainingWords.join(' '));
    } else {
      // No match - check if it's a story word that's out of sequence
      // If it matches a word within the next 5 words, it might be reading ahead
      const lookAheadRange = 5;
      let foundAhead = false;
      
      for (let i = 1; i <= lookAheadRange && currentWordIndex + i < realWords.length; i++) {
        if (isWordMatch(spokenWord, realWords[currentWordIndex + i])) {
          console.log(`⚠️ Word "${spokenWord}" matches word ${i} positions ahead - possible reading ahead or omission`);
          foundAhead = true;
          break;
        }
      }
      
      if (!foundAhead) {
        // True miscue - word doesn't match current or nearby expected words
        setMiscues((prev) => prev + 1);
        setCurrentWordIndex((prev) => prev + 1);
        setWordsRead((prev) => prev + 1);
        console.log('✗ Miscue:', spokenWord, '≠', currentExpectedWord, '(counted and advancing)');
      }
      
      // Always remove the processed word from transcript
      const remainingWords = transcriptWords.slice(1);
      setTranscript(remainingWords.join(' '));
    }
  }, [transcript, realWords, currentWordIndex]);

  // Reset miscues at the start of each session
  useEffect(() => {
    setMiscues(0);
  }, [sessionId]);

  // Miscues are now tracked in the main word matching loop above

  const [studentNames, setStudentNames] = useState<{ [id: string]: string }>({});

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 flex flex-col items-center justify-center">
        <ParentLoader label={isPracticeMode ? 'Loading story…' : 'Loading session…'} fullScreen size="lg" />
        {voskStatus === 'connecting' && (
          <div className="mt-8 flex items-center gap-3 bg-white/80 px-6 py-3 rounded-full shadow-lg">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">Connecting to speech recognition...</span>
          </div>
        )}
        {voskStatus === 'connected' && (
          <div className="mt-8 flex items-center gap-3 bg-white/80 px-6 py-3 rounded-full shadow-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">Speech recognition ready!</span>
          </div>
        )}
      </div>
    );
  }

  if (!currentSession && !isPracticeMode) {
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
    setElapsedTime(0);
    setTranscript('');
    setPartialTranscript('');
    setRecognizedWords(new Set());
    setInsertedWordsAfter(new Map());
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
      // Update session status to completed
      await readingSessionService.updateSessionStatus(sessionId, 'completed');
      
      // Update local state
      setCurrentSession({
        ...currentSession,
        status: 'completed'
      });

      // Show SweetAlert2 success popup
      await Swal.fire({
        icon: 'success',
        title: 'Session Completed!',
        text: 'All data has been saved successfully.',
        confirmButtonText: 'OK',
      });
      
      // Optionally navigate back to sessions list
      // navigate('/teacher/reading');
      
    } catch (error) {
      console.error('Failed to complete session:', error);
      alert('Failed to complete session. Please try again.');
    }
  };

  // Download audio handler
  const handleDownloadAudio = () => {
    if (!audioBlob || !audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${currentSession?.title || 'audio-recording'}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 flex flex-col">
      {/* Title */}
      <header className="w-full px-4 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center px-3 py-2 text-base font-semibold text-blue-700 bg-white/80 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
              title="Back"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
            <div>
            <h1 className="text-3xl font-extrabold text-blue-900 mb-2">
              {isPracticeMode ? 'Practice Session' : (currentSession?.title || 'Reading Session')}
            </h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                  Updated {formatDateHuman(new Date())}
                </span>
              </div>
            </div>
          </div>
          {!isPracticeMode && currentSession && (
            <span className={`ml-4 px-4 py-2 rounded-full text-base font-semibold transition-all duration-200
              ${currentSession.status === 'completed' ? 'bg-green-100 text-green-700' :
                currentSession.status === 'in-progress' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                'bg-yellow-100 text-yellow-700'}`}
            >
              {currentSession.status.charAt(0).toUpperCase() + currentSession.status.slice(1)}
            </span>
          )}
        </div>
      </header>

      {/* Display last recognized word */}
      {isRecording && (
        <div className="w-full flex justify-center mb-4">
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-6 py-3 flex items-center gap-3 text-lg">
            <span className="font-semibold text-yellow-800">Mic heard:</span>
            <span className="font-mono text-yellow-900 text-xl font-bold">
              {(() => {
                // Show partial transcript (real-time) if available, otherwise show last final word
                const partial = partialTranscript.trim().split(/\s+/).filter(Boolean).slice(-1)[0];
                const final = transcript.trim().split(/\s+/).filter(Boolean).slice(-1)[0];
                return partial || final || '-';
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Story Content + Progress Side by Side */}
      <section className="w-full px-4 sm:px-8 mb-6 flex flex-col lg:flex-row gap-8">
        {/* Story Content */}
        <div className="flex-1">
          <div className="relative bg-white/80 rounded-3xl shadow-xl border border-blue-100 p-10 overflow-hidden max-h-[48rem]">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-t-3xl animate-pulse" style={{ width: `${Math.min((currentWordIndex / words.length) * 100, 100)}%` }}></div>
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                <BookOpenIcon className="h-7 w-7 text-blue-500" /> Story
              </h3>
              <div className="flex items-center gap-6 text-lg text-blue-700">
                <span>{words.length} words</span>
                <span>•</span>
                <span>{storyText ? storyText.split('\n\n').length : pdfContent.split('\n\n').length} paragraphs</span>
              </div>
            </div>
            <div className="max-h-[38rem] overflow-y-auto custom-scrollbar prose prose-xl prose-blue bg-white/60 rounded-xl p-8 shadow-inner text-[1.35rem] leading-relaxed tracking-wide">
              {(storyText || pdfContent) ? (
                (storyText ? storyText : pdfContent).split('\n\n').filter(p => p.trim().length > 0).map((paragraph, paragraphIndex, paragraphs) => {
                  const wordsInParagraph = paragraph.trim().split(/\s+/);
                  
                  return (
                    <div key={paragraphIndex} className="mb-8 last:mb-0">
                      <p className="text-gray-800 leading-relaxed flex flex-wrap gap-y-3">
                        {wordsInParagraph.map((word, wordIndex) => {
                          // Count only real words (alphanumeric) up to this point
                          const realWordIndex = wordsInParagraph
                            .slice(0, wordIndex)
                            .filter(w => /\w+/.test(w))
                            .length + 
                            paragraphs
                              .slice(0, paragraphIndex)
                              .reduce((acc, p) => acc + p.trim().split(/\s+/).filter(w => /\w+/.test(w)).length, 0);
                          
                          const isSpecialChar = !/\w+/.test(word);
                          const isCurrentWord = !isSpecialChar && realWordIndex === currentWordIndex;
                          const isRecognized = recognizedWords.has(realWordIndex);
                          const insertionsAfter = insertedWordsAfter.get(realWordIndex) || [];
                          
                          return (
                            <React.Fragment key={`${paragraphIndex}-${wordIndex}`}>
                              {/* Story word */}
                              <span
                                className={
                                  isSpecialChar
                                    ? 'inline-block mr-3 mb-2 px-3 py-2 rounded font-serif text-2xl text-gray-400 bg-transparent pointer-events-none select-none not-allowed'
                                    : `inline-block mr-3 mb-2 px-3 py-2 rounded font-serif text-2xl transition-all duration-200 ` +
                                      (isCurrentWord
                                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow-lg scale-110 animate-pulse'
                                        : isRecognized
                                        ? 'bg-green-100 text-green-900 border-2 border-green-300'
                                        : 'bg-blue-50 text-blue-900 hover:bg-blue-100 hover:text-blue-700 cursor-pointer')
                                }
                                style={isCurrentWord ? { boxShadow: '0 0 12px 2px #a5b4fc' } : {}}
                              >
                                {word}
                              </span>
                              
                              {/* Inserted words that come AFTER this word */}
                              {insertionsAfter.map((insertedWord, idx) => (
                                <span
                                  key={`insertion-${paragraphIndex}-${wordIndex}-${idx}`}
                                  className="inline-block mr-3 mb-2 px-3 py-2 rounded font-serif text-2xl transition-all duration-200 bg-cyan-100 text-cyan-900 border-2 border-cyan-400"
                                  title={`Inserted word: "${insertedWord}" (not in story)`}
                                >
                                  {insertedWord}
                                </span>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 py-12">No story content available</div>
              )}
            </div>
            {(pdfError || error) && !storyText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-3xl shadow-xl z-10">
                <XCircleIcon className="h-16 w-16 text-red-400 mb-4" />
                <div className="text-lg text-red-600 mb-4">{pdfError || error}</div>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Progress Column */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="flex flex-col gap-4">
            {!isPracticeMode && (
              <div className="rounded-xl bg-blue-100 shadow p-4 flex flex-col items-center">
                <span className="text-blue-700 font-bold text-lg mb-1 flex items-center gap-2"><UserGroupIcon className="h-5 w-5 text-blue-500" />Students</span>
                <div className="flex flex-wrap gap-1 justify-center">
                  {currentSession?.students.map((student, idx: number) => {
                    // Handle both old format (string) and new format ({id, name})
                    const studentName = typeof student === 'string'
                      ? (studentNames[student] || student)
                      : student.name;

                    return (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800 shadow-sm">
                        {studentName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Words Read */}
            <div className="rounded-xl bg-blue-100 shadow p-4 flex flex-col items-center">
              <span className="text-blue-700 font-bold text-lg">Words Read</span>
              <span className="text-2xl font-extrabold text-blue-700 mt-1">{wordsRead}</span>
            </div>
            {/* Miscues */}
            <div className="rounded-xl bg-red-100 shadow p-2 sm:p-3 md:p-4 flex flex-row md:flex-col items-center justify-between text-xs sm:text-sm md:text-base mb-1">
              <span className="text-red-700 font-bold">Miscues</span>
              <span className="text-xl font-extrabold text-red-700">{miscues}</span>
            </div>
            {/* Oral Reading Score */}
            <div className="rounded-xl bg-yellow-100 shadow p-2 sm:p-3 md:p-4 flex flex-row md:flex-col items-center justify-between text-xs sm:text-sm md:text-base mb-1">
              <span className="text-yellow-700 font-bold">Oral Reading Score</span>
              <span className="text-xl font-extrabold text-yellow-700">{oralReadingScore}%</span>
            </div>
            {/* Reading Speed */}
            <div className="rounded-xl bg-green-100 shadow p-2 sm:p-3 md:p-4 flex flex-row md:flex-col items-center justify-between text-xs sm:text-sm md:text-base mb-1">
              <span className="text-green-700 font-bold">Reading Speed</span>
              <span className="text-xl font-extrabold text-green-700">{readingSpeedWPM} WPM</span>
            </div>
            {/* Elapsed */}
            <div className="rounded-xl bg-yellow-100 shadow p-4 flex flex-col items-center">
              <span className="text-yellow-700 font-bold text-lg">Elapsed</span>
              <span className="text-2xl font-extrabold text-yellow-700 mt-1">{formatElapsedTime(elapsedTime)}</span>
            </div>
            {!isPracticeMode && (
              <div className="rounded-xl bg-indigo-100 shadow p-4 flex flex-col items-center">
                <span className="text-indigo-700 font-bold text-lg">Book</span>
                <span className="text-lg font-semibold text-indigo-700 mt-1">{currentSession?.book}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Session Controls */}
      <section className="w-full px-4 sm:px-8 pb-8">
        <div className="bg-white/80 rounded-3xl shadow-xl border border-blue-100 p-8 flex flex-col items-center gap-6">
          {/* Language display with status indicator */}
          <div className="w-full flex justify-between items-center gap-2 -mt-4 -mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-900">Story Language:</span>
              <span className="text-sm px-2 py-1 text-blue-900 font-medium">Tagalog</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Status indicator dot only - no text */}
              {(storyLanguage === 'tagalog' || storyLanguage === 'english') && (
                <span className={`w-3 h-3 rounded-full ${voskStatus === 'connected' ? 'bg-green-500' : voskStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <MicrophoneIcon className="h-7 w-7 text-blue-500" />
            <h4 className="text-lg font-bold text-blue-900">Controls</h4>
          </div>
          <div className="flex flex-row flex-wrap justify-center gap-6 w-full">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-bold shadow-lg hover:scale-105 hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                title="Start"
              >
                <MicrophoneIcon className="h-7 w-7" /> Start
              </button>
            ) : (
              <button
                onClick={handleDownloadAudio}
                disabled={!audioUrl}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-green-400 to-blue-400 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download audio recording"
              >
                <svg xmlns='http://www.w3.org/2000/svg' className='h-7 w-7' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4' /></svg>
                Download Audio
              </button>
            )}
            {!isPracticeMode && currentSession?.status === 'in-progress' && hasStarted && (
              <button
                onClick={handleCompleteSession}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200"
                title="Complete"
              >
                <ChartBarIcon className="h-7 w-7" /> Complete
              </button>
            )}
            {isRecording && (
              <button
                onClick={handleRetrySession}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200"
                title="Retry"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            )}
          </div>
        </div>
      </section>

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
              {/* Countdown Number */}
              <span className="text-[180px] sm:text-[220px] font-black text-white drop-shadow-2xl animate-pulse leading-none">
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
    </div>
  );
};

export default ReadingSessionPage;
