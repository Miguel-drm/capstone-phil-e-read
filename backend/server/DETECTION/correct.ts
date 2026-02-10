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
 * Covers 100+ common English words with their acceptable pronunciation variants
 * including dialectal, phonetic, and colloquial variations.
 *
 * Sources:
 * - Common phonetic variations in children's speech
 * - Regional dialect variations (American, British, etc.)
 * - Colloquial pronunciations
 * - Common speech patterns in ESL learners
 * - Phonetic approximations common in early literacy
 */
export const ENGLISH_PRONUNCIATION_VARIANTS: PronunciationVariants = {
  'the': ['da', 'de', 'thee', 'thuh', 'duh', 'th'],
  'a': ['uh', 'ah', 'ay', 'ey'],
  'i': ['eye', 'aye', 'ai'],
  'to': ['too', 'two', 'ta', 'tuh'],
  'of': ['ov', 'uv', 'uh', 'av'],
  'and': ['an', 'en', 'nd', 'n', 'uh'],
  'is': ['iz', 'iss', 's', 'z'],
  'it': ['et', 'it', 'ut'],
  'in': ['en', 'in', 'un'],
  'you': ['ya', 'yuh', 'u', 'yoo', 'yo'],
  'that': ['dat', 'tat', 'thet'],
  'was': ['wuz', 'woz', 'wus', 'waz'],
  'for': ['fer', 'fur', 'for', 'fuh'],
  'are': ['er', 'ar', 'arr', 'uh'],
  'with': ['wit', 'wif', 'with', 'wuth'],
  'they': ['dey', 'they', 'da', 'thee'],
  'be': ['bee', 'buh', 'be'],
  'at': ['et', 'at', 'ut'],
  'one': ['won', 'wun', 'one'],
  'have': ['hav', 'av', 'haf', 'hev'],
  'this': ['dis', 'diss', 'this', 'thiss'],
  'from': ['frum', 'fram', 'from', 'frm'],
  'or': ['er', 'or', 'ur', 'arr'],
  'had': ['hd', 'had', 'hud', 'hed'],
  'by': ['bi', 'bye', 'by'],
  'not': ['nat', 'not', 'nit', 'nut'],
  'but': ['bat', 'but', 'bet', 'buh'],
  'what': ['wut', 'wat', 'what', 'wot'],
  'all': ['ol', 'awl', 'all', 'aw'],
  'were': ['wer', 'wur', 'were', 'wir'],
  'we': ['wee', 'we', 'uh'],
  'when': ['wen', 'when', 'whin', 'hwen'],
  'your': ['yer', 'yur', 'yor', 'your', 'yore'],
  'can': ['ken', 'kin', 'can', 'kun'],
  'said': ['sed', 'said', 'sayed', 'sade'],
  'there': ['der', 'dere', 'there', 'thair', 'thar'],
  'use': ['yuz', 'yoos', 'use', 'yooz'],
  'an': ['en', 'un', 'an', 'uh'],
  'each': ['eech', 'each', 'ech'],
  'which': ['wich', 'which', 'witch'],
  'she': ['shee', 'she', 'shu'],
  'do': ['doo', 'du', 'do', 'duh'],
  'how': ['hao', 'how', 'huh', 'hou'],
  'their': ['der', 'dere', 'their', 'thair', 'thar'],
  'if': ['ef', 'if', 'iff'],
  'will': ['wil', 'will', 'ul'],
  'up': ['ap', 'up', 'uh'],
  'other': ['udder', 'uther', 'other', 'uthur'],
  'about': ['abowt', 'bout', 'about', 'aboot'],
  'out': ['owt', 'out', 'aut'],
  'many': ['meny', 'many', 'mani'],
  'then': ['den', 'then', 'thin', 'dhen'],
  'them': ['dem', 'them', 'um'],
  'these': ['deez', 'these', 'dees', 'theez'],
  'so': ['soh', 'so', 'suh'],
  'some': ['sum', 'some', 'sum'],
  'her': ['er', 'her', 'ur', 'huh'],
  'would': ['wud', 'wood', 'would', 'wud'],
  'make': ['mayk', 'make', 'mak'],
  'like': ['lyk', 'like', 'lik'],
  'him': ['em', 'him', 'um', 'hm'],
  'into': ['inta', 'intoo', 'into', 'inta'],
  'time': ['tym', 'time', 'tim'],
  'has': ['haz', 'has', 'hus', 'hez'],
  'look': ['luk', 'look', 'luk'],
  'two': ['too', 'to', 'two', 'tu'],
  'more': ['mor', 'more', 'moar'],
  'go': ['goh', 'go', 'guh'],
  'see': ['si', 'see', 'sea'],
  'no': ['noh', 'no', 'nuh'],
  'way': ['wey', 'way', 'wae'],
  'could': ['cud', 'kud', 'could', 'kood'],
  'my': ['mi', 'my', 'muh'],
  'than': ['den', 'than', 'then', 'thun'],
  'first': ['furst', 'first', 'furst'],
  'been': ['bin', 'been', 'ben'],
  'call': ['kol', 'call', 'kawl'],
  'who': ['hoo', 'who', 'hu'],
  'its': ['ets', 'its', 'itz'],
  'now': ['nao', 'now', 'nuh'],
  'find': ['fynd', 'find', 'fined'],
  'long': ['lawng', 'long', 'lung'],
  'down': ['daon', 'down', 'doun'],
  'day': ['dey', 'day', 'dae'],
  'did': ['ded', 'did', 'dud'],
  'get': ['git', 'get', 'gat'],
  'come': ['cum', 'kam', 'come', 'kum'],
  'made': ['mayd', 'made', 'mad'],
  'may': ['mey', 'may', 'mae'],
  'part': ['pahrt', 'part', 'purt'],
  'over': ['over', 'ovar', 'ovur'],
  'such': ['such', 'sutch', 'suh'],
  'even': ['even', 'evan', 'evun'],
  'most': ['most', 'moast', 'mos'],
  'also': ['also', 'awlso', 'alzo'],
  'back': ['bak', 'back', 'bac'],
  'good': ['gud', 'good', 'gude'],
  'new': ['noo', 'new', 'nu'],
  'want': ['want', 'wont', 'wunt'],
  'because': ['because', 'cuz', 'becuz'],
  'only': ['only', 'onlee', 'onli'],
  'very': ['very', 'verry', 'veri'],
  'just': ['just', 'jus', 'jest'],
  'know': ['no', 'know', 'noh'],
  'take': ['tayk', 'take', 'tak'],
  'people': ['people', 'peepul', 'peeple'],
  'year': ['yeer', 'year', 'yir'],
  'work': ['work', 'wurk', 'wark'],
  'last': ['last', 'las', 'lust'],
  'little': ['little', 'lil', 'littel'],
  'right': ['rite', 'right', 'rait'],
  'think': ['think', 'thingk', 'tink'],
  'give': ['giv', 'give', 'guv'],
  'hand': ['hand', 'hund', 'hund'],
  'high': ['hi', 'high', 'hie'],
  'keep': ['keep', 'kep', 'kepe'],
  'tell': ['tell', 'tel', 'telle'],
  'ask': ['ask', 'aks', 'ast'],
  'need': ['need', 'nead', 'nede'],
  'feel': ['feel', 'fil', 'feele'],
  'try': ['try', 'tri', 'trie'],
  'leave': ['leave', 'lev', 'leeve'],
  'put': ['put', 'poot', 'putt'],
  'mean': ['mean', 'meen', 'mene'],
  'seem': ['seem', 'sem', 'seeme'],
  'help': ['help', 'hep', 'helpe'],
  'talk': ['talk', 'tawk', 'talke'],
  'turn': ['turn', 'tern', 'turne'],
  'start': ['start', 'sturt', 'starte'],
  'show': ['show', 'sho', 'showe'],
  'hear': ['hear', 'heer', 'heare'],
  'let': ['let', 'lit', 'lette'],
  'move': ['move', 'moov', 'moove'],
  'face': ['face', 'fays', 'facee'],
  'live': ['live', 'liv', 'livee'],
  'open': ['open', 'opin', 'opene'],
  'read': ['read', 'red', 'reade'],
  'write': ['write', 'rite', 'writee'],
  'play': ['play', 'pley', 'playe'],
  'walk': ['walk', 'wawk', 'walke'],
  'run': ['run', 'ren', 'runne'],
  'sit': ['sit', 'set', 'sitte'],
  'stand': ['stand', 'stund', 'stande'],
  'sleep': ['sleep', 'slep', 'sleepe'],
  'eat': ['eat', 'eet', 'eate'],
  'drink': ['drink', 'dringk', 'drinke'],
  'sing': ['sing', 'singk', 'singe'],
  'dance': ['dance', 'dans', 'dancee'],
  'jump': ['jump', 'jum', 'jumpe'],
  'laugh': ['laugh', 'laf', 'laughe'],
  'cry': ['cry', 'cri', 'crye'],
  'smile': ['smile', 'smil', 'smiley'],
  'listen': ['listen', 'lisun', 'listene'],
  'watch': ['watch', 'wotch', 'watche'],
  'touch': ['touch', 'tutch', 'touche'],
  'smell': ['smell', 'smel', 'smelle'],
  'taste': ['taste', 'tast', 'tastee'],
};

/**
 * Tagalog pronunciation variants - common dialectal variations
 * Covers 50+ common Tagalog words with their acceptable pronunciation variants
 * including regional, colloquial, and phonetic variations.
 *
 * Sources:
 * - Common dialectal variations in Filipino speech
 * - Regional pronunciation differences (Manila, Visayas, Mindanao)
 * - Colloquial and informal speech patterns
 * - Common phonetic approximations in early literacy
 * - Vowel reduction patterns common in Tagalog
 */
export const TAGALOG_PRONUNCIATION_VARIANTS: PronunciationVariants = {
  'ng': ['nang', 'ng'],
  'mga': ['manga', 'maga', 'mga'],
  'ang': ['eng', 'ang'],
  'sa': ['se', 'sa'],
  'na': ['ne', 'na'],
  'ay': ['ey', 'ay'],
  'at': ['et', 'at'],
  'ko': ['ku', 'ko'],
  'mo': ['mu', 'mo'],
  'ka': ['ke', 'ka'],
  'si': ['se', 'si'],
  'ni': ['ne', 'ni'],
  'niya': ['nya', 'niya'],
  'siya': ['sha', 'sya', 'siya'],
  'ito': ['to', 'etu', 'ito'],
  'iyan': ['yan', 'iyan'],
  'iyon': ['yon', 'iyon'],
  'dito': ['dto', 'detu', 'dito'],
  'diyan': ['dyan', 'diyan'],
  'doon': ['don', 'dun', 'doon'],
  'hindi': ['hinde', 'di', 'hindi'],
  'wala': ['wale', 'wala'],
  'may': ['mey', 'may'],
  'mayroon': ['meron', 'mayroon'],
  'ano': ['anu', 'ano'],
  'sino': ['sinu', 'sino'],
  'saan': ['san', 'saan'],
  'kailan': ['kelan', 'kailan'],
  'bakit': ['bat', 'bkit', 'bakit'],
  'paano': ['pano', 'paano'],
  'oo': ['o', 'oho', 'oo'],
  'opo': ['po', 'opo'],
  'ako': ['aku', 'ako'],
  'ikaw': ['kaw', 'ka', 'ikaw'],
  'tayo': ['tayu', 'tayo'],
  'kami': ['kame', 'kami'],
  'kayo': ['kayu', 'kayo'],
  'sila': ['sla', 'sila'],
  'namin': ['namen', 'namin'],
  'natin': ['naten', 'natin'],
  'ninyo': ['nyo', 'ninyo'],
  'nila': ['nla', 'nila'],
  'akin': ['aken', 'kin', 'akin'],
  'iyo': ['yo', 'iyo'],
  'atin': ['aten', 'atin'],
  'kanila': ['kanla', 'kanila'],
  'pero': ['piro', 'pero'],
  'kasi': ['kase', 'kasi'],
  'dahil': ['dhil', 'dahil'],
  'kung': ['kng', 'kung'],
  'kapag': ['pag', 'kapag'],
  'habang': ['hbang', 'habang'],
  'hanggang': ['hnggang', 'hanggang'],
  'mula': ['mla', 'mula'],
  'para': ['pra', 'para'],
  'tungkol': ['tngkol', 'tungkol'],
  'lamang': ['lang', 'lamang'],
  'din': ['rin', 'din'],
  'nga': ['nge', 'nga'],
  'ba': ['be', 'ba'],
  'pa': ['pe', 'pa'],
  'talaga': ['tlaga', 'talaga'],
  'sobra': ['sbra', 'sobra'],
  'masyado': ['msyado', 'masyado'],
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
