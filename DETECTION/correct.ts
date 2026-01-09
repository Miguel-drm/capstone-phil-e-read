/**
 * Correct Word Detection Module
 * 
 * Detects when a student correctly reads a word from the story text
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of correct word detection
 */
export interface CorrectWordResult {
  /** Type of match: 'correct' if word matches, 'no_match' otherwise */
  matchType: 'correct' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (0 for correct matches) */
  miscueCount: number;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Dictionary mapping words to their acceptable pronunciation variants
 */
export interface PronunciationVariants {
  [word: string]: string[];
}

// ============================================================================
// Pronunciation Dictionaries
// ============================================================================

/**
 * English pronunciation variants - common phonetic variations
 */
export const ENGLISH_PRONUNCIATION_VARIANTS: PronunciationVariants = {
  'the': ['da', 'de', 'thee', 'thuh', 'duh'],
  'a': ['uh', 'ah', 'ay'],
  'i': ['eye', 'aye'],
  'to': ['too', 'two', 'ta'],
  'of': ['ov', 'uv'],
  'and': ['an', 'en', 'nd'],
  'is': ['iz', 'iss'],
  'it': ['et'],
  'in': ['en'],
  'you': ['ya', 'yuh', 'u'],
  'that': ['dat'],
  'was': ['wuz', 'woz'],
  'for': ['fer', 'fur'],
  'are': ['er', 'ar'],
  'with': ['wit', 'wif'],
  'they': ['dey'],
  'be': ['bee'],
  'at': ['et'],
  'one': ['won', 'wun'],
  'have': ['hav', 'av'],
  'this': ['dis'],
  'from': ['frum', 'fram'],
  'or': ['er'],
  'had': ['hd'],
  'by': ['bi'],
  'not': ['nat'],
  'but': ['bat'],
  'what': ['wut', 'wat'],
  'all': ['ol', 'awl'],
  'were': ['wer', 'wur'],
  'we': ['wee'],
  'when': ['wen'],
  'your': ['yer', 'yur', 'yor'],
  'can': ['ken', 'kin'],
  'said': ['sed'],
  'there': ['der', 'dere'],
  'use': ['yuz', 'yoos'],
  'an': ['en', 'un'],
  'each': ['eech'],
  'which': ['wich'],
  'she': ['shee'],
  'do': ['doo', 'du'],
  'how': ['hao'],
  'their': ['der', 'dere'],
  'if': ['ef'],
  'will': ['wil'],
  'up': ['ap'],
  'other': ['udder', 'uther'],
  'about': ['abowt', 'bout'],
  'out': ['owt'],
  'many': ['meny'],
  'then': ['den'],
  'them': ['dem'],
  'these': ['deez'],
  'so': ['soh'],
  'some': ['sum'],
  'her': ['er'],
  'would': ['wud', 'wood'],
  'make': ['mayk'],
  'like': ['lyk'],
  'him': ['em'],
  'into': ['inta', 'intoo'],
  'time': ['tym'],
  'has': ['haz'],
  'look': ['luk'],
  'two': ['too', 'to'],
  'more': ['mor'],
  'go': ['goh'],
  'see': ['si'],
  'no': ['noh'],
  'way': ['wey'],
  'could': ['cud', 'kud'],
  'my': ['mi'],
  'than': ['den'],
  'first': ['furst'],
  'been': ['bin'],
  'call': ['kol'],
  'who': ['hoo'],
  'its': ['ets'],
  'now': ['nao'],
  'find': ['fynd'],
  'long': ['lawng'],
  'down': ['daon'],
  'day': ['dey'],
  'did': ['ded'],
  'get': ['git'],
  'come': ['cum', 'kam'],
  'made': ['mayd'],
  'may': ['mey'],
  'part': ['pahrt'],
};

/**
 * Tagalog pronunciation variants - common dialectal variations
 */
export const TAGALOG_PRONUNCIATION_VARIANTS: PronunciationVariants = {
  'ng': ['nang'],
  'mga': ['manga', 'maga'],
  'ang': ['eng'],
  'sa': ['se'],
  'na': ['ne'],
  'ay': ['ey'],
  'at': ['et'],
  'ko': ['ku'],
  'mo': ['mu'],
  'ka': ['ke'],
  'si': ['se'],
  'ni': ['ne'],
  'niya': ['nya'],
  'siya': ['sha', 'sya'],
  'ito': ['to', 'etu'],
  'iyan': ['yan'],
  'iyon': ['yon'],
  'dito': ['dto', 'detu'],
  'diyan': ['dyan'],
  'doon': ['don', 'dun'],
  'hindi': ['hinde', 'di'],
  'wala': ['wale'],
  'may': ['mey'],
  'mayroon': ['meron'],
  'ano': ['anu'],
  'sino': ['sinu'],
  'saan': ['san'],
  'kailan': ['kelan'],
  'bakit': ['bat', 'bkit'],
  'paano': ['pano'],
  'oo': ['o', 'oho'],
  'opo': ['po'],
  'ako': ['aku'],
  'ikaw': ['kaw', 'ka'],
  'tayo': ['tayu'],
  'kami': ['kame'],
  'kayo': ['kayu'],
  'sila': ['sla'],
  'namin': ['namen'],
  'natin': ['naten'],
  'ninyo': ['nyo'],
  'nila': ['nla'],
  'akin': ['aken', 'kin'],
  'iyo': ['yo'],
  'atin': ['aten'],
  'kanila': ['kanla'],
  'pero': ['piro'],
  'kasi': ['kase'],
  'dahil': ['dhil'],
  'kung': ['kng'],
  'kapag': ['pag'],
  'habang': ['hbang'],
  'hanggang': ['hnggang'],
  'mula': ['mla'],
  'para': ['pra'],
  'tungkol': ['tngkol'],
  'lamang': ['lang'],
  'din': ['rin'],
  'nga': ['nge'],
  'ba': ['be'],
  'pa': ['pe'],
  'talaga': ['tlaga'],
  'sobra': ['sbra'],
  'masyado': ['msyado'],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalizes a word for comparison by converting to lowercase
 * and removing punctuation characters.
 * 
 * @param word - The word to normalize
 * @returns Normalized word (lowercase, no punctuation)
 */
export function normalizeWord(word: string): string {
  if (!word) return '';
  
  // Convert to lowercase and remove punctuation
  return word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '') // Remove non-letter, non-number characters (Unicode-aware)
    .trim();
}

/**
 * Checks if a spoken word matches an expected word through
 * pronunciation variants.
 * 
 * @param spoken - The word that was spoken
 * @param expected - The expected word from the story
 * @param language - The language mode ('english' or 'tagalog')
 * @returns True if the spoken word is an acceptable variant
 */
export function checkPronunciationMatch(
  spoken: string,
  expected: string,
  language: 'english' | 'tagalog'
): boolean {
  const normalizedSpoken = normalizeWord(spoken);
  const normalizedExpected = normalizeWord(expected);
  
  if (!normalizedSpoken || !normalizedExpected) return false;
  
  // Select appropriate dictionary
  const variants = language === 'tagalog' 
    ? TAGALOG_PRONUNCIATION_VARIANTS 
    : ENGLISH_PRONUNCIATION_VARIANTS;
  
  // Check if expected word has variants and spoken matches one
  // Use Object.prototype.hasOwnProperty.call to avoid prototype pollution issues
  if (Object.prototype.hasOwnProperty.call(variants, normalizedExpected)) {
    const expectedVariants = variants[normalizedExpected];
    if (Array.isArray(expectedVariants) && expectedVariants.includes(normalizedSpoken)) {
      return true;
    }
  }
  
  // Also check reverse: if spoken word is a key and expected is a variant
  if (Object.prototype.hasOwnProperty.call(variants, normalizedSpoken)) {
    const spokenVariants = variants[normalizedSpoken];
    if (Array.isArray(spokenVariants) && spokenVariants.includes(normalizedExpected)) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word correctly matches the expected word
 * at the current position in the story.
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param language - Language mode for pronunciation matching (default: 'english')
 * @returns CorrectWordResult with match details
 */
export function detectCorrectWord(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  language: 'english' | 'tagalog' = 'english'
): CorrectWordResult {
  // Handle edge cases
  const normalizedSpoken = normalizeWord(spokenWord || '');
  const normalizedExpected = normalizeWord(expectedWord || '');
  
  // Empty input handling
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      details: 'Empty spoken word input'
    };
  }
  
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      details: 'Empty expected word'
    };
  }
  
  // Check for exact match (after normalization)
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'correct',
      advance: true,
      newPosition: currentPosition + 1,
      miscueCount: 0,
      details: `Exact match: "${spokenWord}" matches "${expectedWord}"`
    };
  }
  
  // Check for pronunciation variant match
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'correct',
      advance: true,
      newPosition: currentPosition + 1,
      miscueCount: 0,
      details: `Pronunciation variant: "${spokenWord}" accepted for "${expectedWord}"`
    };
  }
  
  // No match found
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: currentPosition,
    miscueCount: 0,
    details: `No match: "${spokenWord}" does not match "${expectedWord}"`
  };
}
