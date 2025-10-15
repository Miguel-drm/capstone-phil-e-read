import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loader from '../../components/Loader';
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
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();
  const { userRole } = useAuth();

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

  if (!test) return (
    <div className="flex justify-center items-center min-h-screen w-full bg-gradient-to-br from-purple-900 to-fuchsia-700">
      <Loader label="Loading test..." />
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
          {/* Top row: test name, admin indicator, and question count */}
          <div className="w-full flex justify-center mb-6">
            <div className="flex flex-row items-center gap-3 bg-white/30 backdrop-blur rounded-full px-6 py-2 shadow-lg border-2 border-white/40">
              <span className="text-blue-900 font-bold text-base md:text-lg px-2 py-1 rounded-full bg-blue-100/80 border border-blue-200/60 shadow-sm">{test.testName}</span>
              <span className="text-red-800 font-bold text-base md:text-lg px-2 py-1 rounded-full bg-red-100/80 border border-red-200/60 shadow-sm">Admin View</span>
              <span className="text-purple-900 font-bold text-base md:text-lg px-2 py-1 rounded-full bg-purple-100/80 border border-purple-200/60 shadow-sm">{currentQuestion + 1} / {test.questions.length}</span>
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

          {/* Answers Grid - View Only */}
          <div className="grid grid-cols-2 gap-6 w-full max-w-7xl mx-auto px-0 mb-8 overflow-visible">
            {test.questions[currentQuestion].choices.map((choice, cIdx) => {
              const isCorrect = cIdx === test.questions[currentQuestion].correctAnswer;
              const label = String.fromCharCode(65 + cIdx);
              return (
                <div
                  key={cIdx}
                  className={`flex items-center gap-6 w-full h-32 rounded-3xl text-3xl font-extrabold shadow-2xl border-4 transition-all duration-200 px-10
                    ${showAnswers 
                      ? (isCorrect 
                          ? 'bg-green-500 border-green-600 text-white ring-4 ring-green-300' 
                          : 'bg-gray-400 border-gray-500 text-white')
                      : 'bg-blue-400 border-white text-white'
                    }`}
                >
                  <span className="flex items-center justify-center w-16 h-16 rounded-full bg-white/90 text-blue-600 shadow-md border-2 border-white">
                    {label}
                  </span>
                  <span className="truncate text-white drop-shadow-lg">{choice}</span>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="w-full max-w-3xl mx-auto mb-8 p-6 rounded-2xl bg-white/10 backdrop-blur-md shadow-lg border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Test Instructions:</h3>
            <p className="text-white text-lg leading-relaxed">{test.instructions}</p>
          </div>

          {/* Admin Info */}
          <div className="w-full max-w-3xl mx-auto p-4 rounded-xl bg-yellow-100/20 backdrop-blur-md shadow-lg border border-yellow-300/30">
            <div className="flex items-center gap-2 text-yellow-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-lg font-semibold">Admin Preview Mode</span>
            </div>
            <p className="text-yellow-100 mt-2 text-sm">
              This is a read-only preview of the test. Students will see this test in an interactive format where they can select answers and submit their responses.
            </p>
          </div>
        </div>
      </div>
      <audio ref={audioRef} src="/music/testmusic1.mp3" loop preload="auto" />
    </>
  );
};

export default AdminViewTest;
