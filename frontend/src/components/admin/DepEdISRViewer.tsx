import React from 'react';

interface ISRData {
  studentName: string;
  age?: string;
  gradeSection: string;
  school: string;
  teacher: string;
  language: 'English' | 'Filipino';
  levelStarted?: string; // The level where the student started (marked with *)
  readingData: {
    level: string;
    levelStarted?: boolean;
    set?: string; // A, B, C, or D
    wordReading: {
      ind: boolean;
      ins: boolean;
      frus: boolean;
    };
    comprehension: {
      ind: boolean;
      ins: boolean;
      frus: boolean;
    };
    dateTaken: string;
  }[];
  observations: {
    wordByWord: boolean;
    lacksExpression: boolean;
    hardlyAudible: boolean;
    disregardsPunctuation: boolean;
    pointsToWords: boolean;
    littleAnalysis: boolean;
    otherObservations: string;
  };
}

interface DepEdISRViewerProps {
  data: ISRData;
  onClose: () => void;
}

const DepEdISRViewer: React.FC<DepEdISRViewerProps> = ({
  data,
  onClose
}) => {

const levels = ['K', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  // Determine levelStarted if missing - use the first entry with data
  const determineLevelStarted = (): string => {
    // If levelStarted is already set, use it
    if (data.levelStarted) {
      return data.levelStarted;
    }
    
    // Find the first readingData entry with levelStarted flag
    const entryWithFlag = data.readingData?.find(entry => entry.levelStarted);
    if (entryWithFlag?.level) {
      return entryWithFlag.level;
    }
    
    // Find the first entry with a dateTaken (earliest assessment)
    const entriesWithDate = data.readingData?.filter(entry => entry.dateTaken);
    if (entriesWithDate && entriesWithDate.length > 0) {
      // Sort by dateTaken to get the earliest
      const sortedByDate = [...entriesWithDate].sort((a, b) => {
        const dateA = new Date(a.dateTaken).getTime();
        const dateB = new Date(b.dateTaken).getTime();
        return dateA - dateB;
      });
      
      // Get the level of the earliest entry
      const earliestLevel = sortedByDate[0]?.level;
      if (earliestLevel) {
        return earliestLevel;
      }
    }
    
    // Find the first entry with any data (wordReading or comprehension)
    const entryWithData = data.readingData?.find(entry => 
      entry.wordReading?.ind || entry.wordReading?.ins || entry.wordReading?.frus ||
      entry.comprehension?.ind || entry.comprehension?.ins || entry.comprehension?.frus
    );
    if (entryWithData?.level) {
      return entryWithData.level;
    }
    
    // If still nothing, use the first entry's level
    if (data.readingData && data.readingData.length > 0) {
      return data.readingData[0].level;
    }
    
    return '';
  };

  const effectiveLevelStarted = determineLevelStarted();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">ISR Review - {data.studentName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* ISR Form Content - Exact DepEd Layout */}
        <div className="p-8 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold mb-1">Individual Summary Record (ISR)</h1>
            <h2 className="text-lg italic">Talaan ng Indibidwal na Pagbabasa (TIP)</h2>
          </div>

          {/* Student Information */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center">
              <span className="font-medium mr-2">Name:</span>
              <span className="border-b border-gray-400 flex-1 pb-1">{data.studentName}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">Age:</span>
              <span className="border-b border-gray-400 flex-1 pb-1">{data.age || ''}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">Grade/Section:</span>
              <span className="border-b border-gray-400 flex-1 pb-1">{data.gradeSection}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">School:</span>
              <span className="border-b border-gray-400 flex-1 pb-1">{data.school}</span>
            </div>
            <div className="flex items-center col-span-2">
              <span className="font-medium mr-2">Teacher:</span>
              <span className="border-b border-gray-400 flex-1 pb-1">{data.teacher}</span>
            </div>
          </div>

          {/* Language Selection */}
          <div className="mb-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <span className="mr-2">English:</span>
                <span className="text-lg">{data.language === 'English' ? '☑' : '☐'}</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">Filipino:</span>
                <span className="text-lg">{data.language === 'Filipino' ? '☑' : '☐'}</span>
              </div>
            </div>
          </div>

          {/* Reading Performance Table */}
          <div className="mb-6">
            <table className="w-full border-collapse border-2 border-gray-800">
              <thead>
                <tr>
                  <th rowSpan={2} className="border border-gray-800 p-2 bg-gray-100 text-sm font-bold">
                    Level Started<br />
                    <span className="text-xs">Mark with an *</span>
                  </th>
                  <th rowSpan={2} className="border border-gray-800 p-2 bg-gray-100 text-sm font-bold">Level</th>
                  <th rowSpan={2} className="border border-gray-800 p-2 bg-gray-100 text-sm font-bold">
                    Set<br />
                    <span className="text-xs">Indicate if A, B, C, or D</span>
                  </th>
                  <th colSpan={3} className="border border-gray-800 p-2 bg-gray-100 text-sm font-bold">Word Reading</th>
                  <th colSpan={3} className="border border-gray-800 p-2 bg-gray-100 text-sm font-bold">Comprehension</th>
                  <th rowSpan={2} className="border border-gray-800 p-2 bg-gray-100 text-sm font-bold">Date Taken</th>
                </tr>
                <tr>
                  <th className="border border-gray-800 p-1 bg-gray-100 text-xs font-bold">Ind</th>
                  <th className="border border-gray-800 p-1 bg-gray-100 text-xs font-bold">Ins</th>
                  <th className="border border-gray-800 p-1 bg-gray-100 text-xs font-bold">Frus</th>
                  <th className="border border-gray-800 p-1 bg-gray-100 text-xs font-bold">Ind</th>
                  <th className="border border-gray-800 p-1 bg-gray-100 text-xs font-bold">Ins</th>
                  <th className="border border-gray-800 p-1 bg-gray-100 text-xs font-bold">Frus</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => {
                  const readingEntry = data.readingData?.find(entry => entry.level === level);
                  const isStartedLevel =
                    effectiveLevelStarted === level ||
                    data.levelStarted === level ||
                    Boolean(readingEntry?.levelStarted);
                  
                  // Debug: Log entry data for this level
                  if (readingEntry) {
                    console.log(`🔍 Rendering level ${level}:`, {
                      entry: readingEntry,
                      wordReading: readingEntry.wordReading,
                      comprehension: readingEntry.comprehension,
                      wordReadingInd: readingEntry.wordReading?.ind,
                      wordReadingIns: readingEntry.wordReading?.ins,
                      wordReadingFrus: readingEntry.wordReading?.frus,
                      comprehensionInd: readingEntry.comprehension?.ind,
                      comprehensionIns: readingEntry.comprehension?.ins,
                      comprehensionFrus: readingEntry.comprehension?.frus
                    });
                  }
                  
                  return (
                    <tr key={level}>
                      <td className="border border-gray-800 p-2 text-center text-sm font-bold">
                        {isStartedLevel ? '*' : ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center font-bold">{level}</td>
                      <td className="border border-gray-800 p-2 text-center text-sm font-bold">
                        {readingEntry?.set || ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {readingEntry?.wordReading?.ind ? '✓' : ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {readingEntry?.wordReading?.ins ? '✓' : ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {readingEntry?.wordReading?.frus ? '✓' : ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {readingEntry?.comprehension?.ind ? '✓' : ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {readingEntry?.comprehension?.ins ? '✓' : ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center">
                        {readingEntry?.comprehension?.frus ? '✓' : ''}
                      </td>
                      <td className="border border-gray-800 p-2 text-center text-xs">
                        {readingEntry?.dateTaken || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs mt-2 font-medium">
              Legend: <strong>Ind</strong>- Independent; <strong>Ins</strong>- Instructional; <strong>Frus</strong>- Frustration
            </p>
          </div>

          {/* Oral Reading Observation Checklist */}
          <div className="mb-6">
            <h3 className="text-center font-bold mb-4">
              Oral Reading Observation Checklist:<br />
              <span className="italic">Talaan ng mga Puna Habang Nagbabasa</span>
            </h3>
            
            <table className="w-full border-collapse border-2 border-gray-800">
              <thead>
                <tr>
                  <th className="border border-gray-800 p-3 bg-gray-100 text-left font-bold">
                    Behaviors while Reading <span className="italic">(Paraan ng Pagbabasa)</span>
                  </th>
                  <th className="border border-gray-800 p-3 bg-gray-100 text-center font-bold w-20 whitespace-nowrap">
                    ✓ or ✗
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-800 p-3">
                    Does word-by-word reading <span className="italic">(Nagbabasa nang pa-isa isang salita)</span>
                  </td>
                  <td className="border border-gray-800 p-3 text-center text-lg">
                    {data.observations.wordByWord ? '✓' : '✗'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-800 p-3">
                    Lacks expression; reads in a monotonous tone <span className="italic">(Walang damdamin; walang pagbabago ang tono)</span>
                  </td>
                  <td className="border border-gray-800 p-3 text-center text-lg">
                    {data.observations.lacksExpression ? '✓' : '✗'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-800 p-3">
                    Voice is hardly audible <span className="italic">(Hindi madaling marinig ang boses)</span>
                  </td>
                  <td className="border border-gray-800 p-3 text-center text-lg">
                    {data.observations.hardlyAudible ? '✓' : '✗'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-800 p-3">
                    Disregards punctuation <span className="italic">(Hindi pinapansin ang mga bantas)</span>
                  </td>
                  <td className="border border-gray-800 p-3 text-center text-lg">
                    {data.observations.disregardsPunctuation ? '✓' : '✗'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-800 p-3">
                    Points to each word with his/her finger <span className="italic">(Itinuturo ang bawat salita)</span>
                  </td>
                  <td className="border border-gray-800 p-3 text-center text-lg">
                    {data.observations.pointsToWords ? '✓' : '✗'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-800 p-3">
                    Employs little or no method of analysis <span className="italic">(Bahagya o walang paraan ng pagsusuri)</span>
                  </td>
                  <td className="border border-gray-800 p-3 text-center text-lg">
                    {data.observations.littleAnalysis ? '✓' : '✗'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Other Observations */}
          <div className="mb-6">
            <h4 className="font-bold mb-2">Other observations: <span className="italic">(Ibang Puna)</span></h4>
            <div className="border-2 border-gray-800 p-4 min-h-[100px] bg-gray-50">
              <p className="text-sm">{data.observations.otherObservations || 'No additional observations'}</p>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default DepEdISRViewer;