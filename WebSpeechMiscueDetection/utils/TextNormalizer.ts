/**
 * Text Normalizer for WebSpeech Miscue Detection
 * Handles text normalization for consistent processing
 */

export class TextNormalizer {
  private language: 'english' | 'tagalog';

  constructor(language: 'english' | 'tagalog') {
    this.language = language;
  }

  /**
   * Normalize text for processing
   */
  public normalize(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let normalized = text.trim();

    // Basic normalization
    normalized = this.basicNormalization(normalized);

    // Language-specific normalization
    normalized = this.applyLanguageNormalization(normalized);

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Basic text normalization
   */
  private basicNormalization(text: string): string {
    return text
      .toLowerCase()
      .replace(/['']/g, "'")  // Normalize apostrophes
      .replace(/[""]/g, '"')  // Normalize quotes
      .replace(/[–—]/g, '-')  // Normalize dashes
      .replace(/…/g, '...')   // Normalize ellipsis
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
      .trim();
  }

  /**
   * Apply language-specific normalization
   */
  private applyLanguageNormalization(text: string): string {
    if (this.language === 'tagalog') {
      return this.normalizeTagalog(text);
    } else {
      return this.normalizeEnglish(text);
    }
  }

  /**
   * Normalize English text
   */
  private normalizeEnglish(text: string): string {
    let normalized = text;

    // Common English contractions
    const contractions: [RegExp, string][] = [
      [/won't/g, 'will not'],
      [/can't/g, 'cannot'],
      [/n't/g, ' not'],
      [/'ll/g, ' will'],
      [/'re/g, ' are'],
      [/'ve/g, ' have'],
      [/'d/g, ' would'],
      [/'m/g, ' am'],
      [/'s/g, ' is'], // Note: This is ambiguous (could be possessive)
    ];

    for (const [pattern, replacement] of contractions) {
      normalized = normalized.replace(pattern, replacement);
    }

    // Remove punctuation but keep apostrophes in contractions
    normalized = normalized.replace(/[^\w\s']/g, ' ');

    return normalized;
  }

  /**
   * Normalize Tagalog text
   */
  private normalizeTagalog(text: string): string {
    let normalized = text;

    // Tagalog-specific normalizations
    const tagalogNormalizations: [RegExp, string][] = [
      [/ng/g, 'ng'],  // Ensure 'ng' is preserved
      [/ñ/g, 'ny'],   // Convert ñ to ny
      [/Ñ/g, 'ny'],   // Convert Ñ to ny
    ];

    for (const [pattern, replacement] of tagalogNormalizations) {
      normalized = normalized.replace(pattern, replacement);
    }

    // Remove punctuation
    normalized = normalized.replace(/[^\w\s]/g, ' ');

    return normalized;
  }

  /**
   * Normalize for phonetic comparison
   */
  public normalizePhonetic(text: string): string {
    let normalized = this.normalize(text);

    // Remove common phonetic variations
    normalized = normalized
      .replace(/ph/g, 'f')
      .replace(/gh/g, 'f')
      .replace(/ck/g, 'k')
      .replace(/qu/g, 'kw')
      .replace(/x/g, 'ks');

    return normalized;
  }

  /**
   * Extract words from text
   */
  public extractWords(text: string): string[] {
    const normalized = this.normalize(text);
    return normalized
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Clean word for comparison
   */
  public cleanWord(word: string): string {
    return this.normalize(word)
      .replace(/[^\w]/g, '')
      .toLowerCase();
  }

  /**
   * Check if text contains only valid characters for the language
   */
  public isValidText(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    if (this.language === 'tagalog') {
      // Tagalog uses Latin alphabet + some special characters
      return /^[a-zA-ZñÑ\s\-'.,!?]+$/.test(text);
    } else {
      // English uses Latin alphabet
      return /^[a-zA-Z\s\-'.,!?]+$/.test(text);
    }
  }

  /**
   * Remove diacritics and accents
   */
  public removeDiacritics(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Convert to sentence case
   */
  public toSentenceCase(text: string): string {
    if (!text) return '';
    
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  /**
   * Split text into sentences
   */
  public splitSentences(text: string): string[] {
    const normalized = this.normalize(text);
    return normalized
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  /**
   * Check if word is a common filler word
   */
  public isFillerWord(word: string): boolean {
    const normalized = this.cleanWord(word);
    
    const englishFillers = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'well'];
    const tagalogFillers = ['ano', 'eh', 'ah', 'eto', 'yun'];
    
    const fillers = this.language === 'tagalog' ? tagalogFillers : englishFillers;
    
    return fillers.includes(normalized);
  }

  /**
   * Get word variants (common misspellings/variations)
   */
  public getWordVariants(word: string): string[] {
    const normalized = this.cleanWord(word);
    const variants = [normalized];

    // Add common variations
    if (this.language === 'english') {
      // English variations
      if (normalized.endsWith('ing')) {
        variants.push(normalized.slice(0, -3) + 'in');
      }
      if (normalized.endsWith('ed')) {
        variants.push(normalized.slice(0, -2));
        variants.push(normalized.slice(0, -1));
      }
      if (normalized.includes('ou')) {
        variants.push(normalized.replace('ou', 'o'));
      }
    }

    return [...new Set(variants)];
  }
}