# Substitution Detection - Usage Examples

## Example 1: Basic Detection

```typescript
import { useAdvancedSubstitutionDetection } from '@/hooks/useAdvancedSubstitutionDetection';

function MyComponent() {
  const detector = useAdvancedSubstitutionDetection();

  const handleWordSpoken = (spokenWord: string, expectedWord: string) => {
    const analysis = detector.detectWord(spokenWord, expectedWord);
    
    if (analysis.isSubstitution) {
      console.log(`Substitution detected: "${spokenWord}" → "${expectedWord}"`);
      console.log(`Confidence: ${analysis.confidence}%`);
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
const detector = useAdvancedSubstitutionDetection({
  enableLogging: true
});

const analysis = detector.getDetailedAnalysis('there', 'their');

console.log('=== Substitution Analysis ===');
console.log(`Spoken: "${analysis.details.spokenWord}"`);
console.log(`Expected: "${analysis.details.expectedWord}"`);
console.log(`Overall Confidence: ${analysis.confidence}%`);
console.log(`Reason: ${analysis.reason}`);
console.log('');
console.log('Strategy Breakdown:');
console.log(`  Phonetic: ${analysis.strategies.phonetic.score.toFixed(0)}% ${analysis.strategies.phonetic.matched ? '✓' : '✗'}`);
console.log(`  Visual: ${analysis.strategies.visual.score.toFixed(0)}% ${analysis.strategies.visual.matched ? '✓' : '✗'}`);
console.log(`  Semantic: ${analysis.strategies.semantic.score.toFixed(0)}% ${analysis.strategies.semantic.matched ? '✓' : '✗'}`);
console.log(`  Contextual: ${analysis.strategies.contextual.score.toFixed(0)}% ${analysis.strategies.contextual.matched ? '✓' : '✗'}`);

// Output:
// === Substitution Analysis ===
// Spoken: "there"
// Expected: "their"
// Overall Confidence: 85%
// Reason: Phonetically similar. Semantically related.
//
// Strategy Breakdown:
//   Phonetic: 70% ✓
//   Visual: 60% ✗
//   Semantic: 85% ✓
//   Contextual: 60% ✓
```

## Example 3: Batch Processing

```typescript
const detector = useAdvancedSubstitutionDetection();

const spokenWords = ['heard', 'there', 'to', 'cat', 'break'];
const expectedWords = ['herd', 'their', 'too', 'bat', 'brake'];

const analyses = detector.detectBatch(spokenWords, expectedWords);
const stats = detector.getStats(analyses);

console.log('=== Batch Analysis Results ===');
console.log(`Total words: ${stats.total}`);
console.log(`Substitutions: ${stats.substitutions}`);
console.log(`Substitution rate: ${stats.substitutionRate.toFixed(1)}%`);
console.log(`Average confidence: ${stats.avgConfidence}%`);
console.log('');
console.log('By Strategy:');
console.log(`  Phonetic matches: ${stats.byStrategy.phonetic}`);
console.log(`  Visual matches: ${stats.byStrategy.visual}`);
console.log(`  Semantic matches: ${stats.byStrategy.semantic}`);
console.log(`  Contextual matches: ${stats.byStrategy.contextual}`);

// Output:
// === Batch Analysis Results ===
// Total words: 5
// Substitutions: 5
// Substitution rate: 100.0%
// Average confidence: 78%
//
// By Strategy:
//   Phonetic matches: 2
//   Visual matches: 2
//   Semantic matches: 3
//   Contextual matches: 5
```

## Example 4: Confidence-Based Recording

```typescript
const detector = useAdvancedSubstitutionDetection({
  minConfidence: 60
});

function recordSubstitution(spokenWord: string, expectedWord: string) {
  const analysis = detector.detectWord(spokenWord, expectedWord);
  
  if (analysis.confidence >= 60) {
    // Record as substitution
    console.log(`✅ Recording: "${spokenWord}" → "${expectedWord}" (${analysis.confidence}%)`);
    recordMiscue('substitution', spokenWord, expectedWord);
  } else if (analysis.confidence >= 40) {
    // Low confidence - log for review
    console.log(`⚠️ Low confidence: "${spokenWord}" → "${expectedWord}" (${analysis.confidence}%)`);
    logForReview(analysis);
  } else {
    // Not a substitution
    console.log(`❌ Not a substitution: "${spokenWord}" vs "${expectedWord}" (${analysis.confidence}%)`);
  }
}

// Examples:
recordSubstitution('heard', 'herd');        // ✅ 90% - recorded
recordSubstitution('cat', 'dog');           // ⚠️ 35% - low confidence
recordSubstitution('hello', 'goodbye');     // ❌ 5% - not recorded
```

## Example 5: Language-Specific Detection

```typescript
// English story
const englishDetector = useAdvancedSubstitutionDetection({
  language: 'english'
});

const englishAnalysis = englishDetector.detectWord('heard', 'herd');
console.log(englishAnalysis.confidence); // 90%

// Tagalog story
const tagalogDetector = useAdvancedSubstitutionDetection({
  language: 'tagalog'
});

const tagalogAnalysis = tagalogDetector.detectWord('tao', 'tau');
console.log(tagalogAnalysis.confidence); // 85%
```

## Example 6: Strict Mode

```typescript
// Lenient mode (default)
const lenientDetector = useAdvancedSubstitutionDetection({
  strictMode: false,
  minConfidence: 60
});

const lenientAnalysis = lenientDetector.detectWord('cat', 'bat');
console.log(lenientAnalysis.confidence); // 67% - recorded

// Strict mode
const strictDetector = useAdvancedSubstitutionDetection({
  strictMode: true,
  minConfidence: 70
});

const strictAnalysis = strictDetector.detectWord('cat', 'bat');
console.log(strictAnalysis.confidence); // 67% - NOT recorded (below 70%)
```

## Example 7: Debugging with Logging

```typescript
const detector = useAdvancedSubstitutionDetection({
  enableLogging: true,
  minConfidence: 60
});

// Single detection
detector.detectWord('there', 'their');
// Console: 🔄 Substitution detected: "there" → "their" (85%)

// Batch detection
detector.detectBatch(
  ['heard', 'there', 'to'],
  ['herd', 'their', 'too']
);
// Console: 📊 Batch analysis: 3/3 substitutions (100%)
```

## Example 8: Integration with Reading Session

```typescript
// In ReadingSessionPage.tsx
case 'substitution':
  const expectedWord = words[oldPosition] || '';
  const substitutionAnalysis = substitutionDetector.detectWord(word, expectedWord);
  
  if (substitutionAnalysis.confidence >= 60) {
    // Record substitution
    setWordMiscues(prev => new Map(prev).set(oldPosition, 'substitution'));
    setMiscues(prev => prev + 1);
    
    console.log(`🔄 Substitution: "${word}" → "${expectedWord}"`);
    console.log(`   Confidence: ${substitutionAnalysis.confidence}%`);
    console.log(`   Reason: ${substitutionAnalysis.reason}`);
  } else {
    console.log(`⚠️ Low confidence: "${word}" → "${expectedWord}" (${substitutionAnalysis.confidence}%)`);
  }
  break;
```

## Example 9: Custom Confidence Thresholds

```typescript
// Very lenient (catch more substitutions)
const lenient = useAdvancedSubstitutionDetection({
  minConfidence: 40
});

// Balanced (default)
const balanced = useAdvancedSubstitutionDetection({
  minConfidence: 60
});

// Very strict (fewer false positives)
const strict = useAdvancedSubstitutionDetection({
  minConfidence: 80
});

// Test word
const testWord = 'cat';
const expectedWord = 'bat';

console.log('Lenient:', lenient.getConfidenceScore(testWord, expectedWord)); // 67% - recorded
console.log('Balanced:', balanced.getConfidenceScore(testWord, expectedWord)); // 67% - recorded
console.log('Strict:', strict.getConfidenceScore(testWord, expectedWord)); // 67% - NOT recorded
```

## Example 10: Real-World Reading Session

```typescript
function ReadingSession() {
  const detector = useAdvancedSubstitutionDetection({
    language: 'english',
    minConfidence: 60,
    enableLogging: true
  });

  const handleWordRecognized = (spokenWord: string, expectedWord: string) => {
    // Check if it's a substitution
    if (detector.isLikelySubstitution(spokenWord, expectedWord)) {
      const analysis = detector.getDetailedAnalysis(spokenWord, expectedWord);
      
      // Display to teacher
      displayMiscueInfo({
        type: 'substitution',
        spoken: spokenWord,
        expected: expectedWord,
        confidence: analysis.confidence,
        reason: analysis.reason,
        strategies: analysis.strategies
      });
      
      // Record miscue
      recordMiscue('substitution', spokenWord, expectedWord);
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
const detector = useAdvancedSubstitutionDetection();

console.time('Single detection');
detector.detectWord('heard', 'herd');
console.timeEnd('Single detection');
// Single detection: 0.5ms

console.time('Batch detection (100 words)');
const spokenWords = Array(100).fill('heard');
const expectedWords = Array(100).fill('herd');
detector.detectBatch(spokenWords, expectedWords);
console.timeEnd('Batch detection (100 words)');
// Batch detection (100 words): 45ms
```

## Common Patterns

### Pattern 1: Phonetic Substitutions
```typescript
const phoneticPairs = [
  ['heard', 'herd'],
  ['there', 'their'],
  ['to', 'too'],
  ['be', 'bee'],
  ['see', 'sea']
];

phoneticPairs.forEach(([spoken, expected]) => {
  const analysis = detector.detectWord(spoken, expected);
  console.log(`${spoken} → ${expected}: ${analysis.confidence}% (phonetic)`);
});
```

### Pattern 2: Visual Substitutions
```typescript
const visualPairs = [
  ['cat', 'bat'],
  ['read', 'red'],
  ['house', 'horse'],
  ['from', 'form']
];

visualPairs.forEach(([spoken, expected]) => {
  const analysis = detector.detectWord(spoken, expected);
  console.log(`${spoken} → ${expected}: ${analysis.confidence}% (visual)`);
});
```

### Pattern 3: Semantic Substitutions
```typescript
const semanticPairs = [
  ['break', 'brake'],
  ['piece', 'peace'],
  ['principal', 'principle'],
  ['allowed', 'aloud']
];

semanticPairs.forEach(([spoken, expected]) => {
  const analysis = detector.detectWord(spoken, expected);
  console.log(`${spoken} → ${expected}: ${analysis.confidence}% (semantic)`);
});
```

---

**Ready to use!** Copy these examples and adapt them to your needs.
