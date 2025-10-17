import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

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

const AdminViewTest: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  // const location = useLocation(); // Available for future use if needed
  // const testName = location.state?.testName || 'Test Preview'; // Available for future use
  const [test, setTest] = useState<Test | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [quizColor, setQuizColor] = useState<'blue' | 'purple' | 'green' | 'orange' | 'pink'>('blue');

  // Ensure only admin users can access this page
  useEffect(() => {
    if (userRole !== 'admin') {
      alert('This page is only accessible by admin users.');
      navigate(-1);
    }
  }, [userRole, navigate]);

  useEffect(() => {
    const fetchTest = async () => {
      if (!testId) return;
      const docRef = doc(db, 'tests', testId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const testData = docSnap.data() as Test;
        setTest(testData);
        await ensureMusicPlaying();
      }
    };
    fetchTest();
  }, [testId]);

  const handleNext = () => {
    if (currentQuestion < (test!.questions.length || 1) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

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

  // Auto start music similar to StudentTestPage
  const ensureMusicPlaying = async () => {
    try {
      if (audioRef.current) {
        await audioRef.current.play();
        setMusicOn(true);
        return true;
      }
    } catch (_) {}
    return false;
  };

  useEffect(() => {
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

  // Set initial audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Theme settings (match StudentTestPage)
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
  } as const;
  const currentTheme = colorThemes[quizColor];

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
        {/* Toggle Answers Button */}
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${showAnswers ? 'bg-yellow-400 text-white' : 'bg-white/30 hover:bg-white/60 text-white'}`}
          aria-label={showAnswers ? 'Hide answers' : 'Show answers'}
          title={showAnswers ? 'Hide answers' : 'Show answers'}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>
      {/* Navigation Buttons - Floating on left and right sides */}
      <div className="fixed z-50 top-1/2 transform -translate-y-1/2 left-[max(2rem,calc(50vw-620px))]">
        <button
          className="flex items-center justify-center w-14 h-14 rounded-full bg-white/30 hover:bg-white/60 text-white shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handlePrev}
          disabled={currentQuestion === 0}
          aria-label="Previous question"
          title="Previous question"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="fixed z-50 top-1/2 transform -translate-y-1/2 right-[max(2rem,calc(50vw-620px))]">
        <button
          className="flex items-center justify-center w-14 h-14 rounded-full bg-white/30 hover:bg-white/60 text-white shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleNext}
          disabled={currentQuestion === test.questions.length - 1}
          aria-label="Next question"
          title="Next question"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="fixed top-0 left-0 min-h-screen h-screen w-screen flex flex-col justify-center items-center bg-gradient-to-br from-[#253347] via-[#253347] to-[#b4c5e4] font-[Comic Sans MS, Comic Sans, cursive, sans-serif] overflow-hidden z-40">
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-8 font-[Quicksand,sans-serif] max-h-full overflow-hidden justify-center flex-1">
          {/* Professional header: Story | Admin | Progress */}
          <div className="w-full mb-6">
            <div className="mx-auto max-w-5xl rounded-xl bg-white/20 backdrop-blur border border-white/30 shadow-md px-4 py-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                <div className="min-w-0">
                  <span className="block text-xs md:text-sm text-white/70">Story</span>
                  <span className="block text-base md:text-xl font-extrabold text-white whitespace-normal break-words">{test.testName}</span>
                </div>
                <div className="min-w-0 col-[2] justify-self-center text-center">
                  <span className="block text-xs md:text-sm text-white/70">Mode</span>
                  <span className="block text-base md:text-lg font-bold text-white whitespace-normal break-words">Admin Preview</span>
                </div>
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

          {/* Answers Grid - View Only (mirrors StudentTestPage styles) */}
          <div className="grid grid-cols-2 gap-6 w-full max-w-7xl mx-auto px-0 mb-8 overflow-visible">
            {test.questions[currentQuestion].choices.map((choice, cIdx) => {
              const isCorrect = cIdx === test.questions[currentQuestion].correctAnswer;
            const label = String.fromCharCode(65 + cIdx);
            const isSelectedStyle = showAnswers && isCorrect;
              return (
                <div
                  key={cIdx}
                className={`flex items-center gap-5 w-full min-h-32 rounded-3xl text-2xl font-extrabold shadow-2xl border-4 transition-all duration-200 px-8 py-6
                    ${showAnswers 
                      ? (isCorrect 
                        ? 'bg-green-500 border-green-600 text-white ring-4 ring-green-300 shadow-green-500/50' 
                          : 'bg-gray-400 border-gray-500 text-white')
                    : `${currentTheme.secondary} border-white text-white hover:ring-4 hover:${currentTheme.ring} hover:shadow-lg`}
                `}
              >
                <span className={`flex items-center justify-center w-14 h-14 rounded-full shadow-md border-2 text-2xl font-bold transition-all duration-300 ${
                  isSelectedStyle 
                    ? 'bg-green-600 border-green-700 text-white' 
                    : `bg-white border-white ${currentTheme.labelColor} label-shadow`
                }`}>
                  {label}
                </span>
                <span className="text-white drop-shadow-2xl text-left leading-snug break-words whitespace-normal font-bold text-shadow-lg transition-all duration-300">
                  {choice}
                </span>
                </div>
              );
            })}
          </div>

          {/* Info Section: Instructions + Admin note */}
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="rounded-2xl bg-white/10 backdrop-blur-md shadow-lg border border-white/20 p-6">
              <header className="mb-3">
                <h3 className="text-lg md:text-xl font-bold text-white tracking-wide">Test Instructions</h3>
              </header>
              <div className="text-white/90 text-base leading-relaxed whitespace-pre-wrap">
                {test.instructions}
          </div>
            </section>

            <aside className="rounded-2xl bg-white/5 backdrop-blur-md shadow-lg border border-white/15 p-6">
              <header className="mb-2">
                <h4 className="text-base md:text-lg font-semibold text-white/90">Admin Preview</h4>
              </header>
              <ul className="list-disc list-inside text-white/80 text-sm leading-relaxed space-y-1">
                <li>Read-only view. Interactions are disabled.</li>
                <li>Students will answer in an interactive version.</li>
                <li>Use Next/Previous to browse all questions.</li>
              </ul>
            </aside>
          </div>
        </div>
      </div>
      <audio ref={audioRef} src="/music/testmusic1.mp3" loop preload="auto" />

      {/* Settings Modal (same as StudentTestPage, simplified) */}
      {showSettings && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4 text-white flex items-center justify-between">
              <h2 className="text-xl font-bold">Settings</h2>
              <button className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30" onClick={() => setShowSettings(false)} aria-label="Close">×</button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">Music Volume</h3>
                  <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-bold rounded-full">{Math.round(musicVolume * 100)}%</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={() => setMusicVolume(0)} className={`w-10 h-10 rounded-xl ${musicVolume===0?'bg-red-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>0</button>
                  <input type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(e)=>setMusicVolume(parseFloat(e.target.value))} className="flex-1" />
                  <button onClick={() => setMusicVolume(1)} className={`w-10 h-10 rounded-xl ${musicVolume===1?'bg-green-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>100</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Quiz Color Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(colorThemes).map(([color, theme]) => (
                    <button key={color} onClick={()=>setQuizColor(color as any)} className={`p-3 rounded-xl border-2 ${quizColor===color? `${theme.secondary} ${theme.accent} text-white ring-2 ${theme.ring}`:'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'}`}>
                      <div className={`w-8 h-8 rounded-full mx-auto mb-2 bg-gradient-to-br ${theme.primary}`}></div>
                      <span className="text-xs font-medium capitalize">{color}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminViewTest;
