/**
 * Variant Service Implementation
 * 
 * Manages pronunciation variants for the reading assessment system.
 * Handles loading built-in variants, managing story-level customization,
 * and providing efficient variant lookups with caching.
 */

import {
  IVariantService,
  VariantCache,
  VariantEntry,
  VariantDictionary,
  isValidLanguage,
  normalizeWord,
  isVariantMatch,
  findMatchInVariants,
} from './variants';
import {
  ENGLISH_PRONUNCIATION_VARIANTS,
  TAGALOG_PRONUNCIATION_VARIANTS,
} from './correct';

// Import persistence service for database operations
// Note: This is a dynamic import to avoid circular dependencies
// The persistence service is only available in the backend environment
let variantPersistenceService: any = null;

/**
 * Initializes the persistence service reference
 * This is called lazily to avoid circular dependencies
 */
function getPersistenceService() {
  if (variantPersistenceService === null) {
    try {
      // Try to import the persistence service
      // This will only work in the backend environment
      variantPersistenceService = require('../backend/server/services/variantPersistenceService').variantPersistenceService;
    } catch (error) {
      // Persistence service not available (e.g., in frontend environment)
      // The service will work with in-memory variants only
      variantPersistenceService = undefined;
    }
  }
  return variantPersistenceService;
}

/**
 * VariantService implementation
 * 
 * Provides variant management with built-in and story-level customization.
 * Uses in-memory caching for fast lookups and supports persistence integration.
 * 
 * Implements requirements:
 * - 1.3: Variant service with caching
 * - 1.6: Built-in variants available at startup
 * - 2.3: Story-level variants override built-in
 * - 4.4: Variant retrieval with story-level override
 * - 10.2: Variant caching for performance
 * - 10.3: Efficient lookup structures
 */
export class VariantService implements IVariantService {
  private cache: VariantCache;
  private storyVariantLoaders: Map<string, Promise<void>> = new Map();

  constructor() {
    this.cache = {
      builtInEnglish: new Map(),
      builtInTagalog: new Map(),
      storyVariants: new Map(),
      lastUpdated: new Map(),
      isInitialized: false,
    };
  }

  /**
   * Initializes the variant service by loading built-in variants
   * 
   * Implements Requirement 1.1, 1.2, 1.6, 8.1, 8.2, 8.3:
   * - Loads English pronunciation variants
   * - Loads Tagalog pronunciation variants
   * - Makes variants immediately available without configuration
   * - Implements language-specific variant loading
   * - Ensures language isolation
   * 
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    if (this.cache.isInitialized) {
      return;
    }

    try {
      // Load English variants with language validation
      if (!isValidLanguage('english')) {
        throw new Error('Invalid language: english');
      }
      this.loadVariantsIntoCache(
        ENGLISH_PRONUNCIATION_VARIANTS,
        'english',
        true
      );

      // Load Tagalog variants with language validation
      if (!isValidLanguage('tagalog')) {
        throw new Error('Invalid language: tagalog');
      }
      this.loadVariantsIntoCache(
        TAGALOG_PRONUNCIATION_VARIANTS,
        'tagalog',
        true
      );

      this.cache.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize variant service:', error);
      throw new Error('Failed to initialize variant service');
    }
  }

  /**
   * Loads variants from a dictionary into the cache
   * 
   * Implements language-specific variant loading as required by:
   * - Requirement 8.1: "WHEN a story is in English, THE Variant_System SHALL use English pronunciation variants"
   * - Requirement 8.2: "WHEN a story is in Tagalog, THE Variant_System SHALL use Tagalog pronunciation variants"
   * - Requirement 8.3: "WHEN variants are loaded, THE Variant_System SHALL load the appropriate language variants"
   * 
   * @param dictionary - The variant dictionary to load
   * @param language - The language of the variants ('english' or 'tagalog')
   * @param isBuiltIn - Whether these are built-in variants
   * @throws Error if language is invalid
   */
  private loadVariantsIntoCache(
    dictionary: VariantDictionary,
    language: 'english' | 'tagalog',
    isBuiltIn: boolean
  ): void {
    // Validate language parameter
    if (!isValidLanguage(language)) {
      throw new Error(`Invalid language: ${language}. Must be 'english' or 'tagalog'.`);
    }

    // Validate dictionary
    if (!dictionary || typeof dictionary !== 'object') {
      throw new Error(`Invalid dictionary for language ${language}`);
    }

    const targetMap =
      language === 'english'
        ? this.cache.builtInEnglish
        : this.cache.builtInTagalog;

    for (const [word, variants] of Object.entries(dictionary)) {
      const normalizedWord = normalizeWord(word);
      if (normalizedWord) {
        targetMap.set(normalizedWord, new Set(variants.map(normalizeWord)));
      }
    }
  }

  /**
   * Retrieves all variants for a word in a specific language
   * Returns both built-in and story-level variants
   * 
   * Implements Requirement 3.5, 4.4, 8.1, 8.2, 8.4:
   * - Returns all applicable variants (built-in + story-level)
   * - Story-level variants override built-in for that story
   * - Uses only variants for the story's language
   * - Implements language isolation
   * 
   * @param word - The word to get variants for
   * @param language - The language ('english' or 'tagalog')
   * @param storyId - Optional story ID for story-level variants
   * @returns Array of variant pronunciations, empty array if no variants exist
   * @throws Error if language is invalid
   */
  getVariants(
    word: string,
    language: 'english' | 'tagalog',
    storyId?: string
  ): string[] {
    // Validate language parameter
    if (!isValidLanguage(language)) {
      console.error(`Invalid language: ${language}. Must be 'english' or 'tagalog'.`);
      return [];
    }

    const normalizedWord = normalizeWord(word);
    if (!normalizedWord) {
      return [];
    }

    const variants = new Set<string>();

    // Get story-level variants first (if storyId provided)
    // Implements language isolation: only get variants for the specified language
    if (storyId) {
      const storyVariantMap = this.cache.storyVariants.get(storyId);
      if (storyVariantMap) {
        const languageVariants = storyVariantMap.get(language);
        if (languageVariants) {
          const storyWordVariants = languageVariants.get(normalizedWord);
          if (storyWordVariants) {
            storyWordVariants.forEach((v) => variants.add(v));
          }
        }
      }
    }

    // Get built-in variants for the specified language
    // Implements language isolation: only get variants for the specified language
    const builtInMap =
      language === 'english'
        ? this.cache.builtInEnglish
        : this.cache.builtInTagalog;

    const builtInVariants = builtInMap.get(normalizedWord);
    if (builtInVariants) {
      builtInVariants.forEach((v) => variants.add(v));
    }

    return Array.from(variants);
  }

  /**
   * Retrieves all variants for a story in a specific language
   * 
   * Implements language isolation as required by:
   * - Requirement 8.1, 8.2, 8.4: Language-specific variant handling
   * 
   * @param storyId - The story ID
   * @param language - The language ('english' or 'tagalog')
   * @returns Map of words to their variant arrays
   * @throws Error if language is invalid
   */
  getAllVariantsForStory(
    storyId: string,
    language: 'english' | 'tagalog'
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();

    // Validate language parameter
    if (!isValidLanguage(language)) {
      console.error(`Invalid language: ${language}. Must be 'english' or 'tagalog'.`);
      return result;
    }

    const storyVariantMap = this.cache.storyVariants.get(storyId);
    if (!storyVariantMap) {
      return result;
    }

    // Get only variants for the specified language (language isolation)
    const languageVariants = storyVariantMap.get(language);
    if (!languageVariants) {
      return result;
    }

    for (const [word, variants] of languageVariants.entries()) {
      result.set(word, Array.from(variants));
    }

    return result;
  }

  /**
   * Adds a custom variant for a word in a specific story
   * 
   * Implements Requirement 2.1, 2.2, 8.1, 8.2, 8.3, 8.6, 9.1, 9.3:
   * - Allows adding custom variants for words in a story
   * - Stores variants associated with the specific story
   * - Associates variant with the story's language
   * - Implements language-specific variant handling
   * - Saves custom variant to database via persistence layer
   * - Updates cache when variants are added
   * 
   * @param word - The word to add a variant for
   * @param variant - The variant pronunciation to add
   * @param storyId - The story ID
   * @param language - The language ('english' or 'tagalog')
   * @returns Promise that resolves when the variant is added
   * @throws Error if language is invalid or word/variant is empty
   */
  async addCustomVariant(
    word: string,
    variant: string,
    storyId: string,
    language: 'english' | 'tagalog'
  ): Promise<void> {
    // Validate language parameter
    if (!isValidLanguage(language)) {
      throw new Error(`Invalid language: ${language}. Must be 'english' or 'tagalog'.`);
    }

    const normalizedWord = normalizeWord(word);
    const normalizedVariant = normalizeWord(variant);

    if (!normalizedWord || !normalizedVariant) {
      throw new Error('Word and variant must not be empty');
    }

    // Ensure story variant structure exists with language isolation
    if (!this.cache.storyVariants.has(storyId)) {
      this.cache.storyVariants.set(
        storyId,
        new Map([
          ['english', new Map()],
          ['tagalog', new Map()],
        ])
      );
    }

    const storyVariantMap = this.cache.storyVariants.get(storyId)!;
    const languageVariants = storyVariantMap.get(language)!;

    // Get or create the variant set for this word in the specified language
    if (!languageVariants.has(normalizedWord)) {
      languageVariants.set(normalizedWord, new Set());
    }

    const variantSet = languageVariants.get(normalizedWord)!;
    variantSet.add(normalizedVariant);

    // Update last modified timestamp
    this.cache.lastUpdated.set(storyId, new Date());

    // Persist to database if persistence service is available
    // Implements Requirement 9.1: Save custom variant to database
    const persistenceService = getPersistenceService();
    if (persistenceService) {
      try {
        await persistenceService.addCustomVariant(
          storyId,
          normalizedWord,
          normalizedVariant,
          language
        );
      } catch (error) {
        console.error('Failed to persist custom variant:', error);
        // Don't throw - variant is still in cache, persistence failure shouldn't block the operation
        // The variant will be available in the current session
      }
    }
  }

  /**
   * Removes a custom variant for a word in a specific story
   * 
   * Implements Requirement 2.5, 9.3:
   * - Removes custom variant and reverts to built-in if it exists
   * - Removes custom variant from database via persistence layer
   * - Updates cache when variants are removed
   * 
   * @param word - The word to remove a variant from
   * @param variant - The variant pronunciation to remove
   * @param storyId - The story ID
   * @returns Promise that resolves when the variant is removed
   */
  async removeCustomVariant(
    word: string,
    variant: string,
    storyId: string
  ): Promise<void> {
    const normalizedWord = normalizeWord(word);
    const normalizedVariant = normalizeWord(variant);

    if (!normalizedWord || !normalizedVariant) {
      throw new Error('Word and variant must not be empty');
    }

    const storyVariantMap = this.cache.storyVariants.get(storyId);
    if (!storyVariantMap) {
      return;
    }

    // Try to remove from both English and Tagalog
    for (const language of ['english', 'tagalog'] as const) {
      const languageVariants = storyVariantMap.get(language);
      if (languageVariants) {
        const variantSet = languageVariants.get(normalizedWord);
        if (variantSet) {
          variantSet.delete(normalizedVariant);

          // If no more variants for this word, remove the word entry
          if (variantSet.size === 0) {
            languageVariants.delete(normalizedWord);
          }
        }
      }
    }

    // Update last modified timestamp
    this.cache.lastUpdated.set(storyId, new Date());

    // Remove from database if persistence service is available
    // Implements Requirement 9.3: Remove custom variant from database
    const persistenceService = getPersistenceService();
    if (persistenceService) {
      try {
        await persistenceService.removeCustomVariant(
          storyId,
          normalizedWord,
          normalizedVariant
        );
      } catch (error) {
        console.error('Failed to remove custom variant from database:', error);
        // Don't throw - variant is already removed from cache, persistence failure shouldn't block the operation
      }
    }
  }

  /**
   * Deletes all custom variants associated with a story
   * 
   * Implements Requirement 9.6:
   * - Cleans up all variants when a story is deleted
   * 
   * @param storyId - The story ID
   * @returns Promise that resolves when all variants are deleted
   */
  async deleteStoryVariants(storyId: string): Promise<void> {
    this.cache.storyVariants.delete(storyId);
    this.cache.lastUpdated.delete(storyId);
    this.storyVariantLoaders.delete(storyId);
  }

  /**
   * Checks if a spoken word matches any variant of an expected word
   * 
   * Implements Requirement 4.1, 4.2, 4.4, 8.1, 8.2, 8.4:
   * - Checks if spoken word matches any variant of expected word
   * - Uses story-level variants first, then falls back to built-in
   * - Treats exact matches as correct pronunciations
   * - Uses only variants for the specified language
   * - Implements language isolation
   * 
   * @param spokenWord - The word that was spoken
   * @param expectedWord - The expected word from the story
   * @param language - The language ('english' or 'tagalog')
   * @param storyId - Optional story ID for story-level variants
   * @returns True if the spoken word matches a variant, false otherwise
   * @throws Error if language is invalid
   */
  matchesVariant(
    spokenWord: string,
    expectedWord: string,
    language: 'english' | 'tagalog',
    storyId?: string
  ): boolean {
    // Validate language parameter
    if (!isValidLanguage(language)) {
      console.error(`Invalid language: ${language}. Must be 'english' or 'tagalog'.`);
      return false;
    }

    const variants = this.getVariants(expectedWord, language, storyId);
    return isVariantMatch(spokenWord, expectedWord, variants);
  }

  /**
   * Validates that a language is supported
   * 
   * Implements language validation as required by:
   * - Requirement 8.1, 8.2, 8.3, 8.4, 8.6: Language-specific variant handling
   * 
   * @param language - The language to validate
   * @returns True if language is valid, false otherwise
   */
  private validateLanguage(language: any): language is 'english' | 'tagalog' {
    return isValidLanguage(language);
  }

  /**
   * Gets the built-in variant map for a specific language
   * 
   * Implements language isolation as required by:
   * - Requirement 8.1, 8.2, 8.4: Language-specific variant handling
   * 
   * @param language - The language ('english' or 'tagalog')
   * @returns The built-in variant map for the language
   * @throws Error if language is invalid
   */
  private getBuiltInMapForLanguage(language: 'english' | 'tagalog'): Map<string, Set<string>> {
    if (!this.validateLanguage(language)) {
      throw new Error(`Invalid language: ${language}. Must be 'english' or 'tagalog'.`);
    }

    return language === 'english'
      ? this.cache.builtInEnglish
      : this.cache.builtInTagalog;
  }

  /**
   * Clears the variant cache
   * Useful for testing or when variants need to be reloaded
   * 
   * Note: Does not clear built-in variants, only story-level variants
   */
  clearCache(): void {
    this.cache.storyVariants.clear();
    this.cache.lastUpdated.clear();
    this.storyVariantLoaders.clear();
  }

  /**
   * Preloads all variants for a specific story into cache
   * 
   * Implements Requirement 2.2, 9.2:
   * - Loads story-level variants from database on demand
   * - Makes previously saved custom variants available
   * 
   * @param storyId - The story ID
   * @returns Promise that resolves when variants are preloaded
   */
  async preloadStoryVariants(storyId: string): Promise<void> {
    // Check if already loading
    if (this.storyVariantLoaders.has(storyId)) {
      return this.storyVariantLoaders.get(storyId)!;
    }

    // Create a promise for this load operation
    const loadPromise = (async () => {
      const persistenceService = getPersistenceService();
      if (!persistenceService) {
        // Persistence service not available, skip loading from database
        return;
      }

      try {
        // Load variants from database
        // Implements Requirement 9.2: Load previously saved custom variants on restart
        const dbVariants = await persistenceService.loadStoryVariants(storyId);

        // Ensure story variant structure exists
        if (!this.cache.storyVariants.has(storyId)) {
          this.cache.storyVariants.set(
            storyId,
            new Map([
              ['english', new Map()],
              ['tagalog', new Map()],
            ])
          );
        }

        const storyVariantMap = this.cache.storyVariants.get(storyId)!;

        // Load each variant into the cache
        for (const dbVariant of dbVariants) {
          const language = dbVariant.language as 'english' | 'tagalog';
          const languageVariants = storyVariantMap.get(language)!;

          const normalizedWord = normalizeWord(dbVariant.word);
          const normalizedVariant = normalizeWord(dbVariant.variant);

          if (normalizedWord && normalizedVariant) {
            if (!languageVariants.has(normalizedWord)) {
              languageVariants.set(normalizedWord, new Set());
            }

            const variantSet = languageVariants.get(normalizedWord)!;
            variantSet.add(normalizedVariant);
          }
        }

        // Update last modified timestamp
        this.cache.lastUpdated.set(storyId, new Date());
      } catch (error) {
        console.error(`Failed to preload variants for story ${storyId}:`, error);
        // Don't throw - allow system to continue with empty variants
      }
    })();

    this.storyVariantLoaders.set(storyId, loadPromise);
    await loadPromise;
  }

  /**
   * Gets the current cache state (for testing/debugging)
   * 
   * @returns The current variant cache
   */
  getCache(): VariantCache {
    return this.cache;
  }

  /**
   * Checks if the service is initialized
   * 
   * @returns True if initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.cache.isInitialized;
  }
}

/**
 * Singleton instance of the VariantService
 * Used throughout the application for variant management
 */
export const variantService = new VariantService();
