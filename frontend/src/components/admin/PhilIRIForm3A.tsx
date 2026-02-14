import React from 'react';

interface ISRResult {
  id?: string;
  studentId: string;
  studentName: string;
  gradeSection?: string;
  school?: string;
  teacherId: string;
  teacherName?: string;
  formTitle: string;
  partA: {
    readingTime: string;
    readingRate: number;
    correctAnswers: number;
    percentage: number;
    comprehensionLevel: 'Independent' | 'Instructional' | 'Frustration';
    answers: string[]; // The actual quiz answers!
  };
  partB: {
    wordReading: {
      selection: string;
      level: string;
      set: 'A' | 'B' | 'C' | 'D';
    };
    miscues: {
      mispronunciation: number;
      omission: number;
      substitution: number;
      insertion: number;
      repetition: number;
      transposition: number;
      reversal: number;
      totalMiscues: number;
    };
    wordsInPassage: number;
    wordReadingScore: number;
    wordReadingLevel: 'Independent' | 'Instructional' | 'Frustration';
  };
  language?: 'English' | 'Filipino';
  assessmentDate?: Date;
  book?: string;
}

interface PhilIRIForm3AProps {
  data: ISRResult;
  onClose: () => void;
}

const PhilIRIForm3A: React.FC<PhilIRIForm3AProps> = ({ data, onClose }) => {
  // Get questions from the same source used in the quiz
  // In a real implementation, this would fetch the actual questions used during the assessment
  const getQuestionsForDisplay = (language: string) => {
    // Default Phil-IRI questions - these should match what was used in the actual quiz
    const defaultQuestions = language === 'Filipino' ? [
      "Sino ang mga pangunahing tauhan sa kuwento?",
      "Saan naganap ang kuwento?", 
      "Ano ang pangunahing problema sa kuwento?",
      "Paano mo sa tingin naramdaman ng tauhan sa dulo?",
      "Ano ang aral na makukuha natin sa kuwentong ito?"
    ] : [
      "Who are the main characters in the story?",
      "Where does the story take place?",
      "What is the main problem in the story?", 
      "How do you think the character felt at the end?",
      "What lesson can we learn from this story?"
    ];
    
    return defaultQuestions;
  };

  const questions = getQuestionsForDisplay(data.language || 'English');
  const answers = data.partA.answers || [];
  
  // Calculate which answers are correct based on the score
  const correctAnswersCount = data.partA.correctAnswers;
  const totalQuestions = Math.min(questions.length, answers.length);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">Phil-IRI Form 3A - Assessment Results</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Student Information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold mb-3">Student Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Name:</strong> {data.studentName}</div>
              <div><strong>Grade/Section:</strong> {data.gradeSection || 'N/A'}</div>
              <div><strong>School:</strong> {data.school || 'N/A'}</div>
              <div><strong>Teacher:</strong> {data.teacherName || 'N/A'}</div>
              <div><strong>Language:</strong> {data.language || 'English'}</div>
              <div><strong>Assessment Date:</strong> {
                data.assessmentDate 
                  ? new Date(data.assessmentDate).toLocaleDateString()
                  : 'N/A'
              }</div>
            </div>
          </div>

          {/* Part A - Comprehension and Reading Rate */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-blue-800">PART A - Comprehension and Reading Rate</h3>
            
            {/* Reading Information */}
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><strong>Story:</strong> {data.book || 'N/A'}</div>
                <div><strong>Reading Time:</strong> {data.partA.readingTime}</div>
                <div><strong>Reading Rate:</strong> {data.partA.readingRate} WPM</div>
              </div>
            </div>

            {/* Comprehension Questions and Answers - Using Your Quiz Interface */}
            <div className="mb-4">
              <h4 className="font-semibold mb-4 text-gray-800">Comprehension Questions (Sagot sa mga Tanong)</h4>
              
              {/* Your exact quiz interface from StudentTestPage.tsx */}
              <div className="bg-gradient-to-br from-[#253347] via-[#253347] to-[#b4c5e4] rounded-2xl p-6 min-h-[500px] font-[Comic Sans MS, Comic Sans, cursive, sans-serif]">
                
                {/* Header similar to your quiz */}
                <div className="w-full mb-6">
                  <div className="mx-auto max-w-4xl rounded-xl bg-white/20 backdrop-blur border border-white/30 shadow-md px-4 py-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                      <div className="min-w-0">
                        <span className="block text-xs md:text-sm text-white/70">Story</span>
                        <span className="block text-base md:text-xl font-extrabold text-white whitespace-normal break-words">{data.book || 'Reading Assessment'}</span>
                      </div>
                      <div className="min-w-0 col-[2] justify-self-center text-center">
                        <span className="block text-xs md:text-sm text-white/70">Student</span>
                        <span className="block text-base md:text-lg font-bold text-white whitespace-normal break-words">{data.studentName}</span>
                      </div>
                      <div className="text-right min-w-[110px] justify-self-end">
                        <span className="block text-xs md:text-sm text-white/70">Results</span>
                        <span className="block text-base md:text-lg font-bold text-white">{correctAnswersCount} / {totalQuestions}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-5 bg-gray-700 rounded-2xl mb-8 overflow-visible shadow-lg border-2 border-white flex items-center">
                  <div
                    className="h-5 rounded-2xl bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 transition-all duration-500 shadow-md border-2 border-white"
                    style={{ width: `${(correctAnswersCount / totalQuestions) * 100}%` }}
                  />
                </div>

                {/* Questions and Answers Display */}
                <div className="space-y-8">
                  {questions.slice(0, totalQuestions).map((question, index) => {
                    const studentAnswer = answers[index] || 'No answer provided';
                    const isCorrect = index < correctAnswersCount;
                    
                    return (
                      <div key={index} className="space-y-6">
                        {/* Question Card - Your exact style */}
                        <div className="w-full p-6 rounded-3xl bg-white/20 backdrop-blur-md shadow-2xl text-center border-2 border-white/30">
                          <div className="flex items-center justify-center mb-3">
                            <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full mr-3">
                              Question {index + 1}
                            </span>
                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                              isCorrect 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                            </span>
                          </div>
                          <span className="text-xl md:text-2xl font-extrabold text-white drop-shadow-lg">
                            {question}
                          </span>
                        </div>

                        {/* Student Answer - Your exact button style */}
                        <div className="flex justify-center">
                          <div className={`flex items-center gap-5 w-full max-w-4xl min-h-24 rounded-3xl text-xl font-extrabold shadow-2xl border-4 transition-all duration-300 px-8 py-6 ${
                            isCorrect
                              ? 'bg-green-500 border-green-600 text-white ring-4 ring-green-300 shadow-green-500/50'
                              : 'bg-red-500 border-red-600 text-white ring-4 ring-red-300 shadow-red-500/50'
                          }`}>
                            <span className={`flex items-center justify-center w-14 h-14 rounded-full shadow-md border-2 text-2xl font-bold transition-all duration-300 ${
                              isCorrect 
                                ? 'bg-green-600 border-green-700 text-white' 
                                : 'bg-red-600 border-red-700 text-white'
                            }`}>
                              {isCorrect ? '✓' : '✗'}
                            </span>
                            <span className="drop-shadow-2xl text-left leading-snug break-words whitespace-normal font-bold text-shadow-lg transition-all duration-300 flex-1">
                              {studentAnswer}
                            </span>
                            <div className="ml-auto">
                              {isCorrect ? (
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add the same CSS styles from your StudentTestPage */}
              <style>{`
                .text-shadow-lg {
                  text-shadow: 
                    2px 2px 4px rgba(0, 0, 0, 0.8),
                    1px 1px 2px rgba(0, 0, 0, 0.9),
                    0 0 8px rgba(0, 0, 0, 0.7);
                }
              `}</style>
            </div>

            {/* Comprehension Results */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-gray-800 mb-3">Assessment Results Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center shadow-sm border">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {data.partA.correctAnswers}/{totalQuestions}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Correct Answers</div>
                  <div className="text-xs text-gray-500">(Tamang Sagot)</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center shadow-sm border">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{data.partA.percentage}%</div>
                  <div className="text-sm text-gray-600 font-medium">Score Percentage</div>
                  <div className="text-xs text-gray-500">(Porsyento)</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center shadow-sm border">
                  <div className={`text-2xl font-bold mb-1 ${
                    data.partA.comprehensionLevel === 'Independent' ? 'text-green-600' :
                    data.partA.comprehensionLevel === 'Instructional' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {data.partA.comprehensionLevel}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Reading Level</div>
                  <div className="text-xs text-gray-500">(Antas ng Pag-unawa)</div>
                </div>
              </div>
              
              {/* Level Description */}
              <div className="mt-4 p-3 bg-white rounded-lg border">
                <div className="text-sm">
                  <strong>Level Description:</strong>
                  <span className="ml-2">
                    {data.partA.comprehensionLevel === 'Independent' && 
                      'Student can read and understand the material independently (90-100%)'}
                    {data.partA.comprehensionLevel === 'Instructional' && 
                      'Student can read the material with teacher guidance (75-89%)'}
                    {data.partA.comprehensionLevel === 'Frustration' && 
                      'Material is too difficult for the student (below 75%)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Part B - Word Reading (Miscue Analysis) */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-purple-800">PART B - Word Reading (Miscue Analysis)</h3>
            
            {/* Selection Information */}
            <div className="mb-4 p-3 bg-purple-50 rounded">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><strong>Selection:</strong> {data.partB.wordReading.selection}</div>
                <div><strong>Level:</strong> {data.partB.wordReading.level}</div>
                <div><strong>Set:</strong> {data.partB.wordReading.set}</div>
                <div><strong>Words in Passage:</strong> {data.partB.wordsInPassage}</div>
              </div>
            </div>

            {/* Miscue Types */}
            <div className="mb-4">
              <h4 className="font-semibold mb-3">Types of Miscues (Uri ng Pagkakamali)</h4>
              <div className="border border-gray-300 rounded">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Type of Miscue</th>
                      <th className="border border-gray-300 p-2 text-center">Number of Miscues</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2">Mispronunciation (Maling Bigkas)</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">{data.partB.miscues.mispronunciation}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Omission (Pagkakaltas)</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">{data.partB.miscues.omission}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Substitution (Pagpapalit)</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">{data.partB.miscues.substitution}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Insertion (Pagsisisingit)</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">{data.partB.miscues.insertion}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Repetition (Pag-uulit)</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">{data.partB.miscues.repetition}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Transposition (Pagpapalit ng Lugar)</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">{data.partB.miscues.transposition}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2">Reversal (Paglilipat)</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">{data.partB.miscues.reversal}</td>
                    </tr>
                    <tr className="bg-yellow-50">
                      <td className="border border-gray-300 p-2 font-bold">Total Miscues (Kabuuan)</td>
                      <td className="border border-gray-300 p-2 text-center font-bold text-lg">{data.partB.miscues.totalMiscues}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Word Reading Results */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-purple-50 rounded">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{data.partB.wordReadingScore.toFixed(1)}%</div>
                <div className="text-sm">Word Reading Score</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${
                  data.partB.wordReadingLevel === 'Independent' ? 'text-green-600' :
                  data.partB.wordReadingLevel === 'Instructional' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {data.partB.wordReadingLevel}
                </div>
                <div className="text-sm">Word Reading Level (Antas ng Pagbasa)</div>
              </div>
            </div>
          </div>

          {/* Overall Assessment Summary */}
          <div className="p-4 bg-gray-100 rounded-lg">
            <h3 className="text-lg font-bold mb-3">Assessment Summary</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Reading Performance</h4>
                <ul className="text-sm space-y-1">
                  <li><strong>Reading Speed:</strong> {data.partA.readingRate} words per minute</li>
                  <li><strong>Word Reading Accuracy:</strong> {data.partB.wordReadingScore.toFixed(1)}%</li>
                  <li><strong>Total Miscues:</strong> {data.partB.miscues.totalMiscues}</li>
                  <li><strong>Words in Passage:</strong> {data.partB.wordsInPassage}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Comprehension Performance</h4>
                <ul className="text-sm space-y-1">
                  <li><strong>Questions Answered:</strong> {questions.length}</li>
                  <li><strong>Correct Answers:</strong> {data.partA.correctAnswers}</li>
                  <li><strong>Comprehension Score:</strong> {data.partA.percentage}%</li>
                  <li><strong>Reading Time:</strong> {data.partA.readingTime}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhilIRIForm3A;