/**
 * Omission Detector for WebSpeech
 * Detects when words are skipped or omitted during reading
 */

import React from 'react';

export interface OmissionResult {
  type: 'omission';
  omittedWord: string;
  position: number;
  confidence: number;
  context: string[];
  isSignificant: boolean;
  omissionType: 'single' | 'multiple' | 'line_skip';
}

export class OmissionDetector {
  private significantWords: Set<string> = new Set();
  private functionWords: Set<string> = new Set();

  constructor() {
    this.initializeWordCategories();
  }

  private initializeWordCategories(): void {
    // Content words that are significant for meaning
    this.significantWords = new Set([
      'cat', 'dog', 'house', 'car', 'tree', 'book', 'water', 'food',
      'happy', 'sad', 'big', 'small', 'red', 'blue', 'green',
      'run', 'walk', 'jump', 'eat', 'sleep', 'play', 'work',
      'mother', 'father', 'child', 'friend', 'teacher', 'doctor'
    ]);

    // Function words that are less critical for meaning
    this.functionWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'for', 'of', 'with', 'by', 'from', 'up', 'down', 'out', 'off',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had'
    ]);
  }

  public detect(
    expectedWords: string[],
    spokenWords: string[],
    currentPosition: number,
    confidence: number = 0.8
  ): OmissionResult[] {
    const omissions: OmissionResult[] = [];
    
    if (!expectedWords.length || !spokenWords.length) return omissions;

    // Simple alignment - look for missing words
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
        // Check if the expected word was omitted
        const nextSpokenWord = spokenIndex + 1 < spokenWords.length ? 
          spokenWords[spokenIndex + 1].toLowerCase().trim() : null;

        if (nextSpokenWord && expectedWord === nextSpokenWord) {
          // Current expected word was omitted
          const omission = this.createOmissionResult(
            expectedWord,
            expectedIndex,
            confidence,
            expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 3)
          );
          
          omissions.push(omission);
          expectedIndex++;
          // Don't advance spokenIndex - the current spoken word might match the next expected word
        } else {
          // Try to find the spoken word in the next few expected words
          let found = false;
          for (let i = 1; i <= 3 && expectedIndex + i < expectedWords.length; i++) {
            if (expectedWords[expectedIndex + i].toLowerCase().trim() === spokenWord) {
              // Found the spoken word later in expected sequence
              // Mark the skipped words as omissions
              for (let j = 0; j < i; j++) {
                const omittedWord = expectedWords[expectedIndex + j];
                const omission = this.createOmissionResult(
                  omittedWord,
                  expectedIndex + j,
                  confidence,
                  expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 5)
                );
                omissions.push(omission);
              }
              expectedIndex += i + 1;
              spokenIndex++;
              found = true;
              break;
            }
          }
          
          if (!found) {
            // No match found, advance both indices
            expectedIndex++;
            spokenIndex++;
          }
        }
      }
    }

    // Check for remaining expected words (omitted at the end)
    while (expectedIndex < expectedWords.length) {
      const omittedWord = expectedWords[expectedIndex];
      const omission = this.createOmissionResult(
        omittedWord,
        expectedIndex,
        confidence,
        expectedWords.slice(Math.max(0, expectedIndex - 2), expectedIndex + 3)
      );
      omissions.push(omission);
      expectedIndex++;
    }

    return omissions;
  }

  private createOmissionResult(
    omittedWord: string,
    position: number,
    confidence: number,
    context: string[]
  ): OmissionResult {
    const word = omittedWord.toLowerCase().trim();
    const isSignificant = this.significantWords.has(word) || !this.functionWords.has(word);
    
    return {
      type: 'omission',
      omittedWord: word,
      position,
      confidence,
      context,
      isSignificant,
      omissionType: 'single' // Could be enhanced to detect multiple/line_skip
    };
  }

  public detectFromTranscript(
    expectedText: string,
    spokenTranscript: string,
    confidence: number = 0.8
  ): OmissionResult[] {
    const expectedWords = expectedText.split(/\s+/).filter(w => w.length > 0);
    const spokenWords = spokenTranscript.split(/\s+/).filter(w => w.length > 0);
    
    return this.detect(expectedWords, spokenWords, 0, confidence);
  }

  public getSeverityLevel(omission: OmissionResult): 'low' | 'medium' | 'high' {
    if (!omission.isSignificant) return 'low';
    if (omission.omissionType === 'multiple' || omission.omissionType === 'line_skip') return 'high';
    return 'medium';
  }

  public getRecommendation(omission: OmissionResult): string {
    if (!omission.isSignificant) {
      return `Small word skipped: "${omission.omittedWord}". Try to read every word.`;
    }
    
    if (omission.omissionType === 'multiple') {
      return `Multiple words skipped. Slow down and read each word carefully.`;
    }
    
    return `Important word skipped: "${omission.omittedWord}". This word is important for understanding.`;
  }

  public isWordSignificant(word: string): boolean {
    const w = word.toLowerCase().trim();
    return this.significantWords.has(w) || !this.functionWords.has(w);
  }
}

// React component for omission detection UI
interface OmissionDetectorUIProps {
  result: OmissionResult;
  onCorrect?: () => void;
  onIgnore?: () => void;
}

export const OmissionDetectorUI: React.FC<OmissionDetectorUIProps> = ({
  result,
  onCorrect,
  onIgnore
}) => {
  const detector = new OmissionDetector();
  const severity = detector.getSeverityLevel(result);
  const recommendation = detector.getRecommendation(result);
  
  const severityColor = severity === 'low' ? 'yellow' : 
                       severity === 'medium' ? 'orange' : 'red';

  return (
    <div className={`bg-${severityColor}-50 border border-${severityColor}-200 rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`font-medium text-${severityColor}-800`}>Word Omission</h4>
          <p className={`text-sm text-${severityColor}-700`}>
            Skipped: <strong>"{result.omittedWord}"</strong> at position {result.position}
          </p>
          <p className={`text-xs text-${severityColor}-600 mt-1`}>
            {recommendation}
          </p>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 bg-${severityColor}-100 text-${severityColor}-700 rounded`}>
              {severity.toUpperCase()}
            </span>
            {result.isSignificant && (
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                SIGNIFICANT
              </span>
            )}
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
              {result.omissionType.toUpperCase().replace('_', ' ')}
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

export default OmissionDetector;