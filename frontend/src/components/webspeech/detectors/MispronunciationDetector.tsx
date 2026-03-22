/**
 * Mispronunciation Detector for WebSpeech
 * Detects when a word is pronounced incorrectly but sounds similar
 */

import React from 'react';

export interface MispronunciationResult {
  type: 'mispronunciation';
  spokenWord: string;
  expectedWord: string;
  confidence: number;
  phoneticSimilarity: number;
  position: number;
}

export class MispronunciationDetector {
  private phoneticMap: Map<string, string> = new Map();

  constructor() {
    this.initializePhoneticMap();
  }

  private initializePhoneticMap(): void {
    // Common phonetic substitutions
    const phoneticRules = [
      // Vowel substitutions
      ['a', 'e'], ['e', 'i'], ['i', 'o'], ['o', 'u'],
      // Consonant substitutions
      ['b', 'p'], ['d', 't'], ['g', 'k'], ['v', 'f'],
      ['z', 's'], ['th', 'd'], ['th', 't'],
      // Common mispronunciations
      ['w', 'v'], ['r', 'l'], ['ch', 'sh']
    ];

    phoneticRules.forEach(([from, to]) => {
      this.phoneticMap.set(from, to);
      this.phoneticMap.set(to, from);
    });
  }

  public detect(
    spokenWord: string,
    expectedWord: string,
    position: number,
    confidence: number = 0.8
  ): MispronunciationResult | null {
    if (!spokenWord || !expectedWord) return null;

    const spoken = spokenWord.toLowerCase().trim();
    const expected = expectedWord.toLowerCase().trim();

    // Skip if words are identical
    if (spoken === expected) return null;

    // Calculate phonetic similarity
    const similarity = this.calculatePhoneticSimilarity(spoken, expected);

    // Threshold for mispronunciation (similar but not identical)
    if (similarity >= 0.6 && similarity < 1.0) {
      return {
        type: 'mispronunciation',
        spokenWord: spoken,
        expectedWord: expected,
        confidence,
        phoneticSimilarity: similarity,
        position
      };
    }

    return null;
  }

  private calculatePhoneticSimilarity(word1: string, word2: string): number {
    if (word1 === word2) return 1.0;
    if (Math.abs(word1.length - word2.length) > 2) return 0.0;

    // Simple phonetic similarity based on character substitutions
    let matches = 0;
    const maxLen = Math.max(word1.length, word2.length);

    for (let i = 0; i < maxLen; i++) {
      const char1 = word1[i] || '';
      const char2 = word2[i] || '';

      if (char1 === char2) {
        matches++;
      } else if (this.arePhoneticallySimilar(char1, char2)) {
        matches += 0.8; // Partial match for phonetic similarity
      }
    }

    return matches / maxLen;
  }

  private arePhoneticallySimilar(char1: string, char2: string): boolean {
    return this.phoneticMap.get(char1) === char2 || this.phoneticMap.get(char2) === char1;
  }

  public getConfidenceThreshold(): number {
    return 0.6;
  }

  public getSeverityLevel(similarity: number): 'low' | 'medium' | 'high' {
    if (similarity >= 0.8) return 'low';
    if (similarity >= 0.6) return 'medium';
    return 'high';
  }
}

// React component for mispronunciation detection UI
interface MispronunciationDetectorUIProps {
  result: MispronunciationResult;
  onCorrect?: () => void;
  onIgnore?: () => void;
}

export const MispronunciationDetectorUI: React.FC<MispronunciationDetectorUIProps> = ({
  result,
  onCorrect,
  onIgnore
}) => {
  const severityColor = result.phoneticSimilarity >= 0.8 ? 'yellow' : 
                       result.phoneticSimilarity >= 0.6 ? 'orange' : 'red';

  return (
    <div className={`bg-${severityColor}-50 border border-${severityColor}-200 rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`font-medium text-${severityColor}-800`}>Mispronunciation Detected</h4>
          <p className={`text-sm text-${severityColor}-700`}>
            Said: <strong>{result.spokenWord}</strong> → Expected: <strong>{result.expectedWord}</strong>
          </p>
          <p className={`text-xs text-${severityColor}-600`}>
            Similarity: {(result.phoneticSimilarity * 100).toFixed(1)}% | Position: {result.position}
          </p>
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

export default MispronunciationDetector;