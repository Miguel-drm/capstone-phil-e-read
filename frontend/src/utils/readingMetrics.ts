
/**
 * Calculates the oral reading score as a percentage.
 * Ensures (wordsRead - miscues) is never negative before calculating the percentage.
 * Formula: ((max(wordsRead - miscues, 0)) / totalWords) * 100
 * The result is clamped between 0 and 100 only if necessary.
 */
export function calculateOralReadingScore(wordsRead: number, miscues: number, totalWords: number): number {
  if (totalWords === 0) return 0;
  // Ensure the numerator is never negative
  const correctWords = Math.max(wordsRead - miscues, 0);
  const score = (correctWords / totalWords) * 100;
  // Clamp only if out of bounds
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

/**
 * Calculates reading speed in words per minute (WPM).
 * Formula: wordsRead / (elapsedTime / 60)
 */
export function calculateReadingSpeedWPM(wordsRead: number, elapsedTime: number): number {
  if (elapsedTime === 0) return 0;
  return Math.round(wordsRead / (elapsedTime / 60));
}

/**
 * Calculates miscues (errors) given transcript and real words.
 * Only counts miscues for spoken words, not for unattempted (unread) words.
 * This is a generic function; actual matching logic should be passed in.
 */
export function calculateMiscues(transcriptWords: string[], realWords: string[], isWordMatch: (a: string, b: string) => boolean): number {
  let idx = 0;
  let spokenIdx = 0;
  let miscuesCount = 0;
  while (idx < realWords.length && spokenIdx < transcriptWords.length) {
    if (isWordMatch(transcriptWords[spokenIdx], realWords[idx])) {
      idx++;
      spokenIdx++;
    } else {
      miscuesCount++;
      spokenIdx++;
    }
  }
  // Do NOT add miscues for unattempted (unread) words
  return miscuesCount;
}

/**
 * Calculates words read (matches) given transcript and real words.
 * This is a generic function; actual matching logic should be passed in.
 */
export function calculateWordsRead(transcriptWords: string[], realWords: string[], isWordMatch: (a: string, b: string) => boolean): number {
  let idx = 0;
  let spokenIdx = 0;
  while (idx < realWords.length && spokenIdx < transcriptWords.length) {
    if (isWordMatch(transcriptWords[spokenIdx], realWords[idx])) {
      idx++;
      spokenIdx++;
    } else {
      spokenIdx++;
    }
  }
  return idx;
}

/**
 * Formats elapsed time in seconds as MM:SS
 */
export function formatElapsedTime(elapsedTime: number): string {
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
} 