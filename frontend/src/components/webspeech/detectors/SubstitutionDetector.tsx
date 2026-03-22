/**
 * Substitution Detector for WebSpeech
 * Detects when a completely different word is spoken instead of the expected word
 */

import React from 'react';

export interface SubstitutionResult {
  type: 'substitution';
  spokenWord: string;
  expectedWord: string;
  confidence: number;
  semanticSimilarity: number;
  position: number;
  isContextual: boolean;
}

export class SubstitutionDetector {
  private semanticGroups: Map<string, string[]> = new Map();
  private commonSubstitutions: Map<string, string[]> = new Map();

  constructor() {
    this.initializeSemanticGroups();
    this.initializeCommonSubstitutions();
  }

  private initializeSemanticGroups(): void {
    // Group semantically related words
    const groups = [
      ['cat', 'dog', 'pet', 'animal'],
      ['big', 'large', 'huge', 'giant'],
      ['small', 'little', 'tiny', 'mini'],
      ['happy', 'glad', 'joyful', 'cheerful'],
      ['sad', 'unhappy', 'upset', 'crying'],
      ['run', 'walk', 'jog', 'sprint'],
      ['house', 'home', 'building', 'place'],
      ['car', 'vehicle', 'truck', 'bus'],
      ['red', 'blue', 'green', 'yellow', 'color'],
      ['one', 'two', 'three', 'number'],
      ['mom', 'mother', 'mama', 'mommy'],
      ['dad', 'father', 'papa', 'daddy']
    ];

    groups.forEach(group => {
      group.forEach(word => {
        this.semanticGroups.set(word, group.filter(w => w !== word));
      });
    });
  }

  private initializeCommonSubstitutions(): void {
    // Common word substitutions in reading
    const substitutions = [
      ['the', ['a', 'an', 'this', 'that']],
      ['and', ['or', 'but', 'then']],
      ['said', ['says', 'told', 'asked']],
      ['went', ['go', 'goes', 'going']],
      ['was', ['is', 'were', 'are']],
      ['have', ['has', 'had', 'having']],
      ['will', ['would', 'could', 'should']],
      ['can', ['could', 'may', 'might']],
      ['see', ['saw', 'look', 'watch']],
      ['get', ['got', 'take', 'grab']]
    ];

    substitutions.forEach(([word, subs]) => {
      this.commonSubstitutions.set(word, subs);
      // Add reverse mappings
      subs.forEach(sub => {
        const existing = this.commonSubstitutions.get(sub) || [];
        if (!existing.includes(word)) {
          this.commonSubstitutions.set(sub, [...existing, word]);
        }
      });
    });
  }

  public detect(
    spokenWord: string,
    expectedWord: string,
    position: number,
    confidence: number = 0.8,
    context: string[] = []
  ): SubstitutionResult | null {
    if (!spokenWord || !expectedWord) return null;

    const spoken = spokenWord.toLowerCase().trim();
    const expected = expectedWord.toLowerCase().trim();

    // Skip if words are identical
    if (spoken === expected) return null;

    // Check if it's a clear substitution (not phonetically similar)
    const phoneticSimilarity = this.calculatePhoneticSimilarity(spoken, expected);
    
    // If too phonetically similar, it's likely a mispronunciation, not substitution
    if (phoneticSimilarity > 0.7) return null;

    // Calculate semantic similarity
    const semanticSimilarity = this.calculateSemanticSimilarity(spoken, expected);
    
    // Check if it's contextually appropriate
    const isContextual = this.isContextuallyAppropriate(spoken, expected, context);

    return {
      type: 'substitution',
      spokenWord: spoken,
      expectedWord: expected,
      confidence,
      semanticSimilarity,
      position,
      isContextual
    };
  }

  private calculatePhoneticSimilarity(word1: string, word2: string): number {
    if (word1 === word2) return 1.0;
    
    const len1 = word1.length;
    const len2 = word2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1.0;
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (word1[i] === word2[i]) {
        matches++;
      }
    }
    
    return matches / maxLen;
  }

  private calculateSemanticSimilarity(word1: string, word2: string): number {
    // Check semantic groups
    const group1 = this.semanticGroups.get(word1);
    if (group1 && group1.includes(word2)) {
      return 0.8; // High semantic similarity
    }

    // Check common substitutions
    const subs1 = this.commonSubstitutions.get(word1);
    if (subs1 && subs1.includes(word2)) {
      return 0.9; // Very high - common substitution
    }

    // Check if they share similar patterns (length, starting letter)
    let similarity = 0;
    
    if (word1[0] === word2[0]) similarity += 0.2; // Same first letter
    if (word1[word1.length - 1] === word2[word2.length - 1]) similarity += 0.1; // Same last letter
    
    const lengthDiff = Math.abs(word1.length - word2.length);
    if (lengthDiff <= 1) similarity += 0.2; // Similar length
    
    return Math.min(similarity, 0.5); // Cap at 0.5 for non-semantic matches
  }

  private isContextuallyAppropriate(
    spokenWord: string,
    expectedWord: string,
    context: string[]
  ): boolean {
    if (context.length === 0) return false;

    // Check if the spoken word makes sense in context
    const contextStr = context.join(' ').toLowerCase();
    
    // Simple contextual checks
    const semanticGroup = this.semanticGroups.get(spokenWord);
    if (semanticGroup) {
      return semanticGroup.some(word => contextStr.includes(word));
    }

    return false;
  }

  public getSeverityLevel(semanticSimilarity: number, isContextual: boolean): 'low' | 'medium' | 'high' {
    if (isContextual && semanticSimilarity > 0.7) return 'low';
    if (semanticSimilarity > 0.5) return 'medium';
    return 'high';
  }

  public getRecommendation(result: SubstitutionResult): string {
    if (result.isContextual) {
      return `Good contextual understanding! Try to focus on the exact word: "${result.expectedWord}"`;
    }
    
    if (result.semanticSimilarity > 0.7) {
      return `Close meaning! The text says "${result.expectedWord}" not "${result.spokenWord}"`;
    }
    
    return `Look carefully at the word. It says "${result.expectedWord}"`;
  }
}

// React component for substitution detection UI
interface SubstitutionDetectorUIProps {
  result: SubstitutionResult;
  onCorrect?: () => void;
  onIgnore?: () => void;
}

export const SubstitutionDetectorUI: React.FC<SubstitutionDetectorUIProps> = ({
  result,
  onCorrect,
  onIgnore
}) => {
  const detector = new SubstitutionDetector();
  const severity = detector.getSeverityLevel(result.semanticSimilarity, result.isContextual);
  const recommendation = detector.getRecommendation(result);
  
  const severityColor = severity === 'low' ? 'blue' : 
                       severity === 'medium' ? 'orange' : 'red';

  return (
    <div className={`bg-${severityColor}-50 border border-${severityColor}-200 rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`font-medium text-${severityColor}-800`}>Word Substitution</h4>
          <p className={`text-sm text-${severityColor}-700`}>
            Said: <strong>{result.spokenWord}</strong> → Expected: <strong>{result.expectedWord}</strong>
          </p>
          <p className={`text-xs text-${severityColor}-600 mt-1`}>
            {recommendation}
          </p>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 bg-${severityColor}-100 text-${severityColor}-700 rounded`}>
              {severity.toUpperCase()}
            </span>
            {result.isContextual && (
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                CONTEXTUAL
              </span>
            )}
          </div>
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

export default SubstitutionDetector;