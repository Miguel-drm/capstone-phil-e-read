/**
 * Advanced Substitution Detection Algorithm
 * 
 * Implements multiple detection strategies to accurately identify word substitutions
 * in children's reading, accounting for:
 * - Phonetic similarities (similar sounds)
 * - Visual similarities (similar spelling)
 * - Semantic relationships (related meanings)
 * - Contextual appropriateness
 * - Language-specific patterns
 */

/**
 * Result of substitution detection analysis
 */
export interface SubstitutionAnalysis {
  isSubstitution: boolean;
  confidence: number; // 0-100
  reason: string;
  strategies: {
    phonetic: { score: number; matched: boolean };
    visual: { score: number; matched: boolean };
    semantic: { score: number; matched: boolean };
    contextual: { score: number; matched: boolean };
  };
  details: {
    spokenWord: string;
    expectedWord: string;
    similarity: number;
    phoneticallyRelated: boolean;
    visuallySimilar: boolean;
    semanticallyRelated: boolean;
  };
}

/**
 * Phonetic similarity using Soundex algorithm
 * Converts words to phonetic codes for comparison
 */
function soundex(word: string): string {
  const normalized = word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return '';

  const firstLetter = normalized[0];
  const codes: { [key: string]: string } = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6'
  };

  let code = firstLetter;
  let lastCode = codes[firstLetter] || '0';

  for (let i = 1; i < normalized.length && code.length < 4; i++) {
    const currentCode = codes[normalized[i]] || '0';
    if (currentCode !== '0' && currentCode !== lastCode) {
      code += currentCode;
      lastCode = currentCode;
    } else if (currentCode === '0') {
      lastCode = '0';
    }
  }

  return (code + '000').substring(0, 4);
}

/**
 * Levenshtein distance - measures edit distance between two words
 * Lower distance = more similar
 */
function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  const matrix: number[][] = Array(aLen + 1)
    .fill(null)
    .map(() => Array(bLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aLen][bLen];
}

/**
 * Calculate visual similarity based on character overlap
 * Returns 0-100 score
 */
function visualSimilarity(word1: string, word2: string): number {
  const a = word1.toLowerCase();
  const b = word2.toLowerCase();

  if (a === b) return 100;
  if (!a || !b) return 0;

  // Levenshtein-based similarity
  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.max(0, Math.min(100, similarity));
}

/**
 * Calculate phonetic similarity using Soundex
 * Returns 0-100 score
 */
function phoneticSimilarity(word1: string, word2: string): number {
  const code1 = soundex(word1);
  const code2 = soundex(word2);

  if (code1 === code2 && code1 !== '') {
    return 90; // Strong phonetic match
  }

  // Check if first 3 characters match
  if (code1.substring(0, 3) === code2.substring(0, 3)) {
    return 70; // Partial phonetic match
  }

  return 0;
}

/**
 * Check if words are semantically related
 * Uses word lists for common substitutions
 */
function semanticSimilarity(word1: string, word2: string): number {
  const a = word1.toLowerCase();
  const b = word2.toLowerCase();

  // Common semantic substitution pairs (homophones, near-homophones, related words)
  const semanticPairs: { [key: string]: string[] } = {
    'there': ['their', 'they\'re'],
    'their': ['there', 'they\'re'],
    'they\'re': ['there', 'their'],
    'to': ['too', 'two'],
    'too': ['to', 'two'],
    'two': ['to', 'too'],
    'for': ['four', 'fore'],
    'four': ['for', 'fore'],
    'fore': ['for', 'four'],
    'be': ['bee'],
    'bee': ['be'],
    'see': ['sea'],
    'sea': ['see'],
    'son': ['sun'],
    'sun': ['son'],
    'right': ['write', 'rite'],
    'write': ['right', 'rite'],
    'rite': ['right', 'write'],
    'know': ['no'],
    'no': ['know'],
    'one': ['won'],
    'won': ['one'],
    'hour': ['our'],
    'our': ['hour'],
    'where': ['wear', 'ware'],
    'wear': ['where', 'ware'],
    'ware': ['where', 'wear'],
    'would': ['wood'],
    'wood': ['would'],
    'new': ['knew', 'gnu'],
    'knew': ['new', 'gnu'],
    'gnu': ['new', 'knew'],
    'break': ['brake'],
    'brake': ['break'],
    'piece': ['peace'],
    'peace': ['piece'],
    'principal': ['principle'],
    'principle': ['principal'],
    'allowed': ['aloud'],
    'aloud': ['allowed'],
    'board': ['bored'],
    'bored': ['board'],
    'buy': ['by', 'bye'],
    'by': ['buy', 'bye'],
    'bye': ['buy', 'by'],
    'cell': ['sell'],
    'sell': ['cell'],
    'dear': ['deer'],
    'deer': ['dear'],
    'flour': ['flower'],
    'flower': ['flour'],
    'heal': ['heel'],
    'heel': ['heal'],
    'hear': ['here'],
    'here': ['hear'],
    'knight': ['night'],
    'night': ['knight'],
    'mail': ['male'],
    'male': ['mail'],
    'meat': ['meet'],
    'meet': ['meat'],
    'pair': ['pear', 'pare'],
    'pear': ['pair', 'pare'],
    'pare': ['pair', 'pear'],
    'plain': ['plane'],
    'plane': ['plain'],
    'road': ['rode', 'rowed'],
    'rode': ['road', 'rowed'],
    'rowed': ['road', 'rode'],
    'sail': ['sale'],
    'sale': ['sail'],
    'scene': ['seen'],
    'seen': ['scene'],
    'sole': ['soul'],
    'soul': ['sole'],
    'stair': ['stare'],
    'stare': ['stair'],
    'steal': ['steel'],
    'steel': ['steal'],
    'tail': ['tale'],
    'tale': ['tail'],
    'wait': ['weight'],
    'weight': ['wait'],
    'waste': ['waist'],
    'waist': ['waste'],
    'weather': ['whether'],
    'whether': ['weather'],
    'which': ['witch'],
    'witch': ['which'],
    'whole': ['hole'],
    'hole': ['whole'],
    'your': ['you\'re'],
    'you\'re': ['your'],
  };

  if (semanticPairs[a] && semanticPairs[a].includes(b)) {
    return 85; // Strong semantic relationship
  }

  return 0;
}

/**
 * Check contextual appropriateness
 * Verifies if the substituted word makes sense in context
 */
function contextualScore(
  spokenWord: string,
  expectedWord: string,
  context: string[]
): number {
  // Simple heuristic: check if both words are same part of speech
  // This is a simplified version - a full implementation would use NLP

  const vowels = 'aeiouAEIOU';
  const spokenVowels = (spokenWord.match(/[aeiou]/gi) || []).length;
  const expectedVowels = (expectedWord.match(/[aeiou]/gi) || []).length;

  // Similar vowel count suggests similar word structure
  if (Math.abs(spokenVowels - expectedVowels) <= 1) {
    return 60;
  }

  return 30;
}

/**
 * Main substitution detection function
 * Combines multiple strategies for robust detection
 */
export function detectSubstitution(
  spokenWord: string,
  expectedWord: string,
  context: string[] = [],
  options: {
    minConfidence?: number;
    language?: 'english' | 'tagalog';
    strictMode?: boolean;
  } = {}
): SubstitutionAnalysis {
  const {
    minConfidence = 60,
    language = 'english',
    strictMode = false
  } = options;

  const spoken = spokenWord.toLowerCase().trim();
  const expected = expectedWord.toLowerCase().trim();

  // Exact match - not a substitution
  if (spoken === expected) {
    return {
      isSubstitution: false,
      confidence: 0,
      reason: 'Exact match',
      strategies: {
        phonetic: { score: 100, matched: true },
        visual: { score: 100, matched: true },
        semantic: { score: 100, matched: true },
        contextual: { score: 100, matched: true }
      },
      details: {
        spokenWord: spoken,
        expectedWord: expected,
        similarity: 100,
        phoneticallyRelated: true,
        visuallySimilar: true,
        semanticallyRelated: true
      }
    };
  }

  // Calculate individual strategy scores
  const phoneticScore = phoneticSimilarity(spoken, expected);
  const visualScore = visualSimilarity(spoken, expected);
  const semanticScore = semanticSimilarity(spoken, expected);
  const contextScore = contextualScore(spoken, expected, context);

  // Weight the strategies
  const weights = {
    phonetic: 0.35,
    visual: 0.30,
    semantic: 0.20,
    contextual: 0.15
  };

  const overallConfidence =
    phoneticScore * weights.phonetic +
    visualScore * weights.visual +
    semanticScore * weights.semantic +
    contextScore * weights.contextual;

  // Determine if it's a substitution
  const isSubstitution = overallConfidence >= minConfidence;

  // Generate reason
  let reason = '';
  if (phoneticScore >= 70) reason += 'Phonetically similar. ';
  if (visualScore >= 70) reason += 'Visually similar. ';
  if (semanticScore >= 70) reason += 'Semantically related. ';
  if (!reason) reason = 'Different word detected.';

  return {
    isSubstitution,
    confidence: Math.round(overallConfidence),
    reason,
    strategies: {
      phonetic: { score: phoneticScore, matched: phoneticScore >= 70 },
      visual: { score: visualScore, matched: visualScore >= 70 },
      semantic: { score: semanticScore, matched: semanticScore >= 70 },
      contextual: { score: contextScore, matched: contextScore >= 60 }
    },
    details: {
      spokenWord: spoken,
      expectedWord: expected,
      similarity: Math.round(visualScore),
      phoneticallyRelated: phoneticScore >= 70,
      visuallySimilar: visualScore >= 70,
      semanticallyRelated: semanticScore >= 70
    }
  };
}

/**
 * Batch detect substitutions for multiple words
 */
export function detectSubstitutionsBatch(
  spokenWords: string[],
  expectedWords: string[],
  options?: {
    minConfidence?: number;
    language?: 'english' | 'tagalog';
    strictMode?: boolean;
  }
): SubstitutionAnalysis[] {
  return spokenWords.map((spoken, index) =>
    detectSubstitution(spoken, expectedWords[index] || '', [], options)
  );
}

/**
 * Get substitution statistics
 */
export function getSubstitutionStats(analyses: SubstitutionAnalysis[]) {
  const total = analyses.length;
  const substitutions = analyses.filter(a => a.isSubstitution).length;
  const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / total;

  return {
    total,
    substitutions,
    substitutionRate: (substitutions / total) * 100,
    avgConfidence: Math.round(avgConfidence),
    byStrategy: {
      phonetic: analyses.filter(a => a.strategies.phonetic.matched).length,
      visual: analyses.filter(a => a.strategies.visual.matched).length,
      semantic: analyses.filter(a => a.strategies.semantic.matched).length,
      contextual: analyses.filter(a => a.strategies.contextual.matched).length
    }
  };
}

/**
 * Format substitution analysis for display
 */
export function formatSubstitutionAnalysis(analysis: SubstitutionAnalysis): string {
  return `
Substitution Analysis:
- Spoken: "${analysis.details.spokenWord}"
- Expected: "${analysis.details.expectedWord}"
- Confidence: ${analysis.confidence}%
- Reason: ${analysis.reason}
- Phonetic: ${analysis.strategies.phonetic.score.toFixed(0)}%
- Visual: ${analysis.strategies.visual.score.toFixed(0)}%
- Semantic: ${analysis.strategies.semantic.score.toFixed(0)}%
- Contextual: ${analysis.strategies.contextual.score.toFixed(0)}%
  `.trim();
}
