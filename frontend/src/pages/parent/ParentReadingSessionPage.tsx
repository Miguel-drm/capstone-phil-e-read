import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { readingSessionService, type ReadingSession } from '../../services/readingSessionService';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
import type { Story } from '../../types/Story';
import { BookOpenIcon, UserIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student } from '../../services/studentService';

const ParentReadingSessionPage: React.FC = () => {
  const [storyText, setStoryText] = useState<string>('');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allStories, setAllStories] = useState<Story[]>([]);
  // Recording & metrics (aligned with teacher UI)
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Remove transcript state to satisfy unused warnings (we only need derived metrics)
  const [wordsRead, setWordsRead] = useState(0);
  const [readingSpeedWPM, setReadingSpeedWPM] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [miscues, setMiscues] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const [isChildPickerOpen, setIsChildPickerOpen] = useState(false);
  const [isStoryPickerOpen, setIsStoryPickerOpen] = useState(false);
  const [storyQuery, setStoryQuery] = useState('');

  // Get child data from navigation state
  const { childName: childNameFromNav, childId: childIdFromNav } = location.state || {};
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string } | null>(childNameFromNav ? { id: childIdFromNav || '', name: childNameFromNav } : null);

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const stories = await UnifiedStoryService.getInstance().getStories({});
        setAllStories(stories);
        // Load parent's children for selection in practice mode
        if (currentUser?.uid) {
          try {
            const kids = await studentService.getStudentsByParent(currentUser.uid);
            setChildren(kids);
            if (!selectedChild && kids.length === 1) {
              setSelectedChild({ id: kids[0].id || '', name: kids[0].name });
            }
          } catch (e) {}
        }

        if (sessionId) {
          // Session mode
        const sessionData = await readingSessionService.getSessionById(sessionId);
          if (!sessionData) throw new Error('Session not found');
        setCurrentSession(sessionData);
        const story = stories.find((s: Story) => s._id === sessionData.book || s.title === sessionData.book);
          if (story?._id) {
          const fullStory = await UnifiedStoryService.getInstance().getStoryById(story._id);
          if (fullStory?.textContent) {
              const text = fullStory.textContent.trim();
              setStoryText(text);
              setTotalWords(text.split(/\s+/).filter(Boolean).length);
            }
          }
        } else {
          // Practice mode (no session). Ensure basic session object so UI renders.
          setCurrentSession({
            pdfPublicId: null,
            title: 'Practice Reading',
            book: 'TBD',
            gradeId: 'parent',
            students: [],
            status: 'in-progress',
            teacherId: '',
            storyUrl: '',
          } as ReadingSession);
        }
      } catch (e: any) {
        console.error('Init failed:', e?.message || e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [sessionId]);

  const handleGoBack = () => {
    navigate('/parent/reading');
  };

  // session-mode start was removed in favor of practice flow

  // Recording controls similar to teacher page
  const handleStartRecording = () => {
    if (!selectedChild) {
      void handleChooseStudent();
      return;
    }
    setIsRecording(true);
    setIsPaused(false);
    // no-op
    setWordsRead(0);
    setReadingSpeedWPM(0);
    setElapsedTime(0);

    if (navigator.mediaDevices && window.MediaRecorder) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      }).catch(() => {
        alert('Microphone access denied or not available.');
        setIsRecording(false);
      });
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      let runningTranscript = '';
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) runningTranscript += event.results[i][0].transcript + ' ';
          else interim += event.results[i][0].transcript;
        }
        const text = (runningTranscript + interim).trim();
        // transcript kept internal to compute metrics only

        // Rough words read based on matching prefix words of story
        const storyWords = (storyText || '').split(/\s+/).map(w => w.toLowerCase());
        const spokenWords = text.split(/\s+/).map(w => w.toLowerCase()).filter(Boolean);
        let idx = 0;
        for (let i = 0; i < spokenWords.length && idx < storyWords.length; i++) {
          if (spokenWords[i] === storyWords[idx]) idx++;
        }
        setWordsRead(idx);
        setCurrentWordIndex(idx);
        setReadingSpeedWPM(elapsedTime > 0 ? Math.round(idx / (elapsedTime / 60)) : 0);
        setMiscues(Math.max(0, spokenWords.length - idx));
      };
      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') alert('Speech recognition error: ' + e.error);
      };
      recognition.start();
    }
  };

  // optional pause/resume removed from simplified UI
  const handleStopRecording = () => {
    try {
      setIsRecording(false);
      setIsPaused(false);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      if (recognitionRef.current) recognitionRef.current.stop();
    } catch {}
  };

  // elapsed time ticker
  useEffect(() => {
    let interval: any;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const next = prev + 1;
          setReadingSpeedWPM(next > 0 ? Math.round(wordsRead / (next / 60)) : 0);
          return next;
        });
      }, 1000);
    }
    return () => interval && clearInterval(interval);
  }, [isRecording, isPaused, wordsRead]);

  const formatElapsed = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  // Choose student for practice (modal toggle)
  const handleChooseStudent = async () => {
    if (children.length === 0) {
      await Swal.fire('No children found', 'Please link a child in My Children.', 'info');
      return;
    }
    setIsChildPickerOpen(true);
  };

  // Choose story handler (works for practice and session modes)
  const handleChooseStory = async () => {
    setIsStoryPickerOpen(true);
  };

  const applyChosenStory = async (story: Story) => {
    try {
      if (sessionId) {
        await readingSessionService.updateSession(sessionId, { book: story._id || story.title, status: 'in-progress' });
      }
      setCurrentSession((prev) => prev ? { ...prev, book: story._id || story.title, status: 'in-progress' } : prev);
      if (story._id) {
        const fullStory = await UnifiedStoryService.getInstance().getStoryById(story._id);
        if (fullStory?.textContent) {
          const text = fullStory.textContent.trim();
          setStoryText(text);
          setTotalWords(text.split(/\s+/).filter(Boolean).length);
        }
      }
      setIsStoryPickerOpen(false);
      await Swal.fire({ icon: 'success', title: 'Story selected', timer: 900, showConfirmButton: false });
    } catch (e) {
      await Swal.fire('Error', 'Failed to select story. Please try again.', 'error');
    }
  };

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load reading session</p>
          <button
            onClick={handleGoBack}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 flex flex-col -mt-8 sm:-mt-10 -mx-4 sm:-mx-8 pb-4">
      {/* Header (no Back button) */}
      <header className="w-full pt-4 sm:pt-6 pb-4 px-4 sm:px-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-extrabold text-blue-900 drop-shadow-sm">
              {currentSession.title}
            </h1>
          <span className="px-4 py-2 rounded-full text-sm font-semibold shadow bg-blue-100 text-blue-700">
            Parent View
          </span>
        </div>
      </header>

      {/* Main Content (replicate teacher layout) */}
      <section className="w-full mb-6 flex flex-col lg:flex-row gap-8 px-4 sm:px-8">
        {/* Story Content */}
        <div className="flex-1">
          <div className="relative bg-white/80 rounded-3xl shadow-xl border border-blue-100 p-10 overflow-hidden max-h-[48rem]">
            {/* Progress bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-t-3xl" style={{ width: `${Math.min((currentWordIndex / Math.max(totalWords, 1)) * 100, 100)}%` }}></div>
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                <BookOpenIcon className="h-7 w-7 text-blue-500" /> Story Content
              </h3>
          <div className="flex items-center gap-6 text-lg text-blue-700">
                <span>{totalWords} words</span>
                <span>•</span>
                <span>{(storyText || '').split('\n\n').filter(p => p.trim().length > 0).length} paragraphs</span>
            <span>•</span>
            <button onClick={handleChooseStory} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700">Choose Story</button>
            <span>•</span>
            <button onClick={handleChooseStudent} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">Choose Child</button>
              </div>
            </div>
            <div className="max-h-[38rem] overflow-y-auto custom-scrollbar prose prose-xl prose-blue bg-white/60 rounded-xl p-8 shadow-inner text-[1.35rem] leading-relaxed tracking-wide">
              {storyText ? (
                storyText.split('\n\n').filter(p => p.trim().length > 0).map((paragraph, paragraphIndex, paragraphs) => (
                  <div key={paragraphIndex} className="mb-8 last:mb-0">
                    <p className="text-gray-800 leading-relaxed flex flex-wrap gap-y-3">
                      {paragraph.trim().split(/\s+/).map((word, wordIndex) => {
                        const globalWordIndex = paragraphs
                          .slice(0, paragraphIndex)
                          .reduce((acc, p) => acc + p.trim().split(/\s+/).length, 0) + wordIndex;
                        const isCurrent = currentWordIndex === globalWordIndex;
                        return (
                          <span
                            key={`${paragraphIndex}-${wordIndex}`}
                            className={
                              `inline-block mr-3 mb-2 px-3 py-2 rounded font-serif text-2xl transition-all duration-200 ` +
                              (isCurrent
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow-lg scale-110'
                                : 'bg-blue-50 text-blue-900 hover:bg-blue-100 hover:text-blue-700')
                            }
                          >
                            {word}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-16">
                  <div className="mx-auto w-28 h-28 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-14 h-14 text-blue-400 animate-pulse">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v12m-6-6h12" />
                    </svg>
                  </div>
                  <p className="mt-4 text-blue-800 font-semibold">Choose a story to begin</p>
                  <p className="text-xs text-blue-600">Tap "Choose Story" above to load content</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Panel */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-blue-100 shadow p-3 flex flex-col items-center">
              <UserIcon className="h-6 w-6 text-blue-500 mb-1" />
              <span className="text-blue-700 font-bold text-base">Students</span>
              <span className="text-xs text-blue-700 mt-1">{(selectedChild?.name || childNameFromNav) || 'Not specified'}</span>
            </div>
            <div className="rounded-xl bg-blue-100 shadow p-3 flex flex-col items-center">
              <span className="text-blue-700 font-bold text-base">Words Read</span>
              <span className="text-xl font-extrabold text-blue-700 mt-1">{wordsRead}</span>
            </div>
            <div className="rounded-xl bg-red-100 shadow p-3 flex flex-col items-center">
              <span className="text-red-700 font-bold text-base">Miscues</span>
              <span className="text-xl font-extrabold text-red-700 mt-1">{miscues}</span>
            </div>
            <div className="rounded-xl bg-yellow-100 shadow p-3 flex flex-col items-center">
              <span className="text-yellow-700 font-bold text-base">Oral Reading Score</span>
              <span className="text-xl font-extrabold text-yellow-700 mt-1">{totalWords ? `${Math.round((wordsRead/totalWords)*1000)/10}%` : '0.0%'}</span>
            </div>
            <div className="rounded-xl bg-green-100 shadow p-3 flex flex-col items-center">
              <span className="text-green-700 font-bold text-base">Reading Speed</span>
              <span className="text-xl font-extrabold text-green-700 mt-1">{readingSpeedWPM} WPM</span>
            </div>
            <div className="rounded-xl bg-yellow-100 shadow p-3 flex flex-col items-center">
              <span className="text-yellow-700 font-bold text-base">Elapsed</span>
              <span className="text-xl font-extrabold text-yellow-700 mt-1">{formatElapsed(elapsedTime)}</span>
            </div>
            <div className="rounded-xl bg-indigo-100 shadow p-3 flex flex-col items-center">
              <span className="text-indigo-700 font-bold text-base">Book</span>
              <span className="text-sm font-semibold text-indigo-700 mt-1">{currentSession.book}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Controls Section - single Read button */}
      <section className="w-full px-4 sm:px-8 pb-8">
        <div className="bg-white/80 rounded-3xl shadow-xl border border-blue-100 p-8 flex flex-col items-center gap-6">
          <div className="flex items-center gap-4 mb-2">
            <MicrophoneIcon className="h-7 w-7 text-blue-500" />
            <h4 className="text-lg font-bold text-blue-900">Session Controls</h4>
          </div>
          <div className="flex flex-row flex-wrap justify-center gap-6 w-full">
            {!isRecording ? (
              <button
                onClick={async () => { if (!selectedChild) { await handleChooseStudent(); } if (!storyText) { await handleChooseStory(); } handleStartRecording(); }}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-bold shadow-lg hover:scale-105 hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
              >
                <BookOpenIcon className="h-7 w-7" /> Read
              </button>
            ) : (
            <button
                onClick={handleStopRecording}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white text-xl font-bold shadow-lg hover:scale-105 transition-all duration-200"
            >
                <StopIcon className="h-7 w-7" /> Stop
            </button>
            )}
          </div>
        </div>
      </section>

      {/* Child Picker Modal */}
      {isChildPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-gray-900">Choose Child</h4>
              <button onClick={() => setIsChildPickerOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {children.map((c) => (
                <button key={c.id} onClick={() => { setSelectedChild({ id: c.id || '', name: c.name }); setIsChildPickerOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:bg-blue-50">
                  <div className="font-semibold text-gray-800">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.grade}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Story Picker Modal */}
      {isStoryPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-gray-900">Choose Story</h4>
              <button onClick={() => setIsStoryPickerOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="flex gap-2 mb-3">
              <input value={storyQuery} onChange={(e) => setStoryQuery(e.target.value)} placeholder="Search stories..." className="flex-1 px-3 py-2 border border-gray-200 rounded-xl" />
              <button onClick={() => setStoryQuery('')} className="px-3 py-2 text-sm rounded-xl border border-gray-200">Clear</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {allStories
                .filter(s => !storyQuery || s.title?.toLowerCase().includes(storyQuery.toLowerCase()))
                .map((s) => (
                <button key={s._id || s.title} onClick={() => applyChosenStory(s)} className="text-left rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 hover:shadow">
                  <div className="font-semibold text-gray-900 line-clamp-1">{s.title}</div>
                  <div className="text-xs text-gray-500">{(s as any)?.language || 'English'}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentReadingSessionPage;
