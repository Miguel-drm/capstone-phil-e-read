/**
 * Repetition Detector for WebSpeech
 * Detects when words or phrases are repeated during reading
 */

import React from 'react';

export interface RepetitionResult {
  type: 'repetition';
  repeatedWord: string;
  position: number;
  confidence: number;
  repetitionCount: number;
  repetitionType: 'word' | 'phrase' | 'line';
  isHesitation: boolean;
  context: string[];
}

export class RepetitionDetector {
  private recentWords: string[] = [];
  private maxHistoryLength: number = 10;
  private hesitationWords: Set<string> = new Set();

  constructor() {
    this.initializeHesitationWords();
  }

  private initializeHesitationWords(): void {
    // Words that often indicate hesitation when repeated
    this.hesitationWords = new Set([
      'the', 'a', 'an', 'and', 'but', 'or', 'so', 'then',
      'um', 'uh', 'er', 'ah', 'well', 'like'
    ]);
  }

  public detect(
    spokenWords: string[],
    currentPosition: number,
    confidence: number = 0.8
  ): RepetitionResult[] {
    const repetitions: RepetitionResult[] = [];
    
    if (!spokenWords.length) return repetitions;

    // Update recent words history
    this.updateHistory(spokenWords);

    // Detect word repetitions
    const wordRepetitions = this.detectWordRepetitions(spokenWords, currentPosition, confidence);
    repetitions.push(...wordRepetitions);

    // Detect phrase repetitions
    const phraseRepetitions = this.detectPhraseRepetitions(spokenWords, currentPosition, confidence);
    repetitions.push(...phraseRepetitions);

    return repetitions;
  }

  private updateHistory(spokenWords: string[]): void {
    // Add new words to history
    this.recentWords.push(...spokenWords.map(w => w.toLowerCase().trim()));
    
    // Keep only recent words
    if (this.recentWords.length > this.maxHistoryLength) {
      this.recentWords = this.recentWords.slice(-this.maxHistoryLength);
    }
  }

  private detectWordRepetitions(
    spokenWords: string[],
    currentPosition: number,
    confidence: number
  ): RepetitionResult[] {
    const repetitions: RepetitionResult[] = [];
    
    for (let i = 1; i < spokenWords.length; i++) {
      const currentWord = spokenWords[i].toLowerCase().trim();
      const previousWord = spokenWords[i - 1].toLowerCase().trim();
      
      if (currentWord === previousWord && currentWord.length > 0) {
        // Count consecutive repetitions
        let repetitionCount = 2;
        let j = i + 1;
        while (j < spokenWords.length && spokenWords[j].toLowerCase().trim() === currentWord) {
          repetitionCount++;
          j++;
        }

        const isHesitation = this.hesitationWords.has(currentWord) || currentWord.length <= 3;
        
        const repetition: RepetitionResult = {
          type: 'repetition',
          repeatedWord: currentWord,
          position: currentPosition + i - 1,
          confidence,
          repetitionCount,
          repetitionType: 'word',
          isHesitation,
          context: spokenWords.slice(Math.max(0, i - 2), Math.min(spokenWords.length, i + 3))
        };

        repetitions.push(repetition);
        
        // Skip the repeated words
        i = j - 1;
      }
    }

    return repetitions;
  }

  private detectPhraseRepetitions(
    spokenWords: string[],
    currentPosition: number,
    confidence: number
  ): RepetitionResult[] {
    const repetitions: RepetitionResult[] = [];
    
    // Look for 2-3 word phrase repetitions
    for (let phraseLength = 2; phraseLength <= 3; phraseLength++) {
      for (let i = 0; i <= spokenWords.length - phraseLength * 2; i++) {
        const phrase1 = spokenWords.slice(i, i + phraseLength)
          .map(w => w.toLowerCase().trim())
          .join(' ');
        
        const phrase2 = spokenWords.slice(i + phraseLength, i + phraseLength * 2)
          .map(w => w.toLowerCase().trim())
          .join(' ');

        if (phrase1 === phrase2 && phrase1.length > 0) {
          const repetition: RepetitionResult = {
            type: 'repetition',
            repeatedWord: phrase1,
            position: currentPosition + i,
            confidence,
            repetitionCount: 2,
            repetitionType: 'phrase',
            isHesitation: false,
            context: spokenWords.slice(Math.max(0, i - 1), Math.min(spokenWords.length, i + phraseLength * 2 + 1))
          };

          repetitions.push(repetition);
          
          // Skip the repeated phrase
          i += phraseLength * 2 - 1;
          break; // Don't check longer phrases starting at this position
        }
      }
    }

    return repetitions;
  }

  public detectFromTranscript(
    spokenTranscript: string,
    currentPosition: number = 0,
    confidence: number = 0.8
  ): RepetitionResult[] {
    const spokenWords = spokenTranscript.split(/\s+/).filter(w => w.length > 0);
    return this.detect(spokenWords, currentPosition, confidence);
  }

  public detectFromRecentHistory(
    newWord: string,
    confidence: number = 0.8
  ): RepetitionResult | null {
    const word = newWord.toLowerCase().trim();
    
    if (this.recentWords.length === 0) {
      this.recentWords.push(word);
      return null;
    }

    const lastWord = this.recentWords[this.recentWords.length - 1];
    
    if (word === lastWord) {
      // Count how many times this word appears at the end
      let count = 1;
      for (let i = this.recentWords.length - 1; i >= 0 && this.recentWords[i] === word; i--) {
        count++;
      }

      const isHesitation = this.hesitationWords.has(word) || word.length <= 3;

      this.recentWords.push(word);

      return {
        type: 'repetition',
        repeatedWord: word,
        position: this.recentWords.length - 1,
        confidence,
        repetitionCount: count,
        repetitionType: 'word',
        isHesitation,
        context: this.recentWords.slice(-5)
      };
    }

    this.recentWords.push(word);
    return null;
  }

  public getSeverityLevel(repetition: RepetitionResult): 'low' | 'medium' | 'high' {
    if (repetition.isHesitation && repetition.repetitionCount <= 2) return 'low';
    if (repetition.repetitionType === 'phrase') return 'medium';
    if (repetition.repetitionCount >= 3) return 'high';
    return 'medium';
  }

  public getRecommendation(repetition: RepetitionResult): string {
    if (repetition.isHesitation) {
      return `Take your time. You repeated "${repetition.repeatedWord}" ${repetition.repetitionCount} times. It's okay to pause and think.`;
    }

    if (repetition.repetitionType === 'phrase') {
      return `You repeated the phrase "${repetition.repeatedWord}". Try to read each phrase only once.`;
    }

    if (repetition.repetitionCount >= 3) {
      return `Multiple repetitions of "${repetition.repeatedWord}". Take a breath and continue reading.`;
    }

    return `Word repeated: "${repetition.repeatedWord}". Continue reading smoothly.`;
  }

  public isPatternConcerning(repetitions: RepetitionResult[]): boolean {
    if (repetitions.length === 0) return false;

    // Check for concerning patterns
    const recentRepetitions = repetitions.slice(-5);
    const highSeverityCount = recentRepetitions.filter(r => this.getSeverityLevel(r) === 'high').length;
    const totalRepetitions = recentRepetitions.reduce((sum, r) => sum + r.repetitionCount, 0);

    return highSeverityCount >= 2 || totalRepetitions >= 10;
  }

  public reset(): void {
    this.recentWords = [];
  }
}

// React component for repetition detection UI
interface RepetitionDetectorUIProps {
  result: RepetitionResult;
  onCorrect?: () => void;
  onIgnore?: () => void;
}

export const RepetitionDetectorUI: React.FC<RepetitionDetectorUIProps> = ({
  result,
  onCorrect,
  onIgnore
}) => {
  const detector = new RepetitionDetector();
  const severity = detector.getSeverityLevel(result);
  const recommendation = detector.getRecommendation(result);
  
  const severityColor = result.isHesitation ? 'blue' :
                       severity === 'low' ? 'green' : 
                       severity === 'medium' ? 'yellow' : 'orange';

  return (
    <div className={`bg-${severityColor}-50 border border-${severityColor}-200 rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`font-medium text-${severityColor}-800`}>
            {result.repetitionType === 'phrase' ? 'Phrase' : 'Word'} Repetition
          </h4>
          <p className={`text-sm text-${severityColor}-700`}>
            Repeated: <strong>"{result.repeatedWord}"</strong> ({result.repetitionCount}x)
          </p>
          <p className={`text-xs text-${severityColor}-600 mt-1`}>
            {recommendation}
          </p>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 bg-${severityColor}-100 text-${severityColor}-700 rounded`}>
              {severity.toUpperCase()}
            </span>
            {result.isHesitation && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                HESITATION
              </span>
            )}
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
              {result.repetitionType.toUpperCase()}
            </span>
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
              {result.repetitionCount}x
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

export default RepetitionDetector;