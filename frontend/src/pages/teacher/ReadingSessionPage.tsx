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
  ChartBarIcon,
  MicrophoneIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
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
import { doubleMetaphone } from "double-metaphone";
import { isrResultService } from "@/services/ISRresultService";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile } from "@/services/authService";

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

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [words, setWords] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pdfContent, setPdfContent] = useState<string>("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false); // used in PDF fetch display logic
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Audio recording state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Audio and speech recognition refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voskSocketRef = useRef<WebSocket | null>(null);
  const voskReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voskReconnectAttemptsRef = useRef<number>(0);
  const voskFinalTranscriptRef = useRef<string>(""); // Accumulate final results
  const voskConnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voskHeartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [transcript, setTranscript] = useState("");
  const [voskStatus, setVoskStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [wordsRead, setWordsRead] = useState(0);
  const [storyLanguage, setStoryLanguage] = useState<"english" | "tagalog">(
    "english"
  );
  const [storyVocabulary, setStoryVocabulary] = useState<Set<string>>(new Set());
  const [isDetectingSpeech, setIsDetectingSpeech] = useState(false); // Visual indicator for when speech is detected
  const audioCooldownRef = useRef<boolean>(false); // Block audio sending during cooldown period
  const [storyPronunciationMap, setStoryPronunciationMap] = useState<{ [key: string]: string[] }>({});

  // Track which words have been correctly recognized (for green highlighting)
  const [recognizedWords, setRecognizedWords] = useState<Set<number>>(new Set());

  // Refs for auto-scrolling to current word
  const currentWordRef = useRef<HTMLSpanElement>(null);
  const storyContentRef = useRef<HTMLDivElement>(null);
  // Derived metrics are calculated from elapsed time and transcript

  // ============================================================================
  // TAGALOG PRONUNCIATION DICTIONARY - Comprehensive Categories
  // ============================================================================

  const TAGALOG_PRONUNCIATION_DICTIONARY: { [key: string]: string[] } = {
    // Pronouns and particles
    'ako': ['aku', 'ako'], 'ikaw': ['ikao', 'ka', 'ikaw'], 'siya': ['sya', 'siya'],
    'kami': ['kame', 'kami'], 'tayo': ['tayu', 'tayo'], 'kayo': ['kayu', 'kayo'],
    'sila': ['sela', 'sila'], 'ko': ['ku', 'ko'], 'mo': ['mu', 'mo'],
    'niya': ['nya', 'niya'], 'namin': ['namen', 'namin'], 'natin': ['naten', 'natin'],
    'ninyo': ['ninyu', 'ninyo'], 'nila': ['nela', 'nila'],
    'ang': ['an', 'ang'], 'ng': ['nang', 'ng'], 'sa': ['sang', 'sa'],
    'mga': ['manga', 'mga'], 'ay': ['ai', 'ay'], 'na': ['nang', 'na'],
    'pa': ['pang', 'pa'], 'ba': ['bang', 'ba'], 'po': ['pu', 'po'], 'opo': ['opu', 'opo'],

    // People and Family
    'tao': ['tau', 'tawo', 'tao'], 'bata': ['bat', 'batang', 'bata'],
    'nanay': ['nay', 'inay', 'nana', 'nanay'], 'tatay': ['tay', 'itay', 'tata', 'tatay'],
    'ina': ['inang', 'nay', 'ina'], 'ama': ['amang', 'tay', 'ama'],
    'kapatid': ['patid', 'kapatit', 'kapatid'], 'ate': ['at', 'ateng', 'ate'],
    'kuya': ['koya', 'kuyang', 'kuya'], 'lolo': ['lol', 'lulo', 'lolo'],
    'lola': ['lol', 'lula', 'lola'], 'pamilya': ['pamilia', 'familia', 'pamilya'],
    'kaibigan': ['kaybigan', 'kibigan', 'kaibigan'], 'kapitbahay': ['kapitbay', 'kapibahay', 'kapitbahay'],
    'guro': ['guru', 'goro', 'guro'], 'estudyante': ['istudyante', 'estudyanti', 'estudyante'],

    // Animals
    'aso': ['asong', 'asu', 'aso'], 'pusa': ['pusang', 'posa', 'pusa'],
    'ibon': ['ibong', 'ebon', 'ibon'], 'isda': ['isdang', 'esda', 'isda'],
    'manok': ['manuk', 'manok'], 'baboy': ['babuy', 'baboi', 'baboy'],
    'baka': ['bakang', 'bak', 'baka'], 'kabayo': ['kabayu', 'kabayo'],
    'kambing': ['kambin', 'kambing'], 'kalabaw': ['kalabao', 'kalabaw'],
    'daga': ['dagat', 'dag', 'daga'], 'paruparo': ['paro-paro', 'paruparu', 'paruparo'],
    'langgam': ['langam', 'langgam'], 'bubuyog': ['bubuyug', 'bubuyok', 'bubuyog'],
    'gagamba': ['gagamb', 'gagamba'], 'palaka': ['palak', 'palaka'],
    'ahas': ['ahas'], 'pagong': ['pagung', 'pagong'], 'unggoy': ['ungoy', 'ungguy', 'unggoy'],

    // Body Parts
    'ulo': ['ulu', 'olo', 'ulo'], 'mata': ['mat', 'matang', 'mata'],
    'ilong': ['ilung', 'elong', 'ilong'], 'tenga': ['tinga', 'tengga', 'tenga'],
    'bibig': ['bibik', 'bebig', 'bibig'], 'ngipin': ['ngepin', 'nipin', 'ngipin'],
    'dila': ['dil', 'dela', 'dila'], 'leeg': ['lig', 'leeg'],
    'balikat': ['balekat', 'balikat'], 'braso': ['brasu', 'baraso', 'braso'],
    'kamay': ['kamey', 'kamay'], 'daliri': ['dalere', 'daliri'],
    'kuko': ['kuku', 'koko', 'kuko'], 'tiyan': ['tyan', 'tiyan'],
    'likod': ['likud', 'lekod', 'likod'], 'paa': ['pa', 'paang', 'paa'],
    'tuhod': ['tuhud', 'tohod', 'tuhod'], 'binti': ['bente', 'binti'],
    'puso': ['pusu', 'poso', 'puso'], 'baga': ['bag', 'baga'],

    // Food and Drinks
    'pagkain': ['pagkaen', 'pakain', 'pagkain'], 'kanin': ['kanen', 'kaning', 'kanin'],
    'tinapay': ['tinapey', 'tinapai', 'tinapay'], 'ulam': ['olam', 'ulam'],
    'gulay': ['golay', 'gulai', 'gulay'], 'prutas': ['protas', 'frutas', 'prutas'],
    'saging': ['sagin', 'saging'], 'mansanas': ['manzanas', 'mansanas'],
    'mangga': ['manga', 'mangga'], 'ubas': ['obas', 'ubas'],
    'pakwan': ['pakoan', 'pakwan'], 'karne': ['karni', 'carne', 'karne'],
    'itlog': ['etlog', 'itlug', 'itlog'], 'gatas': ['gatas'],
    'tubig': ['tobig', 'tubeg', 'tubig'], 'kape': ['kapi', 'coffee', 'kape'],
    'tsaa': ['tsa', 'tea', 'tsaa'], 'sopas': ['sopa', 'sopas'], 'adobo': ['adobu', 'adobo'],

    // Places and Objects
    'bahay': ['bahey', 'bahai', 'bahay'], 'paaralan': ['paralan', 'eskwela', 'paaralan'],
    'silid': ['seled', 'selid', 'silid'], 'kusina': ['kosina', 'kusena', 'kusina'],
    'banyo': ['banyu', 'banio', 'banyo'], 'sala': ['sal', 'salang', 'sala'],
    'kwarto': ['kuarto', 'kwarto'], 'pinto': ['pentu', 'pinto'],
    'bintana': ['bentana', 'bintana'], 'hagdan': ['hagdang', 'agdan', 'hagdan'],
    'bubong': ['bubung', 'bobong', 'bubong'], 'sahig': ['saheg', 'saig', 'sahig'],
    'dingding': ['dengding', 'dinding', 'dingding'], 'mesa': ['misa', 'mesa'],
    'silya': ['silyang', 'silia', 'silya'], 'kama': ['kamang', 'kama'],
    'unan': ['onan', 'unang', 'unan'], 'kumot': ['kumut', 'komot', 'kumot'],
    'libro': ['lebro', 'libro'], 'lapis': ['lapes', 'lapis'],
    'papel': ['papil', 'paper', 'papel'], 'bag': ['beg', 'bag'],
    'sapatos': ['sapatus', 'sapatos'], 'damit': ['damet', 'damit'],
    'sombrero': ['sumbrero', 'sombrero'],

    // Verbs - Common Actions
    'kumain': ['kumaen', 'kain', 'kumain'], 'uminom': ['uminum', 'inom', 'uminom'],
    'maglaro': ['maglaru', 'laro', 'maglaro'], 'matulog': ['matolog', 'tulog', 'matulog'],
    'gumising': ['gumesing', 'gising', 'gumising'], 'maligo': ['malegu', 'ligo', 'maligo'],
    'magsipilyo': ['magsepilyo', 'sipilyo', 'magsipilyo'], 'maglinis': ['maglenes', 'linis', 'maglinis'],
    'maglaba': ['maglabang', 'laba', 'maglaba'], 'magluto': ['magloto', 'luto', 'magluto'],
    'kumanta': ['kumantang', 'kanta', 'kumanta'], 'sumayaw': ['sumayao', 'sayaw', 'sumayaw'],
    'tumakbo': ['tumakbu', 'takbo', 'tumakbo'], 'lumakad': ['lakad', 'lumakad'],
    'tumalon': ['tumalun', 'talon', 'tumalon'], 'umupo': ['umupu', 'upo', 'umupo'],
    'tumayo': ['tumayu', 'tayo', 'tumayo'], 'humiga': ['humega', 'higa', 'humiga'],
    'magsulat': ['magsolat', 'sulat', 'magsulat'], 'magbasa': ['magbas', 'basa', 'magbasa'],
    'pumunta': ['pomunta', 'punta', 'pumunta'], 'umuwi': ['umuwe', 'uwi', 'umuwi'],
    'dumating': ['domating', 'dating', 'dumating'], 'umalis': ['omalis', 'alis', 'umalis'],
    'bumalik': ['bomalik', 'balik', 'bumalik'], 'tumingin': ['tomengin', 'tingin', 'tumingin'],
    'makinig': ['makenig', 'kinig', 'makinig'], 'magsalita': ['magsalit', 'salita', 'magsalita'],
    'tumawa': ['tomawa', 'tawa', 'tumawa'], 'umiyak': ['umeyak', 'iyak', 'umiyak'],
    'ngumiti': ['ngomiti', 'ngiti', 'ngumiti'], 'sumigaw': ['somigaw', 'sigaw', 'sumigaw'],
    'bumukas': ['bomukas', 'bukas', 'bumukas'], 'magsara': ['magsarang', 'sara', 'magsara'],
    'kumuha': ['komuha', 'kuha', 'kumuha'], 'magbigay': ['magbegay', 'bigay', 'magbigay'],
    'tumanggap': ['tomanggap', 'tanggap', 'tumanggap'], 'magtanong': ['tanong', 'magtanong'],
    'sumagot': ['somagot', 'sagot', 'sumagot'], 'mag-aral': ['magaral', 'aral', 'mag-aral'],

    // Adjectives
    'maganda': ['magand', 'magandang', 'maganda'], 'pangit': ['panget', 'pangit'],
    'mabuti': ['mabote', 'buti', 'mabuti'], 'masama': ['masam', 'sama', 'masama'],
    'malaki': ['malake', 'laki', 'malaki'], 'maliit': ['malet', 'liit', 'maliit'],
    'mataba': ['matab', 'taba', 'mataba'], 'payat': ['payat'],
    'mataas': ['matas', 'taas', 'mataas'], 'mababa': ['mabab', 'baba', 'mababa'],
    'mahaba': ['mahab', 'haba', 'mahaba'], 'maikli': ['maikle', 'ikli', 'maikli'],
    'mainit': ['mainet', 'init', 'mainit'], 'malamig': ['malameg', 'lamig', 'malamig'],
    'masaya': ['masay', 'saya', 'masaya'], 'malungkot': ['malongkot', 'lungkot', 'malungkot'],
    'galit': ['galet', 'galit'], 'takot': ['takut', 'takot'],
    'matapang': ['tapang', 'matapang'], 'mahiyain': ['mahiyaen', 'hiyain', 'mahiyain'],
    'matalino': ['matalenu', 'talino', 'matalino'], 'bobo': ['bubu', 'bobo'],
    'mabait': ['mabaet', 'bait', 'mabait'], 'masungit': ['masunget', 'sungit', 'masungit'],
    'maingay': ['maengay', 'ingay', 'maingay'],

    // Colors
    'puti': ['pote', 'puti'], 'itim': ['etem', 'itim'], 'pula': ['pol', 'pula'],
    'asul': ['asol', 'blue', 'asul'], 'dilaw': ['delao', 'yellow', 'dilaw'],
    'berde': ['birdi', 'green', 'berde'], 'kahel': ['kael', 'orange', 'kahel'],
    'lila': ['lela', 'purple', 'lila'], 'rosas': ['rusas', 'pink', 'rosas'],
    'kulay': ['kolay', 'kulai', 'kulay'], 'abo': ['abu', 'gray', 'abo'],
    'kayumanggi': ['kayomangi', 'brown', 'kayumanggi'],

    // Numbers
    'isa': ['es', 'isang', 'isa'], 'dalawa': ['dalawang', 'dalwa', 'dalawa'],
    'tatlo': ['tatlu', 'tatlong', 'tatlo'], 'apat': ['apat'],
    'lima': ['lem', 'limang', 'lima'], 'anim': ['anem', 'anim'],
    'pito': ['petu', 'pitong', 'pito'], 'walo': ['walu', 'walong', 'walo'],
    'siyam': ['siyam'], 'sampu': ['sampo', 'sampung', 'sampu'],
    'labingisa': ['labing-isa', 'labingesa', 'labingisa'],
    'dalawampu': ['dalawampo', 'dalawampu'], 'tatlumpu': ['tatlompo', 'tatlumpu'],
    'apatnapu': ['apatnapo', 'apatnapu'], 'limampu': ['limampo', 'limampu'],
    'animnapu': ['animnapo', 'animnapu'], 'pitumpu': ['pitompo', 'pitumpu'],
    'walumpu': ['walompo', 'walumpu'], 'siyamnapu': ['siyamnapo', 'siyamnapu'],
    'daan': ['dan', 'daang', 'daan'], 'libo': ['lebu', 'libong', 'libo'],

    // Time Words
    'araw': ['arao', 'araw'], 'gabi': ['gabe', 'gabi'], 'umaga': ['omaga', 'umaga'],
    'hapon': ['hapun', 'hapon'], 'tanghali': ['tanggali', 'tanghali'],
    'buwan': ['buan', 'buwan'], 'taon': ['taun', 'taon'], 'linggo': ['lingo', 'linggo'],
    'oras': ['uras', 'oras'], 'minuto': ['minoto', 'minuto'], 'segundo': ['sigundo', 'segundo'],
    'ngayon': ['ngayun', 'ngayon'], 'bukas': ['bokas', 'bukas'],
    'kahapon': ['kahapun', 'kahapon'], 'mamaya': ['mamay', 'mamaya'],
    'kanina': ['kanena', 'kanina'], 'mamayangabi': ['mamayang-gabi', 'mamayangabe', 'mamayangabi'],

    // Demonstratives
    'ito': ['etu', 'itong', 'ito'], 'iyan': ['yan', 'iyang', 'iyan'],
    'iyon': ['yun', 'iyong', 'iyon'], 'dito': ['detu', 'ditong', 'dito'],
    'diyan': ['dyan', 'diyang', 'diyan'], 'doon': ['dun', 'doong', 'doon'],
    'nandito': ['nandetu', 'nandito'], 'nandiyan': ['nandyan', 'nandiyan'],
    'nandoon': ['nandun', 'nandoon'], 'heto': ['eto', 'hetu', 'heto'],
    'hayan': ['ayan', 'hayan'], 'hayun': ['ayun', 'hayun'],

    // Question Words
    'ano': ['anu', 'ano'], 'sino': ['sinu', 'sino'], 'saan': ['san', 'saan'],
    'kailan': ['kelan', 'kailan'], 'bakit': ['baket', 'bakit'],
    'paano': ['pano', 'paanu', 'paano'], 'ilan': ['elan', 'ilang', 'ilan'],
    'alin': ['alen', 'aling', 'alin'], 'kanino': ['kanenu', 'kanino'],
    'magkano': ['magkanu', 'magkano'],

    // Conjunctions and Connectors
    'at': ['at'], 'o': ['u', 'o'], 'pero': ['peru', 'pero'],
    'ngunit': ['ngonet', 'ngunit'], 'kaya': ['kay', 'kaya'],
    'dahil': ['dahel', 'dahil'], 'kung': ['kong', 'kung'],
    'kapag': ['pag', 'kapag'], 'habang': ['habang'],
    'para': ['par', 'para'], 'upang': ['opang', 'upang'],
    'nang': ['ng', 'nang'], 'noong': ['nung', 'noong'],
    'sapagkat': ['sapagkat'], 'subalit': ['sobalit', 'subalit'],
    'kahit': ['kahet', 'kahit'], 'bagaman': ['bagaman'],

    // Common Adverbs
    'mabilis': ['mabeles', 'bilis', 'mabilis'], 'mabagal': ['bagal', 'mabagal'],
    'palagi': ['palage', 'lagi', 'palagi'], 'minsan': ['mensan', 'minsan'],
    'kadalasan': ['dalasan', 'kadalasan'], 'bihira': ['behera', 'bihira'],
    'lagi': ['lage', 'lagi'], 'hindi': ['hende', 'di', 'hindi'],
    'oo': ['o', 'oo'], 'wala': ['wal', 'wala'],
    'mayroon': ['mayron', 'meron', 'mayroon'], 'meron': ['miron', 'meron'],

    // More common words
    'naman': ['naman'], 'lang': ['lang'], 'din': ['rin', 'din'], 'rin': ['din', 'rin'],
    'kasi': ['kase', 'kasi'], 'talaga': ['talag', 'talaga'], 'sobra': ['sobrang', 'sobra'],
    'lahat': ['lahat'], 'bawat': ['bawat'], 'ibang': ['iba', 'ibang'],
    'sarili': ['sarele', 'sarili'], 'mundo': ['mondo', 'mundo'],
    'buhay': ['buhey', 'buhay'],

    // Additional common words
    'may': ['mey', 'may'],
    'walang': ['walang', 'wala'], 'marami': ['marame', 'marami'],
    'konti': ['konte', 'konti'],
    'ibig': ['ebig', 'ibig'], 'gusto': ['gosto', 'gusto'],
    'ayaw': ['ayao', 'ayaw'], 'kailangan': ['kelangan', 'kailangan'],
    'pwede': ['puwede', 'pwedi', 'pwede'], 'dapat': ['dapot', 'dapat'],
    'maaari': ['maare', 'maaari'], 'sana': ['san', 'sana'],
    'lungga': ['longga', 'lunga', 'lungga'], 'gutom': ['gotom', 'gutum', 'gutom'],
    'naglalakad': ['naglalakad', 'naglakad', 'lakad'],
    'nakita': ['naketa', 'nakita'], 'sinabi': ['sinabe', 'sinabi']
  };

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
    if (voskReconnectTimeoutRef.current) {
      clearTimeout(voskReconnectTimeoutRef.current);
    }

    voskReconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, voskReconnectAttemptsRef.current - 1), 10000);

    console.log(`🔄 Attempting Vosk reconnect (attempt ${voskReconnectAttemptsRef.current}) in ${delay}ms...`);
    setVoskStatus("connecting");

    voskReconnectTimeoutRef.current = setTimeout(() => {
      if (isRecording && !isPaused) {
        cleanupVosk();
        startVoskFn(true);
      }
    }, delay);
  };

  /**
   * Initialize microphone access with optimal audio settings for Vosk.
   * Returns a MediaStream configured for speech recognition.
   */
  const initializeMicrophone = async (): Promise<MediaStream> => {
    try {
      // Vosk works best with minimal audio processing
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
      });
    } catch (error) {
      // Fallback to default settings if constraints are not supported
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000
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

    return { context: ctx, source: src, processor: script };
  };

  /**
   * High-quality downsampling algorithm for converting 48kHz audio to 16kHz.
   * Uses sinc-based resampling with anti-aliasing filter for better accuracy.
   */
  const downsampleTo16k = (input: Float32Array, sampleRate: number): Int16Array => {
    const targetRate = 16000;
    const ratio = sampleRate / targetRate;
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

  /**
   * Set up WebSocket message handlers for Vosk recognition results.
   * Processes both final and partial recognition results with vocabulary validation.
   */
  const setupVoskMessageHandlers = (ws: WebSocket) => {
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

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

        if (msg.text && msg.text.trim()) {
          const originalText = msg.text.trim();
          console.log(`🎯 Vosk recognized (final): "${originalText}"`);
          const filteredText = filterThroughVocabulary(originalText, storyVocabulary);

          // Log vocabulary validation results
          if (originalText !== filteredText) {
            const rejectedWords = originalText.split(/\s+/).filter((word: string) =>
              !filteredText.split(/\s+/).includes(word)
            );
            console.log(`❌ Vocabulary filter: Rejected ${rejectedWords.length} word(s) not in story: ${rejectedWords.join(', ')}`);
          }

          if (filteredText) {
            console.log(`✅ Vocabulary filter: Accepted "${filteredText}"`);
            voskFinalTranscriptRef.current += (voskFinalTranscriptRef.current ? " " : "") + filteredText;
            setTranscript(voskFinalTranscriptRef.current);
          } else {
            console.log(`⚠️ All words rejected by vocabulary filter`);
          }
        } else if (msg.partial && msg.partial.trim()) {
          const originalPartial = msg.partial.trim();
          console.log(`🎯 Vosk recognized (partial): "${originalPartial}"`);
          const filteredPartial = filterThroughVocabulary(originalPartial, storyVocabulary);

          if (filteredPartial) {
            setTranscript(voskFinalTranscriptRef.current + (voskFinalTranscriptRef.current ? " " : "") + filteredPartial);
          } else {
            setTranscript(voskFinalTranscriptRef.current);
          }
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

      if (voskReconnectAttemptsRef.current < 3) {
        console.log("Attempting to reconnect to speech recognition service...");
        attemptVoskReconnect(startVoskFn);
      } else {
        console.error("Unable to connect to speech recognition service after multiple attempts");
        cleanupVosk();
        setVoskStatus("disconnected");
        if (!isReconnect) {
          alert("Unable to connect to speech recognition service. Please check your internet connection and try again.");
          setIsRecording(false);
        }
      }
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
        console.error(`   Check Railway logs for specific error message`);
      } else if (event.code === 1011) {
        console.error(`❌ Internal server error (1011) - Service crashed`);
        console.error(`   Check Railway logs for crash details`);
      }

      // Only attempt reconnect if recording is active and it wasn't a clean close
      if (isRecording && !isPaused && event.code !== 1000) {
        if (voskReconnectAttemptsRef.current < 3) {
          console.log(`🔄 Attempting to reconnect (attempt ${voskReconnectAttemptsRef.current + 1}/3)...`);
          attemptVoskReconnect(startVoskFn);
        } else {
          console.error("❌ Connection lost after multiple reconnection attempts");
          cleanupVosk();
          if (!isReconnect) {
            let errorMsg = `Connection to speech recognition service was lost.\n\n`;
            errorMsg += `Close code: ${event.code} (${closeMessage})\n`;
            errorMsg += `Reason: ${closeReason}\n\n`;
            
            if (event.code === 1006) {
              errorMsg += `Possible causes:\n`;
              errorMsg += `• Railway service may be sleeping or crashed\n`;
              errorMsg += `• Check Railway dashboard and service logs\n`;
              errorMsg += `• Wait 30-60 seconds if service is on free tier\n`;
            }
            
            Swal.fire({
              icon: 'error',
              title: 'Connection Lost',
              text: errorMsg,
              confirmButtonText: 'OK'
            });
            setIsRecording(false);
          }
        }
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
  }>>(new Map());

  // Track inserted words (extra words child said) with their position
  const [insertedWords, setInsertedWords] = useState<Map<number, string[]>>(new Map());

  // Real-time Oral Reading Score (Accuracy) using useMemo
  const oralReadingScore = useMemo(() => {
    if (words.length === 0) return "0.0";
    const score = calculateOralReadingScore(wordsRead, miscues, words.length);
    return score.toFixed(1);
  }, [wordsRead, miscues, words.length]);

  // Real-time Reading Speed (WPM)
  const readingSpeedWPM =
    elapsedTime > 0
      ? calculateReadingSpeedWPM(wordsRead, elapsedTime).toString()
      : "0";

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
   * Handles common patterns globally without hardcoding specific words.
   * LANGUAGE-AWARE: Prevents cross-language false matches (e.g., English words in Tagalog stories)
   */
  function isWordMatch(spokenWord: string, expectedWord: string, checkLanguage: boolean = false): boolean {
    const normSpoken = normalize(spokenWord);
    const normExpected = normalize(expectedWord);
    if (!normSpoken || !normExpected) return false;

    // LANGUAGE VALIDATION: Only check when explicitly requested (for current expected word)
    // This prevents excessive warnings when checking against all story words
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

    // Exact match
    if (normSpoken === normExpected) return true;

    // CRITICAL: Prevent false matches between completely different words
    // Block known false positives
    const falsePositivePairs = [
      ['isang', 'asong'],
      ['asong', 'isang'],
      ['may', 'ay'],
      ['ay', 'may'],
    ];

    for (const [word1, word2] of falsePositivePairs) {
      if (normSpoken === word1 && normExpected === word2) {
        return false;
      }
    }

    // UNIVERSAL PATTERN 1: Dropped -ed endings (for ANY word)
    // "carved" accepts "carve", "carv"
    if (normExpected.endsWith('ed')) {
      const root = normExpected.slice(0, -2); // Remove 'ed'
      const rootE = normExpected.slice(0, -1); // Remove 'd' only
      if (normSpoken === root || normSpoken === rootE || normSpoken === root + 't') {
        return true;
      }
    }

    // UNIVERSAL PATTERN 2: Dropped -ing endings
    // "walking" accepts "walk", "walkin"
    if (normExpected.endsWith('ing')) {
      const root = normExpected.slice(0, -3);
      if (normSpoken === root || normSpoken === normExpected.slice(0, -1)) {
        return true;
      }
    }

    // UNIVERSAL PATTERN 2B: Added -ing endings (reverse)
    // "shiny" accepts "shining", "walk" accepts "walking"
    if (normSpoken.endsWith('ing')) {
      const spokenRoot = normSpoken.slice(0, -3);
      // Check if spoken root matches expected word
      // Also handle y→i transformation: "shiny" → "shining" (shin + ing)
      if (spokenRoot === normExpected || spokenRoot + 'y' === normExpected || spokenRoot + 'e' === normExpected) {
        console.log(`✓ -ing variation match: "${spokenWord}" (root: "${spokenRoot}") matches "${expectedWord}"`);
        return true;
      }
    }

    // UNIVERSAL PATTERN 3: Dropped -s/-es endings (plurals/verbs)
    // "looks" accepts "look", "takes" accepts "take"
    if (normExpected.endsWith('s') && normExpected.length > 2) {
      const root = normExpected.slice(0, -1);
      const rootEs = normExpected.endsWith('es') ? normExpected.slice(0, -2) : null;
      if (normSpoken === root || (rootEs && normSpoken === rootEs)) {
        return true;
      }
    }

    // Use story-specific pronunciation map if available, otherwise fall back to comprehensive map
    const accentMap: { [key: string]: string[] } = Object.keys(storyPronunciationMap).length > 0
      ? storyPronunciationMap
      : {
        // Fallback: Common word form variations (WORKAROUND: specific -ing variations)
        'shiny': ['shining', 'shin'],

        // Filipino accent variations - TH sounds (very common in Philippines)
        'the': ['da', 'de', 'duh', 'di', 'za', 'ze'],
        'this': ['dis', 'dees', 'tis', 'zis'],
        'that': ['dat', 'det', 'tat', 'zat'],
        'three': ['tree', 'tri'],
        'think': ['tink', 'tingk'],
        'thing': ['ting'],
        'with': ['wit', 'wid'],
        'they': ['dey', 'day'],
        'them': ['dem'],
        'there': ['der', 'dere'],
        'their': ['der', 'deir'],
        'then': ['den'],
        'than': ['dan'],
        'through': ['tru', 'troo'],
        'thought': ['tot', 'taught'],
        'though': ['do', 'dough'],
        'these': ['dis', 'dees'],
        'those': ['dos', 'dose'],
        'other': ['oder', 'udder'],
        'another': ['anoder', 'anudder'],
        'brother': ['broder', 'brudder'],
        'mother': ['moder', 'mudder'],
        'father': ['fader', 'fadder'],
        'weather': ['weder', 'wedder'],
        'whether': ['weder', 'wedder'],
        'together': ['togeder', 'togedder'],
        'nothing': ['noting', 'nutting'],
        'something': ['someting', 'sumting'],
        'anything': ['anyting', 'eniting'],
        'everything': ['everyting', 'evriting'],
        'birthday': ['birtday', 'burtday'],
        'bathroom': ['batroom', 'batrum'],
        'math': ['mat', 'mats'],
        'path': ['pat', 'pats'],
        'both': ['bot', 'bots'],
        'mouth': ['mout', 'mowt'],
        'south': ['sout', 'sowt'],
        'north': ['nort', 'norts'],

        // Common sight words and function words
        'about': ['abowt', 'bout'],
        'after': ['after', 'apter'],
        'again': ['agen', 'agin'],
        'always': ['allways', 'alwys'],
        'around': ['aroun', 'round'],
        'because': ['becuz', 'cuz', 'coz'],
        'before': ['befor', 'bfor'],
        'between': ['betwee', 'btween'],
        'could': ['cud', 'kud'],
        'should': ['shud', 'shoud'],
        'would': ['wud', 'wood'],
        'does': ['dus', 'duz'],
        'done': ['dun', 'don'],
        'every': ['evry', 'everi'],
        'first': ['furst', 'firs'],
        'friend': ['frend', 'fren'],
        'from': ['frum', 'form'],
        'have': ['hav', 'hab'],
        'here': ['hir', 'hear'],
        'into': ['intu', 'ento'],
        'just': ['jus', 'jast'],
        'know': ['no', 'now'],
        'like': ['lik', 'lyke'],
        'little': ['litle', 'litl'],
        'long': ['lang', 'lon'],
        'many': ['meny', 'mani'],
        'more': ['mor', 'moar'],
        'most': ['mos', 'moast'],
        'much': ['mach', 'mutch'],
        'never': ['neber', 'nevr'],
        'only': ['onli', 'ownly'],
        'over': ['ober', 'ovr'],
        'people': ['pipol', 'peepol', 'peeple'],
        'please': ['pls', 'pleas', 'plz'],
        'pretty': ['prety', 'pritty'],
        'really': ['realy', 'relly', 'rily'],
        'right': ['rite', 'ryt'],
        'some': ['sum', 'som'],
        'time': ['tym', 'tyme'],
        'today': ['tuday', 'todey'],
        'very': ['bery', 'veri'],
        'want': ['wanna', 'wan'],
        'water': ['wader', 'watur'],
        'were': ['wer', 'where'],
        'what': ['wat', 'wut'],
        'when': ['wen', 'win'],
        'where': ['wer', 'were'],
        'which': ['wich', 'witch'],
        'who': ['hoo', 'hu'],
        'why': ['y', 'wi'],
        'will': ['wil', 'wel'],
        'your': ['yur', 'yor', 'ur'],

        // Children's speech: past tense -ed endings (often dropped or mispronounced)
        'looked': ['look', 'looke', 'lookt'],
        'walked': ['walk', 'walke', 'walkt'],
        'talked': ['talk', 'talke', 'talkt'],
        'picked': ['pick', 'picke', 'pickt'],
        'noticed': ['notice', 'notic', 'notis'],
        'wanted': ['want', 'wante', 'wantid'],
        'needed': ['need', 'neede', 'needid'],
        'started': ['start', 'starte', 'startid'],
        'ended': ['end', 'ende', 'endid'],
        'asked': ['ask', 'aske', 'askt'],
        'helped': ['help', 'helpe', 'helpt'],
        'jumped': ['jump', 'jumpe', 'jumpt'],
        'played': ['play', 'playe', 'playd'],
        'stayed': ['stay', 'staye', 'stayd'],
        'tried': ['try', 'trie', 'tryd'],
        'turned': ['turn', 'turne', 'turnd'],
        'learned': ['learn', 'learne', 'learnd'],
        'opened': ['open', 'opene', 'opend'],
        'closed': ['close', 'clos', 'closd'],
        'lived': ['live', 'liv', 'livd'],
        'loved': ['love', 'lov', 'lovd'],
        'moved': ['move', 'mov', 'movd'],
        'used': ['use', 'us', 'usd'],
        'called': ['call', 'calle', 'calld'],
        'worked': ['work', 'worke', 'workt'],
        'seemed': ['seem', 'seeme', 'seemd'],
        'showed': ['show', 'showe', 'showd'],
        'followed': ['follow', 'followe', 'followd'],
        'happened': ['happen', 'happene', 'happend'],
        'appeared': ['appear', 'appeare', 'appeard'],
        'believed': ['believe', 'believ', 'believd'],
        'received': ['receive', 'receiv', 'receivd'],
        'watched': ['watch', 'watche', 'watcht'],
        'listened': ['listen', 'listene', 'listend'],
        'laughed': ['laugh', 'laughe', 'laught'],
        'smiled': ['smile', 'smil', 'smild'],
        'cried': ['cry', 'crie', 'cryd'],
        'stopped': ['stop', 'stoppe', 'stopt'],
        'dropped': ['drop', 'droppe', 'dropt'],
        'hopped': ['hop', 'hoppe', 'hopt'],
        'skipped': ['skip', 'skippe', 'skipt'],
        'clapped': ['clap', 'clappe', 'clapt'],
        'grabbed': ['grab', 'grabbe', 'grabt'],
        'hugged': ['hug', 'hugge', 'hugt'],
        'kissed': ['kiss', 'kisse', 'kist'],
        'missed': ['miss', 'misse', 'mist'],
        'passed': ['pass', 'passe', 'past'],
        'pushed': ['push', 'pushe', 'pusht'],
        'pulled': ['pull', 'pulle', 'pulld'],
        'reached': ['reach', 'reache', 'reacht'],
        'touched': ['touch', 'touche', 'toucht'],
        'washed': ['wash', 'washe', 'washt'],
        'wished': ['wish', 'wishe', 'wisht'],
        'yelled': ['yell', 'yelle', 'yelld'],
        'answered': ['answer', 'answere', 'answerd'],
        'climbed': ['climb', 'climbe', 'climbd'],
        'cooked': ['cook', 'cooke', 'cookt'],
        'danced': ['dance', 'danc', 'danst'],
        'finished': ['finish', 'finishe', 'finisht'],
        'painted': ['paint', 'painte', 'paintid'],
        'planted': ['plant', 'plante', 'plantid'],
        'pointed': ['point', 'pointe', 'pointid'],
        'remembered': ['remember', 'remembere', 'rememberd'],
        'visited': ['visit', 'visite', 'visitid'],
        'waited': ['wait', 'waite', 'waitid'],
        'wondered': ['wonder', 'wondere', 'wonderd'],

        // Common irregular verbs children struggle with
        'saw': ['see', 'sow', 'so'],
        'said': ['say', 'sed', 'sayed'],
        'went': ['go', 'goed', 'wented'],
        'came': ['come', 'comed', 'camed'],
        'took': ['take', 'taked', 'tooked'],
        'gave': ['give', 'gived', 'gaved'],
        'made': ['make', 'maked', 'maded'],
        'got': ['get', 'getted', 'goted'],
        'found': ['find', 'finded', 'founded'],
        'told': ['tell', 'telled', 'tolded'],
        'knew': ['know', 'knowed', 'knewed'],
        'felt': ['feel', 'feeled', 'felted'],
        'left': ['leave', 'leaved', 'lefted'],
        'kept': ['keep', 'keeped', 'kepted'],
        'held': ['hold', 'holded', 'helded'],
        'brought': ['bring', 'bringed', 'broughted'],
        'began': ['begin', 'begined', 'beganed'],
        'ran': ['run', 'runned', 'raned'],
        'stood': ['stand', 'standed', 'stooded'],
        'heard': ['hear', 'heared', 'herd'],
        'became': ['become', 'becomed', 'becamed'],
        'put': ['put', 'putted', 'puted'],
        'let': ['let', 'letted', 'leted'],
        'read': ['read', 'readed', 'red'],
        'met': ['meet', 'meeted', 'meted'],
        'sat': ['sit', 'sitted', 'sated'],
        'spoke': ['speak', 'speaked', 'spoked'],
        'wrote': ['write', 'writed', 'wroted'],
        'ate': ['eat', 'eated', 'ated'],
        'drank': ['drink', 'drinked', 'dranked'],
        'sang': ['sing', 'singed', 'sanged'],
        'swam': ['swim', 'swimmed', 'swamed'],
        'flew': ['fly', 'flyed', 'flewed'],
        'drew': ['draw', 'drawed', 'drewed'],
        'grew': ['grow', 'growed', 'grewed'],
        'threw': ['throw', 'throwed', 'threwed'],
        'wore': ['wear', 'weared', 'wored'],
        'broke': ['break', 'breaked', 'broked'],
        'chose': ['choose', 'choosed', 'chosed'],
        'drove': ['drive', 'drived', 'droved'],
        'rode': ['ride', 'rided', 'roded'],
        'woke': ['wake', 'waked', 'woked'],
        'froze': ['freeze', 'freezed', 'frosed'],
        'stole': ['steal', 'stealed', 'stoled'],
        'built': ['build', 'builded', 'bilt'],
        'bought': ['buy', 'buyed', 'boughted'],
        'caught': ['catch', 'catched', 'caughted'],
        'cut': ['cut', 'cutted', 'cuted'],
        'did': ['do', 'doed', 'dided'],
        'fell': ['fall', 'falled', 'felled'],
        'fought': ['fight', 'fighted', 'foughted'],
        'forgot': ['forget', 'forgeted', 'forgotted'],
        'hid': ['hide', 'hided', 'hidded'],
        'hit': ['hit', 'hitted', 'hited'],
        'hurt': ['hurt', 'hurted', 'herted'],
        'lay': ['lie', 'lied', 'layed'],
        'led': ['lead', 'leaded', 'ledded'],
        'lost': ['lose', 'losed', 'losted'],
        'paid': ['pay', 'payed', 'paided'],
        'rang': ['ring', 'ringed', 'rung'],
        'rose': ['rise', 'rised', 'rosed'],
        'sent': ['send', 'sended', 'sented'],
        'shook': ['shake', 'shaked', 'shooked'],
        'shot': ['shoot', 'shooted', 'shoted'],
        'shut': ['shut', 'shutted', 'shuted'],
        'slept': ['sleep', 'sleeped', 'slepted'],
        'spent': ['spend', 'spended', 'spented'],
        'taught': ['teach', 'teached', 'taughted'],
        'understood': ['understand', 'understanded', 'understooded'],
        'won': ['win', 'winned', 'woned'],

        // Common nouns and story words
        'animal': ['animel', 'anmal'],
        'bedroom': ['bedrum', 'bed room'],
        'breakfast': ['brekfast', 'brekfest'],
        'children': ['chilren', 'childs'],
        'chocolate': ['choklate', 'choclate', 'choco'],
        'christmas': ['krismas', 'xmas'],
        'different': ['diferent', 'diffrent'],
        'finally': ['finaly', 'finely'],
        'garden': ['gardin', 'garding'],
        'happy': ['hapi', 'hapy'],
        'important': ['importan', 'importent'],
        'kitchen': ['kitchin', 'kichen'],
        'library': ['libary', 'liberry'],
        'morning': ['mornin', 'morming'],
        'mountain': ['mountin', 'mowntain'],
        'neighbor': ['nabor', 'naybor', 'neybor'],
        'picture': ['pikture', 'pitcher', 'pictur'],
        'probably': ['probly', 'prolly'],
        'remember': ['rember', 'remembr'],
        'restaurant': ['restarant', 'resturant'],
        'school': ['skool', 'scool'],
        'special': ['speshal', 'speshul'],
        'surprise': ['suprise', 'surprize'],
        'tomorrow': ['tomoro', 'tommorow', 'tomorow'],
        'tonight': ['tonite', 'to night'],
        'vegetable': ['vegtable', 'vegitable'],
        'yesterday': ['yesturday', 'yesterdey'],

        // Adjectives and descriptive words
        'angry': ['angri', 'angery'],
        'busy': ['bisy', 'bizzy'],
        'careful': ['carful', 'carefull'],
        'comfortable': ['comftable', 'comfterble'],
        'dangerous': ['dangeros', 'dangerus'],
        'delicious': ['delishus', 'delisious'],
        'difficult': ['dificult', 'difficalt'],
        'excited': ['exited', 'exsited'],
        'expensive': ['expensiv', 'exspensive'],
        'famous': ['famos', 'famus'],
        'frightened': ['fritened', 'frightend'],
        'hungry': ['hongry', 'hungri'],
        'interesting': ['intresting', 'intersting'],
        'jealous': ['jelous', 'jealos'],
        'lonely': ['lonley', 'loneli'],
        'nervous': ['nervos', 'nervus'],
        'perfect': ['perfec', 'perfict'],
        'popular': ['populer', 'poplar'],
        'quiet': ['quite', 'kwiet'],
        'scared': ['skared', 'scaired'],
        'terrible': ['terible', 'terrable'],
        'tired': ['tyred', 'tierd'],
        'wonderful': ['wonderfull', 'wunderful'],

        // ========================================================================
        // TAGALOG PRONUNCIATION VARIANTS FOR CHILDREN
        // ========================================================================
        // Common Tagalog words with child mispronunciations

        // Pronouns and particles
        'ako': ['aku', 'ako'],
        'ikaw': ['ikao', 'ka', 'ikaw'],
        'siya': ['sya', 'siya'],
        'kami': ['kame', 'kami'],
        'tayo': ['tayu', 'tayo'],
        'kayo': ['kayu', 'kayo'],
        'sila': ['sela', 'sila'],
        'ang': ['an', 'ang'],
        'nga': ['ng', 'nga'],
        'mga': ['manga', 'mga'],
        'ay': ['ai', 'ay'],
        'na': ['nang', 'na'],
        'pa': ['pang', 'pa'],
        'ba': ['bang', 'ba'],
        'po': ['pu', 'po'],
        'opo': ['opu', 'opo'],

        // Common nouns - People
        'tao': ['tau', 'tawo', 'tao'],
        'bata': ['bat', 'batang', 'bata'],
        'nanay': ['nay', 'inay', 'nana', 'nanay'],
        'tatay': ['tay', 'itay', 'tata', 'tatay'],
        'kapatid': ['patid', 'kapatit', 'kapatid'],
        'pamilya': ['pamilia', 'familia', 'pamilya'],

        // Common nouns - Animals
        'aso': ['asong', 'asu', 'aso'],
        'pusa': ['pusang', 'posa', 'pusa'],
        'ibon': ['ibong', 'ebon', 'ibon'],
        'isda': ['isdang', 'esda', 'isda'],
        'manok': ['manuk', 'manok'],

        // Common nouns - Body parts
        'ulo': ['ulu', 'olo', 'ulo'],
        'mata': ['mat', 'matang', 'mata'],
        'kamay': ['kamay', 'kamey'],
        'paa': ['pa', 'paang', 'paa'],

        // Common nouns - Food
        'pagkain': ['pagkaen', 'pakain', 'pagkain'],
        'kanin': ['kanen', 'kaning', 'kanin'],
        'tubig': ['tobig', 'tubeg', 'tubig'],
        'saging': ['sagin', 'saging'],

        // Common nouns - Places
        'bahay': ['bahey', 'bahai', 'bahay'],
        'paaralan': ['paralan', 'eskwela', 'paaralan'],
        'silid': ['seled', 'selid', 'silid'],

        // Common verbs
        'kumain': ['kumaen', 'kain', 'kumain'],
        'uminom': ['uminum', 'inom', 'uminom'],
        'maglaro': ['maglaru', 'laro', 'maglaro'],
        'matulog': ['matolog', 'tulog', 'matulog'],
        'gumising': ['gumesing', 'gising', 'gumising'],
        'pumunta': ['pomunta', 'punta', 'pumunta'],
        'umuwi': ['umuwe', 'uwi', 'umuwi'],
        'tumakbo': ['tumakbu', 'takbo', 'tumakbo'],
        'lumakad': ['lumakad', 'lakad'],

        // Common adjectives
        'maganda': ['magand', 'magandang', 'maganda'],
        'pangit': ['panget', 'pangit'],
        'mabuti': ['mabote', 'buti', 'mabuti'],
        'masama': ['masam', 'sama', 'masama'],
        'malaki': ['malake', 'laki', 'malaki'],
        'maliit': ['malet', 'liit', 'maliit'],
        'masaya': ['masay', 'saya', 'masaya'],
        'malungkot': ['malongkot', 'lungkot', 'malungkot'],

        // Colors
        'puti': ['pote', 'puti'],
        'itim': ['etem', 'itim'],
        'pula': ['pol', 'pula'],
        'asul': ['asol', 'blue', 'asul'],
        'dilaw': ['delao', 'yellow', 'dilaw'],
        'berde': ['birdi', 'green', 'berde'],

        // Numbers
        'isa': ['es', 'isang', 'isa'],
        'dalawa': ['dalawang', 'dalwa', 'dalawa'],
        'tatlo': ['tatlu', 'tatlong', 'tatlo'],
        'apat': ['apat'],
        'lima': ['lem', 'limang', 'lima'],
        'anim': ['anem', 'anim'],
        'pito': ['petu', 'pitong', 'pito'],
        'walo': ['walu', 'walong', 'walo'],
        'siyam': ['siyam'],
        'sampu': ['sampo', 'sampung', 'sampu'],

        // Time words
        'araw': ['arao', 'araw'],
        'gabi': ['gabe', 'gabi'],
        'umaga': ['omaga', 'umaga'],
        'hapon': ['hapun', 'hapon'],
        'ngayon': ['ngayun', 'ngayon'],
        'bukas': ['bokas', 'bukas'],
        'kahapon': ['kahapun', 'kahapon'],

        // Demonstratives
        'ito': ['etu', 'itong', 'ito'],
        'iyan': ['yan', 'iyang', 'iyan'],
        'iyon': ['yun', 'iyong', 'iyon'],
        'dito': ['detu', 'ditong', 'dito'],
        'diyan': ['dyan', 'diyang', 'diyan'],
        'doon': ['dun', 'doong', 'doon'],

        // Question words
        'ano': ['anu', 'ano'],
        'sino': ['sinu', 'sino'],
        'saan': ['san', 'saan'],
        'kailan': ['kelan', 'kailan'],
        'bakit': ['baket', 'bakit'],
        'paano': ['pano', 'paanu', 'paano'],

        // Common connectors
        'at': ['at'],
        'o': ['u', 'o'],
        'pero': ['peru', 'pero'],
        'kaya': ['kay', 'kaya'],
        'dahil': ['dahel', 'dahil'],
        'kung': ['kong', 'kung'],
        'para': ['par', 'para'],

        // Adverbs
        'hindi': ['hende', 'di', 'hindi'],
        'oo': ['o', 'oo'],
        'wala': ['wal', 'wala'],
        'meron': ['miron', 'mayron', 'meron'],
        'lagi': ['lage', 'lagi'],
        'minsan': ['mensan', 'minsan'],

        // More common words
        'naman': ['naman'],
        'lang': ['lang'],
        'din': ['rin', 'din'],
        'rin': ['din', 'rin'],
        'kasi': ['kase', 'kasi'],
        'talaga': ['talag', 'talaga'],
        'sobra': ['sobrang', 'sobra'],
        'lahat': ['lahat'],
        'bawat': ['bawat'],
        'ibang': ['iba', 'ibang'],
        'sarili': ['sarele', 'sarili'],
        'mundo': ['mondo', 'mundo'],
        'buhay': ['buhey', 'buhay'],
        'taon': ['taun', 'taon'],
        'buwan': ['buan', 'buwan'],
        'linggo': ['lingo', 'linggo'],
        'oras': ['uras', 'oras']
      };

    // Check if expected word has accent variations
    if (accentMap[normExpected]) {
      if (accentMap[normExpected].includes(normSpoken)) {
        return true;
      }
    }

    // Also check reverse - if spoken word is in the map
    for (const [standard, variations] of Object.entries(accentMap)) {
      if (variations.includes(normSpoken) && standard === normExpected) {
        return true;
      }
    }

    // Calculate similarity metrics
    const distance = levenshtein(normSpoken, normExpected);
    const maxLength = Math.max(normSpoken.length, normExpected.length);
    const minLength = Math.min(normSpoken.length, normExpected.length);
    const similarity = 1 - (distance / maxLength);

    // Length difference check - words should be similar length
    const lengthDiff = Math.abs(normSpoken.length - normExpected.length);
    const lengthRatio = minLength / maxLength;

    // For very short words (3 chars or less), be strict
    if (normExpected.length <= 3) {
      // Require exact match or 1 char difference with 85%+ similarity
      // e.g., "the" vs "tea" = 66%, won't match
      // e.g., "may" vs "mey" = 66% but length diff = 0, should match via accentMap
      const matches = lengthDiff <= 1 && similarity >= 0.85;
      if ((normSpoken === 'in' && normExpected === 'when') || (normSpoken === 'when' && normExpected === 'in')) {
        console.log(`   Checking short word (<=3): similarity=${(similarity * 100).toFixed(0)}%, lengthDiff=${lengthDiff}, threshold=85%, matches=${matches}`);
      }
      return matches;
    }

    // For short words (4 chars), be STRICT - require 90%+ similarity AND similar length
    // This prevents false matches like "isang" vs "asong"
    if (normExpected.length === 4) {
      // Allow max 1 character difference
      if (lengthDiff <= 1 && similarity >= 0.90) {
        return true;
      }
    }

    // For 5-char words, require 95%+ similarity AND very similar length
    // This prevents false matches like "isang" vs "asong" (80% similar, same length)
    if (normExpected.length === 5) {
      // Must be same length or 1 char difference
      if (lengthDiff <= 1 && similarity >= 0.95) {
        return true;
      }
    }

    // For 6-7 char words, require 90%+ similarity AND length ratio > 0.85
    if (normExpected.length >= 6 && normExpected.length <= 7) {
      if (lengthRatio >= 0.85 && similarity >= 0.90) {
        return true;
      }
    }

    // Double Metaphone phonetic match for longer words
    // BUT: Require minimum word length to avoid false positives with short words
    // "in" should NOT match "when" even if phonetically similar
    if (normSpoken.length >= 5 && normExpected.length >= 5) {
      const [primary1, secondary1] = doubleMetaphone(normSpoken);
      const [primary2, secondary2] = doubleMetaphone(normExpected);

      // Check if any phonetic codes match
      if (primary1 === primary2 ||
        (secondary1 && secondary1 === secondary2) ||
        (secondary1 && secondary1 === primary2) ||
        (primary1 === secondary2)) {
        // Additional validation: words should be similar length (within 1 character)
        // This prevents "isang" from matching "asong"
        if (Math.abs(normSpoken.length - normExpected.length) <= 1) {
          return true;
        }
      }
    }

    // For longer words (8+ chars), allow up to 1 character difference
    // More strict to prevent false matches
    if (maxLength >= 8 && distance <= 1) {
      return true;
    }

    // For medium words (5-7 chars), only allow exact match or known variants
    // No fuzzy matching to prevent false positives like "isang" vs "asong"
    // (These should be caught by the accentMap or exact match above)

    if ((normSpoken === 'in' && normExpected === 'when') || (normSpoken === 'when' && normExpected === 'in')) {
      console.log(`   ✗ No match found - returning false`);
    }

    return false;
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

    for (const word of words) {
      const normalized = normalize(word);
      if (!normalized) continue;

      // Add the base word (always)
      vocabulary.add(normalized);

      // For Tagalog stories, only add minimal variations
      // Tagalog doesn't have English-style plurals, past tense, or gerunds
      // Just add the exact words from the story

      // Contraction variations (useful for both languages)
      if (normalized.includes("'")) {
        vocabulary.add(normalized.replace("'", ''));
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

  /**
   * Build a story-specific pronunciation map from the vocabulary.
   * Only includes words that are actually in the story.
   * This makes the mic smarter - it only listens for words from the current story.
   * 
   * @param vocabulary - Set of normalized words from the story
   * @returns Object mapping story words to their pronunciation variants
   */
  const buildStoryPronunciationMap = (vocabulary: Set<string>): { [key: string]: string[] } => {
    const storyMap: { [key: string]: string[] } = {};

    // For each word in the story vocabulary
    for (const word of vocabulary) {
      const normalized = normalize(word);

      // Check if this word exists in the comprehensive Tagalog dictionary
      if (TAGALOG_PRONUNCIATION_DICTIONARY[normalized]) {
        storyMap[normalized] = TAGALOG_PRONUNCIATION_DICTIONARY[normalized];
      }

      // Also check for morphological variants (with/without suffixes)
      // e.g., "asong" in story should match "aso" in dictionary
      const suffixes = ['ng', 'an', 'in', 'ang'];
      for (const suffix of suffixes) {
        if (normalized.endsWith(suffix) && normalized.length > suffix.length + 2) {
          const root = normalized.slice(0, -suffix.length);
          if (TAGALOG_PRONUNCIATION_DICTIONARY[root]) {
            // Add the root word's variants plus the suffixed form
            if (!storyMap[normalized]) {
              storyMap[normalized] = [];
            }
            storyMap[normalized].push(...TAGALOG_PRONUNCIATION_DICTIONARY[root]);
            storyMap[normalized].push(root + suffix);
            storyMap[normalized].push(root); // Also accept root form
          }
        }
      }
    }

    return storyMap;
  };

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



  // Start recording and speech recognition
  const handleStartRecording = () => {
    if (currentSession?.status === "completed") {
      alert("This session is already completed. Recording is disabled.");
      return;
    }
    setIsRecording(true);
    setIsPaused(false);
    setTranscript("");
    voskFinalTranscriptRef.current = ""; // Reset Vosk transcript accumulator
    setWordsRead(0);
    // reset derived metrics
    setElapsedTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setCurrentWordIndex(0);
    voskReconnectAttemptsRef.current = 0; // Reset reconnect attempts

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

    // Use Vosk for both Tagalog and English stories
    const useVosk = storyLanguage === "tagalog" || storyLanguage === "english";
    if (useVosk) {
      try {
        // Railway WebSocket URLs (separate services for each language)
        // Can be configured via environment variables:
        // - VITE_VOSK_WS_URL_TAGALOG: Tagalog WebSocket URL
        // - VITE_VOSK_WS_URL_ENGLISH: English WebSocket URL
        const getRailwayWsUrl = (lang: string) => {
          const env = (import.meta as any)?.env || {};
          
          // Helper to ensure URL has proper format (with / before query params)
          const formatWsUrl = (baseUrl: string, language: string) => {
            // Remove trailing slash if present, then add /?lang=...
            const cleanUrl = baseUrl.replace(/\/$/, '');
            return `${cleanUrl}/?lang=${language}`;
          };
          
          // Use language-specific environment variables if available
          if (lang === "tagalog" || lang === "tl") {
            const tagalogUrl = env.VITE_VOSK_WS_URL_TAGALOG;
            if (tagalogUrl) {
              return formatWsUrl(tagalogUrl, "tagalog");
            }
            // Default fallback
            return formatWsUrl("wss://vigilant-celebration.up.railway.app", "tagalog");
          } else if (lang === "english" || lang === "en") {
            const englishUrl = env.VITE_VOSK_WS_URL_ENGLISH;
            if (englishUrl) {
              return formatWsUrl(englishUrl, "english");
            }
            // Default fallback
            return formatWsUrl("wss://philiready-websocket-english.up.railway.app", "english");
          }
          // Fallback to Tagalog service
          const tagalogUrl = env.VITE_VOSK_WS_URL_TAGALOG;
          if (tagalogUrl) {
            return formatWsUrl(tagalogUrl, "tagalog");
          }
          return formatWsUrl("wss://vigilant-celebration.up.railway.app", "tagalog");
        };
        const wsUrl = getRailwayWsUrl(storyLanguage);
        const startVosk = async (isReconnect: boolean = false) => {
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

            setVoskStatus("connecting");

            // Connection timeout - longer for Railway services (may need time to wake up)
            const connectionTimeout = 20000; // 20 seconds for Railway (may be sleeping on free tier)
            const connectionStartTime = Date.now();
            
            console.log(`🔌 Connecting to: ${wsUrl}`);
            console.log(`⏱️ Connection timeout: ${connectionTimeout / 1000}s`);
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

              // Send vocabulary constraint to Vosk for 100% accurate word recognition
              if (storyVocabulary.size > 0) {
                const vocabularyList = Array.from(storyVocabulary);

                // DISABLED GRAMMAR CONSTRAINT: Too strict, causes <unk> for valid words
                // Previous issue: Child says "gutom" but Vosk returns <unk> because grammar
                // constraint is too strict. Better to let Vosk recognize naturally and filter
                // on frontend where we have more control and can be more lenient for children.
                //
                // Grammar constraint mode - force Vosk to only recognize story words
                const config1 = JSON.stringify({
                  config: {
                    words: true,
                    max_alternatives: 0,
                    grammar: vocabularyList  // Send story vocabulary to Vosk
                  }
                });

                console.log(`🎯 Vosk configured with GRAMMAR CONSTRAINT`);
                console.log(`📝 Sending ${vocabularyList.length} story words to Vosk`);
                console.log(`📝 Vocabulary sample (first 20):`, vocabularyList.slice(0, 20).join(', '));

                // Send config
                try {
                  ws.send(config1);
                  console.log('✓ Sent Vosk config with grammar constraint');
                } catch (e) {
                  console.warn('Failed to send config:', e);
                }
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

              // Audio buffer for capturing the beginning of speech
              const audioBuffer: Int16Array[] = [];
              const MAX_BUFFER_SIZE = 5; // Keep last 5 chunks (~100ms) to catch speech start
              let speechStartDetected = false;
              let consecutiveSpeechFrames = 0;
              let consecutiveSilenceFrames = 0;

              // Setup audio processing
              script.onaudioprocess = (e: AudioProcessingEvent) => {
                try {
                  const channel = e.inputBuffer.getChannelData(0);

                  // Calculate RMS (Root Mean Square) volume to detect silence
                  let sum = 0;
                  let peak = 0;
                  for (let i = 0; i < channel.length; i++) {
                    const abs = Math.abs(channel[i]);
                    sum += channel[i] * channel[i];
                    if (abs > peak) peak = abs;
                  }
                  const rms = Math.sqrt(sum / channel.length);

                  // ULTRA-SENSITIVE AUDIO DETECTION - Optimized for catching first word
                  const SILENCE_THRESHOLD = 0.005;  // 0.5% - extremely sensitive
                  const PEAK_THRESHOLD = 0.02;      // 2% - catches very soft speech
                  const MIN_DYNAMIC_RANGE = 0.003;  // Very low - accepts all speech patterns

                  // Calculate dynamic range (difference between peak and RMS)
                  const dynamicRange = peak - rms;

                  // Speech detection with relaxed criteria to catch first word
                  const isSpeechDetected =
                    rms > SILENCE_THRESHOLD &&
                    peak > PEAK_THRESHOLD &&
                    dynamicRange > MIN_DYNAMIC_RANGE;

                  // Track consecutive frames for stability
                  if (isSpeechDetected) {
                    consecutiveSpeechFrames++;
                    consecutiveSilenceFrames = 0;
                  } else {
                    consecutiveSilenceFrames++;
                    consecutiveSpeechFrames = 0;
                  }

                  setIsDetectingSpeech(isSpeechDetected);

                  // Convert audio to PCM16
                  const pcm16 = downsampleTo16k(channel, ctx.sampleRate || 48000);

                  // Always buffer recent audio (circular buffer)
                  audioBuffer.push(pcm16);
                  if (audioBuffer.length > MAX_BUFFER_SIZE) {
                    audioBuffer.shift();
                  }

                  // Check cooldown - don't send audio during cooldown period
                  if (audioCooldownRef.current) {
                    speechStartDetected = false;
                    consecutiveSpeechFrames = 0;
                    return;
                  }

                  // Detect speech start (2 consecutive frames = ~40ms)
                  if (!speechStartDetected && consecutiveSpeechFrames >= 2) {
                    speechStartDetected = true;

                    // Send buffered audio first to capture the beginning
                    if (ws.readyState === WebSocket.OPEN) {
                      console.log('🎤 Speech start detected - sending buffered audio');
                      for (const bufferedChunk of audioBuffer) {
                        ws.send(bufferedChunk.buffer);
                      }
                      audioBuffer.length = 0; // Clear buffer after sending
                    }
                  }

                  // Send current audio if speech is active
                  if (speechStartDetected && isSpeechDetected) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(pcm16.buffer);
                    } else if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
                      attemptVoskReconnect(startVosk);
                    }
                  }

                  // REAL-TIME FIX: Send EOF after silence to force Vosk to finalize
                  // Reduced from 10 frames (200ms) to 5 frames (100ms) for faster response
                  if (speechStartDetected && consecutiveSilenceFrames >= 5) {
                    // Send EOF to Vosk to finalize recognition
                    if (ws.readyState === WebSocket.OPEN) {
                      try {
                        ws.send(JSON.stringify({ eof: 1 }));
                        console.log('🔚 Sent EOF to Vosk after 100ms silence - forcing finalization');
                      } catch (e) {
                        console.warn('Failed to send EOF:', e);
                      }
                    }
                    
                    speechStartDetected = false;
                    audioBuffer.length = 0;
                  }
                } catch (error) {
                  console.warn("Error processing audio:", error);
                }
              };
              src.connect(script);
              script.connect(ctx.destination);
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
      setTimeout(() => {
        if (isRecording && !isPaused) {
          // Use same Railway URL logic as main Vosk initialization
          const getRailwayWsUrl = (lang: string) => {
            const env = (import.meta as any)?.env || {};
            
            if (lang === "tagalog" || lang === "tl") {
              const tagalogUrl = env.VITE_VOSK_WS_URL_TAGALOG;
              if (tagalogUrl) {
                return `${tagalogUrl}?lang=tagalog`;
              }
              return "wss://vigilant-celebration.up.railway.app?lang=tagalog";
            } else if (lang === "english" || lang === "en") {
              const englishUrl = env.VITE_VOSK_WS_URL_ENGLISH;
              if (englishUrl) {
                return `${englishUrl}?lang=english`;
              }
              return "wss://philiready-websocket-english.up.railway.app?lang=english";
            }
            const tagalogUrl = env.VITE_VOSK_WS_URL_TAGALOG;
            if (tagalogUrl) {
              return `${tagalogUrl}?lang=tagalog`;
            }
            return "wss://vigilant-celebration.up.railway.app?lang=tagalog";
          };
          const wsUrl = getRailwayWsUrl(storyLanguage);

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

              // Use same improved downsampling algorithm
              const downsampleTo16k = (input: Float32Array): Int16Array => {
                const sampleRate = ctx.sampleRate || 48000;
                const targetRate = 16000;
                const ratio = sampleRate / targetRate;
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

                  // Try multiple Vosk configuration formats for compatibility
                  const config1 = JSON.stringify({
                    config: {
                      words: true,
                      max_alternatives: 0,
                      grammar: vocabularyList
                    }
                  });

                  const config2 = JSON.stringify({
                    config: {
                      sample_rate: 16000,
                      words: true,
                      max_alternatives: 0,
                      word_list: vocabularyList
                    }
                  });

                  console.log(`🎯 Sending ${vocabularyList.length} story words to Vosk as grammar constraint (reconnect)`);
                  console.log(`📝 Vocabulary sample (first 20):`, vocabularyList.slice(0, 20).join(', '));

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

                script.onaudioprocess = (e: AudioProcessingEvent) => {
                  try {
                    const channel = e.inputBuffer.getChannelData(0);

                    // Calculate RMS (Root Mean Square) volume to detect silence
                    let sum = 0;
                    let peak = 0;
                    for (let i = 0; i < channel.length; i++) {
                      const abs = Math.abs(channel[i]);
                      sum += channel[i] * channel[i];
                      if (abs > peak) peak = abs;
                    }
                    const rms = Math.sqrt(sum / channel.length);

                    // ULTRA-SENSITIVE AUDIO DETECTION - Optimized for 100% word capture
                    const SILENCE_THRESHOLD = 0.01;  // 1% - ultra-low for very quiet voices
                    const PEAK_THRESHOLD = 0.05;     // 5% - catches even whispers
                    const MIN_DYNAMIC_RANGE = 0.01;  // Very low - accepts all speech patterns

                    // Calculate dynamic range (difference between peak and RMS)
                    const dynamicRange = peak - rms;

                    // Speech detection requires ALL conditions:
                    // 1. RMS above threshold (not too quiet)
                    // 2. Peak above threshold (has clear sound peaks)
                    // 3. Dynamic range sufficient (not constant noise)
                    const isSpeechDetected =
                      rms > SILENCE_THRESHOLD &&
                      peak > PEAK_THRESHOLD &&
                      dynamicRange > MIN_DYNAMIC_RANGE;

                    setIsDetectingSpeech(isSpeechDetected);

                    // Check cooldown - don't send audio during cooldown period
                    if (audioCooldownRef.current) {
                      return; // Skip sending audio during cooldown
                    }

                    // Only send audio data if ALL speech detection criteria are met
                    if (isSpeechDetected) {
                      const pcm16 = downsampleTo16k(channel);
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(pcm16.buffer);
                      }
                    }
                    // If below threshold, don't send anything (silence/noise)
                    // This aggressively filters: background noise, crowd, wind, constant sounds
                  } catch (error) {
                    console.warn("Error processing audio:", error);
                  }
                };
                src.connect(script);
                script.connect(ctx.destination);
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
                    // Filter partial results through vocabulary validation
                    const filteredPartial = filterThroughVocabulary(msg.partial.trim(), storyVocabulary);

                    // Show accumulated + filtered partial for instant feedback
                    if (filteredPartial) {
                      setTranscript(voskFinalTranscriptRef.current + (voskFinalTranscriptRef.current ? " " : "") + filteredPartial);
                    } else {
                      // If no valid words in partial, just show accumulated
                      setTranscript(voskFinalTranscriptRef.current);
                    }
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
      setIsDetectingSpeech(false); // Reset speech detection indicator

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

      // Cleanup Vosk (includes all cleanup logic)
      cleanupVosk();

      // Reset Vosk state
      voskFinalTranscriptRef.current = "";
      voskReconnectAttemptsRef.current = 0;

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

  // Pause/Resume recording (optional)
  const handlePauseRecording = () => {
    setIsPaused(true);
    if (mediaRecorderRef.current) mediaRecorderRef.current.pause();
  };
  const handleResumeRecording = () => {
    setIsPaused(false);
    if (mediaRecorderRef.current) mediaRecorderRef.current.resume();
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

            if (normalizedLang === "tagalog" || normalizedLang === "filipino" || normalizedLang === "none") {
              internalLanguage = "tagalog";
            } else if (normalizedLang === "english") {
              internalLanguage = "english";
            } else {
              // Unknown language value, default to english
              console.warn(`Unknown story language value: "${fullStory.language}", defaulting to English`);
              internalLanguage = "english";
            }

            setStoryLanguage(internalLanguage);
          } else {
            // Default to English if no language is specified
            setStoryLanguage("english");
          }

          // Set text content first (this is what we want to display)
          if (
            fullStory.textContent &&
            fullStory.textContent.trim().length > 0
          ) {
            const trimmedText = fullStory.textContent.trim();
            setStoryText(trimmedText);
            const wordArray = trimmedText
              .split(/\s+/)
              .filter((word: string) => word.length > 0);
            setWords(wordArray);

            // Extract vocabulary for vocabulary-constrained recognition
            const vocabulary = extractVocabulary(trimmedText);
            setStoryVocabulary(vocabulary);

            // Build story-specific pronunciation map from vocabulary
            const pronunciationMap = buildStoryPronunciationMap(vocabulary);
            setStoryPronunciationMap(pronunciationMap);
            console.log(`📚 Story loaded: ${vocabulary.size} vocabulary words, ${Object.keys(pronunciationMap).length} with pronunciation variants, language: ${fullStory.language || 'auto-detect'}`);

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

      // Detect story language
      const detectedLanguage = detectStoryLanguage(vocabulary);
      setStoryLanguage(detectedLanguage);

      console.log(`📚 Story loaded: ${vocabulary.size} vocabulary words, language: ${detectedLanguage}`);
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

      // REAL-TIME OPTIMIZATION: Limit transcript to last 10 words to prevent slowdown
      // This keeps the system fast and responsive for children
      if (transcriptWords.length > 10) {
        console.log(`⚡ TRANSCRIPT TRIM: Keeping only last 10 words (had ${transcriptWords.length})`);
        const trimmedWords = transcriptWords.slice(-10);
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
        if (normExpected.startsWith(normLastWord) && normLastWord.length >= 2) {
          const similarity = normLastWord.length / normExpected.length;
          if (similarity >= 0.60) {  // CHILD-FRIENDLY: 60% of the word (was 75%)
            console.log(`⚡ NEAR-COMPLETE MATCH: "${lastWord}" is 60%+ of "${expectedWord}" - accepting!`);

            // Mark this word as recognized (for green highlighting)
            setRecognizedWords(prev => new Set(prev).add(currentWordIndex));

            // Move yellow highlight to next word (but don't increment wordsRead counter)
            const newIndex = currentWordIndex + 1;
            setCurrentWordIndex(newIndex);
            console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex}`);

            // Remove the last word (matched) and keep remaining words
            const remainingWords = transcriptWords.slice(0, -1); // Remove last word
            voskFinalTranscriptRef.current = remainingWords.join(' ');
            setTranscript(remainingWords.join(' '));
            processedTranscriptWordsRef.current = 0;
            console.log(`🧹 Removed near-complete match "${lastWord}", kept ${remainingWords.length} remaining words: [${remainingWords.join(', ')}]`);

            return;
          }
        }
      }

      // Check RECENT words (last 3 words) to catch fast reading
      // This handles cases where speech recognition splits compound words
      // CRITICAL FIX: First check if current word is ANYWHERE in the full transcript
      // This prevents getting stuck when reading fast
      // BUT: Use STRICT matching to avoid false positives (e.g., "in" matching "when")
      console.log(`🔎 Searching for "${expectedWord}" in full transcript: [${transcriptWords.join(', ')}]`);
      const currentWordInFullTranscript = transcriptWords.some(w => {
        // CHILD-FRIENDLY: More lenient matching for children (75%+ similarity)
        const normSpoken = normalize(w);
        const normExpected = normalize(expectedWord);

        // Exact match
        if (normSpoken === normExpected) {
          console.log(`   ✓ Found exact match: "${w}" matches "${expectedWord}"`);
          return true;
        }

        // CHILD-FRIENDLY: Allow more variations for children's pronunciation
        // Lowered from 85% to 75% to accept more natural child speech
        const distance = levenshtein(normSpoken, normExpected);
        const maxLength = Math.max(normSpoken.length, normExpected.length);
        const similarity = 1 - (distance / maxLength);

        // CHILD-FRIENDLY: 75%+ similarity (was 85%)
        if (similarity >= 0.75) {
          console.log(`   ✓ Found close match: "${w}" matches "${expectedWord}" (${Math.round(similarity * 100)}% similar)`);
          return true;
        }

        return false;
      });

      if (currentWordInFullTranscript) {
        console.log(`✅ FOUND "${expectedWord}" in full transcript! Match detected - moving yellow highlight to next word.`);

        // Mark this word as recognized (for green highlighting)
        setRecognizedWords(prev => new Set(prev).add(currentWordIndex));

        // Move yellow highlight to next word (but don't increment wordsRead counter)
        const newIndex = currentWordIndex + 1;
        setCurrentWordIndex(newIndex);
        console.log(`🟡 Yellow highlight moved from ${currentWordIndex} to ${newIndex}`);

        // Reset and mark as processed
        lastMiscueWordRef.current = "";

        // Find the position of the matched word in the transcript
        const matchedWordIndex = transcriptWords.findIndex(w => {
          const normSpoken = normalize(w);
          const normExpected = normalize(expectedWord);
          if (normSpoken === normExpected) return true;
          const distance = levenshtein(normSpoken, normExpected);
          const maxLength = Math.max(normSpoken.length, normExpected.length);
          const similarity = 1 - (distance / maxLength);
          return similarity >= 0.85;
        });

        // Remove matched word and all words before it from transcript
        if (matchedWordIndex >= 0) {
          const remainingWords = transcriptWords.slice(matchedWordIndex + 1);
          voskFinalTranscriptRef.current = remainingWords.join(' ');
          setTranscript(remainingWords.join(' '));
          processedTranscriptWordsRef.current = 0; // Reset since we have new transcript
          console.log(`🧹 Removed matched word and kept ${remainingWords.length} remaining words: [${remainingWords.join(', ')}]`);
        } else {
          // If we can't find the exact position, clear everything
          voskFinalTranscriptRef.current = "";
          setTranscript("");
          processedTranscriptWordsRef.current = 0;
          console.log("🧹 Cleared entire transcript");
        }

        // NO cooldown - allow continuous processing for fast readers
        console.log("✅ Match detected, keeping audio processing active");

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
        const hasStartedReading = wordsRead > 0 || currentWordIndex > 0;
        if (transcriptWords.length > 0 && currentWordIndex < realWords.length - 1 && hasStartedReading && !foundSplitWordMatch) {
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

              // AUTO-ADVANCE: Move yellow highlight forward when omission is detected
              // The child has already moved ahead, so we must advance to let them continue
              const newIndex = currentWordIndex + 1;
              setCurrentWordIndex(newIndex);
              console.log(`⚠️ Omission marked - auto-advancing yellow highlight from ${currentWordIndex} to ${newIndex}`);
            } else {
              console.log(`⚠️ Omission already marked for word "${expectedWord}" at index ${currentWordIndex} - skipping duplicate`);
            }

            return; // Exit to allow state update to trigger re-render
          }
        }
      }

      // Check RECENT words (last 5 words) to catch fast reading
      const recentWordsCount = Math.min(5, transcriptWords.length);
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
        if (isWordMatch(spokenWord, expectedWord, true)) {
          console.log(`✅ MATCH! "${spokenWord}" = "${expectedWord}" - but not auto-advancing`);
          // AUTO-ADVANCE REMOVED: Teacher must manually advance
          // wordsAdvanced = 1;
          // matched = true;
          break;
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

              // CHILD-FRIENDLY: Auto-advance after split-word match
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

          console.log(`🔬 Compound check: "${normalizedSpoken}" vs "${normalizedExpected}" + "${normalizedNext}"`);

          // Method 1: EXACT concatenation (e.g., "henoticed" = "he" + "noticed")
          const concatenated = normalizedExpected + normalizedNext;
          const isExactConcat = normalizedSpoken === concatenated;

          // Method 2: Check if spoken word contains both expected words in order
          const containsBothInOrder = normalizedSpoken.includes(normalizedExpected) &&
            normalizedSpoken.includes(normalizedNext) &&
            normalizedSpoken.indexOf(normalizedExpected) < normalizedSpoken.indexOf(normalizedNext);

          // Method 3 & 4: Use cached similarity calculation (optimized)
          const similarity = getCachedSimilarity(normalizedSpoken, concatenated);
          const isHighSimilarity = similarity >= 0.85; // Lowered from 90% to 85% for fast readers
          const isMediumSimilarity = similarity >= 0.70; // Raised from 60% to 70% to reduce false positives

          // Method 5: Check if it's a blend (more lenient for fast readers)
          // "luski" from "lost" (los) + "key" (ki)
          const firstPart = normalizedExpected.substring(0, Math.min(3, normalizedExpected.length));
          const lastPart = normalizedNext.substring(Math.max(0, normalizedNext.length - 2));
          const isBlend = normalizedSpoken.length >= 5 && // Increased from 4 to 5 to reduce false positives
            normalizedSpoken.includes(firstPart) &&
            normalizedSpoken.includes(lastPart);

          console.log(`  Exact concat: ${isExactConcat}`);
          console.log(`  Contains both in order: ${containsBothInOrder}`);
          console.log(`  Similarity to "${concatenated}": ${(similarity * 100).toFixed(0)}%`);
          console.log(`  Debug: normalizedSpoken="${normalizedSpoken}", concatenated="${concatenated}"`);
          console.log(`  Is blend: ${isBlend} (has "${firstPart}" and "${lastPart}")`);

          // Match if ANY of these conditions are true (but with stricter thresholds)
          if (isExactConcat || containsBothInOrder || isHighSimilarity || (isMediumSimilarity && normalizedSpoken.length >= 6)) {
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

            // Clear transcript and reset with faster cooldown (10ms for ZERO DELAY)
            audioCooldownRef.current = true;
            setTimeout(() => {
              audioCooldownRef.current = false;
            }, 10); // Reduced to 10ms for ZERO DELAY instant recognition

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

        // 4. INSERTION - Child added extra words that DON'T match ANY story word
        // STRICT: Only count words that are truly extra and not fragments of nearby words
        // CRITICAL: Skip insertion check if we already counted a miscue for this position
        const alreadyCountedMiscue = countedMiscuePositionsRef.current.has(currentWordIndex);

        if (newWords.length > 0 && !alreadyCountedMiscue) {
          let insertionCount = 0;
          const insertedWordsList: string[] = [];

          for (const word of newWords) {
            const normalizedWord = normalize(word);

            // No look-ahead - only check if word matches current expected word or nearby words

            // Check if this word matches ANY word in the story
            const matchesAnyStoryWord = realWords.some(storyWord => isWordMatch(word, storyWord));

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
            // 3. Word is substantial (4+ chars to reduce false positives)
            // 4. Word is not a number or punctuation
            // 5. Word is not a common filler word
            const fillerWords = ['um', 'uh', 'like', 'you', 'know', 'well', 'so', 'and', 'the', 'a'];
            const isFillerWord = fillerWords.includes(normalizedWord);

            if (!matchesAnyStoryWord && !isLikelyFragment && !isFillerWord && word.length >= 4 && /[a-z]/i.test(word)) {
              insertionCount++;
              insertedWordsList.push(word);
              console.log(`⚠️ INSERTION! Child added extra word: "${word}" (not in story)`);
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

          // Method 2: Check if child is re-reading a word CONSECUTIVELY
          // Example: Child reads "the the" or "wanted wanted" (said twice IN A ROW)
          // This should ONLY trigger for consecutive repetitions, not words that appear multiple times in the story
          if (recentWords.length >= 2) {
            const lastWord = recentWords[recentWords.length - 1];
            const secondLastWord = recentWords[recentWords.length - 2];
            const normalizedLast = normalize(lastWord);
            const normalizedSecondLast = normalize(secondLastWord);

            // Check if the last two words are the same (CONSECUTIVE repetition)
            if (normalizedLast === normalizedSecondLast && normalizedLast.length > 0) {
              // Find which story word was repeated
              let repeatedWordIndex = -1;
              for (let i = Math.max(0, currentWordIndex - 3); i <= currentWordIndex && i < realWords.length; i++) {
                if (isWordMatch(lastWord, realWords[i])) {
                  repeatedWordIndex = i;
                  break;
                }
              }

              if (repeatedWordIndex >= 0) {
                const alreadyCountedRepetition = wordMiscues.get(repeatedWordIndex) === 'repetition';

                if (!alreadyCountedRepetition) {
                  console.log(`⚠️ REPETITION! Child said "${lastWord}" twice in a row (story word #${repeatedWordIndex}: "${realWords[repeatedWordIndex]}") - DepEd Rule: Underline repeated portion`);
                  setMiscues(prev => prev + 1);
                  setMiscueTypes(prev => ({ ...prev, repetition: prev.repetition + 1 }));
                  setWordMiscues(prev => new Map(prev).set(repeatedWordIndex, 'repetition'));
                  setWordMarkings(prev => new Map(prev).set(repeatedWordIndex, {
                    type: 'repetition',
                    marking: `Underline repeated word: "${lastWord}" (said twice in a row)`,
                    spokenWord: `${lastWord} ${lastWord}`,
                    correctWord: realWords[repeatedWordIndex]
                  }));

                  // Mark this transcript position as processed
                  processedTranscriptWordsRef.current = transcriptWords.length;
                  return;
                }
              }
            }
          }

          // Method 3: Check for phrase repetition (2 words repeated CONSECUTIVELY)
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
          const isNewWord = newWords.includes(lastWord);

          if (isNewWord && wordsForMiscueDetection.length >= 2) {
            // Check if they said the NEXT word before the current word
            if (currentWordIndex + 1 < realWords.length) {
              const nextExpectedWord = realWords[currentWordIndex + 1];
              const secondLastWord = wordsForMiscueDetection[wordsForMiscueDetection.length - 2];

              // Pattern: They said word[i+1] then word[i] (swapped order)
              if (isWordMatch(secondLastWord, nextExpectedWord) && isWordMatch(lastWord, expectedWord)) {
                console.log(`⚠️ TRANSPOSITION! Child swapped "${expectedWord}" and "${nextExpectedWord}" - DepEd Rule: Use transpositional symbol`);
                setMiscues(prev => prev + 1);
                setMiscueTypes(prev => ({ ...prev, transposition: prev.transposition + 1 }));
                setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'transposition'));
                setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
                  type: 'transposition',
                  marking: `Transpositional symbol over "${expectedWord}" and "${nextExpectedWord}"`,
                  spokenWord: `${secondLastWord} ${lastWord}`,
                  correctWord: `${expectedWord} ${nextExpectedWord}`
                }));
                lastMiscueWordRef.current = miscueKey;
                return;
              }
            }

            // Don't count saying a previous word as transposition - it's likely repetition or re-reading
          }

          // 2. MISPRONUNCIATION vs 3. SUBSTITUTION - Following DepEd Phil-IRI rules
          const similarity = getCachedSimilarity(lastWord, expectedWord);

          // Check for self-correction first (DepEd Rule: Don't count self-correction as error)
          // Pattern: child says wrong word then corrects themselves
          if (wordsForMiscueDetection.length >= 2) {
            const previousWord = wordsForMiscueDetection[wordsForMiscueDetection.length - 2];
            if (isWordMatch(lastWord, expectedWord) && !isWordMatch(previousWord, expectedWord)) {
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

            // AUTO-ADVANCE REMOVED: Teacher must manually advance
            // const newIndex = currentWordIndex + 1;
            // setCurrentWordIndex(newIndex);
            // setWordsRead(newIndex);
            console.log(`⚠️ Mispronunciation (dropped ending) detected but not auto-advancing`);
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

            // AUTO-ADVANCE REMOVED: Teacher must manually advance
            // const newIndex = currentWordIndex + 1;
            // setCurrentWordIndex(newIndex);
            // setWordsRead(newIndex);
            console.log(`⚠️ Mispronunciation detected but not auto-advancing`);

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

            // DISABLED AUTO-ADVANCE: Causes too many false positives
            // The child might self-correct or the teacher should manually advance
            // Previous issue: Child says "kalsada" while expected word is "May" (reading from wrong position)
            // System incorrectly marks as substitution and auto-advances, creating cascade of errors
            //
            // Better approach: Mark the substitution but DON'T auto-advance
            // Let the teacher decide when to move forward or let child self-correct
            console.log(`⚠️ Substitution marked, waiting for teacher intervention or self-correction`);

            // CRITICAL FIX: Clear the transcript after substitution to prevent continued matching
            // Without this, the transcript keeps accumulating and matching subsequent words
            // causing the yellow highlight to advance even though child hasn't read them
            voskFinalTranscriptRef.current = "";
            setTranscript("");
            processedTranscriptWordsRef.current = 0;
            console.log(`🧹 Cleared transcript after substitution to prevent false matches`);
            
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
    { id: string; testName: string; storyId?: string; storyTitle?: string }[]
  >([]);
  const [resolvedTestId, setResolvedTestId] = useState<string>("");

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
    if (!storyKey) {
      console.log("⚠️ No story key found in currentSession.book");
      return;
    }

    console.log("🔍 Looking for test matching story:", storyKey);
    console.log("📚 Available tests:", tests.map(t => ({ id: t.id, name: t.testName, storyId: t.storyId, storyTitle: t.storyTitle })));

    // IMPROVED MATCHING: Try multiple strategies
    let match = tests.find(
      (t) =>
        // Strategy 1: Exact storyId match
        (t.storyId && t.storyId === currentSession.book) ||
        // Strategy 2: Exact storyTitle match
        (t.storyTitle && t.storyTitle.toLowerCase() === storyKey.toLowerCase()) ||
        // Strategy 3: Test name contains story key
        (t.testName && t.testName.toLowerCase().includes(storyKey.toLowerCase())) ||
        // Strategy 4: Story key contains test name (reverse)
        (t.testName && storyKey.toLowerCase().includes(t.testName.toLowerCase())) ||
        // Strategy 5: Story key contains storyTitle
        (t.storyTitle && storyKey.toLowerCase().includes(t.storyTitle.toLowerCase()))
    );

    // If still no match, try fuzzy matching by checking if storyId matches any test's storyId
    if (!match && currentSession.book) {
      match = tests.find(t => t.storyId === currentSession.book);
    }

    // If STILL no match and there's only one test, use it (fallback)
    if (!match && tests.length === 1) {
      console.log("⚠️ Using single available test as fallback");
      match = tests[0];
    }

    if (match) {
      console.log("✅ Test found:", match.testName, "ID:", match.id);
      setResolvedTestId(match.id);
    } else {
      console.log("❌ No matching test found for story:", storyKey);
      console.log("💡 Tip: Make sure the quiz has storyId set to:", currentSession.book);
    }
  }, [tests, currentSession]);

  // Auto-scroll to current word when it changes
  useEffect(() => {
    if (currentWordRef.current && storyContentRef.current && isRecording) {
      const wordElement = currentWordRef.current;
      const container = storyContentRef.current;

      // Calculate position relative to container
      const wordRect = wordElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Check if word is outside visible area
      const isAboveView = wordRect.top < containerRect.top;
      const isBelowView = wordRect.bottom > containerRect.bottom;

      if (isAboveView || isBelowView) {
        // Smooth scroll to center the word in view
        const scrollOffset = wordElement.offsetTop - container.offsetTop - (container.clientHeight / 2) + (wordRect.height / 2);
        container.scrollTo({
          top: scrollOffset,
          behavior: 'smooth'
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

      // Save to MongoDB
      await isrResultService.createISRResult(isrResultData);
    } catch (error) {
      console.error("Error saving ISR result to MongoDB:", error);
      throw error; // Re-throw to show error to user
    }
  };

  const handleCompleteSession = async () => {
    if (!sessionId || !currentSession) return;

    try {
      // If recording is active, stop and wait for audio to finalize
      if (isRecording) {
        await handleStopRecording();
        await waitForAudioFinalization(2500);
      }

      // Update session status to completed
      await readingSessionService.updateSessionStatus(sessionId, "completed");

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
        status: "completed",
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

  // Helper to check if a word has been read/recognized (either advanced past it OR recognized it)
  function isWordRead(realWordIndex: number): boolean {
    return realWordIndex < currentWordIndex || recognizedWords.has(realWordIndex);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 flex flex-col">
      {/* Title */}
      <header className="w-full px-4 sm:px-8 pt-4 sm:pt-8 pb-4 relative z-50 bg-gradient-to-br from-blue-50 via-white to-purple-100">
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
      </header>

      {/* Real-time Mic Heard Indicator */}
      {isRecording && (
        <div className="w-full flex justify-center mb-4">
          <div className={`border-2 rounded-xl px-6 py-3 flex items-center gap-3 shadow-lg text-lg transition-all duration-200 ${isDetectingSpeech
            ? 'bg-green-50 border-green-500 scale-105'
            : 'bg-gray-50 border-gray-300'
            }`}>
            <span className={`font-semibold ${isDetectingSpeech ? 'text-green-700' : 'text-gray-600'}`}>
              mic heard:
            </span>
            <span className={`font-mono text-xl font-bold ${isDetectingSpeech ? 'text-green-900' : 'text-gray-400'
              }`}>
              {transcript.trim().split(/\s+/).filter(Boolean).slice(-1)[0] || '-'}
            </span>
            {isDetectingSpeech && (
              <span className="flex items-center gap-1 text-green-600 text-sm animate-pulse">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                listening
              </span>
            )}
          </div>
        </div>
      )}

      {/* Story Content + Progress Side by Side */}
      <section className="w-full px-4 sm:px-8 mb-6 flex flex-col lg:flex-row gap-4 lg:gap-8 relative z-10">
        {/* Story Content */}
        <div className="flex-1">
          <div className="relative bg-white/80 rounded-2xl lg:rounded-3xl border border-blue-100 p-4 sm:p-6 lg:p-10 overflow-hidden max-h-[40rem] lg:max-h-[48rem]">
            {/* Progress Bar */}
            <div
              className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-t-3xl animate-pulse"
              style={{
                width: `${Math.min(
                  (currentWordIndex / words.length) * 100,
                  100
                )}%`,
              }}
            ></div>
            <div className="mb-4 sm:mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900 flex items-center gap-2">
                <BookOpenIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-blue-500" />{" "}
                Story Content
              </h3>
              <div className="flex items-center gap-3 sm:gap-6 text-sm sm:text-base lg:text-lg text-blue-700">
                <span>{words.length} words</span>
                <span className="hidden sm:inline">•</span>
                <span>
                  {storyText
                    ? storyText.split("\n\n").filter(p => p.trim().length > 0).length
                    : pdfContent.split("\n\n").filter(p => p.trim().length > 0).length}{" "}
                  paragraph{(storyText ? storyText.split("\n\n").filter(p => p.trim().length > 0).length : pdfContent.split("\n\n").filter(p => p.trim().length > 0).length) !== 1 ? 's' : ''}
                </span>
                {isLoadingPdf && <span className="hidden sm:inline">•</span>}
                {isLoadingPdf && <span>Loading PDF…</span>}
              </div>
            </div>
            <div
              ref={storyContentRef}
              className="max-h-[20rem] sm:max-h-[30rem] lg:max-h-[38rem] overflow-y-auto custom-scrollbar prose prose-sm sm:prose-base lg:prose-xl prose-blue bg-white/60 rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 text-sm sm:text-base lg:text-[1.35rem] leading-relaxed tracking-wide"
            >
              {storyText || pdfContent ? (
                (storyText ? storyText : pdfContent)
                  .split("\n\n")
                  .filter((p) => p.trim().length > 0)
                  .map((paragraph, paragraphIndex, paragraphs) => {
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
                        <p className="text-gray-800 leading-relaxed flex flex-wrap gap-y-1 sm:gap-y-2 lg:gap-y-3">
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
                            const isRead = !isSpecialChar && isWordRead(realWordIndex);
                            const miscueType = !isSpecialChar ? wordMiscues.get(realWordIndex) : undefined;

                            // Only show miscue colors AFTER session is completed or stopped (not during active recording)
                            const showMiscueColors = isCompleted || (!isRecording && wordsRead > 0);

                            // Color mapping for miscue types - Balanced: DepEd format + color coding for visibility
                            const getMiscueColor = (type: MiscueType | undefined) => {
                              if (!type || !showMiscueColors) return null; // Hide during recording
                              const colors = {
                                mispronunciation: 'bg-red-50 text-red-900 border border-red-200', // Light red, underlined
                                omission: 'bg-orange-50 text-orange-900 border border-orange-200', // Light orange, circled
                                substitution: 'bg-yellow-50 text-yellow-900 border border-yellow-200', // Light yellow, underlined
                                insertion: 'bg-cyan-50 text-cyan-900 border border-cyan-200', // Light cyan, caret shown
                                repetition: 'bg-blue-50 text-blue-900 border border-blue-200', // Light blue, underlined
                                transposition: 'bg-purple-50 text-purple-900 border border-purple-200', // Light purple, curved line
                                reversal: 'bg-pink-50 text-pink-900 border border-pink-200', // Light pink, word above
                                selfCorrection: 'bg-green-50 text-green-900 border border-green-200' // Light green for self-correction
                              };
                              return colors[type];
                            };

                            // Add DepEd marking indicators - Color-coded underlines for visibility
                            const getMiscueMarkingStyle = (type: MiscueType | undefined) => {
                              if (!type || !showMiscueColors) return {};

                              const styles: { [key in MiscueType]: React.CSSProperties } = {
                                mispronunciation: {
                                  textDecoration: 'underline',
                                  textDecorationColor: '#dc2626', // red-600
                                  textDecorationThickness: '2px',
                                  textDecorationStyle: 'solid'
                                },
                                omission: {
                                  position: 'relative'
                                  // Circle is rendered separately as overlay
                                },
                                substitution: {
                                  textDecoration: 'underline',
                                  textDecorationColor: '#ca8a04', // yellow-600
                                  textDecorationThickness: '2px',
                                  textDecorationStyle: 'solid'
                                },
                                insertion: {
                                  position: 'relative'
                                  // Caret is rendered separately
                                },
                                repetition: {
                                  textDecoration: 'underline',
                                  textDecorationColor: '#2563eb', // blue-600
                                  textDecorationThickness: '2px',
                                  textDecorationStyle: 'solid'
                                },
                                transposition: {
                                  position: 'relative'
                                  // Curved line is rendered separately
                                },
                                reversal: {
                                  position: 'relative'
                                  // No underline, just word above
                                },
                                selfCorrection: {
                                  position: 'relative'
                                  // No underline, just 'S' above
                                }
                              };
                              return styles[type] || {};
                            };

                            // Get marking details for this word
                            const marking = !isSpecialChar ? wordMarkings.get(realWordIndex) : undefined;

                            return (
                              <span
                                key={`${paragraphIndex}-${wordIndex}`}
                                ref={isCurrent ? currentWordRef : null}
                                className={
                                  isSpecialChar
                                    ? "inline-block mr-1 sm:mr-2 lg:mr-3 mb-1 sm:mb-2 px-2 sm:px-3 py-1 sm:py-2 rounded font-serif text-sm sm:text-lg lg:text-2xl text-gray-400 bg-transparent pointer-events-none select-none"
                                    : `inline-block mr-1 sm:mr-2 lg:mr-3 mb-1 sm:mb-2 px-2 sm:px-3 py-1 sm:py-2 rounded font-serif text-sm sm:text-lg lg:text-2xl transition-all duration-300 ease-in-out relative ` +
                                    (isRead
                                      ? "bg-green-100 text-green-800 font-bold shadow-lg border-2 border-green-400"
                                      : isCurrent
                                        ? "bg-yellow-400 text-black font-extrabold shadow-2xl z-10 border-4 border-yellow-600"
                                        : miscueType
                                          ? `${getMiscueColor(miscueType)} font-semibold`
                                          : "bg-blue-50 text-blue-900 hover:bg-blue-100 hover:text-blue-700 cursor-pointer")
                                }
                                style={
                                  isCurrent
                                    ? {
                                      boxShadow: "0 4px 16px rgba(234, 179, 8, 0.8), 0 0 0 4px rgba(234, 179, 8, 0.3)",
                                      transform: "scale(1.15)",
                                      transition: "all 0.3s ease-in-out",
                                      animation: "pulse 1.5s ease-in-out infinite"
                                    }
                                    : miscueType
                                      ? {
                                        ...getMiscueMarkingStyle(miscueType),
                                        transition: "all 0.2s ease-in-out"
                                      }
                                      : isRead
                                        ? {
                                          transition: "all 0.2s ease-in-out"
                                        }
                                        : {
                                          transition: "all 0.2s ease-in-out"
                                        }
                                }
                              >
                                {word}

                                {/* DepEd Phil-IRI Table 4 Marking Annotations - Color-coded for visibility */}
                                {!isSpecialChar && miscueType && showMiscueColors && marking && (
                                  <>
                                    {/* MISPRONUNCIATION: Italic phonetic spelling above, underlined word */}
                                    {marking.type === 'mispronunciation' && (
                                      <span
                                        className="absolute left-0 -top-7 text-sm italic text-red-700 bg-red-100 px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-20 border border-red-300"
                                        style={{ fontFamily: 'cursive' }}
                                        title="DepEd: Underline text and write phonetic spelling above"
                                      >
                                        {marking.spokenWord}
                                      </span>
                                    )}

                                    {/* OMISSION: Circle around word */}
                                    {marking.type === 'omission' && (
                                      <span
                                        className="absolute inset-0 border-2 border-orange-600 rounded-full z-10"
                                        title="DepEd: Circle the omitted word"
                                        style={{
                                          width: 'calc(100% + 8px)',
                                          height: 'calc(100% + 8px)',
                                          left: '-4px',
                                          top: '-4px'
                                        }}
                                      />
                                    )}

                                    {/* SUBSTITUTION: Italic substituted word above, underlined word */}
                                    {marking.type === 'substitution' && (
                                      <span
                                        className="absolute left-0 -top-7 text-sm italic text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-20 border border-yellow-300"
                                        style={{ fontFamily: 'cursive' }}
                                        title="DepEd: Underline text and write substituted word above"
                                      >
                                        {marking.spokenWord}
                                      </span>
                                    )}

                                    {/* INSERTION: Caret (^) after word + italic inserted word above */}
                                    {marking.type === 'insertion' && (
                                      <>
                                        <span
                                          className="absolute -right-3 top-0 text-lg text-cyan-600 font-bold z-20"
                                          title="DepEd: Use caret to show where word was inserted"
                                        >
                                          ^
                                        </span>
                                        <span
                                          className="absolute left-0 -top-7 text-sm italic text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-20 border border-cyan-300"
                                          style={{ fontFamily: 'cursive' }}
                                        >
                                          {marking.spokenWord}
                                        </span>
                                      </>
                                    )}

                                    {/* REPETITION: Underline the repeated portion */}
                                    {marking.type === 'repetition' && (
                                      <span
                                        className="absolute left-0 -bottom-1 w-full border-b-2 border-blue-600 z-10"
                                        title="DepEd: Underline the portion repeated"
                                      />
                                    )}

                                    {/* TRANSPOSITION: Curved line connecting transposed words */}
                                    {marking.type === 'transposition' && (
                                      <span
                                        className="absolute left-full ml-1 top-1/2 transform -translate-y-1/2 text-2xl text-purple-600 font-bold z-20"
                                        title="DepEd: Use transpositional symbol"
                                      >
                                        ⌢
                                      </span>
                                    )}

                                    {/* REVERSAL: Italic correct word above */}
                                    {marking.type === 'reversal' && (
                                      <span
                                        className="absolute left-0 -top-7 text-sm italic text-pink-800 bg-pink-100 px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-20 border border-pink-300"
                                        style={{ fontFamily: 'cursive' }}
                                        title="DepEd: Write correct word above"
                                      >
                                        {marking.correctWord}
                                      </span>
                                    )}

                                    {/* SELF-CORRECTION: Simple 'S' above */}
                                    {marking.type === 'selfCorrection' && (
                                      <span
                                        className="absolute left-0 -top-7 text-base font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full shadow-sm z-20 border-2 border-green-500"
                                        title="DepEd: Write S above self-corrected word"
                                      >
                                        S
                                      </span>
                                    )}
                                  </>
                                )}

                                {/* Show inserted words as floating badges after this word - ONLY after session completes */}
                                {!isSpecialChar && insertedWords.has(realWordIndex) && showMiscueColors && (
                                  <span className="relative">
                                    {insertedWords.get(realWordIndex)!.map((insertedWord, idx) => (
                                      <span
                                        key={`insert-${realWordIndex}-${idx}`}
                                        className="absolute left-0 top-[-20px] bg-cyan-600 text-white text-xs px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-20"
                                        style={{ marginLeft: `${idx * 60}px` }}
                                        title="Inserted word (not in story)"
                                      >
                                        +{insertedWord}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </span>
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
        {/* Progress Column */}
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
            {/* Miscues */}
            <div className="rounded-lg sm:rounded-xl bg-red-100 p-2 sm:p-3 lg:p-4 flex flex-col items-center">
              <span className="text-red-700 font-bold text-xs sm:text-sm lg:text-lg">
                Total Miscues
              </span>
              <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-red-700 mt-1">
                {miscues}
              </span>
              {/* Miscue Types Breakdown */}
              {(miscues > 0 || miscueTypes.selfCorrection > 0) && (
                <div className="mt-2 text-xs text-red-600 space-y-0.5 w-full">
                  {miscueTypes.mispronunciation > 0 && <div>Mispronunciation: {miscueTypes.mispronunciation}</div>}
                  {miscueTypes.omission > 0 && <div>Omission: {miscueTypes.omission}</div>}
                  {miscueTypes.substitution > 0 && <div>Substitution: {miscueTypes.substitution}</div>}
                  {miscueTypes.insertion > 0 && <div>Insertion: {miscueTypes.insertion}</div>}
                  {miscueTypes.repetition > 0 && <div>Repetition: {miscueTypes.repetition}</div>}
                  {miscueTypes.transposition > 0 && <div>Transposition: {miscueTypes.transposition}</div>}
                  {miscueTypes.reversal > 0 && <div>Reversal: {miscueTypes.reversal}</div>}
                  {miscueTypes.selfCorrection > 0 && <div className="text-green-600">Self-Correction: {miscueTypes.selfCorrection}</div>}
                </div>
              )}
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
            {/* Book */}
            <div className="rounded-lg sm:rounded-xl bg-indigo-100 p-2 sm:p-3 lg:p-4 flex flex-col items-center col-span-2 lg:col-span-1">
              <span className="text-indigo-700 font-bold text-xs sm:text-sm lg:text-lg">
                Book
              </span>
              <span className="text-sm sm:text-base lg:text-lg font-semibold text-indigo-700 mt-1 text-center truncate w-full">
                {currentSession?.book}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Miscue Types Observation Panel - Only show after recording stops */}
      {(!isRecording || isCompleted) && (
        <section className="w-full px-4 sm:px-8 pb-4">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl lg:rounded-3xl border-2 border-red-200 p-4 sm:p-6 lg:p-8">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-red-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Miscue Types Detection (Phil-IRI) - Results
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* 1. Mispronunciation */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.mispronunciation > 0 ? 'bg-red-100 border-red-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-red-900 text-sm">1. Mispronunciation</h4>
                    <p className="text-xs text-red-700 italic">Maling Bigkas</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.mispronunciation > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {miscueTypes.mispronunciation}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Underline text, write phonetic spelling above</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> "sleed" above underlined "slide"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Count as 1 error every mispronunciation (dialectal variations not counted)</p>
              </div>

              {/* 2. Omission */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.omission > 0 ? 'bg-orange-100 border-orange-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-orange-900 text-sm">2. Omission</h4>
                    <p className="text-xs text-orange-700 italic">Pagkakaltas</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.omission > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {miscueTypes.omission}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Circle the omitted unit of language</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> Circle "huge" in "The (huge) elephant"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Count as one error a word or phrase omitted</p>
              </div>

              {/* 3. Substitution */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.substitution > 0 ? 'bg-yellow-100 border-yellow-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-yellow-900 text-sm">3. Substitution</h4>
                    <p className="text-xs text-yellow-700 italic">Pagpapalit</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.substitution > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {miscueTypes.substitution}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Underline text, write substituted word above</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> "money" above underlined "monkey"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Count as one error every substitution</p>
              </div>

              {/* 4. Insertion */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.insertion > 0 ? 'bg-cyan-100 border-cyan-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-cyan-900 text-sm">4. Insertion</h4>
                    <p className="text-xs text-cyan-700 italic">Pagsisisingit</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.insertion > 0 ? 'text-cyan-600' : 'text-gray-400'}`}>
                    {miscueTypes.insertion}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Use caret (^) to show where word was inserted, write above</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> "lovely" above caret in "the^ flowers in the vase"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Count a word or phrase inserted as one error</p>
              </div>

              {/* 5. Repetition */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.repetition > 0 ? 'bg-blue-100 border-blue-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm">5. Repetition</h4>
                    <p className="text-xs text-blue-700 italic">Pag-uulit</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.repetition > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {miscueTypes.repetition}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Underline the portion of text that was repeated</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> Underline "in the" in "They found it in the in the"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Count as one error every word or phrase repeated</p>
              </div>

              {/* 6. Transposition */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.transposition > 0 ? 'bg-purple-100 border-purple-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-purple-900 text-sm">6. Transposition</h4>
                    <p className="text-xs text-purple-700 italic">Pagpapalit ng Lugar</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.transposition > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                    {miscueTypes.transposition}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Use transpositional symbol over and under letters/words</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> Curved line connecting "girl" and "is" in "The girl is pretty"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Count as one error every transposition made</p>
              </div>

              {/* 7. Reversal */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.reversal > 0 ? 'bg-pink-100 border-pink-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-pink-900 text-sm">7. Reversal</h4>
                    <p className="text-xs text-pink-700 italic">Paglilipat</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.reversal > 0 ? 'text-pink-600' : 'text-gray-400'}`}>
                    {miscueTypes.reversal}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Write correct word/nonword above the reversed word</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> "bad" above "dab"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Count as one error every reversal made</p>
              </div>

              {/* 8. Self-Correction */}
              <div className={`rounded-xl p-4 border-2 transition-all ${miscueTypes.selfCorrection > 0 ? 'bg-green-100 border-green-400 shadow-lg' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-green-900 text-sm">8. Self-Correction</h4>
                    <p className="text-xs text-green-700 italic">Pagwawasto</p>
                  </div>
                  <span className={`text-2xl font-extrabold ${miscueTypes.selfCorrection > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {miscueTypes.selfCorrection}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-1"><strong>Marking:</strong> Write 'S' above the self-corrected word</p>
                <p className="text-xs text-gray-600 italic"><strong>Example:</strong> "S" above "hasn't"</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Scoring:</strong> Don't count self-correction as an error</p>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 bg-white/70 rounded-lg border border-red-200">
              <p className="text-xs text-gray-700">
                <span className="font-semibold">� DepEed Phil-IRI Summary:</span> These results follow the official DepEd Table 4 marking and scoring guidelines.
                Each miscue type has specific marking conventions and scoring rules as defined in the Philippine Informal Reading Inventory.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <span className="font-semibold">Note:</span> Self-corrections are marked but not counted as errors. Dialectal variations are not counted as mispronunciations.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Session Controls */}
      {!isCompleted && (
        <section className="w-full px-4 sm:px-8 pb-8 relative z-10">
          <div className="bg-white/80 rounded-2xl lg:rounded-3xl border border-blue-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center gap-4 sm:gap-6">
            {/* Language selector + STT Provider/Vosk status badge */}
            <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 -mt-2 -mb-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="recognition-language"
                  className="text-xs sm:text-sm font-semibold text-blue-900"
                >
                  Story Language:
                </label>
                <select
                  id="recognition-language"
                  value={storyLanguage}
                  onChange={(e) =>
                    setStoryLanguage(e.target.value as "english" | "tagalog")
                  }
                  disabled={isRecording}
                  className="text-xs sm:text-sm px-2 py-1 rounded-md border border-blue-200 bg-white text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                  title={isRecording ? "Cannot change language during recording" : "Select story language for speech recognition"}
                >
                  <option value="english">English</option>
                  <option value="tagalog">Tagalog</option>
                </select>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                {/* Always show Vosk status for Tagalog and English stories */}
                {(storyLanguage === "tagalog" || storyLanguage === "english") && (
                  <span
                    className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${voskStatus === "connected"
                      ? "bg-green-100 text-green-800"
                      : voskStatus === "connecting"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                      }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${voskStatus === "connected"
                        ? "bg-green-500 animate-pulse"
                        : voskStatus === "connecting"
                          ? "bg-yellow-500 animate-pulse"
                          : "bg-red-500"
                        }`}
                    ></span>
                    <span className="hidden sm:inline">
                      {voskStatus === "connected"
                        ? `Vosk ${storyLanguage === "tagalog" ? "Tagalog" : "English"} Model: Connected`
                        : voskStatus === "connecting"
                          ? `Vosk ${storyLanguage === "tagalog" ? "Tagalog" : "English"} Model: Connecting…`
                          : `Vosk ${storyLanguage === "tagalog" ? "Tagalog" : "English"} Model: Disconnected`}
                    </span>
                    <span className="sm:hidden">
                      {voskStatus === "connected"
                        ? `Vosk ${storyLanguage === "tagalog" ? "TL" : "EN"}`
                        : voskStatus === "connecting"
                          ? `Vosk ${storyLanguage === "tagalog" ? "TL" : "EN"}...`
                          : `Vosk ${storyLanguage === "tagalog" ? "TL" : "EN"}`}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 mb-2">
              <MicrophoneIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-blue-500" />
              <h4 className="text-base sm:text-lg font-bold text-blue-900">
                Session Controls
              </h4>
            </div>
            <div className="flex flex-row flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6 w-full">
              {!isRecording ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <button
                    onClick={handleStartRecording}
                    className="flex items-center justify-center gap-2 sm:gap-3 px-8 sm:px-12 lg:px-16 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg sm:text-xl lg:text-2xl font-bold hover:scale-105 hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg"
                  >
                    <MicrophoneIcon className="h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
                    <span>Start Reading Session</span>
                  </button>
                  <p className="text-sm text-gray-500 text-center">
                    Click to begin recording the student's reading
                  </p>
                </div>
              ) : (
                <>
                  {isPaused ? (
                    <button
                      onClick={handleResumeRecording}
                      className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-400 to-blue-400 text-white text-base sm:text-lg lg:text-xl font-bold hover:scale-105 transition-all duration-200"
                      title="Resume Recording"
                    >
                      <PlayIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                      <span className="hidden sm:inline">Resume</span>
                      <span className="sm:hidden">Resume</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseRecording}
                      className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-base sm:text-lg lg:text-xl font-bold hover:scale-105 transition-all duration-200"
                      title="Pause Recording"
                    >
                      <PauseIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                      <span className="hidden sm:inline">Pause</span>
                      <span className="sm:hidden">Pause</span>
                    </button>
                  )}
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold text-red-600">Recording in Progress</span>
                    </div>
                    <button
                      onClick={handleStopRecording}
                      className="flex items-center gap-2 sm:gap-3 px-8 sm:px-12 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white text-lg sm:text-xl font-bold hover:scale-105 transition-all duration-200 shadow-lg"
                    >
                      <StopIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                      <span>Stop & Save Session</span>
                    </button>
                  </div>
                  {/* Skip Word Button - for when stuck (DepEd Rule: Manual omission) */}
                  <button
                    onClick={() => {
                      const skippedWord = realWords[currentWordIndex];
                      console.log(`⏭️ Manual skip: Advancing from word ${currentWordIndex} ("${skippedWord}") - DepEd Rule: Circle omitted word`);

                      // Mark as omission following DepEd rules
                      setMiscues(prev => prev + 1);
                      setMiscueTypes(prev => ({ ...prev, omission: prev.omission + 1 }));
                      setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'omission'));
                      setWordMarkings(prev => new Map(prev).set(currentWordIndex, {
                        type: 'omission',
                        marking: `Circle the omitted word: "${skippedWord}"`,
                        spokenWord: '(manually skipped)',
                        correctWord: skippedWord
                      }));

                      // Advance to next word
                      setCurrentWordIndex(prev => prev + 1);
                      setWordsRead(prev => prev + 1);
                    }}
                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gray-500 to-gray-600 text-white text-sm sm:text-base lg:text-lg font-bold hover:scale-105 transition-all duration-200"
                    title="Skip current word (counts as omission)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" />
                    </svg>
                    <span className="hidden lg:inline">Skip</span>
                  </button>
                </>
              )}
              {!isCompleted && (
                <button
                  onClick={handleCompleteSession}
                  className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 text-white text-base sm:text-lg lg:text-xl font-bold hover:scale-105 transition-all duration-200"
                  title="Complete Session"
                >
                  <ChartBarIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                  <span className="hidden sm:inline">Complete Session</span>
                  <span className="sm:hidden">Complete</span>
                </button>
              )}
            </div>
            {/* Download Audio Button (show only if audioUrl exists) */}
            {audioUrl && (
              <button
                onClick={handleDownloadAudio}
                className="mt-4 sm:mt-6 flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-gradient-to-r from-green-400 to-blue-400 text-white text-sm sm:text-base lg:text-lg font-bold hover:scale-105 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                title="Download audio recording"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                  />
                </svg>
                <span className="hidden sm:inline">Download Audio</span>
                <span className="sm:hidden">Download</span>
              </button>
            )}
          </div>
        </section>
      )}
      {/* Bottom Quiz Button */}
      <div className="w-full px-4 sm:px-8 py-4 mt-auto bg-white/80 border-t border-blue-100">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              if (!currentSession) return;
              // choose student deterministically: first completed, else first in list
              const completedIds = Object.keys(completedStudents).filter(
                (id) => completedStudents[id]
              );

              // Extract student IDs from students array (handle both old and new format)
              const studentIds = currentSession.students.map(s =>
                typeof s === 'string' ? s : s.id
              );

              const studentId =
                currentSession.students.length === 1
                  ? studentIds[0]
                  : completedIds[0] || studentIds[0];

              // Get student name (handle both old and new format)
              const firstStudent = currentSession.students[0];
              const studentName = typeof firstStudent === 'string'
                ? (studentNames[studentId] || studentId)
                : firstStudent.name;
              if (!resolvedTestId) {
                alert("No test found for this story.");
                return;
              }

              navigate(`/student/test/${resolvedTestId}` as any, {
                state: {
                  studentId,
                  studentName,
                  teacherId: currentSession.teacherId,
                },
              });
            }}
            disabled={false}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all duration-200 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 hover:scale-[1.01]"
          >
            Quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReadingSessionPage;