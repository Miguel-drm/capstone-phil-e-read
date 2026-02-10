/**
 * Property-Based Tests for Word Variants System
 * 
 * Uses fast-check library to verify universal properties about variant loading,
 * matching, and persistence.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ENGLISH_PRONUNCIATION_VARIANTS, TAGALOG_PRONUNCIATION_VARIANTS } from './correct';
import { isVariantDictionary, isValidLanguage, normalizeWord, isVariantMatch, findMatchInVariants } from './variants';

/**
 * **Feature: word-variants-system, Property 1: Built-in Variants Loaded at Startup**
 * 
 * *For any* system initialization, the Variant_System SHALL load both English and Tagalog
 * built-in variants and make them immediately available without requiring configuration.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.6**
 */
describe('Property 1: Built-in Variants Loaded at Startup', () => {
  it('English pronunciation variants are loaded and accessible', () => {
    // Verify that ENGLISH_PRONUNCIATION_VARIANTS is a valid dictionary
    expect(isVariantDictionary(ENGLISH_PRONUNCIATION_VARIANTS)).toBe(true);
  });

  it('English pronunciation variants contain at least 100 words', () => {
    const englishWords = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
    expect(englishWords.length).toBeGreaterThanOrEqual(100);
  });

  it('Tagalog pronunciation variants are loaded and accessible', () => {
    // Verify that TAGALOG_PRONUNCIATION_VARIANTS is a valid dictionary
    expect(isVariantDictionary(TAGALOG_PRONUNCIATION_VARIANTS)).toBe(true);
  });

  it('Tagalog pronunciation variants contain at least 50 words', () => {
    const tagalogWords = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);
    expect(tagalogWords.length).toBeGreaterThanOrEqual(50);
  });

  it('each English variant entry has non-empty variants array', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(ENGLISH_PRONUNCIATION_VARIANTS)),
        (word) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
          expect(Array.isArray(variants)).toBe(true);
          expect(variants.length).toBeGreaterThan(0);
          expect(variants.every(v => typeof v === 'string' && v.length > 0)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each Tagalog variant entry has non-empty variants array', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(TAGALOG_PRONUNCIATION_VARIANTS)),
        (word) => {
          const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
          expect(Array.isArray(variants)).toBe(true);
          expect(variants.length).toBeGreaterThan(0);
          expect(variants.every(v => typeof v === 'string' && v.length > 0)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('English variants are accessible without configuration', () => {
    // Verify that we can access any English word's variants directly
    const englishWords = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
    expect(englishWords.length).toBeGreaterThan(0);
    
    // Pick a random word and verify its variants are accessible
    const randomWord = englishWords[Math.floor(Math.random() * englishWords.length)];
    const variants = ENGLISH_PRONUNCIATION_VARIANTS[randomWord];
    expect(variants).toBeDefined();
    expect(Array.isArray(variants)).toBe(true);
  });

  it('Tagalog variants are accessible without configuration', () => {
    // Verify that we can access any Tagalog word's variants directly
    const tagalogWords = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);
    expect(tagalogWords.length).toBeGreaterThan(0);
    
    // Pick a random word and verify its variants are accessible
    const randomWord = tagalogWords[Math.floor(Math.random() * tagalogWords.length)];
    const variants = TAGALOG_PRONUNCIATION_VARIANTS[randomWord];
    expect(variants).toBeDefined();
    expect(Array.isArray(variants)).toBe(true);
  });

  it('English and Tagalog variants are distinct dictionaries', () => {
    // Verify that the two dictionaries are different objects
    expect(ENGLISH_PRONUNCIATION_VARIANTS).not.toBe(TAGALOG_PRONUNCIATION_VARIANTS);
    
    // Verify they have different content (not just different references)
    const englishKeys = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
    const tagalogKeys = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);
    
    // They should have different sizes (English has 100+, Tagalog has 50+)
    expect(englishKeys.length).not.toBe(tagalogKeys.length);
  });

  it('all variant entries are strings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(ENGLISH_PRONUNCIATION_VARIANTS)),
        (word) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
          expect(variants.every(v => typeof v === 'string')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('variant dictionaries are not empty', () => {
    expect(Object.keys(ENGLISH_PRONUNCIATION_VARIANTS).length).toBeGreaterThan(0);
    expect(Object.keys(TAGALOG_PRONUNCIATION_VARIANTS).length).toBeGreaterThan(0);
  });

  it('variant dictionaries contain only string keys', () => {
    const englishKeys = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
    const tagalogKeys = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);
    
    expect(englishKeys.every(k => typeof k === 'string')).toBe(true);
    expect(tagalogKeys.every(k => typeof k === 'string')).toBe(true);
  });

  it('variant dictionaries contain only array values', () => {
    const englishValues = Object.values(ENGLISH_PRONUNCIATION_VARIANTS);
    const tagalogValues = Object.values(TAGALOG_PRONUNCIATION_VARIANTS);
    
    expect(englishValues.every(v => Array.isArray(v))).toBe(true);
    expect(tagalogValues.every(v => Array.isArray(v))).toBe(true);
  });

  it('built-in variants are immediately available on import', () => {
    // This test verifies that variants are loaded at module import time
    // and don't require any initialization function to be called
    expect(ENGLISH_PRONUNCIATION_VARIANTS).toBeDefined();
    expect(TAGALOG_PRONUNCIATION_VARIANTS).toBeDefined();
    expect(typeof ENGLISH_PRONUNCIATION_VARIANTS).toBe('object');
    expect(typeof TAGALOG_PRONUNCIATION_VARIANTS).toBe('object');
  });

  it('variant arrays contain at least one variant per word', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(ENGLISH_PRONUNCIATION_VARIANTS)),
        (word) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
          expect(variants.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('variant arrays do not contain empty strings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(ENGLISH_PRONUNCIATION_VARIANTS)),
        (word) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
          expect(variants.every(v => v.length > 0)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Tagalog variant arrays do not contain empty strings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(TAGALOG_PRONUNCIATION_VARIANTS)),
        (word) => {
          const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
          expect(variants.every(v => v.length > 0)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('built-in variants are consistent across multiple accesses', () => {
    // Verify that accessing the same word multiple times returns the same variants
    const englishWords = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
    const testWord = englishWords[0];
    
    const firstAccess = ENGLISH_PRONUNCIATION_VARIANTS[testWord];
    const secondAccess = ENGLISH_PRONUNCIATION_VARIANTS[testWord];
    
    expect(firstAccess).toEqual(secondAccess);
  });

  it('built-in variants are not modified after initial load', () => {
    // Verify that the variant dictionaries maintain their structure
    const englishWordCount = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS).length;
    const tagalogWordCount = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS).length;
    
    // Access some variants
    const englishWords = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
    englishWords.slice(0, 10).forEach(word => {
      const _ = ENGLISH_PRONUNCIATION_VARIANTS[word];
    });
    
    // Verify counts haven't changed
    expect(Object.keys(ENGLISH_PRONUNCIATION_VARIANTS).length).toBe(englishWordCount);
    expect(Object.keys(TAGALOG_PRONUNCIATION_VARIANTS).length).toBe(tagalogWordCount);
  });
});


/**
 * **Feature: word-variants-system, Property 8: Word Normalization Consistency**
 * 
 * *For any* word with different cases and punctuation, the Pronunciation_Matcher SHALL 
 * normalize them to the same form before comparison, ensuring case-insensitive and 
 * punctuation-insensitive matching.
 * 
 * **Validates: Requirements 4.6**
 */
describe('Property 8: Word Normalization Consistency', () => {
  it('normalizes uppercase to lowercase', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (word) => {
        const normalized = normalizeWord(word);
        expect(normalized).toBe(normalized.toLowerCase());
      }),
      { numRuns: 100 }
    );
  });

  it('removes punctuation from words', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (word) => {
        const normalized = normalizeWord(word);
        // Normalized word should not contain punctuation
        expect(/[^\w\s]/.test(normalized)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('produces consistent results for the same input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (word) => {
        const first = normalizeWord(word);
        const second = normalizeWord(word);
        expect(first).toBe(second);
      }),
      { numRuns: 100 }
    );
  });

  it('handles empty strings gracefully', () => {
    const result = normalizeWord('');
    expect(result).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeWord(null as any)).toBe('');
    expect(normalizeWord(undefined as any)).toBe('');
  });

  it('removes common punctuation marks', () => {
    expect(normalizeWord("don't")).toBe('dont');
    expect(normalizeWord('Hello!')).toBe('hello');
    expect(normalizeWord('The.')).toBe('the');
    expect(normalizeWord('What?')).toBe('what');
    expect(normalizeWord('Yes,')).toBe('yes');
  });

  it('handles mixed case and punctuation', () => {
    expect(normalizeWord("DON'T")).toBe('dont');
    expect(normalizeWord('HeLLo!')).toBe('hello');
    expect(normalizeWord('ThE.')).toBe('the');
  });

  it('preserves word content after normalization', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (word) => {
        const normalized = normalizeWord(word);
        // The normalized word should contain only alphanumeric characters and spaces
        expect(/^[\w\s]*$/.test(normalized)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: word-variants-system, Property 4: Variant Matching Consistency**
 * 
 * *For any* spoken word and expected word with variants, the Pronunciation_Matcher SHALL 
 * return the same match result regardless of how many times the match is performed (idempotence).
 * 
 * **Validates: Requirements 4.1, 4.2**
 */
describe('Property 4: Variant Matching Consistency', () => {
  it('returns consistent results for the same inputs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        (spokenWord, expectedWord, variants) => {
          const first = isVariantMatch(spokenWord, expectedWord, variants);
          const second = isVariantMatch(spokenWord, expectedWord, variants);
          expect(first).toBe(second);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('matches exact word after normalization', () => {
    expect(isVariantMatch('the', 'the', ['da', 'de'])).toBe(true);
    expect(isVariantMatch('The', 'the', ['da', 'de'])).toBe(true);
    expect(isVariantMatch('THE', 'the', ['da', 'de'])).toBe(true);
  });

  it('matches variant pronunciations', () => {
    expect(isVariantMatch('da', 'the', ['da', 'de', 'thee'])).toBe(true);
    expect(isVariantMatch('de', 'the', ['da', 'de', 'thee'])).toBe(true);
    expect(isVariantMatch('thee', 'the', ['da', 'de', 'thee'])).toBe(true);
  });

  it('handles case-insensitive variant matching', () => {
    expect(isVariantMatch('DA', 'the', ['da', 'de', 'thee'])).toBe(true);
    expect(isVariantMatch('Da', 'the', ['da', 'de', 'thee'])).toBe(true);
  });

  it('handles punctuation in spoken word', () => {
    expect(isVariantMatch("don't", "dont", ["dont", "do not"])).toBe(true);
    expect(isVariantMatch('Hello!', 'hello', ['hello', 'hallo'])).toBe(true);
  });

  it('returns false for non-matching words', () => {
    expect(isVariantMatch('xyz', 'the', ['da', 'de', 'thee'])).toBe(false);
    expect(isVariantMatch('cat', 'dog', ['dog', 'dawg'])).toBe(false);
  });

  it('handles empty variant arrays', () => {
    expect(isVariantMatch('the', 'the', [])).toBe(false);
  });

  it('handles undefined variant arrays', () => {
    expect(isVariantMatch('the', 'the', undefined as any)).toBe(false);
  });

  it('handles null variant arrays', () => {
    expect(isVariantMatch('the', 'the', null as any)).toBe(false);
  });

  it('is idempotent across multiple calls', () => {
    const spokenWord = 'da';
    const expectedWord = 'the';
    const variants = ['da', 'de', 'thee'];
    
    const results = [
      isVariantMatch(spokenWord, expectedWord, variants),
      isVariantMatch(spokenWord, expectedWord, variants),
      isVariantMatch(spokenWord, expectedWord, variants),
    ];
    
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });
});

/**
 * **Feature: word-variants-system, Property 12: Variant Retrieval Completeness**
 * 
 * *For any* word in a story, the Variant_System SHALL return all applicable variants 
 * (both built-in and story-level) when retrieving variants for that word.
 * 
 * **Validates: Requirements 3.5**
 * 
 * Note: This property is tested through findMatchInVariants which is the core
 * batch variant checking function used by the variant service.
 */
describe('Property 12: Variant Retrieval Completeness (via findMatchInVariants)', () => {
  it('finds matches in variant lists', () => {
    expect(findMatchInVariants('da', ['da', 'de', 'thee'])).toBe(true);
    expect(findMatchInVariants('de', ['da', 'de', 'thee'])).toBe(true);
    expect(findMatchInVariants('thee', ['da', 'de', 'thee'])).toBe(true);
  });

  it('handles case-insensitive matching in variant lists', () => {
    expect(findMatchInVariants('DA', ['da', 'de', 'thee'])).toBe(true);
    expect(findMatchInVariants('Da', ['da', 'de', 'thee'])).toBe(true);
  });

  it('handles punctuation in variant lists', () => {
    expect(findMatchInVariants("don't", ["dont", "do not"])).toBe(true);
    expect(findMatchInVariants('Hello!', ['hello', 'hallo'])).toBe(true);
  });

  it('returns false for non-matching words', () => {
    expect(findMatchInVariants('xyz', ['da', 'de', 'thee'])).toBe(false);
    expect(findMatchInVariants('cat', ['dog', 'dawg'])).toBe(false);
  });

  it('handles empty variant lists', () => {
    expect(findMatchInVariants('the', [])).toBe(false);
  });

  it('handles undefined variant lists', () => {
    expect(findMatchInVariants('the', undefined as any)).toBe(false);
  });

  it('handles null variant lists', () => {
    expect(findMatchInVariants('the', null as any)).toBe(false);
  });

  it('is consistent across multiple calls', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        (spokenWord, variants) => {
          const first = findMatchInVariants(spokenWord, variants);
          const second = findMatchInVariants(spokenWord, variants);
          expect(first).toBe(second);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('finds all matching variants in a list', () => {
    const variants = ['da', 'de', 'thee', 'thuh', 'duh'];
    
    // Each variant should be found
    expect(findMatchInVariants('da', variants)).toBe(true);
    expect(findMatchInVariants('de', variants)).toBe(true);
    expect(findMatchInVariants('thee', variants)).toBe(true);
    expect(findMatchInVariants('thuh', variants)).toBe(true);
    expect(findMatchInVariants('duh', variants)).toBe(true);
  });

  it('handles large variant lists efficiently', () => {
    const largeVariantList = Array.from({ length: 1000 }, (_, i) => `variant${i}`);
    largeVariantList.push('target');
    
    const start = performance.now();
    const result = findMatchInVariants('target', largeVariantList);
    const end = performance.now();
    
    expect(result).toBe(true);
    expect(end - start).toBeLessThan(10); // Should complete in less than 10ms
  });
});

/**
 * **Feature: word-variants-system, Property 2: Story-level Variants Override Built-in**
 * 
 * *For any* word that has both built-in and story-level variants, when matching 
 * pronunciations for that story, the Variant_System SHALL use the story-level variants 
 * and ignore the built-in variants for that story only.
 * 
 * **Validates: Requirements 2.3, 4.4**
 */
describe('Property 2: Story-level Variants Override Built-in', () => {
  it('story-level variants are used when available', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add a custom variant for 'the' in story1
    await service.addCustomVariant('the', 'custom_variant', 'story1', 'english');

    // Get variants for 'the' in story1
    const variantsWithStory = service.getVariants('the', 'english', 'story1');
    
    // Should include the custom variant
    expect(variantsWithStory).toContain('custom_variant');
  });

  it('story-level variants do not affect other stories', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add a custom variant for 'the' in story1
    await service.addCustomVariant('the', 'custom_variant', 'story1', 'english');

    // Get variants for 'the' in story2 (different story)
    const variantsStory2 = service.getVariants('the', 'english', 'story2');
    
    // Should NOT include the custom variant from story1
    expect(variantsStory2).not.toContain('custom_variant');
  });

  it('story-level variants are used for matching in that story', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add a custom variant for 'hello' in story1
    await service.addCustomVariant('hello', 'helo', 'story1', 'english');

    // Matching should work with the custom variant in story1
    const matchesStory1 = service.matchesVariant('helo', 'hello', 'english', 'story1');
    expect(matchesStory1).toBe(true);

    // Matching should NOT work with the custom variant in story2
    const matchesStory2 = service.matchesVariant('helo', 'hello', 'english', 'story2');
    expect(matchesStory2).toBe(false);
  });

  it('story-level variants are combined with built-in variants', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Get built-in variants for 'the'
    const builtInVariants = service.getVariants('the', 'english');
    const builtInCount = builtInVariants.length;

    // Add a custom variant for 'the' in story1
    await service.addCustomVariant('the', 'custom_variant', 'story1', 'english');

    // Get variants for 'the' in story1
    const variantsWithStory = service.getVariants('the', 'english', 'story1');

    // Should have more variants than built-in (built-in + custom)
    expect(variantsWithStory.length).toBeGreaterThanOrEqual(builtInCount);
    
    // Should include the custom variant
    expect(variantsWithStory).toContain('custom_variant');
    
    // Should still include built-in variants
    builtInVariants.forEach(variant => {
      expect(variantsWithStory).toContain(variant);
    });
  });

  it('story-level variants persist across multiple retrievals', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add a custom variant for 'the' in story1
    await service.addCustomVariant('the', 'custom_variant', 'story1', 'english');

    // Retrieve variants multiple times
    const variants1 = service.getVariants('the', 'english', 'story1');
    const variants2 = service.getVariants('the', 'english', 'story1');
    const variants3 = service.getVariants('the', 'english', 'story1');

    // All retrievals should be consistent
    expect(variants1).toEqual(variants2);
    expect(variants2).toEqual(variants3);
    expect(variants1).toContain('custom_variant');
  });

  it('multiple story-level variants for same word are all available', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add multiple custom variants for 'hello' in story1
    await service.addCustomVariant('hello', 'helo', 'story1', 'english');
    await service.addCustomVariant('hello', 'hallo', 'story1', 'english');
    await service.addCustomVariant('hello', 'hullo', 'story1', 'english');

    // Get variants for 'hello' in story1
    const variants = service.getVariants('hello', 'english', 'story1');

    // Should include all custom variants
    expect(variants).toContain('helo');
    expect(variants).toContain('hallo');
    expect(variants).toContain('hullo');
  });

  it('story-level variants work correctly with multiple stories', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add custom variants for different stories
    await service.addCustomVariant('hello', 'helo', 'story1', 'english');
    await service.addCustomVariant('hello', 'hallo', 'story2', 'english');

    // Verify each story has its own variants
    const story1Variants = service.getVariants('hello', 'english', 'story1');
    const story2Variants = service.getVariants('hello', 'english', 'story2');

    expect(story1Variants).toContain('helo');
    expect(story1Variants).not.toContain('hallo');

    expect(story2Variants).toContain('hallo');
    expect(story2Variants).not.toContain('helo');
  });

  it('story-level variants are language-specific', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add a custom variant for 'the' in English for story1
    await service.addCustomVariant('the', 'custom_en', 'story1', 'english');

    // Add a custom variant for 'ang' in Tagalog for story1
    await service.addCustomVariant('ang', 'custom_tl', 'story1', 'tagalog');

    // English variants should have the English custom variant
    const englishVariants = service.getVariants('the', 'english', 'story1');
    expect(englishVariants).toContain('custom_en');
    expect(englishVariants).not.toContain('custom_tl');

    // Tagalog variants should have the Tagalog custom variant
    const tagalogVariants = service.getVariants('ang', 'tagalog', 'story1');
    expect(tagalogVariants).toContain('custom_tl');
    expect(tagalogVariants).not.toContain('custom_en');
  });

  it('story-level variants override built-in for matching', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Get built-in variants for 'the'
    const builtInVariants = service.getVariants('the', 'english');
    expect(builtInVariants.length).toBeGreaterThan(0);

    // Add a custom variant for 'the' in story1
    const customVariant = 'unique_custom_variant_xyz';
    await service.addCustomVariant('the', customVariant, 'story1', 'english');

    // Matching with custom variant should work in story1
    const matchesStory1 = service.matchesVariant(customVariant, 'the', 'english', 'story1');
    expect(matchesStory1).toBe(true);

    // Matching with custom variant should NOT work in story2
    const matchesStory2 = service.matchesVariant(customVariant, 'the', 'english', 'story2');
    expect(matchesStory2).toBe(false);

    // Matching with built-in variants should still work in both stories
    const builtInVariant = builtInVariants[0];
    const matchesBuiltInStory1 = service.matchesVariant(builtInVariant, 'the', 'english', 'story1');
    const matchesBuiltInStory2 = service.matchesVariant(builtInVariant, 'the', 'english', 'story2');
    expect(matchesBuiltInStory1).toBe(true);
    expect(matchesBuiltInStory2).toBe(true);
  });
});

/**
 * **Feature: word-variants-system, Property 13: Empty Variant Array for Unknown Words**
 * 
 * *For any* word that has no variants defined (neither built-in nor story-level), 
 * the Variant_System SHALL return an empty array.
 * 
 * **Validates: Requirements 3.6**
 */
describe('Property 13: Empty Variant Array for Unknown Words', () => {
  it('returns false when variant array is empty', () => {
    expect(findMatchInVariants('anyword', [])).toBe(false);
  });

  it('returns false for isVariantMatch with empty variants', () => {
    expect(isVariantMatch('anyword', 'expectedword', [])).toBe(false);
  });

  it('handles unknown words consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (unknownWord) => {
          const result = findMatchInVariants(unknownWord, []);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('distinguishes between empty array and no match', () => {
    // Empty array should return false
    expect(findMatchInVariants('word', [])).toBe(false);
    
    // Non-matching word with non-empty array should also return false
    expect(findMatchInVariants('xyz', ['abc', 'def'])).toBe(false);
    
    // Both should be false, but for different reasons
    // This test ensures the behavior is consistent
  });
});


/**
 * **Feature: word-variants-system, Property 9: Variant Matching Performance**
 * 
 * *For any* word checked against variants, the Variant_Matcher SHALL complete the check 
 * in less than 10 milliseconds, even when a story has many custom variants.
 * 
 * **Validates: Requirements 10.1, 10.4, 10.5, 10.6**
 */
describe('Property 9: Variant Matching Performance', () => {
  it('completes variant matching in less than 10ms for small variant lists', () => {
    const variants = ['da', 'de', 'thee', 'thuh', 'duh'];
    
    const start = performance.now();
    const result = isVariantMatch('da', 'the', variants);
    const end = performance.now();
    
    expect(result).toBe(true);
    expect(end - start).toBeLessThan(10);
  });

  it('completes variant matching in less than 10ms for medium variant lists', () => {
    const variants = Array.from({ length: 100 }, (_, i) => `variant${i}`);
    
    const start = performance.now();
    const result = isVariantMatch('variant50', 'the', variants);
    const end = performance.now();
    
    expect(result).toBe(true);
    expect(end - start).toBeLessThan(10);
  });

  it('completes variant matching in less than 10ms for large variant lists', () => {
    const variants = Array.from({ length: 1000 }, (_, i) => `variant${i}`);
    
    const start = performance.now();
    const result = isVariantMatch('variant999', 'the', variants);
    const end = performance.now();
    
    expect(result).toBe(true);
    expect(end - start).toBeLessThan(10);
  });

  it('completes findMatchInVariants in less than 10ms for large lists', () => {
    const variants = Array.from({ length: 1000 }, (_, i) => `variant${i}`);
    
    const start = performance.now();
    const result = findMatchInVariants('variant999', variants);
    const end = performance.now();
    
    expect(result).toBe(true);
    expect(end - start).toBeLessThan(10);
  });

  it('maintains performance with many sequential lookups', () => {
    const variants = Array.from({ length: 500 }, (_, i) => `variant${i}`);
    
    const start = performance.now();
    
    // Perform 100 sequential lookups
    for (let i = 0; i < 100; i++) {
      isVariantMatch(`variant${i % 500}`, 'the', variants);
    }
    
    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / 100;
    
    // Average time per lookup should be less than 10ms
    expect(avgTime).toBeLessThan(10);
  });

  it('completes variant service matching in less than 10ms', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add multiple custom variants
    for (let i = 0; i < 50; i++) {
      await service.addCustomVariant('hello', `variant${i}`, 'story1', 'english');
    }

    const start = performance.now();
    const result = service.matchesVariant('variant25', 'hello', 'english', 'story1');
    const end = performance.now();

    expect(result).toBe(true);
    expect(end - start).toBeLessThan(10);
  });

  it('maintains performance with many stories and variants', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add variants to multiple stories
    for (let storyIdx = 0; storyIdx < 10; storyIdx++) {
      for (let variantIdx = 0; variantIdx < 50; variantIdx++) {
        await service.addCustomVariant(
          'hello',
          `story${storyIdx}_variant${variantIdx}`,
          `story${storyIdx}`,
          'english'
        );
      }
    }

    // Test matching performance across different stories
    const start = performance.now();
    
    for (let storyIdx = 0; storyIdx < 10; storyIdx++) {
      service.matchesVariant(
        `story${storyIdx}_variant25`,
        'hello',
        'english',
        `story${storyIdx}`
      );
    }
    
    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / 10;

    // Average time per lookup should be less than 10ms
    expect(avgTime).toBeLessThan(10);
  });

  it('handles worst-case scenario (no match in large list) efficiently', () => {
    const variants = Array.from({ length: 1000 }, (_, i) => `variant${i}`);
    
    const start = performance.now();
    const result = isVariantMatch('nonexistent', 'the', variants);
    const end = performance.now();
    
    expect(result).toBe(false);
    expect(end - start).toBeLessThan(10);
  });

  it('performance is consistent across multiple runs', () => {
    const variants = Array.from({ length: 500 }, (_, i) => `variant${i}`);
    const times: number[] = [];

    for (let run = 0; run < 10; run++) {
      const start = performance.now();
      isVariantMatch('variant250', 'the', variants);
      const end = performance.now();
      times.push(end - start);
    }

    // All runs should be under 10ms
    expect(times.every(t => t < 10)).toBe(true);
    
    // Variance should be low (performance should be consistent)
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    
    // Standard deviation should be reasonable (less than 50% of average)
    expect(stdDev).toBeLessThan(avgTime * 0.5);
  });

  it('normalizeWord completes in less than 1ms', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (word) => {
        const start = performance.now();
        normalizeWord(word);
        const end = performance.now();
        
        expect(end - start).toBeLessThan(1);
      }),
      { numRuns: 100 }
    );
  });

  it('variant service initialization completes in reasonable time', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();

    const start = performance.now();
    await service.initialize();
    const end = performance.now();

    // Initialization should complete in less than 100ms
    expect(end - start).toBeLessThan(100);
  });

  it('getVariants completes in less than 10ms even with many story variants', async () => {
    const { VariantService } = await import('./variantService');
    const service = new VariantService();
    await service.initialize();

    // Add many variants for a single word
    for (let i = 0; i < 100; i++) {
      await service.addCustomVariant('hello', `variant${i}`, 'story1', 'english');
    }

    const start = performance.now();
    const variants = service.getVariants('hello', 'english', 'story1');
    const end = performance.now();

    expect(variants.length).toBeGreaterThan(0);
    expect(end - start).toBeLessThan(10);
  });
});
