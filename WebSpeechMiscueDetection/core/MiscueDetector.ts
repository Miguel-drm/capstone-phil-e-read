/**
 * WebSpeech Miscue Detector
 * Core detection engine for identifying and analyzing reading miscues
 */

import { 
  MiscueDetectionConfig, 
  MiscueEvent, 
  DetectionResult, 
  MiscueType, 
  PerformanceMetrics,
  DetectionState,
  DetectionCallbacks,
  WordContext
} from '../types/MiscueTypes';
import { PhoneticMatcher } from './PhoneticMatcher';
import { WordMatcher } from './WordMatcher';
import { TextNormalizer } from '../utils/TextNormalizer';
import { PerformanceTracker } from '../utils/PerformanceMetrics';

export class WebSpeechMiscueDetector {
  private config: MiscueDetectionConfig;
  private phoneticMatcher: PhoneticMatcher;
  private wordMatcher: WordMatcher;
  private textNormalizer: TextNormalizer;
  private performanceTracker: PerformanceTracker;
  private state: DetectionState;
  private callbacks: Partial<DetectionCallbacks>;

  constructor(config: MiscueDetectionConfig, callbacks?: Partial<DetectionCallbacks>) {
    this.config = config;
    this.callbacks = callbacks || {};
    
    // Initialize components
    this.phoneticMatcher = new PhoneticMatcher(config.language);
    this.wordMatcher = new WordMatcher(config.storyWords);
    this.textNormalizer = new TextNormalizer(config.language);
    this.performanceTracker = new PerformanceTracker();
    
    // Initialize state
    this.state = {
      currentPosition: 0,
      buffer: [],
      pendingWords: [],
      lastProcessedTime: Date.now(),
      sessionStartTime: Date.now(),
      totalProcessingTime: 0
    };

    console.log('🎯 WebSpeech Miscue Detector initialized:', {
      storyWords: config.storyWords.length,
      language: config.language,
      realTimeMode: config.realTimeMode
    });
  }

  /**
   * Process spoken word and detect miscues
   */
  public async processSpokenWord(
    spokenWord: string, 
    confidence: number = 1.0,
    timestamp?: number
  ): Promise<DetectionResult> {
    const startTime = performance.now();
    const processTimestamp = timestamp || Date.now();

    try {
      // Normalize the spoken word
      const normalizedSpoken = this.textNormalizer.normalize(spokenWord);
      
      if (!normalizedSpoken || normalizedSpoken.trim().length === 0) {
        return this.createEmptyResult(startTime);
      }

      // Get current context
      const context = this.getWordContext(this.state.currentPosition);
      const expectedWord = context.word;

      console.log(`🎙️ Processing: "${spokenWord}" -> "${normalizedSpoken}" (expected: "${expectedWord}")`);

      // Detect miscue type
      const miscueEvent = await this.detectMiscue(
        normalizedSpoken,
        expectedWord,
        context,
        confidence,
        processTimestamp
      );

      // Determine if we should advance position
      const shouldAdvance = this.shouldAdvancePosition(miscueEvent);
      const newPosition = shouldAdvance ? this.state.currentPosition + 1 : this.state.currentPosition;

      // Update state
      if (shouldAdvance) {
        this.state.currentPosition = newPosition;
        this.performanceTracker.recordWordProcessed(miscueEvent?.type === 'correct');
      }

      // Update performance metrics
      if (miscueEvent) {
        this.performanceTracker.recordMiscue(miscueEvent);
      }

      // Create result
      const result: DetectionResult = {
        miscue: miscueEvent,
        shouldAdvance,
        newPosition,
        confidence,
        processingTime: performance.now() - startTime,
        alternatives: [] // TODO: Implement alternatives
      };

      // Trigger callbacks
      if (miscueEvent && this.callbacks.onMiscueDetected) {
        this.callbacks.onMiscueDetected(miscueEvent);
      }

      if (shouldAdvance && this.callbacks.onPositionAdvanced) {
        this.callbacks.onPositionAdvanced(newPosition);
      }

      if (miscueEvent?.type === 'correct' && this.callbacks.onWordCorrect) {
        this.callbacks.onWordCorrect(expectedWord, this.state.currentPosition);
      }

      return result;

    } catch (error) {
      console.error('❌ Error processing spoken word:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
      return this.createEmptyResult(startTime);
    }
  }

  /**
   * Detect the type of miscue
   */
  private async detectMiscue(
    spokenWord: string,
    expectedWord: string,
    context: WordContext,
    confidence: number,
    timestamp: number
  ): Promise<MiscueEvent | null> {
    const miscueId = `miscue_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Check for exact match (correct)
    if (spokenWord.toLowerCase() === expectedWord.toLowerCase()) {
      return {
        id: miscueId,
        timestamp,
        type: 'correct',
        position: context.position,
        expectedWord,
        spokenWord,
        confidence,
        severity: 'low',
        phonetic: {
          similarity: 1.0,
          phoneticMatch: true,
          soundexMatch: true
        },
        context: {
          previousWords: context.previousWords,
          nextWords: context.nextWords,
          sentencePosition: context.position
        }
      };
    }

    // Check for phonetic match (mispronunciation)
    if (this.config.phonetic) {
      const phoneticMatch = await this.phoneticMatcher.match(spokenWord, expectedWord);
      
      if (phoneticMatch.similarity > 0.7) {
        return {
          id: miscueId,
          timestamp,
          type: 'mispronunciation',
          position: context.position,
          expectedWord,
          spokenWord,
          confidence,
          severity: phoneticMatch.similarity > 0.85 ? 'low' : 'medium',
          phonetic: {
            similarity: phoneticMatch.similarity,
            phoneticMatch: phoneticMatch.soundexMatch,
            soundexMatch: phoneticMatch.soundexMatch
          },
          context: {
            previousWords: context.previousWords,
            nextWords: context.nextWords,
            sentencePosition: context.position
          }
        };
      }
    }

    // Check for substitution (different word)
    if (this.isValidStoryWord(spokenWord)) {
      return {
        id: miscueId,
        timestamp,
        type: 'substitution',
        position: context.position,
        expectedWord,
        spokenWord,
        confidence,
        severity: 'high',
        phonetic: {
          similarity: 0,
          phoneticMatch: false,
          soundexMatch: false
        },
        context: {
          previousWords: context.previousWords,
          nextWords: context.nextWords,
          sentencePosition: context.position
        }
      };
    }

    // Check for insertion (extra word)
    if (this.isInsertionCandidate(spokenWord, context)) {
      return {
        id: miscueId,
        timestamp,
        type: 'insertion',
        position: context.position,
        expectedWord,
        spokenWord,
        confidence,
        severity: 'medium',
        phonetic: {
          similarity: 0,
          phoneticMatch: false,
          soundexMatch: false
        },
        context: {
          previousWords: context.previousWords,
          nextWords: context.nextWords,
          sentencePosition: context.position
        }
      };
    }

    // Default to substitution if word is not recognized
    return {
      id: miscueId,
      timestamp,
      type: 'substitution',
      position: context.position,
      expectedWord,
      spokenWord,
      confidence,
      severity: 'high',
      phonetic: {
        similarity: 0,
        phoneticMatch: false,
        soundexMatch: false
      },
      context: {
        previousWords: context.previousWords,
        nextWords: context.nextWords,
        sentencePosition: context.position
      }
    };
  }

  /**
   * Get word context for current position
   */
  private getWordContext(position: number): WordContext {
    const word = this.config.storyWords[position] || '';
    const previousWords = this.config.storyWords.slice(Math.max(0, position - 3), position);
    const nextWords = this.config.storyWords.slice(position + 1, position + 4);

    return {
      position,
      word,
      previousWords,
      nextWords,
      sentenceStart: position === 0 || this.isSentenceStart(position),
      sentenceEnd: this.isSentenceEnd(position),
      paragraphStart: this.isParagraphStart(position)
    };
  }

  /**
   * Check if position should advance
   */
  private shouldAdvancePosition(miscueEvent: MiscueEvent | null): boolean {
    if (!miscueEvent) return false;
    
    // Advance for correct words and most miscue types
    return ['correct', 'mispronunciation', 'substitution', 'repetition', 'self_correction'].includes(miscueEvent.type);
  }

  /**
   * Check if word is valid story word
   */
  private isValidStoryWord(word: string): boolean {
    const normalized = this.textNormalizer.normalize(word);
    return this.config.storyWords.some(storyWord => 
      this.textNormalizer.normalize(storyWord) === normalized
    );
  }

  /**
   * Check if word is insertion candidate
   */
  private isInsertionCandidate(word: string, context: WordContext): boolean {
    // Simple heuristic: if word is not in story and not phonetically similar to expected word
    return !this.isValidStoryWord(word) && word.length > 2;
  }

  /**
   * Check if position is sentence start
   */
  private isSentenceStart(position: number): boolean {
    if (position === 0) return true;
    const prevWord = this.config.storyWords[position - 1];
    return prevWord ? /[.!?]$/.test(prevWord) : false;
  }

  /**
   * Check if position is sentence end
   */
  private isSentenceEnd(position: number): boolean {
    const word = this.config.storyWords[position];
    return word ? /[.!?]$/.test(word) : false;
  }

  /**
   * Check if position is paragraph start
   */
  private isParagraphStart(position: number): boolean {
    // Simple heuristic - could be enhanced with paragraph markers
    return position === 0 || (position > 0 && this.config.storyWords[position - 1] === '');
  }

  /**
   * Create empty result for error cases
   */
  private createEmptyResult(startTime: number): DetectionResult {
    return {
      miscue: null,
      shouldAdvance: false,
      newPosition: this.state.currentPosition,
      confidence: 0,
      processingTime: performance.now() - startTime,
      alternatives: []
    };
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceTracker.getMetrics();
  }

  /**
   * Reset detector state
   */
  public reset(): void {
    this.state = {
      currentPosition: 0,
      buffer: [],
      pendingWords: [],
      lastProcessedTime: Date.now(),
      sessionStartTime: Date.now(),
      totalProcessingTime: 0
    };
    this.performanceTracker.reset();
    console.log('🔄 WebSpeech Miscue Detector reset');
  }

  /**
   * Get current position
   */
  public getCurrentPosition(): number {
    return this.state.currentPosition;
  }

  /**
   * Set current position
   */
  public setCurrentPosition(position: number): void {
    this.state.currentPosition = Math.max(0, Math.min(position, this.config.storyWords.length - 1));
  }
}