# Mispronunciation Detection - Usage Examples

## Example 1: Basic Detection

```typescript
import { useAdvancedMispronunciationDetection } from '@/hooks/useAdvancedMispronunciationDetection';

function MyComponent() {
  const detector = useAdvancedMispronunciationDetection();

  const handleWordSpoken = (spokenWord: string, expectedWord: string) => {
    const analysis = detector.detectWord(spokenWord, expectedWord);
    
    if (analysis.isMispronunciation) {
      console.log(`Mispronunciation detected: "${spokenWord}" → "${expectedWord}"`);
      console.log(`Confidence: ${analysis.confidence}%`);
      console.log(`Severity: ${analysis.severity}`);
      console.log(`Reason: ${analysis.reason}`);
    }
  };

  return (
    <button onClick={() => handleWordSpoken('heard', 'herd')}>
      Test Detection
    </button>
  );
}
```

## Example 2: Detailed Analysis

```typescript
const detector = useAdvancedMispronunciationDetection({
  enableLogging: true
});

const analysis = detector.getDetailedAnalysis('think', 'fink');

console.log('=== Mispronunciation Analysis ===');
console.log(`Spoken: "${analysis.details.spokenWord}"`);
console.log(`Expected: "${analysis.details.expectedWord}"`);
console.log(`Overall Confidence: ${analysis.confidence}%`);
console.log(`Severity: ${analysis.severity}`);
console.log(`Reason: ${analysis.reason}`);
console.log('');
console.log('Strategy Breakdown:');
console.log(`  Phonetic: ${analysis.strategies.phonetic.score.toFixed(0)}% ${analysis.strategies.phonetic.matched ? '✓' : '✗'}`);
console.log(`  Vowel Pattern: ${analysis.strategies.vowelPattern.score.toFixed(0)}% ${analysis.strategies.vowelPattern.matched ? '✓' : '✗'}`);
console.log(`  Consonant Pattern: ${analysis.strategies.consonantPattern.score.toFixed(0)}% ${analysis.strategies.consonantPattern.matched ? '✓' : '✗'}`);
console.log(`  Syllable Stress: ${analysis.strategies.syllableStress.score.toFixed(0)}% ${analysis.strategies.syllableStress.matched ? '✓' : '✗'}`);
console.log('');
console.log('Error Details:');
console.log(`  Vowel Errors: ${analysis.details.vowelErrors}`);
console.log(`  Consonant Errors: ${analysis.details.consonantErrors}`);
console.log(`  Common Error: ${analysis.details.commonError ? 'Yes' : 'No'}`);

// Output:
// === Mispronunciation Analysis ===
// Spoken: "think"
// Expected: "fink"
// Overall Confidence: 90%
// Severity: minor
// Reason: Consonant pattern similar. Similar syllable structure. Common pronunciation error.
//
// Strategy Breakdown:
//   Phonetic: 90% ✓
//   Vowel Pattern: 100% ✓
//   Consonant Pattern: 85% ✓
//   Syllable Stress: 80% ✓
//
// Error Details:
//   Vowel Errors: 0
//   Consonant Errors: 1
//   Common Error: Yes
```

## Example 3: Batch Processing

```typescript
const detector = useAdvancedMispronunciationDetection();

const spokenWords = ['heard', 'think', 'ship', 'cat', 'run'];
const expectedWords = ['herd', 'fink', 'chip', 'cot', 'wun'];

const analyses = detector.detectBatch(spokenWords, expectedWords);
const stats = detector.getStats(analyses);

console.log('=== Batch Analysis Results ===');
console.log(`Total words: ${stats.total}`);
console.log(`Mispronunciations: ${stats.mispronunciations}`);
console.log(`Mispronunciation rate: ${stats.mispronunciationRate.toFixed(1)}%`);
console.log(`Average confidence: ${stats.avgConfidence}%`);
console.log('');
console.log('Severity Breakdown:');
console.log(`  Minor: ${stats.severity.minor}`);
console.log(`  Moderate: ${stats.severity.moderate}`);
console.log(`  Major: ${stats.severity.major}`);
console.log('');
console.log('Common Errors: ' + stats.commonErrors);
console.log('');
console.log('By Strategy:');
console.log(`  Vowel Pattern matches: ${stats.byStrategy.vowelPattern}`);
console.log(`  Consonant Pattern matches: ${stats.byStrategy.consonantPattern}`);
console.log(`  Syllable Stress matches: ${stats.byStrategy.syllableStress}`);

// Output:
// === Batch Analysis Results ===
// Total words: 5
// Mispronunciations: 5
// Mispronunciation rate: 100.0%
// Average confidence: 84%
//
// Severity Breakdown:
//   Minor: 4
//   Moderate: 1
//   Major: 0
//
// Common Errors: 3
//
// By Strategy:
//   Vowel Pattern matches: 4
//   Consonant Pattern matches: 5
//   Syllable Stress matches: 5
```

## Example 4: Severity-Based Feedback

```typescript
const detector = useAdvancedMispronunciationDetection();

function provideFeedback(spokenWord: string, expectedWord: string) {
  const analysis = detector.detectWord(spokenWord, expectedWord);
  
  if (!analysis.isMispronunciation) {
    console.log('✅ Great pronunciation!');
    return;
  }

  switch (analysis.severity) {
    case 'minor':
      console.log(`Good try! "${spokenWord}" is close to "${expectedWord}".`);
      console.log(`Try emphasizing the ${analysis.details.consonantErrors > 0 ? 'consonant' : 'vowel'} sound.`);
      break;
      
    case 'moderate':
      console.log(`Let's work on "${expectedWord}".`);
      console.log(`You said "${spokenWord}", but the correct pronunciation is "${expectedWord}".`);
      console.log(`Pay attention to the ${analysis.details.vowelErrors > 0 ? 'vowel' : 'consonant'} sounds.`);
      break;
      
    case 'major':
      console.log(`"${expectedWord}" is a challenging word!`);
      console.log(`Let's practice: "${expectedWord}" (not "${spokenWord}").`);
      console.log(`Break it into syllables and practice each part.`);
      break;
  }
}

// Examples:
provideFeedback('heard', 'herd');
// Good try! "heard" is close to "herd".
// Try emphasizing the consonant sound.

provideFeedback('water', 'wader');
// Let's work on "wader".
// You said "water", but the correct pronunciation is "wader".
// Pay attention to the vowel sounds.
```

## Example 5: Common Error Detection

```typescript
const detector = useAdvancedMispronunciationDetection();

function analyzeError(spokenWord: string, expectedWord: string) {
  const isCommon = detector.isCommonError(spokenWord, expectedWord);
  const analysis = detector.detectWord(spokenWord, expectedWord);
  
  if (isCommon) {
    console.log(`⚠️ Common pronunciation error detected!`);
    console.log(`Many children say "${spokenWord}" instead of "${expectedWord}".`);
    console.log(`This is a known pattern that needs practice.`);
  } else {
    console.log(`Unique pronunciation variation.`);
  }
}

// Examples:
analyzeError('think', 'fink');
// ⚠️ Common pronunciation error detected!
// Many children say "think" instead of "fink".
// This is a known pattern that needs practice.

analyzeError('run', 'wun');
// ⚠️ Common pronunciation error detected!
// Many children say "run" instead of "wun".
// This is a known pattern that needs practice.
```

## Example 6: Word Difficulty Assessment

```typescript
const detector = useAdvancedMispronunciationDetection();

function assessDifficulty(word: string) {
  const difficulty = detector.getDifficulty(word);
  
  console.log(`Word: "${word}"`);
  console.log(`Difficulty: ${difficulty}`);
  
  switch (difficulty) {
    case 'easy':
      console.log('This is an easy word to pronounce.');
      break;
    case 'medium':
      console.log('This word has moderate difficulty.');
      break;
    case 'hard':
      console.log('This is a challenging word. Extra practice may be needed.');
      break;
  }
}

// Examples:
assessDifficulty('cat');
// Word: "cat"
// Difficulty: easy
// This is an easy word to pronounce.

assessDifficulty('think');
// Word: "think"
// Difficulty: hard
// This is a challenging word. Extra practice may be needed.

assessDifficulty('water');
// Word: "water"
// Difficulty: medium
// This word has moderate difficulty.
```

## Example 7: Confidence-Based Recording

```typescript
const detector = useAdvancedMispronunciationDetection({
  minConfidence: 60
});

function recordMispronunciation(spokenWord: string, expectedWord: string) {
  const analysis = detector.detectWord(spokenWord, expectedWord);
  
  if (analysis.confidence >= 60) {
    // Record as mispronunciation
    console.log(`✅ Recording: "${spokenWord}" → "${expectedWord}" (${analysis.confidence}%, ${analysis.severity})`);
    recordMiscue('mispronunciation', spokenWord, expectedWord, analysis.severity);
  } else if (analysis.confidence >= 40) {
    // Low confidence - log for review
    console.log(`⚠️ Low confidence: "${spokenWord}" → "${expectedWord}" (${analysis.confidence}%)`);
    logForReview(analysis);
  } else {
    // Not a mispronunciation
    console.log(`❌ Not a mispronunciation: "${spokenWord}" vs "${expectedWord}" (${analysis.confidence}%)`);
  }
}

// Examples:
recordMispronunciation('heard', 'herd');        // ✅ 85% - recorded (minor)
recordMispronunciation('cat', 'dog');           // ⚠️ 35% - low confidence
recordMispronunciation('hello', 'goodbye');     // ❌ 5% - not recorded
```

## Example 8: Language-Specific Detection

```typescript
// English story
const englishDetector = useAdvancedMispronunciationDetection({
  language: 'english'
});

const englishAnalysis = englishDetector.detectWord('think', 'fink');
console.log(englishAnalysis.confidence); // 90%

// Tagalog story
const tagalogDetector = useAdvancedMispronunciationDetection({
  language: 'tagalog'
});

const tagalogAnalysis = tagalogDetector.detectWord('tao', 'tau');
console.log(tagalogAnalysis.confidence); // 80%
```

## Example 9: Strict Mode

```typescript
// Lenient mode (default)
const lenientDetector = useAdvancedMispronunciationDetection({
  strictMode: false,
  minConfidence: 60
});

const lenientAnalysis = lenientDetector.detectWord('heard', 'herd');
console.log(lenientAnalysis.confidence); // 85% - recorded

// Strict mode
const strictDetector = useAdvancedMispronunciationDetection({
  strictMode: true,
  minConfidence: 90
});

const strictAnalysis = strictDetector.detectWord('heard', 'herd');
console.log(strictAnalysis.confidence); // 85% - NOT recorded (below 90%)
```

## Example 10: Real-World Reading Session

```typescript
function ReadingSession() {
  const detector = useAdvancedMispronunciationDetection({
    language: 'english',
    minConfidence: 60,
    enableLogging: true
  });

  const handleWordRecognized = (spokenWord: string, expectedWord: string) => {
    // Check if it's a mispronunciation
    if (detector.isLikelyMispronounced(spokenWord, expectedWord)) {
      const analysis = detector.getDetailedAnalysis(spokenWord, expectedWord);
      
      // Display to teacher
      displayMiscueInfo({
        type: 'mispronunciation',
        spoken: spokenWord,
        expected: expectedWord,
        confidence: analysis.confidence,
        severity: analysis.severity,
        reason: analysis.reason,
        isCommon: analysis.details.commonError,
        difficulty: detector.getDifficulty(expectedWord),
        strategies: analysis.strategies
      });
      
      // Record miscue
      recordMiscue('mispronunciation', spokenWord, expectedWord, analysis.severity);
    }
  };

  return (
    <div>
      {/* Reading session UI */}
    </div>
  );
}
```

## Performance Comparison

```typescript
// Measure performance
const detector = useAdvancedMispronunciationDetection();

console.time('Single detection');
detector.detectWord('heard', 'herd');
console.timeEnd('Single detection');
// Single detection: 0.4ms

console.time('Batch detection (100 words)');
const spokenWords = Array(100).fill('heard');
const expectedWords = Array(100).fill('herd');
detector.detectBatch(spokenWords, expectedWords);
console.timeEnd('Batch detection (100 words)');
// Batch detection (100 words): 40ms
```

## Common Patterns

### Pattern 1: Vowel Errors
```typescript
const vowelErrors = [
  ['cat', 'cot'],
  ['sit', 'set'],
  ['book', 'buk'],
  ['hat', 'het']
];

vowelErrors.forEach(([spoken, expected]) => {
  const analysis = detector.detectWord(spoken, expected);
  console.log(`${spoken} → ${expected}: ${analysis.confidence}% (vowel error)`);
});
```

### Pattern 2: Consonant Errors
```typescript
const consonantErrors = [
  ['think', 'fink'],
  ['ship', 'chip'],
  ['run', 'wun'],
  ['like', 'rike']
];

consonantErrors.forEach(([spoken, expected]) => {
  const analysis = detector.detectWord(spoken, expected);
  console.log(`${spoken} → ${expected}: ${analysis.confidence}% (consonant error)`);
});
```

### Pattern 3: Complex Sound Errors
```typescript
const complexErrors = [
  ['nation', 'nashun'],
  ['vision', 'vizhen'],
  ['water', 'wader']
];

complexErrors.forEach(([spoken, expected]) => {
  const analysis = detector.detectWord(spoken, expected);
  console.log(`${spoken} → ${expected}: ${analysis.confidence}% (complex sound)`);
});
```

---

**Ready to use!** Copy these examples and adapt them to your needs.
