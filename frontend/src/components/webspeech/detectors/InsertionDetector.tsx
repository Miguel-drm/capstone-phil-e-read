/**
 * Insertion Detector for WebSpeech
 * Detects when extra words are added that aren't in the text
 */

import React from 'react';

export interface InsertionResult {
  type: 'insertion';
  insertedWord: string;
  position: number;
  confidence: number;
  context: string[];
  insertionType: 'filler' | 'repetition' | 'elaboration' | 'correction';
  isHelpful: boolean;
}

export class InsertionDetector {
  private fillerWords: Set<string> = new Set();
  private correctionWords: Set<string> = new Set();

  constructor() {
    this.initializeWordCategories();
  }

  private initializeWordCategories(): void {
    // Common filler words
    this.fillerWords = new Set([
      'um', 'uh', 'er', 'ah', 'like', 'you know', 'well', 'so',
      'actually', 'basically', 'literally', 'totally', 'really'
    ]);

    // Words that indicate self-correction
    this.correctionWords = new Set([
      'no', 'wait', 'sorry', 'i mean', 'actually', 'oops', 'oh'
    ]);
  }

  public detect(
    expectedWords: string[],
    spokenWords: string[],
    currentPosition: number,
    confidence: number = 0.8
  ): InsertionResult[] {
    const insertions: InsertionResult[] = [];
    
    if (!expectedWords.length || !spokenWords.length) return insertions;

    // Align spoken words with expected words to find insertions
    let expectedIndex = currentPosition;
    let spokenIndex = 0;

    while (expectedIndex < expectedWords.length && spokenIndex < spokenWords.length) {
      const expectedWord = expectedWords[expectedIndex].toLowerCase().trim();
      const spokenWord = spokenWords[spokenIndex].toLowerCase().trim();

      if (expectedWord === spokenWord) {
        // Words match, advance both
        expectedIndex++;
        spokenIndex++;
      } else {
        // Check if this is an insertion
        const insertion = this.analyzeInsertion(
          spokenWord,
          expectedWords,
          spokenWords,
          expectedIndex,
          spokenIndex,
          confidence
        );

        if (insertion) {
          insertions.push(insertion);
        }

        // Try to find the expected word in the next few spoken words
        let found = false;
        for (let i = 1; i <= 3 && spokenIndex + i < spokenWords.length; i++) {
          if (spokenWords[spokenIndex + i].toLowerCase().trim() === expectedWord) {
            // Found expected word later, mark intermediate words as insertions
            for (let j = 0; j < i; j++) {
              const insertedWord = spokenWords[spokenIndex + j];
              const insertionResult = this.createInsertionResult(
                insertedWord,
                expectedIndex,
                confidence,
                expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 3)
              );
              if (!insertions.find(ins => ins.insertedWord === insertionResult.insertedWord && ins.position === insertionResult.position)) {
                insertions.push(insertionResult);
              }
            }
            expectedIndex++;
            spokenIndex += i + 1;
            found = true;
            break;
          }
        }

        if (!found) {
          // No match found, advance spoken index (treat as insertion)
          spokenIndex++;
        }
      }
    }

    // Any remaining spoken words are insertions
    while (spokenIndex < spokenWords.length) {
      const insertedWord = spokenWords[spokenIndex];
      const insertion = this.createInsertionResult(
        insertedWord,
        expectedIndex,
        confidence,
        expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 1)
      );
      insertions.push(insertion);
      spokenIndex++;
    }

    return insertions;
  }

  private analyzeInsertion(
    spokenWord: string,
    expectedWords: string[],
    spokenWords: string[],
    expectedIndex: number,
    spokenIndex: number,
    confidence: number
  ): InsertionResult | null {
    const word = spokenWord.toLowerCase().trim();
    
    // Check if it's a filler word
    if (this.fillerWords.has(word)) {
      return this.createInsertionResult(
        word,
        expectedIndex,
        confidence,
        expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 3),
        'filler'
      );
    }

    // Check if it's a correction word
    if (this.correctionWords.has(word)) {
      return this.createInsertionResult(
        word,
        expectedIndex,
        confidence,
        expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 3),
        'correction'
      );
    }

    // Check for repetition
    if (spokenIndex > 0 && spokenWords[spokenIndex - 1].toLowerCase().trim() === word) {
      return this.createInsertionResult(
        word,
        expectedIndex,
        confidence,
        expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 3),
        'repetition'
      );
    }

    // Check if it's an elaboration (related to context)
    const isElaboration = this.isElaboration(word, expectedWords, expectedIndex);
    if (isElaboration) {
      return this.createInsertionResult(
        word,
        expectedIndex,
        confidence,
        expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 3),
        'elaboration'
      );
    }

    return null;
  }

  private createInsertionResult(
    insertedWord: string,
    position: number,
    confidence: number,
    context: string[],
    insertionType: InsertionResult['insertionType'] = 'elaboration'
  ): InsertionResult {
    const word = insertedWord.toLowerCase().trim();
    const isHelpful = this.isHelpfulInsertion(word, insertionType);
    
    return {
      type: 'insertion',
      insertedWord: word,
      position,
      confidence,
      context,
      insertionType,
      isHelpful
    };
  }

  private isElaboration(word: string, expectedWords: string[], position: number): boolean {
    // Check if the word is semantically related to nearby expected words
    const contextWords = expectedWords.slice(Math.max(0, position - 2), position + 3);
    const contextStr = contextWords.join(' ').toLowerCase();
    
    // Simple semantic relationship check
    const semanticPairs = [
      ['cat', ['animal', 'pet', 'kitten', 'meow']],
      ['house', ['home', 'building', 'room', 'door']],
      ['car', ['vehicle', 'drive', 'road', 'wheel']],
      ['happy', ['smile', 'joy', 'glad', 'cheerful']],
      ['sad', ['cry', 'tears', 'upset', 'unhappy']]
    ];

    for (const [key, related] of semanticPairs) {
      if (contextStr.includes(key) && related.includes(word)) {
        return true;
      }
    }

    return false;
  }

  private isHelpfulInsertion(word: string, insertionType: InsertionResult['insertionType']): boolean {
    switch (insertionType) {
      case 'correction':
        return true; // Self-corrections are helpful
      case 'elaboration':
        return true; // Elaborations show understanding
      case 'filler':
        return false; // Fillers are not helpful
      case 'repetition':
        return false; // Repetitions are not helpful
      default:
        return false;
    }
  }

  public detectFromTranscript(
    expectedText: string,
    spokenTranscript: string,
    confidence: number = 0.8
  ): InsertionResult[] {
    const expectedWords = expectedText.split(/\s+/).filter(w => w.length > 0);
    const spokenWords = spokenTranscript.split(/\s+/).filter(w => w.length > 0);
    
    return this.detect(expectedWords, spokenWords, 0, confidence);
  }

  public getSeverityLevel(insertion: InsertionResult): 'low' | 'medium' | 'high' {
    if (insertion.isHelpful) return 'low';
    if (insertion.insertionType === 'filler') return 'low';
    if (insertion.insertionType === 'repetition') return 'medium';
    return 'medium';
  }

  public getRecommendation(insertion: InsertionResult): string {
    switch (insertion.insertionType) {
      case 'filler':
        return `Try to avoid filler words like "${insertion.insertedWord}". Read smoothly.`;
      case 'repetition':
        return `Word repeated: "${insertion.insertedWord}". Take your time and read each word once.`;
      case 'correction':
        return `Good self-correction! You caught your mistake.`;
      case 'elaboration':
        return `Good understanding! But try to stick to the text: "${insertion.insertedWord}" isn't written here.`;
      default:
        return `Extra word added: "${insertion.insertedWord}". Focus on reading only what's written.`;
    }
  }
}

// React component for insertion detection UI
interface InsertionDetectorUIProps {
  result: InsertionResult;
  onCorrect?: () => void;
  onIgnore?: () => void;
}

export const InsertionDetectorUI: React.FC<InsertionDetectorUIProps> = ({
  result,
  onCorrect,
  onIgnore
}) => {
  const detector = new InsertionDetector();
  const severity = detector.getSeverityLevel(result);
  const recommendation = detector.getRecommendation(result);
  
  const severityColor = result.isHelpful ? 'green' :
                       severity === 'low' ? 'blue' : 
                       severity === 'medium' ? 'yellow' : 'orange';

  return (
    <div className={`bg-${severityColor}-50 border border-${severityColor}-200 rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`font-medium text-${severityColor}-800`}>Word Insertion</h4>
          <p className={`text-sm text-${severityColor}-700`}>
            Added: <strong>"{result.insertedWord}"</strong> at position {result.position}
          </p>
          <p className={`text-xs text-${severityColor}-600 mt-1`}>
            {recommendation}
          </p>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 bg-${severityColor}-100 text-${severityColor}-700 rounded`}>
              {result.insertionType.toUpperCase()}
            </span>
            {result.isHelpful && (
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                HELPFUL
              </span>
            )}
            <span className={`text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded`}>
              {severity.toUpperCase()}
            </span>
          </div>
          {result.context.length > 0 && (
            <p className={`text-xs text-${severityColor}-600 mt-1`}>
              Context: "{result.context.join(' ')}"
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {onCorrect && (
            <button
              onClick={onCorrect}
              className={`px-2 py-1 text-xs bg-${severityColor}-600 text-white rounded hover:bg-${severityColor}-700`}
            >
              Correct
            </button>
          )}
          {onIgnore && (
            <button
              onClick={onIgnore}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Ignore
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsertionDetector;