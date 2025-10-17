import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { resultService } from '../../services/resultsService';
import { getAuth } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';

// Confetti component for celebration
const Confetti: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center animate-fade-in">
    <div className="absolute inset-0 overflow-hidden">
      {[...Array(60)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${10 + Math.random() * 16}px`,
            height: `${10 + Math.random() * 16}px`,
            background: `hsl(${Math.random() * 360}, 90%, 60%)`,
            opacity: 0.7,
            animation: `confetti-fall 1.5s ${Math.random()}s ease-out forwards`,
          }}
        />
      ))}
    </div>
    <style>{`
      @keyframes confetti-fall {
        0% { transform: translateY(-100vh) scale(1); opacity: 1; }
        100% { transform: translateY(100vh) scale(0.7); opacity: 0; }
      }
      .animate-fade-in { animation: fadeIn 0.5s; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    `}</style>
  </div>
);

interface Question {
  question: string;
  choices: string[];
  correctAnswer: number;
}

interface Test {
  testName: string;
  instructions: string;
  questions: Question[];
  randomizeAnswers?: boolean;
}

function getRandomizedChoices(choices: string[]): string[] {
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const StudentTestPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const location = useLocation();
  const studentName = location.state?.studentName || null;
  const studentId = location.state?.studentId || null;
  const teacherId = location.state?.teacherId || null;
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [shuffledChoices, setShuffledChoices] = useState<string[][]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loadingActive, setLoadingActive] = useState(false);
  const prevSelectedRef = useRef<number>(-1);
  const [gapActive, setGapActive] = useState(false);
  const gapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [teacherName, setTeacherName] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [quizColor, setQuizColor] = useState('blue');
  const { userRole, currentUser } = useAuth();

  // Countdown state for answer selection
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const selectedAnswerRef = useRef<number | null>(null);

  // Restart session utility removed (unused)

  // Ensure studentId and studentName are present
  useEffect(() => {
    if (!studentId || !studentName) {
      alert('No student selected for this test. Please go back and select a student.');
      navigate(-1);
    }
  }, [studentId, studentName, navigate]);

  // Fetch teacher name
  useEffect(() => {
    const fetchTeacherName = async () => {
      if (!teacherId) return;
      try {
        const teacherDoc = await getDoc(doc(db, 'users', teacherId));
        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          setTeacherName(teacherData.displayName || teacherData.name || 'Unknown Teacher');
        } else {
          setTeacherName('Unknown Teacher');
        }
      } catch (error) {
        console.error('Error fetching teacher name:', error);
        setTeacherName('Unknown Teacher');
      }
    };
    fetchTeacherName();
  }, [teacherId]);

  // Robustly try to start background music; falls back to first user gesture
  const ensureMusicPlaying = async () => {
    try {
      if (audioRef.current) {
        await audioRef.current.play();
        setMusicOn(true);
        return true;
      }
    } catch (_) {
      // Autoplay blocked; will try again on first user interaction
    }
    return false;
  };

  useEffect(() => {
    // Attach a one-time user gesture listener to force playback if blocked
    const resumeOnGesture = async () => {
      const started = await ensureMusicPlaying();
      if (started) {
        window.removeEventListener('pointerdown', resumeOnGesture, true);
        window.removeEventListener('keydown', resumeOnGesture, true);
      }
    };
    window.addEventListener('pointerdown', resumeOnGesture, true);
    window.addEventListener('keydown', resumeOnGesture, true);
    return () => {
      window.removeEventListener('pointerdown', resumeOnGesture, true);
      window.removeEventListener('keydown', resumeOnGesture, true);
    };
  }, []);

  useEffect(() => {
    const fetchTest = async () => {
      if (!testId) return;
      const docRef = doc(db, 'tests', testId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const testData = docSnap.data() as Test;
        setTest(testData);
        setAnswers(Array(testData.questions.length).fill(-1));
        // Shuffle choices if needed
        if (testData.randomizeAnswers) {
          setShuffledChoices(testData.questions.map(q => getRandomizedChoices(q.choices)));
        } else {
          setShuffledChoices(testData.questions.map(q => q.choices));
        }
        // Try to auto-start background music immediately
        await ensureMusicPlaying();
      }
    };
    fetchTest();
  }, [testId]);

  // Set initial audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSelect = (qIdx: number, cIdx: number) => {
    if (submitted) return; // Cannot change answer after submission

    // Clear any existing countdown
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }

    const newAnswers = [...answers];
    newAnswers[qIdx] = cIdx;
    setAnswers(newAnswers);
    selectedAnswerRef.current = cIdx; // Store the selected choice

    // Start countdown for 3 seconds
    setCountdown(3);
    countdownRef.current = setTimeout(() => {
      // If countdown finishes and no new selection, auto-advance
      if (qIdx < test!.questions.length - 1) {
        setCurrentQuestion(qIdx + 1);
      } else {
        // If it's the last question, submit the quiz
        handleSubmit();
      }
      setCountdown(null); // Clear countdown display
      selectedAnswerRef.current = null; // Clear selected answer ref
      }, 3000);
  };

  // Write to 'recenttests' collection in Firestore
  const writeRecentTest = async (score: number) => {
    const enableRecent = (import.meta as any)?.env?.VITE_ENABLE_RECENTTESTS === 'true';
    if (!enableRecent) return; // disabled by default to avoid Firestore errors
    // Only teachers/parents should write this auxiliary collection; silently skip otherwise
    if (!teacherId || !testId || !test || !studentId) return;
    if (userRole !== 'teacher' && userRole !== 'parent') return;
    try {
      await addDoc(collection(db, 'recenttests'), {
        teacherId,
        testId,
        testName: test.testName,
        studentId,
        studentName,
        createdAt: Timestamp.now(),
        score,
      });
    } catch (error) {
      // Do not interrupt quiz if permissions are missing
      console.warn('Skipping recenttests write (permission or network):', (error as any)?.message || error);
    }
  };

  // New: Save result handler for modal
  const handleSaveResult = async () => {
    console.log('Save Result button clicked');
    if (!test || !currentUser) return;
    const correct = score ?? 0;
    const now = new Date();
    let testResultData: any = {
      testId,
      testName: test.testName,
      testCategory: (test as any).testCategory || '',
      studentName: studentName || '',
      type: 'test' as const,
      totalQuestions: test.questions.length,
      correctAnswers: correct,
      score: Math.round((correct / test.questions.length) * 100),
      comprehension: Math.round((correct / test.questions.length) * 100),
      answers: test.questions.map((q, i) => ({
        questionId: `${testId}-q${i}`,
        question: q.question,
        selectedAnswer: answers[i] !== -1 ? (test.randomizeAnswers ? shuffledChoices[i][answers[i]] : q.choices[answers[i]]) : '',
        correctAnswer: q.choices[q.correctAnswer],
        isCorrect: answers[i] !== -1 && ((test.randomizeAnswers ? shuffledChoices[i][answers[i]] : q.choices[q.correctAnswer]) === q.choices[q.correctAnswer])
      })),
      testDate: now,
    };
    if (userRole === 'teacher' || userRole === 'parent') {
      testResultData.teacherId = currentUser.uid;
      testResultData.studentId = studentId;
    } else {
      alert('Only teachers and parents can save test results.');
      setSavingResult(false);
      return;
    }
    try {
      setSavingResult(true);
      const auth = getAuth();
      if (!auth.currentUser) {
        alert('You must be logged in to save your test result.');
        console.error('No authenticated user.');
        setSavingResult(false);
        return;
      }
      console.log('Authenticated user:', auth.currentUser.uid, 'Role:', userRole);
      await resultService.createTestResult(testResultData);
      setSavingResult(false);
      setSaveSuccess(true);
    } catch (error) {
      setSavingResult(false);
      console.error('Error saving test result:', error);
      alert('Error saving test result: ' + ((error as any)?.message || error));
    }
  };

  // Update handleSubmit to only handle quiz logic
  const handleSubmit = async () => {
    if (!test) return;
    let correct = 0;
    test.questions.forEach((q, i) => {
      let correctIdx = q.correctAnswer;
      if (test.randomizeAnswers) {
        correctIdx = shuffledChoices[i].findIndex(
          (choice) => choice === q.choices[q.correctAnswer]
        );
      }
      if (answers[i] === correctIdx) correct++;
    });
    setScore(correct);
    setSubmitted(true);
    setShowConfetti(true);
    writeRecentTest(Math.round((correct / test.questions.length) * 100));
  };

  // Navigation handlers no longer used (auto-advance)

  // Music toggle handler
  const handleMusicToggle = () => {
    if (!audioRef.current) return;
    if (musicOn) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setMusicOn(false);
    } else {
      audioRef.current.play();
      setMusicOn(true);
    }
  };

  // Music volume handler
  const handleVolumeChange = (volume: number) => {
    setMusicVolume(volume);
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  };

  // Quiz color themes
  const colorThemes = {
    blue: {
      primary: 'from-blue-400 to-blue-600',
      secondary: 'bg-blue-500',
      accent: 'border-blue-600',
      ring: 'ring-blue-300',
      hover: 'hover:bg-blue-600',
      selected: 'bg-blue-500 border-blue-600 text-white ring-4 ring-blue-300',
      labelColor: 'text-blue-700'
    },
    purple: {
      primary: 'from-purple-400 to-purple-600',
      secondary: 'bg-purple-500',
      accent: 'border-purple-600',
      ring: 'ring-purple-300',
      hover: 'hover:bg-purple-600',
      selected: 'bg-purple-500 border-purple-600 text-white ring-4 ring-purple-300',
      labelColor: 'text-purple-700'
    },
    green: {
      primary: 'from-green-400 to-green-600',
      secondary: 'bg-green-500',
      accent: 'border-green-600',
      ring: 'ring-green-300',
      hover: 'hover:bg-green-600',
      selected: 'bg-green-500 border-green-600 text-white ring-4 ring-green-300',
      labelColor: 'text-green-700'
    },
    orange: {
      primary: 'from-orange-400 to-orange-600',
      secondary: 'bg-orange-500',
      accent: 'border-orange-600',
      ring: 'ring-orange-300',
      hover: 'hover:bg-orange-600',
      selected: 'bg-orange-500 border-orange-600 text-white ring-4 ring-orange-300',
      labelColor: 'text-orange-700'
    },
    pink: {
      primary: 'from-pink-400 to-pink-600',
      secondary: 'bg-pink-500',
      accent: 'border-pink-600',
      ring: 'ring-pink-300',
      hover: 'hover:bg-pink-600',
      selected: 'bg-pink-500 border-pink-600 text-white ring-4 ring-pink-300',
      labelColor: 'text-pink-700'
    }
  };

  const currentTheme = colorThemes[quizColor as keyof typeof colorThemes] || colorThemes.blue;

  // Safe click sound: fall back or noop if unsupported/missing
  const popSoundRef = useRef<HTMLAudioElement | null>(null);
  if (!popSoundRef.current) {
    try {
      const audioEl = new Audio();
      // Prefer mp3; use an existing asset if custom sound is missing
      const canMp3 = audioEl.canPlayType('audio/mpeg');
      if (canMp3) {
        audioEl.src = '/music/testmusic1.mp3';
        audioEl.preload = 'auto';
        audioEl.volume = 0.15;
        popSoundRef.current = audioEl;
      } else {
        popSoundRef.current = null; // unsupported; noop later
      }
    } catch {
      popSoundRef.current = null;
    }
  }
  const playPopSound = () => {
    const el = popSoundRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      void el.play().catch(() => {});
    } catch {}
  };

  // Clean up timers on unmount or question change
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    // Reset loading and gap when question changes
    setLoadingActive(false);
    setLoadingProgress(0);
    prevSelectedRef.current = answers[currentQuestion];
    if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    setGapActive(false);
    setCountdown(null);
    selectedAnswerRef.current = null;
  }, [currentQuestion]);

  if (!test) return (
    <div className="flex justify-center items-center min-h-screen w-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600">
      <div className="flex flex-col items-center justify-center py-8 px-6">
        {/* Enhanced Square Loading Animation */}
        <div className="relative mb-8">
          <div className="grid grid-cols-2 gap-2 w-16 h-16">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg animate-pulse"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '1.2s'
                }}
              />
            ))}
          </div>
          {/* Pulsing Ring */}
          <div className="absolute inset-0 rounded-lg border-4 border-blue-300 animate-ping opacity-20"></div>
        </div>
        
        {/* Loading Text with Typing Animation */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 animate-pulse">
            Loading Quiz
          </h2>
          <p className="text-blue-200 text-sm md:text-base animate-bounce">
            Preparing your reading assessment...
          </p>
        </div>
        
        {/* Progress Dots */}
        <div className="flex space-x-2 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed top-32 left-4 z-50 flex flex-col gap-4 items-center">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-white/30 hover:bg-white/60 text-white shadow-lg transition-all"
          aria-label="Go back"
          title="Go back"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {/* Settings Icon */}
        <button
          className="flex items-center justify-center w-12 h-12 rounded-full bg-white/30 hover:bg-white/60 text-white shadow-lg transition-all"
          aria-label="Settings"
          title="Settings"
          onClick={() => setShowSettings(true)}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        {/* Music Icon */}
        <button
          className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${musicOn ? 'bg-green-400 text-white' : 'bg-white/30 hover:bg-white/60 text-white'}`}
          aria-label={musicOn ? 'Turn music off' : 'Turn music on'}
          title={musicOn ? 'Turn music off' : 'Turn music on'}
          onClick={handleMusicToggle}
        >
          {musicOn ? (
            // Music ON icon (standard note)
            <svg className="w-7 h-7" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 19V6l8-2v13" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="19" r="2.5" fill="white" />
              <circle cx="17" cy="17" r="2.5" fill="white" />
            </svg>
          ) : (
            // Music OFF icon (outline note)
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l8-2v13" />
              <circle cx="9" cy="19" r="2.5" />
              <circle cx="17" cy="17" r="2.5" />
            </svg>
          )}
        </button>
      </div>
      {/* Navigation arrows removed per requirements */}
      <div className="fixed top-0 left-0 min-h-screen h-screen w-screen flex flex-col justify-center items-center bg-gradient-to-br from-[#253347] via-[#253347] to-[#b4c5e4] font-[Comic Sans MS, Comic Sans, cursive, sans-serif] overflow-hidden z-40">
        {showConfetti && <Confetti />}
        {/* Celebration Modal */}
        {submitted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col items-stretch border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold truncate">{test?.testName}</div>
              <button
                    className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-2xl font-bold"
                onClick={() => { setSubmitted(false); setShowScoreDetails(false); }}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
                </div>
              </div>
              {!showScoreDetails ? (
                <div className="p-6 md:p-8 overflow-y-auto">
                  {saveSuccess && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 font-semibold text-center">
                      ✅ Test result saved successfully
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-4 mb-6">
                    {/* Score Ring */}
                    <div className="relative w-28 h-28">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400 to-emerald-500"></div>
                      <div className="absolute inset-[6px] rounded-full bg-white flex items-center justify-center">
                        <span className="text-3xl font-extrabold text-gray-900">
                          {typeof score === 'number' && test ? Math.round((score / test.questions.length) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-extrabold text-gray-900 text-center">Well done!</div>
                    <div className="text-gray-600 text-center">You've finished this session. What would you like to do next?</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      className={`w-full px-6 py-4 rounded-2xl text-base md:text-lg font-bold shadow transition-all ${saveSuccess ? 'bg-green-600 text-white cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      onClick={saveSuccess ? undefined : handleSaveResult}
                      disabled={savingResult || saveSuccess}
                    >
                      {savingResult ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2 inline text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                          Saving...
                        </>
                      ) : saveSuccess ? 'Saved' : 'Save Result'}
                    </button>
                    <button
                      className="w-full px-6 py-4 bg-violet-600 text-white rounded-2xl text-base md:text-lg font-bold shadow hover:bg-violet-700 transition-all"
                      onClick={() => setShowScoreDetails(true)}
                    >
                      View ISR
                    </button>
                    <button
                      className="w-full px-6 py-4 bg-emerald-600 text-white rounded-2xl text-base md:text-lg font-bold shadow hover:bg-emerald-700 transition-all"
                      onClick={() => navigate('/teacher/Reading')}
                    >
                      Back to Reading Sessions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full overflow-y-auto">
                  {/* ISR Form Header */}
                  <div className="w-full text-center mb-4 sticky top-0 bg-white pb-4 border-b border-gray-200">
                    <h2 className="text-xl md:text-2xl font-bold text-blue-900 mb-2">Phil-IRI Form 3A, Pahina 4</h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div><strong>School:</strong> CCDES</div>
                      <div><strong>Teacher:</strong> {teacherName || 'Loading...'}</div>
                      <div><strong>Student:</strong> {studentName || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Part A - Comprehension Section */}
                  <div className="w-full mb-4 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                    <h3 className="text-base font-bold text-blue-900 mb-4">PART A - Comprehension</h3>
                    
                    {/* First Row: Reading Time and Rate */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-blue-800 whitespace-nowrap">Kabuuang Oras ng Pagbasa:</label>
                        <input 
                          type="text" 
                          className="w-12 px-2 py-1 border border-blue-300 rounded text-center font-semibold text-sm"
                          value={Math.round((test!.questions.length * 2) / 60)} // Estimated reading time in minutes
                          readOnly
                        />
                        <span className="text-sm text-blue-700">minuto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-blue-800 whitespace-nowrap">Rate ng Pagbasa:</label>
                        <input 
                          type="text" 
                          className="w-12 px-2 py-1 border border-blue-300 rounded text-center font-semibold text-sm"
                          value={Math.round((test!.questions.length * 15) / Math.max(1, Math.round((test!.questions.length * 2) / 60)))} // Estimated WPM
                          readOnly
                        />
                        <span className="text-sm text-blue-700">salita /minuto</span>
                      </div>
                    </div>

                    {/* Second Row: Questions Section */}
                    <div className="mb-2">
                      <label className="block text-sm font-semibold text-blue-800 mb-3">Sagot sa mga Tanong:</label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-blue-700 whitespace-nowrap">Marka:</label>
                          <input 
                            type="text" 
                            className="w-12 px-2 py-1 border border-blue-300 rounded text-center font-semibold text-sm"
                            value={typeof score === 'number' ? Math.round((score / test!.questions.length) * 100) : 0}
                            readOnly
                          />
                          <span className="text-sm text-blue-700">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-blue-700 whitespace-nowrap">Comprehension Level:</label>
                          <input 
                            type="text" 
                            className="w-24 px-2 py-1 border border-blue-300 rounded text-center font-semibold text-sm"
                            value={typeof score === 'number' ? (score / test!.questions.length >= 0.8 ? 'Independent' : score / test!.questions.length >= 0.5 ? 'Instructional' : 'Frustration') : 'N/A'}
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Part B - Word Reading Section */}
                  <div className="w-full mb-4 p-3 border-2 border-green-200 rounded-lg bg-green-50">
                    <h3 className="text-base font-bold text-green-900 mb-3">PART B - Word Reading (Pagbasa)</h3>
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div>
                          <label className="text-xs font-semibold text-green-800">Seleksyon:</label>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-green-700">Level:</span>
                            <input 
                              type="text" 
                              className="w-12 px-1 py-1 border border-green-300 rounded text-center text-xs"
                              value="3A"
                              readOnly
                            />
                            <span className="text-xs text-green-700">Set:</span>
                            <input 
                              type="text" 
                              className="w-12 px-1 py-1 border border-green-300 rounded text-center text-xs"
                              value="A"
                              readOnly
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Miscues Table */}
                    <div className="mb-3 overflow-x-auto">
                      <table className="w-full border-collapse border border-green-300 text-xs">
                        <thead>
                          <tr className="bg-green-200">
                            <th className="border border-green-300 px-1 py-1 text-left w-8">#</th>
                            <th className="border border-green-300 px-1 py-1 text-left">Types of Miscues (Uri ng Mali)</th>
                            <th className="border border-green-300 px-1 py-1 text-left w-16">Number of Miscues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { id: 1, type: 'Mispronunciation (Maling Bigkas)', miscues: 0 },
                            { id: 2, type: 'Omission (Pagkakaltas)', miscues: 0 },
                            { id: 3, type: 'Substitution (Pagpapalit)', miscues: 0 },
                            { id: 4, type: 'Insertion (Pagsisingit)', miscues: 0 },
                            { id: 5, type: 'Repetition (Pag-uulit)', miscues: 0 },
                            { id: 6, type: 'Transposition (Pagpapalit ng lugar)', miscues: 0 },
                            { id: 7, type: 'Reversal (Paglilipat)', miscues: 0 }
                          ].map((miscue) => (
                            <tr key={miscue.id}>
                              <td className="border border-green-300 px-1 py-1 text-center">{miscue.id}</td>
                              <td className="border border-green-300 px-1 py-1 text-xs">{miscue.type}</td>
                              <td className="border border-green-300 px-1 py-1 text-center">
                                <input 
                                  type="text" 
                                  className="w-8 px-1 py-0.5 border border-green-300 rounded text-center text-xs"
                                  value={miscue.miscues}
                                  readOnly
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Fields */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block font-semibold text-green-800 mb-1">Total Miscues (Kabuuan)</label>
                        <input 
                          type="text" 
                          className="w-full px-2 py-1 border border-green-300 rounded text-center font-semibold text-xs"
                          value="0"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-green-800 mb-1">Number of Words in the Passage</label>
                        <input 
                          type="text" 
                          className="w-full px-2 py-1 border border-green-300 rounded text-center font-semibold text-xs"
                          value={test!.questions.length * 15} // Estimated words
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-green-800 mb-1">Word Reading Score</label>
                        <input 
                          type="text" 
                          className="w-full px-2 py-1 border border-green-300 rounded text-center font-semibold text-xs"
                          value={typeof score === 'number' ? Math.round((score / test!.questions.length) * 100) : 0}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-green-800 mb-1">Word Reading Level (Antas ng Pagbasa)</label>
                        <input 
                          type="text" 
                          className="w-full px-2 py-1 border border-green-300 rounded text-center font-semibold text-xs"
                          value={typeof score === 'number' ? (score / test!.questions.length >= 0.8 ? 'Independent' : score / test!.questions.length >= 0.5 ? 'Instructional' : 'Frustration') : 'N/A'}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
        {/* Loading Overlay */}
        {savingResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center">
              <svg className="animate-spin h-10 w-10 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
              <span className="text-lg font-bold text-blue-700">Saving your test result...</span>
            </div>
          </div>
        )}
        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Settings</h2>
              <button
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xl font-bold"
                    onClick={() => setShowSettings(false)}
                    aria-label="Close"
              >
                    ×
              </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Music Volume */}
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">Music Volume</h3>
                    <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-bold rounded-full">
                      {Math.round(musicVolume * 100)}%
                    </div>
                  </div>
                  
                  {/* Volume Control */}
                  <div className="space-y-3">
                    {/* Slider Container */}
                    <div className="relative">
                      <div className="flex items-center space-x-3">
                        {/* Mute Button */}
                        <button
                          onClick={() => handleVolumeChange(0)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                            musicVolume === 0 
                              ? 'bg-red-500 text-white shadow-lg' 
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L5.5 14.5H3a1 1 0 01-1-1V6.5a1 1 0 011-1h2.5l2.883-3.316a1 1 0 011.617.816zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {/* Slider */}
                        <div className="flex-1 relative">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={musicVolume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer slider-new"
                          />
                          {/* Progress Fill */}
                          <div 
                            className="absolute top-0 left-0 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full pointer-events-none"
                            style={{ width: `${musicVolume * 100}%` }}
                          />
                        </div>
                        
                        {/* Max Volume Button */}
                        <button
                          onClick={() => handleVolumeChange(1)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                            musicVolume === 1 
                              ? 'bg-green-500 text-white shadow-lg' 
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L5.5 14.5H3a1 1 0 01-1-1V6.5a1 1 0 011-1h2.5l2.883-3.316a1 1 0 011.617.816zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Volume Level Bar */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">Silent</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Low</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Medium</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">High</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Max</span>
                    </div>
                  </div>
                </div>

                {/* Quiz Color Theme */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Quiz Color Theme
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(colorThemes).map(([color, theme]) => (
                      <button
                        key={color}
                        onClick={() => setQuizColor(color)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          quizColor === color
                            ? `${theme.secondary} ${theme.accent} text-white ring-2 ${theme.ring}`
                            : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full mx-auto mb-2 bg-gradient-to-br ${theme.primary}`}></div>
                        <span className="text-xs font-medium capitalize">{color}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Preview
                  </label>
                  <div className="p-4 rounded-xl bg-gray-50 border-2 border-gray-200">
                    <div className="flex gap-2">
                      <button className={`px-4 py-2 rounded-xl text-sm font-bold ${currentTheme.selected}`}>
                        A
                      </button>
                      <button className={`px-4 py-2 rounded-xl text-sm font-bold ${currentTheme.secondary} border-2 ${currentTheme.accent} text-white hover:${currentTheme.hover}`}>
                        Sample Answer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Removed separate saved modal to keep focus on a single modal */}
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-8 font-[Quicksand,sans-serif] max-h-full overflow-hidden justify-center flex-1">
          {/* Professional header: Story | Student | Progress */}
          <div className="w-full mb-6">
            <div className="mx-auto max-w-5xl rounded-xl bg-white/20 backdrop-blur border border-white/30 shadow-md px-4 py-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                <div className="min-w-0">
                  <span className="block text-xs md:text-sm text-white/70">Story</span>
                  <span className="block text-base md:text-xl font-extrabold text-white whitespace-normal break-words">{test.testName}</span>
                </div>
              {studentName && (
                  <div className="min-w-0 col-[2] justify-self-center text-center">
                    <span className="block text-xs md:text-sm text-white/70">Student</span>
                    <span className="block text-base md:text-lg font-bold text-white whitespace-normal break-words">{studentName}</span>
                  </div>
                )}
                <div className="text-right min-w-[110px] justify-self-end">
                  <span className="block text-xs md:text-sm text-white/70">Progress</span>
                  <span className="block text-base md:text-lg font-bold text-white">{currentQuestion + 1} / {test.questions.length}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Horizontal progress bar under the top row */}
          <div className="w-full h-5 bg-gray-700 rounded-2xl mb-10 overflow-visible shadow-lg border-2 border-white flex items-center">
            <div
              className="h-5 rounded-2xl bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 transition-all duration-500 shadow-md border-2 border-white"
                                                                                                              style={{ width: `${((currentQuestion + 1) / test.questions.length) * 100}%` }}
            />
          </div>

          {/* Question Card */}
          <div className="w-full mb-8 p-8 rounded-3xl bg-white/20 backdrop-blur-md shadow-2xl text-center border-2 border-white/30">
            <span className="text-2xl md:text-3xl font-extrabold text-white drop-shadow">{test.questions[currentQuestion].question}</span>
          </div>


          {/* Answers Grid */}
          <div className="grid grid-cols-2 gap-6 w-full max-w-7xl mx-auto px-0 mb-8 overflow-visible">
            {(shuffledChoices[currentQuestion] || test.questions[currentQuestion].choices).map((choice, cIdx) => {
              const isSelected = answers[currentQuestion] === cIdx;
              const label = String.fromCharCode(65 + cIdx);
              return (
                <button
                  key={cIdx}
                  type="button"
                  className={`flex items-center gap-5 w-full min-h-32 rounded-3xl text-2xl font-extrabold shadow-2xl border-4 transition-all duration-300 px-8 py-6 transform hover:scale-105
                    ${isSelected
                      ? `bg-green-500 border-green-600 text-white ring-4 ring-green-300 shadow-green-500/50`
                      : `${currentTheme.secondary} border-white text-white hover:ring-4 hover:${currentTheme.ring} hover:shadow-lg`}
                    focus:outline-none`}
                  onClick={() => { handleSelect(currentQuestion, cIdx); playPopSound(); }}
                  disabled={submitted}
                  aria-label={`Select answer ${choice}`}
                >
                  <span className={`flex items-center justify-center w-14 h-14 rounded-full shadow-md border-2 text-2xl font-bold transition-all duration-300 ${
                    isSelected 
                      ? 'bg-green-600 border-green-700 text-white' 
                      : `bg-white border-white ${currentTheme.labelColor} label-shadow`
                  }`}>
                    {label}
                  </span>
                  <span className={`drop-shadow-2xl text-left leading-snug break-words whitespace-normal font-bold text-shadow-lg transition-all duration-300 ${
                    isSelected ? 'text-white' : 'text-white'
                  }`}>
                    {choice}
                  </span>
                  {isSelected && (
                    <div className="ml-auto">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Thin loading bar under answers grid */}
          {loadingActive && !gapActive && (
            <div className="w-full max-w-3xl mx-auto h-1 bg-gray-300 rounded-full overflow-hidden mb-4">
              <div
                className="h-1 bg-blue-500 transition-all duration-75"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          )}

          {/* Finish Quiz Button: only show on last question */}
          {currentQuestion === test!.questions.length - 1 && (
            <div className="w-full max-w-md mx-auto">
            <button
                className="group relative w-full py-5 px-8 rounded-3xl text-2xl font-bold transition-all duration-300 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 cursor-pointer disabled:opacity-60 shadow-2xl hover:shadow-emerald-500/25 hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-2xl overflow-hidden"
              onClick={handleSubmit}
              disabled={answers.includes(-1)}
              aria-label="Finish Quiz"
              title="Finish Quiz"
            >
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"></div>
                
                {/* Button Content */}
                <div className="relative flex items-center justify-center gap-3">
                  <span className="text-white drop-shadow-sm">Finish Quiz</span>
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                
                {/* Shine Effect */}
                <div className="absolute inset-0 -top-1 -left-1 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 rounded-3xl"></div>
            </button>
              
              {/* Progress Indicator */}
              <div className="mt-3 text-center">
                <div className="text-sm text-white/70 mb-1">
                  {answers.filter(a => a !== -1).length} of {test!.questions.length} answered
                </div>
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${(answers.filter(a => a !== -1).length / test!.questions.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Countdown at Bottom */}
        {countdown !== null && countdown > 0 && (currentQuestion < test!.questions.length - 1) && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
            <div className="text-white text-lg font-medium bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
              You can change your answer in {countdown} second{countdown !== 1 ? 's' : ''}
      </div>
          </div>
        )}
      </div>
      <audio ref={audioRef} src="/music/testmusic1.mp3" loop preload="auto" autoPlay playsInline />
      
      {/* Custom Styles */}
      <style>{`
        .slider-new {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          height: 12px;
        }
        
        .slider-new::-webkit-slider-track {
          background: transparent;
          height: 12px;
          border-radius: 6px;
        }
        
        .slider-new::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: -6px;
        }
        
        .slider-new::-webkit-slider-thumb:hover {
          background: rgba(59, 130, 246, 0.1);
        }
        
        .slider-new::-moz-range-track {
          background: transparent;
          height: 12px;
          border-radius: 6px;
          border: none;
        }
        
        .slider-new::-moz-range-thumb {
          background: transparent;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .text-shadow-lg {
          text-shadow: 
            2px 2px 4px rgba(0, 0, 0, 0.8),
            1px 1px 2px rgba(0, 0, 0, 0.9),
            0 0 8px rgba(0, 0, 0, 0.7);
        }
        
        .label-shadow {
          text-shadow: 
            1px 1px 2px rgba(0, 0, 0, 0.3),
            0 0 4px rgba(255, 255, 255, 0.8);
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.6; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
        }
        
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </>
  );
};

export default StudentTestPage; 
  