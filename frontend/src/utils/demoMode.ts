/**
 * Demo Mode - Simulates a reading session with automatic word marking
 * Used to demonstrate the system without requiring actual speech recognition
 */

export interface DemoWord {
  word: string;
  delay: number; // milliseconds before marking this word
  type: 'correct' | 'mispronunciation' | 'omission' | 'insertion' | 'substitution' | 'reversal' | 'transposition' | 'repetition' | 'selfCorrection';
}

/**
 * Generate demo words for a story
 * Simulates realistic reading with various miscues for demonstration
 */
export function generateDemoSequence(words: string[]): DemoWord[] {
  const demoSequence: DemoWord[] = [];
  let cumulativeDelay = 500; // Start after 500ms

  const miscueTypes: Array<'correct' | 'mispronunciation' | 'omission' | 'insertion' | 'substitution' | 'reversal' | 'transposition' | 'repetition' | 'selfCorrection'> = [
    'correct',
    'correct',
    'mispronunciation',
    'correct',
    'omission',
    'correct',
    'insertion',
    'correct',
    'substitution',
    'correct',
    'reversal',
    'correct',
    'transposition',
    'correct',
    'repetition',
    'correct',
    'selfCorrection',
    'correct',
  ];

  words.forEach((word, index) => {
    // Simulate realistic reading speed: ~150 WPM = ~400ms per word
    const wordDelay = 400 + Math.random() * 200; // 400-600ms per word
    cumulativeDelay += wordDelay;

    // Cycle through miscue types to demonstrate variety
    const miscueIndex = index % miscueTypes.length;
    const type = miscueTypes[miscueIndex];

    demoSequence.push({
      word,
      delay: cumulativeDelay,
      type,
    });
  });

  return demoSequence;
}

/**
 * Simulate a reading session
 * Calls the callback for each word at the appropriate time
 */
export async function simulateReadingSession(
  demoSequence: DemoWord[],
  onWordMarked: (word: string, type: string, index: number) => void,
  onComplete: () => void
): Promise<void> {
  let lastTime = 0;

  for (let i = 0; i < demoSequence.length; i++) {
    const { word, delay, type } = demoSequence[i];

    // Calculate time to wait from now (not from start)
    const timeToWait = Math.max(0, delay - lastTime);
    
    // Wait for the calculated delay
    await new Promise((resolve) => setTimeout(resolve, timeToWait));

    // Call the callback
    onWordMarked(word, type, i);
    
    // Add a small delay to allow React to render the state update
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    lastTime = delay + 50;
  }

  // Wait a bit before completing
  await new Promise((resolve) => setTimeout(resolve, 500));
  onComplete();
}

/**
 * Create a demo session with predefined miscues
 * Good for showing specific detection types
 */
export function createDemoWithMiscues(words: string[]): DemoWord[] {
  const demoSequence: DemoWord[] = [];
  let cumulativeDelay = 500;

  words.forEach((word, index) => {
    const wordDelay = 400 + Math.random() * 200;
    cumulativeDelay += wordDelay;

    // Demonstrate different miscue types
    let type: 'correct' | 'mispronunciation' | 'omission' | 'insertion' = 'correct';

    // Show some miscues for demonstration
    if (index === 2) type = 'mispronunciation'; // 3rd word
    if (index === 5) type = 'omission'; // 6th word
    if (index === 8) type = 'insertion'; // 9th word

    demoSequence.push({
      word,
      delay: cumulativeDelay,
      type,
    });
  });

  return demoSequence;
}
