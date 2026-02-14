# Self-Correction Detection - Examples

## Example 1: Phonetic Correction (Sound-based)

**Scenario:** Student reads "heard" as "herd"

```typescript
const detector = useAdvancedSelfCorrectionDetection();

const analysis = detector.detectCorrection(
  'herd',      // What student said (error)
  'heard',     // What was expected (correction)
  1000         // Time between error and correction (1 second)
);

// Output:
{
  isSelfCorrection: true,
  confidence: 85,
  reason: "Timely correction. Phonetically related. Natural reading flow.",
  correctionType: "phonetic",
  correctionQuality: "excellent",
  strategies: {
    temporal: { score: 100, matched: true },      // 1 second is optimal
    phonetic: { score: 80, matched: true },       // Similar sounds
    semantic: { score: 70, matched: true },       // Makes sense in context
    flowPattern: { score: 70, matched: true }     // Natural correction
  },
  details: {
    errorWord: "herd",
    correctionWord: "heard",
    timeBetweenMs: 1000,
    errorType: "single_character",
    correctionAccuracy: 80,
    naturalFlow: true,
    demonstratesUnderstanding: true
  }
}

// Interpretation:
// ✅ This is a high-confidence self-correction
// ✅ Student demonstrates sound awareness
// ✅ Correction is timely and appropriate
// ✅ Student shows comprehension
```

## Example 2: Semantic Correction (Meaning-based)

**Scenario:** Student reads "the" as "a"

```typescript
const detector = useAdvancedSelfCorrectionDetection();

const analysis = detector.detectCorrection(
  'a',         // What student said (error)
  'the',       // What was expected (correction)
  800          // Time between error and correction (0.8 seconds)
);

// Output:
{
  isSelfCorrection: true,
  confidence: 78,
  reason: "Timely correction. Semantically appropriate. Good reading flow.",
  correctionType: "semantic",
  correctionQuality: "good",
  strategies: {
    temporal: { score: 100, matched: true },      // 0.8 seconds is good
    phonetic: { score: 60, matched: true },       // Some phonetic similarity
    semantic: { score: 90, matched: true },       // Semantically correct
    flowPattern: { score: 65, matched: true }     // Good flow
  },
  details: {
    errorWord: "a",
    correctionWord: "the",
    timeBetweenMs: 800,
    errorType: "article_substitution",
    correctionAccuracy: 85,
    naturalFlow: true,
    demonstratesUnderstanding: true
  }
}

// Interpretation:
// ✅ Good self-correction
// ✅ Student demonstrates meaning awareness
// ✅ Correction is quick and appropriate
// ✅ Student shows comprehension
```

## Example 3: Syntactic Correction (Grammar-based)

**Scenario:** Student reads "go" as "goes"

```typescript
const detector = useAdvancedSelfCorrectionDetection();

const analysis = detector.detectCorrection(
  'go',        // What student said (error)
  'goes',      // What was expected (correction)
  1200         // Time between error and correction (1.2 seconds)
);

// Output:
{
  isSelfCorrection: true,
  confidence: 72,
  reason: "Timely correction. Syntactically appropriate. Natural reading flow.",
  correctionType: "syntactic",
  correctionQuality: "good",
  strategies: {
    temporal: { score: 95, matched: true },       // 1.2 seconds is good
    phonetic: { score: 70, matched: true },       // Similar sounds
    semantic: { score: 75, matched: true },       // Semantically correct
    flowPattern: { score: 60, matched: true }     // Acceptable flow
  },
  details: {
    errorWord: "go",
    correctionWord: "goes",
    timeBetweenMs: 1200,
    errorType: "verb_tense",
    correctionAccuracy: 75,
    naturalFlow: true,
    demonstratesUnderstanding: true
  }
}

// Interpretation:
// ✅ Good self-correction
// ✅ Student demonstrates grammar awareness
// ✅ Correction shows verb tense understanding
// ✅ Student shows comprehension
```

## Example 4: Visual Correction (Appearance-based)

**Scenario:** Student reads "cat" as "bat"

```typescript
const detector = useAdvancedSelfCorrectionDetection();

const analysis = detector.detectCorrection(
  'bat',       // What student said (error)
  'cat',       // What was expected (correction)
  900          // Time between error and correction (0.9 seconds)
);

// Output:
{
  isSelfCorrection: true,
  confidence: 68,
  reason: "Timely correction. Visually similar. Acceptable reading flow.",
  correctionType: "visual",
  correctionQuality: "fair",
  strategies: {
    temporal: { score: 100, matched: true },      // 0.9 seconds is optimal
    phonetic: { score: 50, matched: true },       // Some phonetic similarity
    semantic: { score: 65, matched: true },       // Makes sense in context
    flowPattern: { score: 55, matched: true }     // Acceptable flow
  },
  details: {
    errorWord: "bat",
    correctionWord: "cat",
    timeBetweenMs: 900,
    errorType: "initial_consonant",
    correctionAccuracy: 70,
    naturalFlow: true,
    demonstratesUnderstanding: false
  }
}

// Interpretation:
// ✅ Fair self-correction
// ⚠️ Student demonstrates visual processing
// ⚠️ May not demonstrate full comprehension
// ⚠️ Correction is more automatic than understanding-based
```

## Example 5: Low Confidence (Not a Self-Correction)

**Scenario:** Student reads "cat" as "dog" (too different)

```typescript
const detector = useAdvancedSelfCorrectionDetection();

const analysis = detector.detectCorrection(
  'dog',       // What student said (error)
  'cat',       // What was expected (correction)
  3000         // Time between error and correction (3 seconds - too long)
);

// Output:
{
  isSelfCorrection: false,
  confidence: 25,
  reason: "Correction too late. Not phonetically related. Different reading flow.",
  correctionType: "unknown",
  correctionQuality: "poor",
  strategies: {
    temporal: { score: 30, matched: false },      // 3 seconds is too long
    phonetic: { score: 10, matched: false },      // Very different sounds
    semantic: { score: 20, matched: false },      // Different meanings
    flowPattern: { score: 15, matched: false }    // Disrupts flow
  },
  details: {
    errorWord: "dog",
    correctionWord: "cat",
    timeBetweenMs: 3000,
    errorType: "complete_substitution",
    correctionAccuracy: 20,
    naturalFlow: false,
    demonstratesUnderstanding: false
  }
}

// Interpretation:
// ❌ Not a self-correction
// ❌ Correction is too late (3 seconds)
// ❌ Words are too different
// ❌ Likely a different miscue type
```

## Example 6: Batch Processing

**Scenario:** Analyzing multiple corrections in a reading session

```typescript
const detector = useAdvancedSelfCorrectionDetection();

const analyses = detector.detectBatch(
  ['herd', 'a', 'go', 'bat'],           // Error words
  ['heard', 'the', 'goes', 'cat'],      // Correction words
  [1000, 800, 1200, 900]                // Time between errors and corrections
);

// Output: Array of 4 analyses (as shown in Examples 1-4)

// Get statistics
const stats = detector.getStats(analyses);

// Output:
{
  total: 4,
  selfCorrections: 4,
  selfCorrectionRate: 100,
  averageConfidence: 75.75,
  quality: {
    excellent: 1,
    good: 2,
    fair: 1,
    poor: 0
  },
  types: {
    phonetic: 1,
    semantic: 1,
    syntactic: 1,
    visual: 1,
    unknown: 0
  },
  averageTimeBetweenMs: 975
}

// Interpretation:
// ✅ 100% self-correction rate (all 4 were self-corrections)
// ✅ Average confidence: 75.75% (good)
// ✅ Mix of correction types (diverse skills)
// ✅ Average timing: 975ms (optimal)
```

## Example 7: Comprehension Assessment

**Scenario:** Assessing student comprehension from corrections

```typescript
const detector = useAdvancedSelfCorrectionDetection();

// Analyze multiple corrections
const analyses = detector.detectBatch(
  ['herd', 'a', 'go', 'bat'],
  ['heard', 'the', 'goes', 'cat'],
  [1000, 800, 1200, 900]
);

// Assess comprehension
const comprehension = detector.assessComprehension(analyses);

// Output:
{
  comprehensionLevel: "high",
  score: 82,
  indicators: {
    selfCorrectionFrequency: "high",
    correctionQuality: "good",
    correctionTypes: "diverse",
    timing: "optimal",
    understanding: "demonstrated"
  },
  insights: [
    "Student demonstrates strong self-monitoring",
    "Frequent, high-quality corrections indicate comprehension",
    "Mix of correction types shows diverse skills",
    "Timely corrections suggest active reading"
  ],
  recommendations: [
    "Continue encouraging self-correction",
    "Focus on semantic understanding",
    "Provide more challenging texts"
  ]
}

// Interpretation:
// ✅ High comprehension level
// ✅ Student is actively monitoring their reading
// ✅ Diverse correction types show multiple skills
// ✅ Ready for more challenging material
```

## Example 8: Student Pattern Analysis

**Scenario:** Identifying student's correction patterns

```typescript
const detector = useAdvancedSelfCorrectionDetection();

// Analyze multiple corrections
const analyses = detector.detectBatch(
  ['herd', 'a', 'go', 'bat', 'think', 'is'],
  ['heard', 'the', 'goes', 'cat', 'fink', 'are'],
  [1000, 800, 1200, 900, 950, 1100]
);

// Get student patterns
const patterns = detector.getPatterns(analyses);

// Output:
{
  mostCommonType: "phonetic",
  typeDistribution: {
    phonetic: 3,
    semantic: 1,
    syntactic: 1,
    visual: 1
  },
  averageQuality: "good",
  qualityDistribution: {
    excellent: 1,
    good: 3,
    fair: 2,
    poor: 0
  },
  averageConfidence: 76,
  strengthAreas: [
    "Sound awareness (phonetic corrections)",
    "Timely corrections (average 975ms)",
    "Consistent self-monitoring"
  ],
  developmentAreas: [
    "Semantic understanding (only 1 semantic correction)",
    "Visual processing (only 1 visual correction)",
    "Grammar awareness (only 1 syntactic correction)"
  ],
  recommendations: [
    "Focus on semantic understanding activities",
    "Practice visual discrimination exercises",
    "Strengthen grammar awareness through targeted instruction"
  ]
}

// Interpretation:
// ✅ Student's strength: Sound awareness
// ⚠️ Development areas: Meaning and grammar
// ✅ Consistent self-monitoring
// 📋 Recommendations for targeted instruction
```

## Example 9: Configuration Options

**Scenario:** Adjusting detection sensitivity

```typescript
// Strict mode (fewer false positives)
const strictDetector = useAdvancedSelfCorrectionDetection({
  minConfidence: 75,      // Higher threshold
  strictMode: true,       // Stricter matching
  enableLogging: true
});

const strictAnalysis = strictDetector.detectCorrection('herd', 'heard', 1000);
// Result: Only very confident corrections are recorded

// Lenient mode (catches more corrections)
const lenientDetector = useAdvancedSelfCorrectionDetection({
  minConfidence: 50,      // Lower threshold
  strictMode: false,      // More lenient matching
  enableLogging: true
});

const lenientAnalysis = lenientDetector.detectCorrection('herd', 'heard', 1000);
// Result: More corrections are recorded, including borderline cases

// Tagalog language support
const tagalogDetector = useAdvancedSelfCorrectionDetection({
  language: 'tagalog',    // Tagalog patterns
  minConfidence: 60,
  enableLogging: true
});

const tagalogAnalysis = tagalogDetector.detectCorrection('nag-aral', 'nag-aaral', 1000);
// Result: Uses Tagalog-specific patterns for detection
```

## Example 10: Integration with Reading Session

**Scenario:** Real-world integration in ReadingSessionPage

```typescript
// In ReadingSessionPage.tsx
const selfCorrectionDetector = useAdvancedSelfCorrectionDetection({
  minConfidence: 60,
  language: 'english',
  strictMode: false,
  enableLogging: false
});

// When self-correction is detected
case 'selfCorrection':
  const expectedWord = words[oldPosition] || '';
  const selfCorrectionAnalysis = selfCorrectionDetector.detectCorrection(
    word,                                          // Spoken word
    expectedWord,                                  // Expected word
    Date.now() - lastWordTimestampRef.current     // Time between error and correction
  );
  
  if (selfCorrectionAnalysis.isSelfCorrection) {
    // Record as self-correction (not counted as miscue)
    setWordMiscues(prev => new Map(prev).set(oldPosition, 'selfCorrection'));
    setRecognizedWords(prev => new Set(prev).add(oldPosition));
    
    // Log for teacher review
    console.log(`✅ Self-correction: "${word}" → "${expectedWord}" (${selfCorrectionAnalysis.confidence}%)`);
  } else {
    // Low confidence - might be a different miscue type
    console.log(`⚠️ Low confidence: "${word}" → "${expectedWord}" (${selfCorrectionAnalysis.confidence}%)`);
  }
  
  wordStateManager.updateWordStatus(oldPosition, 'miscue', 'selfCorrection', word);
  wordStateManager.advanceToWord(new_position);
  break;

// At end of session, assess comprehension
const comprehension = selfCorrectionDetector.assessComprehension(allAnalyses);
console.log(`Comprehension Level: ${comprehension.comprehensionLevel}`);
console.log(`Score: ${comprehension.score}`);
```

## Summary

These examples demonstrate:
1. ✅ Phonetic corrections (sound-based)
2. ✅ Semantic corrections (meaning-based)
3. ✅ Syntactic corrections (grammar-based)
4. ✅ Visual corrections (appearance-based)
5. ✅ Low confidence detections (not self-corrections)
6. ✅ Batch processing for multiple corrections
7. ✅ Comprehension assessment
8. ✅ Student pattern analysis
9. ✅ Configuration options
10. ✅ Real-world integration

For more details, see [Full Guide](./SELF_CORRECTION_DETECTION_GUIDE.md) and [Quick Reference](./SELF_CORRECTION_QUICK_REFERENCE.md).
