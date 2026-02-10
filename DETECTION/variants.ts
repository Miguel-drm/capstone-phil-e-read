/**
 * Word Variants System - Core Interfaces and Types
 * 
 * Defines the data structures and interfaces for managing pronunciation variants
 * in the reading assessment system. Supports built-in variants for English and Tagalog,
 * with optional story-level customization.
 */

// ============================================================================
// Core Data Model Interfaces
// ============================================================================

/**
 * Represents a single variant entry with metadata
 * 
 * @interface VariantEntry
 */
export interface VariantEntry {
  /** The canonical word */
  word: string;
  
  /** Array of acceptable pronunciations or spellings */
  variants: string[];
  
  /** Language of the variants ('english' or 'tagalog') */
  language: 'english' | 'tagalog';
  
  /** Whether this is a built-in variant (true) or custom (false) */
  isBuiltIn: boolean;
  
  /** Story ID if this is a story-level variant (undefined for built-in) */
  storyId?: string;
  
  /** Timestamp of creation */
  createdAt: Date;
  
  /** Timestamp of last update */
  updatedAt: Date;
}

/**
 * Dictionary mapping words to arrays of acceptable variants
 * 
 * @interface VariantDictionary
 * @example
 * {
 *   'the': ['da', 'de', 'thee', 'thuh'],
 *   'a': ['uh', 'ah', 'ay']
 * }
 */
export interface VariantDictionary {
  [word: string]: string[];
}

/**
 * Metadata associated with a variant entry
 * 
 * @interface VariantMetadata
 */
export interface VariantMetadata {
  /** Language of the variants */
  language: 'english' | 'tagalog';
  
  /** Whether this is a built-in variant */
  isBuiltIn: boolean;
  
  /** Story ID if this is a story-level variant */
  storyId?: string;
  
  /** Timestamp of creation */
  createdAt: Date;
  
  /** Timestamp of last update */
  updatedAt: Date;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Interface for the Variant Service
 * Manages variant loading, retrieval, and persistence
 * 
 * @interface IVariantService
 */
export interface IVariantService {
  /**
   * Initializes the variant service by loading built-in variants
   * Must be called before using other methods
   * 
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;
  
  /**
   * Retrieves all variants for a word in a specific language
   * Returns both built-in and story-level variants
   * 
   * @param word - The word to get variants for
   * @param language - The language ('english' or 'tagalog')
   * @param storyId - Optional story ID for story-level variants
   * @returns Array of variant pronunciations, empty array if no variants exist
   */
  getVariants(
    word: string,
    language: 'english' | 'tagalog',
    storyId?: string
  ): string[];
  
  /**
   * Retrieves all variants for a story in a specific language
   * 
   * @param storyId - The story ID
   * @param language - The language ('english' or 'tagalog')
   * @returns Map of words to their variant arrays
   */
  getAllVariantsForStory(
    storyId: string,
    language: 'english' | 'tagalog'
  ): Map<string, string[]>;
  
  /**
   * Adds a custom variant for a word in a specific story
   * 
   * @param word - The word to add a variant for
   * @param variant - The variant pronunciation to add
   * @param storyId - The story ID
   * @param language - The language ('english' or 'tagalog')
   * @returns Promise that resolves when the variant is added
   */
  addCustomVariant(
    word: string,
    variant: string,
    storyId: string,
    language: 'english' | 'tagalog'
  ): Promise<void>;
  
  /**
   * Removes a custom variant for a word in a specific story
   * 
   * @param word - The word to remove a variant from
   * @param variant - The variant pronunciation to remove
   * @param storyId - The story ID
   * @returns Promise that resolves when the variant is removed
   */
  removeCustomVariant(
    word: string,
    variant: string,
    storyId: string
  ): Promise<void>;
  
  /**
   * Deletes all custom variants associated with a story
   * 
   * @param storyId - The story ID
   * @returns Promise that resolves when all variants are deleted
   */
  deleteStoryVariants(storyId: string): Promise<void>;
  
  /**
   * Checks if a spoken word matches any variant of an expected word
   * 
   * @param spokenWord - The word that was spoken
   * @param expectedWord - The expected word from the story
   * @param language - The language ('english' or 'tagalog')
   * @param storyId - Optional story ID for story-level variants
   * @returns True if the spoken word matches a variant, false otherwise
   */
  matchesVariant(
    spokenWord: string,
    expectedWord: string,
    language: 'english' | 'tagalog',
    storyId?: string
  ): boolean;
  
  /**
   * Clears the variant cache
   * Useful for testing or when variants need to be reloaded
   */
  clearCache(): void;
  
  /**
   * Preloads all variants for a specific story into cache
   * 
   * @param storyId - The story ID
   * @returns Promise that resolves when variants are preloaded
   */
  preloadStoryVariants(storyId: string): Promise<void>;
}

/**
 * Interface for Pronunciation Matching
 * Handles word normalization and variant matching logic
 * 
 * @interface IPronunciationMatcher
 */
export interface IPronunciationMatcher {
  /**
   * Checks if a spoken word matches any variant in the provided list
   * 
   * @param spokenWord - The word that was spoken
   * @param expectedWord - The expected word from the story
   * @param variants - Array of acceptable variants for the expected word
   * @returns True if the spoken word matches a variant, false otherwise
   */
  isVariantMatch(
    spokenWord: string,
    expectedWord: string,
    variants: string[]
  ): boolean;
  
  /**
   * Normalizes a word for comparison
   * Converts to lowercase and removes punctuation
   * 
   * @param word - The word to normalize
   * @returns Normalized word (lowercase, no punctuation)
   */
  normalizeWord(word: string): string;
  
  /**
   * Checks if a spoken word matches any variant in a list
   * 
   * @param spokenWord - The word that was spoken
   * @param variantsList - Array of acceptable variants
   * @returns True if the spoken word matches any variant, false otherwise
   */
  findMatchInVariants(spokenWord: string, variantsList: string[]): boolean;
}

// ============================================================================
// Cache Structure
// ============================================================================

/**
 * Internal cache structure for variant lookups
 * Stores both built-in and story-level variants for fast access
 * 
 * @interface VariantCache
 */
export interface VariantCache {
  /** Built-in English variants (word -> Set of variants) */
  builtInEnglish: Map<string, Set<string>>;
  
  /** Built-in Tagalog variants (word -> Set of variants) */
  builtInTagalog: Map<string, Set<string>>;
  
  /** Story-level variants (storyId -> language -> word -> Set of variants) */
  storyVariants: Map<string, Map<'english' | 'tagalog', Map<string, Set<string>>>>;
  
  /** Last update timestamp for each story */
  lastUpdated: Map<string, Date>;
  
  /** Whether the cache has been initialized */
  isInitialized: boolean;
}

// ============================================================================
// Database Schema Types
// ============================================================================

/**
 * Represents a story variant record in the database
 * Stored in Firestore at: stories/{storyId}/variants/{variantId}
 * 
 * @interface StoryVariantRecord
 */
export interface StoryVariantRecord {
  /** Unique identifier for the variant */
  id: string;
  
  /** Reference to the story */
  storyId: string;
  
  /** The canonical word */
  word: string;
  
  /** The variant pronunciation */
  variant: string;
  
  /** Language of the variant */
  language: 'english' | 'tagalog';
  
  /** Timestamp of creation (Firestore Timestamp) */
  createdAt: any; // Firestore Timestamp type
  
  /** Timestamp of last update (Firestore Timestamp) */
  updatedAt: any; // Firestore Timestamp type
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of a variant matching operation
 * 
 * @interface VariantMatchResult
 */
export interface VariantMatchResult {
  /** Whether a variant match was found */
  isMatch: boolean;
  
  /** The matched variant (if isMatch is true) */
  matchedVariant?: string;
  
  /** Details about the match */
  details: string;
}

/**
 * Result of adding a custom variant
 * 
 * @interface AddVariantResult
 */
export interface AddVariantResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Error message if unsuccessful */
  error?: string;
  
  /** The variant entry that was added */
  variant?: VariantEntry;
}

/**
 * Result of removing a custom variant
 * 
 * @interface RemoveVariantResult
 */
export interface RemoveVariantResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Error message if unsuccessful */
  error?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid language
 * 
 * @param value - The value to check
 * @returns True if the value is 'english' or 'tagalog'
 */
export function isValidLanguage(value: any): value is 'english' | 'tagalog' {
  return value === 'english' || value === 'tagalog';
}

/**
 * Type guard to check if an object is a VariantEntry
 * 
 * @param value - The value to check
 * @returns True if the value is a VariantEntry
 */
export function isVariantEntry(value: any): value is VariantEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.word === 'string' &&
    Array.isArray(value.variants) &&
    isValidLanguage(value.language) &&
    typeof value.isBuiltIn === 'boolean' &&
    value.createdAt instanceof Date &&
    value.updatedAt instanceof Date
  );
}

/**
 * Type guard to check if an object is a VariantDictionary
 * 
 * @param value - The value to check
 * @returns True if the value is a VariantDictionary
 */
export function isVariantDictionary(value: any): value is VariantDictionary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  for (const key in value) {
    if (!Array.isArray(value[key])) {
      return false;
    }
  }
  
  return true;
}


// ============================================================================
// Pronunciation Matching Implementation
// ============================================================================

/**
 * Normalizes a word for comparison by converting to lowercase and removing punctuation
 * 
 * Implements case-insensitive and punctuation-insensitive matching as required by
 * Requirement 4.6: "When matching variants, THE Pronunciation_Matcher SHALL normalize 
 * words (lowercase, remove punctuation) before comparison"
 * 
 * @param word - The word to normalize
 * @returns Normalized word (lowercase, no punctuation)
 * 
 * @example
 * normalizeWord("Hello!") // returns "hello"
 * normalizeWord("The.") // returns "the"
 * normalizeWord("don't") // returns "dont"
 */
export function normalizeWord(word: string): string {
  if (!word || typeof word !== 'string') {
    return '';
  }
  
  // Convert to lowercase and remove all punctuation
  return word
    .toLowerCase()
    .replace(/[^\w\s]/g, '');
}

/**
 * Checks if a spoken word matches any variant of an expected word
 * 
 * Implements variant matching logic as required by:
 * - Requirement 4.1: "When a spoken word is compared against an expected word, 
 *   THE Pronunciation_Matcher SHALL check if the spoken word matches any variant 
 *   of the expected word"
 * - Requirement 4.2: "When a spoken word exactly matches a variant, 
 *   THE Pronunciation_Matcher SHALL treat it as a correct pronunciation"
 * 
 * Performance optimization: Uses Set for O(1) lookups instead of O(n) linear search
 * Implements Requirement 10.2, 10.3: Efficient lookup structures and caching
 * 
 * @param spokenWord - The word that was spoken
 * @param expectedWord - The expected word from the story
 * @param variants - Array of acceptable variants for the expected word
 * @returns True if the spoken word matches a variant, false otherwise
 * 
 * @example
 * isVariantMatch("da", "the", ["da", "de", "thee"]) // returns true
 * isVariantMatch("The", "the", ["da", "de", "thee"]) // returns true (normalized)
 * isVariantMatch("xyz", "the", ["da", "de", "thee"]) // returns false
 */
export function isVariantMatch(
  spokenWord: string,
  expectedWord: string,
  variants: string[]
): boolean {
  if (!Array.isArray(variants) || variants.length === 0) {
    return false;
  }
  
  const normalizedSpoken = normalizeWord(spokenWord);
  const normalizedExpected = normalizeWord(expectedWord);
  
  // Check if spoken word matches the expected word exactly (after normalization)
  if (normalizedSpoken === normalizedExpected) {
    return true;
  }
  
  // Performance optimization: Convert to Set for O(1) lookup
  // This is more efficient than linear search for large variant lists
  const variantSet = new Set<string>();
  for (const variant of variants) {
    variantSet.add(normalizeWord(variant));
  }
  
  // Check if spoken word matches any variant using Set lookup (O(1))
  return variantSet.has(normalizedSpoken);
}

/**
 * Checks if a spoken word matches any variant in a list
 * 
 * Batch variant checking function for efficient lookups when you have a list of variants
 * but don't need to check against the expected word itself.
 * 
 * Performance optimization: Uses Set for O(1) lookups instead of O(n) linear search
 * Implements Requirement 10.2, 10.3: Efficient lookup structures and caching
 * 
 * @param spokenWord - The word that was spoken
 * @param variantsList - Array of acceptable variants
 * @returns True if the spoken word matches any variant, false otherwise
 * 
 * @example
 * findMatchInVariants("da", ["da", "de", "thee"]) // returns true
 * findMatchInVariants("Da!", ["da", "de", "thee"]) // returns true (normalized)
 * findMatchInVariants("xyz", ["da", "de", "thee"]) // returns false
 */
export function findMatchInVariants(
  spokenWord: string,
  variantsList: string[]
): boolean {
  if (!Array.isArray(variantsList) || variantsList.length === 0) {
    return false;
  }
  
  const normalizedSpoken = normalizeWord(spokenWord);
  
  // Performance optimization: Convert to Set for O(1) lookup
  // This is more efficient than linear search for large variant lists
  const variantSet = new Set<string>();
  for (const variant of variantsList) {
    variantSet.add(normalizeWord(variant));
  }
  
  // Check if spoken word matches any variant using Set lookup (O(1))
  return variantSet.has(normalizedSpoken);
}
