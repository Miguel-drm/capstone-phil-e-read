import React, {useEffect, useState, useRef, useMemo} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { readingSessionService, type ReadingSession } from '@/services/readingSessionService';
import { resultService } from '@/services/resultsService';
import { UnifiedStoryService } from '@/services/UnifiedStoryService';
import type { Story } from '@/types/Story';
import { ArrowLeftIcon, XCircleIcon, BookOpenIcon, UserGroupIcon, ChartBarIcon, MicrophoneIcon, PlayIcon, PauseIcon, StopIcon } from '@heroicons/react/24/outline';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import 'pdfjs-dist/build/pdf.worker.entry';
import {
  calculateOralReadingScore,
  calculateReadingSpeedWPM,
  calculateMiscues,
  calculateWordsRead,
  formatElapsedTime
} from '@/utils/readingMetrics';
import { studentService, type Student } from '@/services/studentService';
import Swal from 'sweetalert2';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ReadingSessionPage: React.FC = () => {
  const [storyText, setStoryText] = useState<string>('');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [words, setWords] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pdfContent, setPdfContent] = useState<string>('');
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

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
  const [sttProvider, setSttProvider] = useState<'vosk' | 'webspeech' | 'none'>('none');
  const [voskStatus, setVoskStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [wordsRead, setWordsRead] = useState(0);
  const [storyLanguage, setStoryLanguage] = useState<'english' | 'tagalog'>('english');
  const [readingSpeed, setReadingSpeed] = useState(0); // WPM
  const [accuracy, setAccuracy] = useState(0); // %

  // Add debug state
  const [debugSpokenWords, setDebugSpokenWords] = useState<string[]>([]);
  const [debugStoryWords, setDebugStoryWords] = useState<string[]>([]);
  const [debugStoryText, setDebugStoryText] = useState('');

  // Add miscues state
  const [miscues, setMiscues] = useState(0);

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

  // Real-time Reading Speed (WPM)
  const readingSpeedWPM = elapsedTime > 0 ? calculateReadingSpeedWPM(wordsRead, elapsedTime).toString() : '0';

  // Helper: Normalize text for comparison (lowercase, remove all non-word characters)
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();

  // Helper: Check if a word contains any alphanumeric character
  const isWordAlphanumeric = (word: string) => /[a-zA-Z0-9]/.test(word);

  // Helper: Extract all readable words (alphanumeric only) from text, skipping punctuation/symbols
  function extractWordsFromText(text: string): string[] {
    // This regex matches words with at least one alphanumeric character
    return text.match(/\b\w+\b/g) || [];
  }

  // Helper: Simple Soundex implementation (for browser, no deps)
  function soundex(s: string): string {
    const a = s.toLowerCase().replace(/[^a-z]/g, '').split('');
    if (!a.length) return '';
    const f = a.shift()!;
    const codes: { [key: string]: string } = {
      a: '', e: '', i: '', o: '', u: '', y: '', h: '', w: '',
      b: '1', f: '1', p: '1', v: '1',
      c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
      d: '3', t: '3',
      l: '4',
      m: '5', n: '5',
      r: '6'
    };
    let r = f + a.map(c => codes[c] || '').join('');
    r = r.replace(/(\d)\1+/g, '$1');
    r = r.replace(/[^a-z\d]/g, '');
    return (r + '000').slice(0, 4);
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
   * Returns true if spokenWord and expectedWord are phonetically similar (Soundex) or have Levenshtein distance <= 1.
   * For production, consider using 'natural' or 'double-metaphone' npm packages.
   */
  function isWordMatch(spokenWord: string, expectedWord: string): boolean {
    const normSpoken = normalize(spokenWord);
    const normExpected = normalize(expectedWord);
    if (!normSpoken || !normExpected) return false;
    // Phonetic match
    if (soundex(normSpoken) === soundex(normExpected)) return true;
    // Fuzzy match
    if (levenshtein(normSpoken, normExpected) <= 1) return true;
    return false;
  }

  // Helper: Split text into display words and normalized words, and mark if each is alphanumeric
  const splitAndNormalizeWords = (text: string) => {
    const displayWords = text.split(/\s+/).filter(Boolean);
    const normalizedWords = displayWords.map(normalize);
    const isAlphanumeric = displayWords.map(isWordAlphanumeric);
    return { displayWords, normalizedWords, isAlphanumeric };
  };

  // Start recording and speech recognition
  const handleStartRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
    setTranscript('');
    setWordsRead(0);
    setReadingSpeed(0);
    setAccuracy(0);
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
      }).catch(err => {
        alert('Microphone access denied or not available.');
        setIsRecording(false);
      });
    } else {
      alert('MediaRecorder not supported in this browser.');
      setIsRecording(false);
    }

    // Choose STT path: Vosk (WS) for Tagalog if enabled, else Web Speech
    // Force-try Vosk whenever the story is Tagalog; fallback to Web Speech if Vosk WS fails
    const useVosk = storyLanguage === 'tagalog';
    if (useVosk) {
      try {
        const wsUrl = (import.meta as any)?.env?.VITE_VOSK_WS_URL || 'ws://localhost:2700';
        const startVosk = async () => {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 48000 } });
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
          audioContextRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          sourceNodeRef.current = src;
          const script = ctx.createScriptProcessor(4096, 1, 1);
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

          setVoskStatus('connecting');
          const ws = new WebSocket(wsUrl);
          voskSocketRef.current = ws;
          ws.binaryType = 'arraybuffer';
          ws.onopen = () => {
            setVoskStatus('connected');
            setSttProvider('vosk');
            script.onaudioprocess = (e: AudioProcessingEvent) => {
              const channel = e.inputBuffer.getChannelData(0);
              const pcm16 = downsampleTo16k(channel);
              if (ws.readyState === WebSocket.OPEN) ws.send(pcm16);
            };
            src.connect(script);
            script.connect(ctx.destination);
          };
          ws.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data);
              if (msg.text || msg.partial) {
                const text = msg.text || msg.partial;
                setTranscript(text);
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
            setTranscript(runningTranscript + interim);
          };
          recognition.onerror = (_e: any) => {};
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
    } else {
      // Web Speech path (default)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
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
          setTranscript(runningTranscript + interim);
        };
        recognition.onerror = (_e: any) => {};
        recognition.start();
      } else {
        alert('SpeechRecognition not supported in this browser.');
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

  // Wait for MediaRecorder to finalize audio (audioBlob/audioUrl set) with timeout
  const waitForAudioFinalization = async (timeoutMs: number = 2000): Promise<void> => {
    if (!isRecording && (audioBlob || audioUrl)) return;
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const done = (!!audioBlob || !!audioUrl) || Date.now() - start > timeoutMs;
        if (done) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  // Pause/Resume speech recognition (optional)
  const handlePauseRecording = () => {
    setIsPaused(true);
    if (recognitionRef.current) recognitionRef.current.abort();
    if (mediaRecorderRef.current) mediaRecorderRef.current.pause();
  };
  const handleResumeRecording = () => {
    setIsPaused(false);
    if (mediaRecorderRef.current) mediaRecorderRef.current.resume();
    if (recognitionRef.current) recognitionRef.current.start();
  };

  // Update reading speed as time passes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setElapsedTime((prev: number) => {
          const next = prev + 1;
          setReadingSpeed(next > 0 ? Math.round((wordsRead / (next / 60))) : 0);
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused, wordsRead]);

  const loadPdfContent = async (pdfUrl: string) => {
    try {
      setIsLoadingPdf(true);
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
      setIsLoadingPdf(false);
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        console.error('No session ID provided');
        setError('No session ID provided');
        return;
      }

      try {
        setIsLoading(true);
        console.log('Fetching session with ID:', sessionId);

        const sessionData = await readingSessionService.getSessionById(sessionId);
        console.log('Session data:', sessionData);

        if (!sessionData) {
          throw new Error('Session not found');
        }

        setCurrentSession(sessionData);

        // Get all stories firsts
        const stories = await UnifiedStoryService.getInstance().getStories({});
        console.log('All stories:', stories);

        // Extract story by _id or title for compatibility
        const story = stories.find((s: Story) => s._id === sessionData.book || s.title === sessionData.book);

        if (!story || !story._id) {
          throw new Error('Story not found');
        }

        console.log('Found matching story:', story);

        try {
          // Get the full story details
          const fullStory = await UnifiedStoryService.getInstance().getStoryById(story._id);
          
          if (!fullStory) {
            throw new Error('Failed to fetch story details');
          }

          console.log('Full story details:', {
            id: fullStory._id,
            title: fullStory.title,
            language: fullStory.language,
            hasTextContent: !!fullStory.textContent,
            textContentLength: fullStory.textContent?.length,
            textContentPreview: fullStory.textContent?.substring(0, 100)
          });

          // Set story language for speech recognition
          if (fullStory.language) {
            // Convert MongoDB language codes back to our internal format
            const internalLanguage = fullStory.language === 'none' ? 'tagalog' : 'english';
            setStoryLanguage(internalLanguage);
            console.log('Story language set to:', internalLanguage, '(from MongoDB code:', fullStory.language, ')');
          } else {
            // Default to English if no language is specified
            setStoryLanguage('english');
            console.log('No language specified, defaulting to English');
          }

          // Set text content first (this is what we want to display)
          if (fullStory.textContent && fullStory.textContent.trim().length > 0) {
            setStoryText(fullStory.textContent.trim());
            const wordArray = fullStory.textContent.trim().split(/\s+/).filter((word: string) => word.length > 0);
            setWords(wordArray);
            console.log('Text content loaded. Found', wordArray.length, 'words');
          }

          // Try to load PDF content as a backup (but don't fail if it doesn't work)
          try {
            const pdfUrl = UnifiedStoryService.getInstance().getStoryPdfUrl(story._id);
            await loadPdfContent(pdfUrl);
            console.log('PDF content also loaded successfully');
          } catch (pdfError) {
            console.warn('PDF loading failed, but text content is available:', pdfError);
            // Don't throw error here since we have text content
            // Set a flag to indicate PDF failed
            setPdfError(pdfError instanceof Error ? pdfError.message : 'PDF loading failed');
          }

        } catch (error) {
          console.error('Error fetching story content:', error);
          if (error instanceof Error) {
            throw new Error(`Failed to load story content: ${error.message}`);
          } else {
            throw new Error('Failed to load story content: Unknown error');
          }
        }
      } catch (error: any) {
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          stack: error.stack,
          response: error.response?.data
        });
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const renderStoryContent = () => {
    if (isLoadingPdf || isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      );
    }

    // Show text content if available (this is the primary content we want to display)
    if (storyText && storyText.trim().length > 0) {
      // Split text into paragraphs and process each word
      const paragraphs = storyText.split('\n\n').filter(p => p.trim().length > 0);
      
      return (
        <div className="story-container bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Story Content</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center">
                  <BookOpenIcon className="h-4 w-4 mr-1" />
                  {words.length} words
                </span>
                <span>•</span>
                <span>{paragraphs.length} paragraphs</span>
              </div>
            </div>
            <div className="relative">
              <div className="max-h-96 overflow-y-auto pr-4 custom-scrollbar">
                <div className="prose prose-lg max-w-none">
                  <div className="space-y-6">
                    {paragraphs.map((paragraph, paragraphIndex) => {
                      const wordsInParagraph = paragraph.trim().split(/\s+/);
                      return (
                        <div key={paragraphIndex} className="mb-6 last:mb-0">
                          <p className="text-gray-800 leading-relaxed flex flex-wrap gap-y-2">
                            {wordsInParagraph.map((word, wordIndex) => {
                              // Calculate the global word index for highlighting
                              const globalWordIndex = paragraphs
                                .slice(0, paragraphIndex)
                                .reduce((acc, p) => acc + p.trim().split(/\s+/).length, 0) + wordIndex;
                              const isCurrentWord = currentWordIndex === globalWordIndex;
                              return (
                                <span
                                  key={`${paragraphIndex}-${wordIndex}`}
                                  className={
                                    `inline-block mr-2 mb-1 px-2 py-1 rounded font-serif text-base transition-all duration-150 ` +
                                    (isCurrentWord
                                      ? 'bg-blue-600 text-white font-bold shadow-md scale-105'
                                      : 'bg-gray-100 text-gray-900 hover:bg-blue-100 hover:text-blue-700 cursor-pointer')
                                  }
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Scroll indicator */}
              <div className="absolute right-2 top-0 bottom-0 w-1 bg-gray-200 rounded-full">
                <div className="w-1 bg-blue-500 rounded-full transition-all duration-300" 
                     style={{ height: '20%' }}></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show PDF content if available and no text content
    if (pdfContent && pdfContent.trim().length > 0) {
      const paragraphs = pdfContent.split('\n\n').filter(p => p.trim().length > 0);
      
      return (
        <div className="story-container bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Story Content</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{words.length} words</span>
              </div>
            </div>
            <div className="relative">
              <div className="max-h-96 overflow-y-auto pr-4 custom-scrollbar">
                <div className="prose prose-lg max-w-none">
                  <div className="space-y-6">
                    {paragraphs.map((paragraph, paragraphIndex) => {
                      const wordsInParagraph = paragraph.trim().split(/\s+/);
                      return (
                        <div key={paragraphIndex} className="mb-6 last:mb-0">
                          <p className="text-gray-800 leading-relaxed flex flex-wrap gap-y-2">
                            {wordsInParagraph.map((word, wordIndex) => {
                              const globalWordIndex = paragraphs
                                .slice(0, paragraphIndex)
                                .reduce((acc, p) => acc + p.trim().split(/\s+/).length, 0) + wordIndex;
                              const isCurrentWord = currentWordIndex === globalWordIndex;
                              return (
                                <span
                                  key={`${paragraphIndex}-${wordIndex}`}
                                  className={
                                    `inline-block mr-2 mb-1 px-2 py-1 rounded font-serif text-base transition-all duration-150 ` +
                                    (isCurrentWord
                                      ? 'bg-blue-600 text-white font-bold shadow-md scale-105'
                                      : 'bg-gray-100 text-gray-900 hover:bg-blue-100 hover:text-blue-700 cursor-pointer')
                                  }
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show error if no content is available
    if ((pdfError || error) && !storyText) {
      // Only show error if there is no text content fallback
      return (
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-600 mb-4">{pdfError || error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      );
    }

    // No content available
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No story content available</p>
      </div>
    );
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

  const [isAlphanumericArr, setIsAlphanumericArr] = useState<boolean[]>([]);
  useEffect(() => {
    if (storyText && storyText.trim().length > 0) {
      setDebugStoryText(storyText);
      const { displayWords, normalizedWords, isAlphanumeric } = splitAndNormalizeWords(storyText);
      setWords(displayWords);
      setDebugStoryWords(normalizedWords);
      setIsAlphanumericArr(isAlphanumeric);
      console.log('DEBUG: Loaded storyText:', storyText);
    } else if (pdfContent && pdfContent.trim().length > 0) {
      setDebugStoryText(pdfContent);
      const { displayWords, normalizedWords, isAlphanumeric } = splitAndNormalizeWords(pdfContent);
      setWords(displayWords);
      setDebugStoryWords(normalizedWords);
      setIsAlphanumericArr(isAlphanumeric);
      console.log('DEBUG: Loaded pdfContent:', pdfContent);
    } else {
      setDebugStoryText('');
      setDebugStoryWords([]);
      setIsAlphanumericArr([]);
      console.warn('DEBUG: No storyText or pdfContent loaded');
    }
  }, [storyText, pdfContent]);

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
  useEffect(() => {
    if (!transcript || !realWords.length) return;
    const transcriptWords = transcript.split(/\s+/).filter(Boolean);
    const idx = calculateWordsRead(transcriptWords, realWords, isWordMatch);
    console.log('Transcript:', transcriptWords);
    console.log('Real words:', realWords);
    console.log('Words read:', idx);
    setCurrentWordIndex(idx);
    setWordsRead(idx);
  }, [transcript, realWords]);

  // Reset miscues at the start of each session
  useEffect(() => {
    setMiscues(0);
  }, [sessionId]);

  // Update miscues calculation to use realWords and isWordMatch
  useEffect(() => {
    if (!transcript || !realWords.length) return;
    const transcriptWords = transcript.split(/\s+/).filter(Boolean);
    const miscuesCount = calculateMiscues(transcriptWords, realWords, isWordMatch);
    console.log('Miscues:', miscuesCount);
    setMiscues(miscuesCount);
  }, [transcript, realWords]);

  const [studentNames, setStudentNames] = useState<{ [id: string]: string }>({});
  const [completedStudents, setCompletedStudents] = useState<{ [id: string]: boolean }>({});

  // Fetch student names when currentSession changes
  useEffect(() => {
    const fetchNames = async () => {
      if (!currentSession?.students) return;
      const names: { [id: string]: string } = {};
      await Promise.all(
        currentSession.students.map(async (id) => {
          try {
            const student = await studentService.getStudent(id);
            if (student && student.name) {
              names[id] = student.name;
            }
          } catch (e) {
            // ignore error, fallback to ID
          }
        })
      );
      setStudentNames(names);
    };
    fetchNames();
  }, [currentSession]);

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

  const handleCompleteSession = async () => {
    if (!sessionId || !currentSession) return;

    try {
      // If recording is active, stop and wait for audio to finalize
      if (isRecording) {
        await handleStopRecording();
        await waitForAudioFinalization(2500);
      }

      // Update session status to completed
      await readingSessionService.updateSessionStatus(sessionId, 'completed');
      
      // Save detailed results to the new results collection
      for (const studentId of currentSession.students) {
        const readingSessionResult = {
          sessionId: sessionId,
          sessionTitle: currentSession.title,
          book: currentSession.book,
          gradeId: currentSession.gradeId,
          studentId, // <-- Add this field
          teacherId: currentSession.teacherId,
          type: 'reading-session' as const,
          
          // Reading metrics
          wordsRead: wordsRead,
          totalWords: words.length,
          miscues: miscues,
          oralReadingScore: parseFloat(oralReadingScore),
          readingSpeed: parseInt(readingSpeedWPM),
          elapsedTime: elapsedTime,
          
          // Additional data
          transcript: transcript,
          audioUrl: audioUrl || undefined,
          storyUrl: currentSession.storyUrl,
          
          // Timestamps
          sessionDate: new Date()
        };
        await resultService.createReadingSessionResult(readingSessionResult);
        setCompletedStudents(prev => ({ ...prev, [studentId]: true }));
      }
      
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

  function formatTime(elapsedTime: number): string {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // In the rendering, highlight only if the display word is the current real word
  // To do this, map realWords to their positions in the display words array
  // We'll build a mapping from real word index to display word index
  function getDisplayWordIndexForRealWord(realWordIdx: number, displayWords: string[]): number {
    let count = 0;
    for (let i = 0; i < displayWords.length; i++) {
      if (/\w+/.test(displayWords[i])) {
        if (count === realWordIdx) return i;
        count++;
      }
    }
    return -1;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 flex flex-col">
      {/* Title */}
      <header className="w-full px-4 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center px-3 py-2 text-base font-semibold text-blue-700 bg-white/80 border border-blue-200 rounded-lg shadow hover:bg-blue-50 transition"
              title="Back"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
            <h1 className="text-3xl font-extrabold text-blue-900 drop-shadow-sm mb-2">
              {currentSession?.title || 'Reading Session'}
            </h1>
          </div>
          {currentSession && (
            <span className={`ml-4 px-4 py-2 rounded-full text-base font-semibold shadow transition-all duration-200
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
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-6 py-3 flex items-center gap-3 shadow text-lg">
            <span className="font-semibold text-yellow-800">Mic heard:</span>
            <span className="font-mono text-yellow-900 text-xl font-bold">{transcript.trim().split(/\s+/).filter(Boolean).slice(-1)[0] || '-'}</span>
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
                <BookOpenIcon className="h-7 w-7 text-blue-500" /> Story Content
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
                          const globalWordIndex = paragraphs
                            .slice(0, paragraphIndex)
                            .reduce((acc, p) => acc + p.trim().split(/\s+/).length, 0) + wordIndex;
                          const isCurrentWord = getDisplayWordIndexForRealWord(currentWordIndex, wordsInParagraph) === globalWordIndex;
                          const isSpecialChar = !/\w+/.test(word);
                          return (
                            <span
                              key={`${paragraphIndex}-${wordIndex}`}
                              className={
                                isSpecialChar
                                  ? 'inline-block mr-3 mb-2 px-3 py-2 rounded font-serif text-2xl text-gray-400 bg-transparent pointer-events-none select-none not-allowed'
                                  : `inline-block mr-3 mb-2 px-3 py-2 rounded font-serif text-2xl transition-all duration-200 ` +
                                    (isCurrentWord
                                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow-lg scale-110 animate-pulse'
                                      : 'bg-blue-50 text-blue-900 hover:bg-blue-100 hover:text-blue-700 cursor-pointer')
                              }
                              style={isCurrentWord ? { boxShadow: '0 0 12px 2px #a5b4fc' } : {}}
                            >
                              {word}
                            </span>
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
            {/* Students */}
            <div className="rounded-xl bg-blue-100 shadow p-4 flex flex-col items-center">
              <span className="text-blue-700 font-bold text-lg mb-1 flex items-center gap-2"><UserGroupIcon className="h-5 w-5 text-blue-500" />Students</span>
              <div className="flex flex-wrap gap-2 justify-center">
                {currentSession?.students.map((student: string, idx: number) => (
                  <span key={idx} className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800 shadow-sm">
                    {studentNames[student] || student}
                    {completedStudents[student] && (
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-[10px] font-semibold">
                        Completed
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
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
            {/* Book */}
            <div className="rounded-xl bg-indigo-100 shadow p-4 flex flex-col items-center">
              <span className="text-indigo-700 font-bold text-lg">Book</span>
              <span className="text-lg font-semibold text-indigo-700 mt-1">{currentSession?.book}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Session Controls */}
      <section className="w-full px-4 sm:px-8 pb-8">
        <div className="bg-white/80 rounded-3xl shadow-xl border border-blue-100 p-8 flex flex-col items-center gap-6">
          {/* Language selector + STT Provider/Vosk status badge */}
          <div className="w-full flex justify-between items-center gap-2 -mt-4 -mb-2">
            <div className="flex items-center gap-2">
              <label htmlFor="recognition-language" className="text-sm font-semibold text-blue-900">Recognition language</label>
              <select
                id="recognition-language"
                value={storyLanguage}
                onChange={(e) => setStoryLanguage(e.target.value as 'english' | 'tagalog')}
                className="text-sm px-2 py-1 rounded-md border border-blue-200 bg-white text-blue-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="english">English</option>
                <option value="tagalog">Tagalog</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {/* Always show Vosk status for Tagalog stories */}
              {storyLanguage === 'tagalog' && (
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${voskStatus === 'connected' ? 'bg-green-100 text-green-800' : voskStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                  <span className={`w-2 h-2 rounded-full ${voskStatus === 'connected' ? 'bg-green-500' : voskStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                  {voskStatus === 'connected' ? 'Vosk (Tagalog) connected' : voskStatus === 'connecting' ? 'Vosk (Tagalog) connecting…' : 'Vosk (Tagalog) disconnected'}
                </span>
              )}
              {/* If we fell back, show a small fallback label */}
              {storyLanguage === 'tagalog' && sttProvider === 'webspeech' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Fallback: Web Speech
                </span>
              )}
              {/* For English */}
              {storyLanguage !== 'tagalog' && sttProvider === 'webspeech' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Web Speech
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <MicrophoneIcon className="h-7 w-7 text-blue-500" />
            <h4 className="text-lg font-bold text-blue-900">Session Controls</h4>
          </div>
          <div className="flex flex-row flex-wrap justify-center gap-6 w-full">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-bold shadow-lg hover:scale-105 hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                title="Start Session"
              >
                <MicrophoneIcon className="h-7 w-7" /> Start
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={handleResumeRecording}
                    className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-green-400 to-blue-400 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200"
                    title="Resume Recording"
                  >
                    <PlayIcon className="h-7 w-7" /> Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePauseRecording}
                    className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200"
                    title="Pause Recording"
                  >
                    <PauseIcon className="h-7 w-7" /> Pause
                  </button>
                )}
                <button
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200"
                  title="Stop Recording"
                >
                  <StopIcon className="h-7 w-7" /> Stop
                </button>
              </>
            )}
            {currentSession?.status === 'in-progress' && (
              <button
                onClick={handleCompleteSession}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200"
                title="Complete Session"
              >
                <ChartBarIcon className="h-7 w-7" /> Complete Session
              </button>
            )}
          </div>
          {/* Download Audio Button (show only if audioUrl exists) */}
          {audioUrl && (
            <button
              onClick={handleDownloadAudio}
              className="mt-6 flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-green-400 to-blue-400 text-white text-lg font-bold shadow-lg hover:scale-105 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
              title="Download audio recording"
            >
              <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4' /></svg>
              Download Audio
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default ReadingSessionPage;

