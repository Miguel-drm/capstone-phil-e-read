/**
 * Word Matcher for WebSpeech Miscue Detection
 * Advanced word matching and pattern recognition
 */

export class WordMatcher {
  private storyWords: string[];
  private wordSet: Set<string>;
  private normalizedWordMap: Map<string, string[]>;

  constructor(storyWords: string[]) {
    this.storyWords = storyWords;
    this.wordSet = new Set(storyWords.map(w => w.toLowerCase()));
    this.normalizedWordMap = this.buildNormalizedWordMap();
  }

  /**
   * Build normalized word mapping for fuzzy matching
   */
  private buildNormalizedWordMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();

    for (const word of this.storyWords) {
      const normalized = this.normalizeWord(word);
      if (!map.has(normalized)) {
        map.set(normalized, []);
      }
      map.get(normalized)!.push(word);
    }

    return map;
  }

  /**
   * Normalize word for matching
   */
  private normalizeWord(word: string): string {
    return word.toLowerCase()
      .replace(/[^\w]/g, '')
      .trim();
  }

  /**
   * Check if word exists in story
   */
  public isStoryWord(word: string): boolean {
    const normalized = this.normalizeWord(word);
    return this.wordSet.has(normalized);
  }

  /**
   * Find best matching word in story
   */
  public findBestMatch(spokenWord: string, position: number): {
    word: string;
    confidence: number;
    type: 'exact' | 'fuzzy' | 'phonetic' | 'none';
  } {
    const normalized = this.normalizeWord(spokenWord);
    
    // Exact match
    if (this.wordSet.has(normalized)) {
      return {
        word: this.storyWords.find(w => this.normalizeWord(w) === normalized) || spokenWord,
        confidence: 1.0,
        type: 'exact'
      };
    }

    // Fuzzy match
    const fuzzyMatch = this.findFuzzyMatch(normalized);
    if (fuzzyMatch.confidence > 0.8) {
      return {
        word: fuzzyMatch.word,
        confidence: fuzzyMatch.confidence,
        type: 'fuzzy'
      };
    }

    // Context-based match
    const contextMatch = this.findContextMatch(normalized, position);
    if (contextMatch.confidence > 0.7) {
      return {
        word: contextMatch.word,
        confidence: contextMatch.confidence,
        type: 'fuzzy'
      };
    }

    return {
      word: spokenWord,
      confidence: 0,
      type: 'none'
    };
  }

  /**
   * Find fuzzy match using string similarity
   */
  private findFuzzyMatch(word: string): { word: string; confidence: number } {
    let bestMatch = '';
    let bestScore = 0;

    for (const storyWord of this.storyWords) {
      const normalized = this.normalizeWord(storyWord);
      const similarity = this.calculateStringSimilarity(word, normalized);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = storyWord;
      }
    }

    return {
      word: bestMatch,
      confidence: bestScore
    };
  }

  /**
   * Find context-based match
   */
  private findContextMatch(word: string, position: number): { word: string; confidence: number } {
    const contextWindow = 3;
    const startPos = Math.max(0, position - contextWindow);
    const endPos = Math.min(this.storyWords.length, position + contextWindow + 1);
    
    let bestMatch = '';
    let bestScore = 0;

    for (let i = startPos; i < endPos; i++) {
      const storyWord = this.storyWords[i];
      const normalized = this.normalizeWord(storyWord);
      const similarity = this.calculateStringSimilarity(word, normalized);
      
      // Boost score for words closer to current position
      const distanceBoost = 1 - (Math.abs(i - position) / contextWindow) * 0.2;
      const adjustedScore = similarity * distanceBoost;
      
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMatch = storyWord;
      }
    }

    return {
      word: bestMatch,
      confidence: bestScore
    };
  }

  /**
   * Calculate string similarity using multiple algorithms
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Combine multiple similarity metrics
    const jaccardSim = this.jaccardSimilarity(str1, str2);
    const levenshteinSim = this.levenshteinSimilarity(str1, str2);
    const longestCommonSim = this.longestCommonSubsequenceSimilarity(str1, str2);

    // Weighted average
    return (jaccardSim * 0.3 + levenshteinSim * 0.4 + longestCommonSim * 0.3);
  }

  /**
   * Jaccard similarity for character n-grams
   */
  private jaccardSimilarity(str1: string, str2: string): number {
    const ngrams1 = this.getNGrams(str1, 2);
    const ngrams2 = this.getNGrams(str2, 2);
    
    const set1 = new Set(ngrams1);
    const set2 = new Set(ngrams2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Get n-grams from string
   */
  private getNGrams(str: string, n: number): string[] {
    const ngrams: string[] = [];
    for (let i = 0; i <= str.length - n; i++) {
      ngrams.push(str.substring(i, i + n));
    }
    return ngrams;
  }

  /**
   * Levenshtein similarity
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Longest Common Subsequence similarity
   */
  private longestCommonSubsequenceSimilarity(str1: string, str2: string): number {
    const lcs = this.longestCommonSubsequence(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : lcs / maxLength;
  }

  /**
   * Longest Common Subsequence length
   */
  private longestCommonSubsequence(str1: string, str2: string): number {
    const matrix = Array(str1.length + 1).fill(null).map(() => Array(str2.length + 1).fill(0));

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    return matrix[str1.length][str2.length];
  }

  /**
   * Get words around position for context analysis
   */
  public getContextWords(position: number, windowSize: number = 3): {
    before: string[];
    current: string;
    after: string[];
  } {
    const before = this.storyWords.slice(
      Math.max(0, position - windowSize), 
      position
    );
    
    const current = this.storyWords[position] || '';
    
    const after = this.storyWords.slice(
      position + 1, 
      Math.min(this.storyWords.length, position + windowSize + 1)
    );

    return { before, current, after };
  }

  /**
   * Check if word could be a transposition
   */
  public isTranspositionCandidate(word: string, position: number): boolean {
    const contextWords = this.getContextWords(position, 5);
    const allContextWords = [...contextWords.before, ...contextWords.after];
    
    return allContextWords.some(contextWord => 
      this.normalizeWord(contextWord) === this.normalizeWord(word)
    );
  }

  /**
   * Update story words
   */
  public updateStoryWords(newWords: string[]): void {
    this.storyWords = newWords;
    this.wordSet = new Set(newWords.map(w => w.toLowerCase()));
    this.normalizedWordMap = this.buildNormalizedWordMap();
  }
}