/**
 * WebSpeech Miscue Detectors
 * Individual detector modules for different types of reading miscues
 */

export { default as MispronunciationDetector, MispronunciationDetectorUI } from './MispronunciationDetector';
export type { MispronunciationResult } from './MispronunciationDetector';

export { default as SubstitutionDetector, SubstitutionDetectorUI } from './SubstitutionDetector';
export type { SubstitutionResult } from './SubstitutionDetector';

export { default as OmissionDetector, OmissionDetectorUI } from './OmissionDetector';
export type { OmissionResult } from './OmissionDetector';

export { default as InsertionDetector, InsertionDetectorUI } from './InsertionDetector';
export type { InsertionResult } from './InsertionDetector';

export { default as RepetitionDetector, RepetitionDetectorUI } from './RepetitionDetector';
export type { RepetitionResult } from './RepetitionDetector';

// Combined types
export type MiscueResult = 
  | MispronunciationResult 
  | SubstitutionResult 
  | OmissionResult 
  | InsertionResult 
  | RepetitionResult;

// Detector manager class
export class WebSpeechMiscueDetectorManager {
  private mispronunciationDetector = new MispronunciationDetector();
  private substitutionDetector = new SubstitutionDetector();
  private omissionDetector = new OmissionDetector();
  private insertionDetector = new InsertionDetector();
  private repetitionDetector = new RepetitionDetector();

  public detectAll(
    spokenWord: string,
    expectedWord: string,
    position: number,
    confidence: number = 0.8,
    context: string[] = []
  ): MiscueResult[] {
    const results: MiscueResult[] = [];

    // Try each detector
    const mispronunciation = this.mispronunciationDetector.detect(spokenWord, expectedWord, position, confidence);
    if (mispronunciation) results.push(mispronunciation);

    const substitution = this.substitutionDetector.detect(spokenWord, expectedWord, position, confidence, context);
    if (substitution) results.push(substitution);

    // Note: Omission and insertion detectors work differently (need word arrays)
    // They should be called separately with appropriate data

    return results;
  }

  public detectFromTranscript(
    expectedText: string,
    spokenTranscript: string,
    confidence: number = 0.8
  ): MiscueResult[] {
    const results: MiscueResult[] = [];

    // Detect omissions
    const omissions = this.omissionDetector.detectFromTranscript(expectedText, spokenTranscript, confidence);
    results.push(...omissions);

    // Detect insertions
    const insertions = this.insertionDetector.detectFromTranscript(expectedText, spokenTranscript, confidence);
    results.push(...insertions);

    // Detect repetitions
    const repetitions = this.repetitionDetector.detectFromTranscript(spokenTranscript, 0, confidence);
    results.push(...repetitions);

    return results;
  }

  public reset(): void {
    this.repetitionDetector.reset();
  }

  public getDetector(type: 'mispronunciation' | 'substitution' | 'omission' | 'insertion' | 'repetition') {
    switch (type) {
      case 'mispronunciation': return this.mispronunciationDetector;
      case 'substitution': return this.substitutionDetector;
      case 'omission': return this.omissionDetector;
      case 'insertion': return this.insertionDetector;
      case 'repetition': return this.repetitionDetector;
    }
  }
}