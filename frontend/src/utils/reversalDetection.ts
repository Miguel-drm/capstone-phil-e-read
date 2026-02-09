/**
 * Reversal Detection Configuration Utility
 * Manages settings for AI-powered reversal detection in reading sessions
 */

export interface ReversalConfig {
  enabled: boolean;
  minWordLength: number;
  customReversalPairs: Array<{ word1: string; word2: string }>;
  excludeWords: string[];
}

const DEFAULT_CONFIG: ReversalConfig = {
  enabled: true,
  minWordLength: 2,
  customReversalPairs: [
    { word1: 'was', word2: 'saw' },
    { word1: 'on', word2: 'no' },
    { word1: 'pot', word2: 'top' },
    { word1: 'bad', word2: 'dab' },
  ],
  excludeWords: [],
};

const STORAGE_KEY = 'reversal_detection_config';

/**
 * Load reversal detection configuration from localStorage
 */
export function loadReversalConfig(): ReversalConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (error) {
    console.error('Error loading reversal config:', error);
  }
  return DEFAULT_CONFIG;
}

/**
 * Save reversal detection configuration to localStorage
 */
export function saveReversalConfig(config: ReversalConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving reversal config:', error);
  }
}

/**
 * Reset configuration to defaults
 */
export function resetReversalConfig(): ReversalConfig {
  saveReversalConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Validate a custom reversal pair
 */
export function validateReversalPair(word1: string, word2: string): {
  valid: boolean;
  error?: string;
} {
  const w1 = word1.trim().toLowerCase();
  const w2 = word2.trim().toLowerCase();

  if (!w1 || !w2) {
    return { valid: false, error: 'Both words are required' };
  }

  if (w1.length !== w2.length) {
    return { valid: false, error: 'Words must be the same length' };
  }

  if (w1 === w2) {
    return { valid: false, error: 'Words must be different' };
  }

  // Check if word2 is the reverse of word1
  const reversed = w1.split('').reverse().join('');
  if (reversed !== w2) {
    return {
      valid: false,
      error: `"${w2}" is not the reverse of "${w1}" (expected "${reversed}")`,
    };
  }

  return { valid: true };
}

/**
 * Check if a word pair is a reversal
 */
export function isReversalPair(
  word1: string,
  word2: string,
  config: ReversalConfig
): boolean {
  if (!config.enabled) return false;

  const w1 = word1.trim().toLowerCase();
  const w2 = word2.trim().toLowerCase();

  // Check minimum word length
  if (w1.length < config.minWordLength || w2.length < config.minWordLength) {
    return false;
  }

  // Check exclude list
  if (config.excludeWords.includes(w1) || config.excludeWords.includes(w2)) {
    return false;
  }

  // Check custom pairs
  const isCustomPair = config.customReversalPairs.some(
    (pair) =>
      (pair.word1.toLowerCase() === w1 && pair.word2.toLowerCase() === w2) ||
      (pair.word1.toLowerCase() === w2 && pair.word2.toLowerCase() === w1)
  );

  if (isCustomPair) return true;

  // Check if one word is the reverse of the other
  const reversed = w1.split('').reverse().join('');
  return reversed === w2;
}
