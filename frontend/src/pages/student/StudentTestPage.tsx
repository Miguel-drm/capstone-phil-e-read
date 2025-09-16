import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loader from '../../components/Loader';
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
  const [musicOn, setMusicOn] = useState(false);
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
  const [showSavedModal, setShowSavedModal] = useState(false);
  const { userRole, currentUser } = useAuth();

  // Ensure studentId and studentName are present
  useEffect(() => {
    if (!studentId || !studentName) {
      alert('No student selected for this test. Please go back and select a student.');
      navigate(-1);
    }
  }, [studentId, studentName, navigate]);

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
      }
    };
    fetchTest();
  }, [testId]);

  const handleSelect = (qIdx: number, cIdx: number) => {
    const newAnswers = [...answers];
    newAnswers[qIdx] = cIdx;
    setAnswers(newAnswers);
    // Cancel all timers
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    setLoadingActive(false);
    setLoadingProgress(0);
    setGapActive(false);
    // Only start gap if not on last question and not submitted
    if (qIdx < test!.questions.length - 1 && !submitted) {
      setGapActive(true);
      gapTimerRef.current = setTimeout(() => {
        setGapActive(false);
        setLoadingActive(true);
        let start = Date.now();
        loadingTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - start;
          setLoadingProgress(Math.min(100, (elapsed / 8000) * 100));
          if (elapsed >= 8000) {
            clearInterval(loadingTimerRef.current!);
            setLoadingActive(false);
            setLoadingProgress(0);
            setTimeout(() => {
              if (currentQuestion < test!.questions.length - 1) {
                setCurrentQuestion(currentQuestion + 1);
              }
            }, 100); // slight delay for smoothness
          }
        }, 30);
      }, 3000);
    }
  };

  // Write to 'recenttests' collection in Firestore
  const writeRecentTest = async (score: number) => {
    if (!teacherId || !testId || !test) return;
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
      console.error('Error writing recent test:', error);
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
    if (userRole === 'teacher') {
      testResultData.teacherId = currentUser.uid;
      testResultData.studentId = studentId;
    } else {
      alert('Only teachers can save test results.');
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
      setShowSavedModal(true);
      setSubmitted(false);
      setShowScoreDetails(false);
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

  const handleNext = () => {
    if (answers[currentQuestion] === -1) {
      return;
    }
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

  const popSound = new Audio('/sounds/pop.mp3'); // Place pop.mp3 in public/sounds/
  const playPopSound = () => { popSound.currentTime = 0; popSound.play(); };

  // Clean up timers on unmount or question change
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Reset loading and gap when question changes
    setLoadingActive(false);
    setLoadingProgress(0);
    prevSelectedRef.current = answers[currentQuestion];
    if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    setGapActive(false);
  }, [currentQuestion]);

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
      </div>
      {/* Navigation Buttons - Floating on left and right sides */}
      <div className="fixed z-50 top-1/2 transform -translate-y-1/2 left-[max(2rem,calc(50vw-620px))]">
        <button
          className="flex items-center justify-center w-14 h-14 rounded-full bg-white/30 hover:bg-white/60 text-white shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handlePrev}
          disabled={currentQuestion === 0 || submitted}
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
          disabled={currentQuestion === test.questions.length - 1 || submitted}
          aria-label="Next question"
          title="Next question"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="fixed top-0 left-0 min-h-screen h-screen w-screen flex flex-col justify-center items-center bg-gradient-to-br from-[#253347] via-[#253347] to-[#b4c5e4] font-[Comic Sans MS, Comic Sans, cursive, sans-serif] overflow-hidden z-40">
        {showConfetti && <Confetti />}
        {/* Celebration Modal */}
        {submitted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full flex flex-col items-center border-4 border-green-400 relative">
              {/* X Button to close modal */}
              <button
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-red-100 hover:bg-red-300 text-red-600 flex items-center justify-center text-2xl font-bold shadow"
                onClick={() => { setSubmitted(false); setShowScoreDetails(false); }}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
              {!showScoreDetails ? (
                <>
                  <span className="text-6xl mb-4">🎉</span>
                  <span className="text-3xl md:text-4xl font-extrabold text-green-600 mb-4 text-center">Great job!</span>
                  <span className="text-xl md:text-2xl font-bold text-gray-700 mb-6 text-center">You finished the test! What would you like to do?</span>
                  <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
                    <button
                      className="px-8 py-3 bg-blue-500 text-white rounded-xl text-lg font-bold shadow hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                      onClick={handleSaveResult}
                      disabled={savingResult}
                    >
                      {savingResult ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                          Saving...
                        </>
                      ) : (
                        'Save Result'
                      )}
                    </button>
                    <button
                      className="px-8 py-3 bg-green-500 text-white rounded-xl text-lg font-bold shadow hover:bg-green-600 transition-all"
                      onClick={() => setShowScoreDetails(true)}
                    >
                      Show My Score
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-5xl mb-2">🎉</span>
                  <span className="text-3xl md:text-4xl font-extrabold text-green-600 mb-2">Well Done!</span>
                  <span className="text-2xl md:text-3xl font-extrabold text-yellow-600 mb-2 flex items-center gap-2">
                    🏆 Score: {score} / {test!.questions.length}
                  </span>
                  {/* Comprehension Percentage */}
                  {typeof score === 'number' && (
                    <span
                      className={`text-xl md:text-2xl font-extrabold mb-4 flex items-center gap-2
                        ${score / test!.questions.length >= 0.8 ? 'text-green-600' : score / test!.questions.length >= 0.5 ? 'text-orange-500' : 'text-red-600'}`}
                    >
                      Comprehension: {Math.round((score / test!.questions.length) * 100)}%
                    </span>
                  )}
                  <div className="w-full max-h-80 overflow-y-auto mb-6">
                    {test!.questions.map((q, idx) => {
                      const userAnswerIdx = answers[idx];
                      const correctIdx = q.correctAnswer;
                      const isCorrect = userAnswerIdx === correctIdx;
                      return (
                        <div key={idx} className={`mb-4 p-4 rounded-xl border-2 ${isCorrect ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}> 
                          <div className="font-bold text-lg mb-2 text-gray-800">Q{idx + 1}: {q.question}</div>
                          <div className="flex flex-col md:flex-row gap-2 md:gap-6">
                            <div className={`font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>Your answer: {userAnswerIdx !== -1 ? q.choices[userAnswerIdx] : <span className="italic text-gray-400">No answer</span>}</div>
                            {!isCorrect && (
                              <div className="font-semibold text-green-700">Correct answer: {q.choices[correctIdx]}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
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
        {/* Test Saved Modal */}
        {showSavedModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center">
              <span className="text-4xl mb-4">✅</span>
              <span className="text-2xl font-bold text-green-700 mb-2">Test Saved</span>
              <button
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg font-bold shadow hover:bg-blue-600 transition-all"
                onClick={() => setShowSavedModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-8 font-[Quicksand,sans-serif] max-h-full overflow-hidden justify-center flex-1">
          {/* Top row: test name, student name, and question count (grouped in a pill) */}
          <div className="w-full flex justify-center mb-6">
            <div className="flex flex-row items-center gap-3 bg-white/30 backdrop-blur rounded-full px-6 py-2 shadow-lg border-2 border-white/40">
              <span className="text-blue-900 font-bold text-base md:text-lg px-2 py-1 rounded-full bg-blue-100/80 border border-blue-200/60 shadow-sm">{test.testName}</span>
              {studentName && (
                <span className="text-green-800 font-bold text-base md:text-lg px-2 py-1 rounded-full bg-green-100/80 border border-green-200/60 shadow-sm">{studentName}</span>
              )}
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

          {/* Answers Grid */}
          <div className="grid grid-cols-2 gap-6 w-full max-w-7xl mx-auto px-0 mb-8 overflow-visible">
            {(shuffledChoices[currentQuestion] || test.questions[currentQuestion].choices).map((choice, cIdx) => {
              const isSelected = answers[currentQuestion] === cIdx;
              return (
                <button
                  key={cIdx}
                  type="button"
                  className={`flex items-center gap-6 w-full h-32 rounded-3xl text-3xl font-extrabold shadow-2xl border-4 transition-all duration-200 px-16
                    ${isSelected
                      ? 'bg-green-500 border-green-600 text-white ring-4 ring-green-300'
                      : 'bg-blue-400 border-white text-white hover:ring-4 hover:ring-blue-200'}
                    focus:outline-none`}
                  onClick={() => { handleSelect(currentQuestion, cIdx); playPopSound(); }}
                  disabled={submitted}
                  aria-label={`Select answer ${choice}`}
                >
                  <span className="text-4xl mr-4" role="img" aria-label="star">⭐</span>
                  <span className="truncate text-white drop-shadow-lg">{choice}</span>
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
            <button
              className="w-full py-4 rounded-2xl text-2xl font-extrabold transition-all duration-200 bg-green-600 text-white hover:bg-green-700 cursor-pointer disabled:opacity-60 shadow-2xl flex items-center justify-center gap-3"
              onClick={handleSubmit}
              disabled={answers.includes(-1)}
              style={{ letterSpacing: '0.02em' }}
              aria-label="Finish Quiz"
              title="Finish Quiz"
            >
              <span role="img" aria-label="trophy">🏆</span> Finish Quiz!
            </button>
          )}
        </div>
      </div>
      <audio ref={audioRef} src="/music/testmusic1.mp3" loop preload="auto" />
    </>
  );
};

export default StudentTestPage; 
  