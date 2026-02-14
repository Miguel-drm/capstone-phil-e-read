/**
 * Ghost Word Filter Module
 * 
 * Filters out common ghost/background noise words that are frequently
 * misrecognized by speech recognition systems but should be ignored
 * during reading assessment.
 * 
 * Ghost words are typically:
 * - Very common articles and prepositions (the, de, a, an)
 * - Single syllables that are easily confused with background noise
 * - Words that appear frequently in pronunciation variants
 * - Words that don't contribute meaningful assessment data
 */

// ============================================================================
// Ghost Word Lists
// ============================================================================

/**
 * English ghost words - common words that are frequently misrecognized
 * as background noise and should be filtered out
 */
export const ENGLISH_GHOST_WORDS = new Set([
  'the',      // Most common article - frequently heard as background noise
  'de',       // Common misrecognition of "the"
  'a',        // Indefinite article
  'an',       // Indefinite article
  'and',      // Common conjunction
  'or',       // Common conjunction
  'is',       // Common verb
  'it',       // Common pronoun
  'in',       // Common preposition
  'at',       // Common preposition
  'to',       // Common preposition
  'of',       // Common preposition
  'by',       // Common preposition
  // 'on',    // REMOVED - can be reversal of "no" (content word)
  'up',       // Common preposition
  'be',       // Common verb
  'do',       // Common verb
  'go',       // Common verb
  // 'no',    // REMOVED - can be reversal of "on" (content word)
  'so',       // Common word
  'we',       // Common pronoun
  'he',       // Common pronoun
  'me',       // Common pronoun
  'my',       // Common pronoun
  'um',       // Filler word
  'uh',       // Filler word
  'er',       // Filler word
  'ah',       // Filler word
  'oh',       // Filler word
  'eh',       // Filler word
  'hm',       // Filler word
  'hmm',      // Filler word
  'mm',       // Filler word
  'shh',      // Filler word
  'psst',     // Filler word
]);

/**
 * Tagalog ghost words - common words that are frequently misrecognized
 * as background noise and should be filtered out
 */
export const TAGALOG_GHOST_WORDS = new Set([
  'ang',      // Common article
  'ng',       // Common particle
  'sa',       // Common preposition
  'na',       // Common particle
  'ay',       // Common particle
  'at',       // Common conjunction
  'o',        // Common conjunction
  'ba',       // Common particle
  'pa',       // Common particle
  'din',      // Common particle
  'rin',      // Common particle
  'naman',    // Common particle
  'kasi',     // Common conjunction
  'pero',     // Common conjunction
  'dahil',    // Common conjunction
  'kung',     // Common conjunction
  'kapag',    // Common conjunction
  'habang',   // Common conjunction
  'hanggang', // Common conjunction
  'mula',     // Common preposition
  'para',     // Common preposition
  'tungkol',  // Common preposition
  'lamang',   // Common particle
  'talaga',   // Common adverb
  'sobra',    // Common adverb
  'masyado',  // Common adverb
  'um',       // Filler word
  'uh',       // Filler word
  'er',       // Filler word
  'ah',       // Filler word
  'oh',       // Filler word
  'eh',       // Filler word
  'hm',       // Filler word
  'hmm',      // Filler word
  'mm',       // Filler word
]);

// ============================================================================
// Ghost Word Detection
// ============================================================================

/**
 * Checks if a word is a ghost word that should be filtered out.
 * Ghost words are common background noise misrecognitions that don't
 * contribute meaningful assessment data.
 * 
 * @param word - The word to check
 * @param language - The language mode ('english' or 'tagalog')
 * @returns True if the word is a ghost word, false otherwise
 */
export function isGhostWord(
  word: string,
  language: 'english' | 'tagalog' = 'english'
): boolean {
  if (!word) return false;
  
  const normalizedWord = word.toLowerCase().trim();
  
  if (!normalizedWord) return false;
  
  const ghostWords = language === 'tagalog' 
    ? TAGALOG_GHOST_WORDS 
    : ENGLISH_GHOST_WORDS;
  
  return ghostWords.has(normalizedWord);
}

/**
 * Filters out ghost words from a list of words.
 * Returns only words that are not ghost words.
 * 
 * @param words - Array of words to filter
 * @param language - The language mode ('english' or 'tagalog')
 * @returns Array of non-ghost words
 */
export function filterGhostWords(
  words: string[],
  language: 'english' | 'tagalog' = 'english'
): string[] {
  return words.filter(word => !isGhostWord(word, language));
}

/**
 * Checks if a spoken word should be ignored due to being a ghost word.
 * This is the main function to call before processing a spoken word
 * in the detection pipeline.
 * 
 * @param spokenWord - The word recognized from speech
 * @param language - The language mode ('english' or 'tagalog')
 * @returns True if the word should be ignored, false if it should be processed
 */
export function shouldIgnoreWord(
  spokenWord: string,
  language: 'english' | 'tagalog' = 'english'
): boolean {
  return isGhostWord(spokenWord, language);
}

/**
 * Gets the list of ghost words for a given language.
 * Useful for debugging and configuration.
 * 
 * @param language - The language mode ('english' or 'tagalog')
 * @returns Set of ghost words for the language
 */
export function getGhostWordsList(
  language: 'english' | 'tagalog' = 'english'
): Set<string> {
  return language === 'tagalog' 
    ? new Set(TAGALOG_GHOST_WORDS) 
    : new Set(ENGLISH_GHOST_WORDS);
}

/**
 * Adds a custom ghost word to the filter.
 * This allows runtime configuration of ghost words.
 * 
 * @param word - The word to add as a ghost word
 * @param language - The language mode ('english' or 'tagalog')
 */
export function addGhostWord(
  word: string,
  language: 'english' | 'tagalog' = 'english'
): void {
  if (!word) return;
  
  const ghostWords = language === 'tagalog' 
    ? TAGALOG_GHOST_WORDS 
    : ENGLISH_GHOST_WORDS;
  
  ghostWords.add(word.toLowerCase().trim());
}

/**
 * Removes a word from the ghost word filter.
 * Useful if a word was incorrectly added or needs to be re-enabled.
 * 
 * @param word - The word to remove from ghost words
 * @param language - The language mode ('english' or 'tagalog')
 */
export function removeGhostWord(
  word: string,
  language: 'english' | 'tagalog' = 'english'
): void {
  if (!word) return;
  
  const ghostWords = language === 'tagalog' 
    ? TAGALOG_GHOST_WORDS 
    : ENGLISH_GHOST_WORDS;
  
  ghostWords.delete(word.toLowerCase().trim());
}
