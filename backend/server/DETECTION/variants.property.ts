/**
 * Property-Based Tests for Word Variants System
 * 
 * Uses fast-check library to verify universal properties about variant loading,
 * matching, and persistence.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ENGLISH_PRONUNCIATION_VARIANTS, TAGALOG_PRONUNCIATION_VARIANTS } from './correct';
import { isVariantDictionary, isValidLanguage } from './variants';

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
