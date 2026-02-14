# Substitution Detection - Deployment Guide

## Overview

This guide walks through deploying the optimized substitution detection algorithm to production.

## Pre-Deployment Checklist

- [x] Algorithm implemented and tested
- [x] Documentation complete
- [x] Code quality verified (no diagnostics)
- [x] Backward compatibility confirmed
- [ ] Performance tested in staging
- [ ] Team review completed
- [ ] Rollback plan prepared
- [ ] Monitoring configured

## Deployment Steps

### Step 1: Backup Current Implementation

```bash
# Create backup of original substitution.ts
cp DETECTION/substitution.ts DETECTION/substitution.ts.backup
```

### Step 2: Update Imports

Replace all imports of the old module with the new one:

```typescript
// Old
import { detectSubstitution } from './substitution';

// New
import { detectSubstitution } from './substitution-optimized';
```

**Files to update:**
- `frontend/src/components/reading/*.tsx`
- `backend/server/services/*.ts`
- Any other files importing substitution detection

### Step 3: Verify Configuration

Check if any custom configuration is needed:

```typescript
// Default configuration (no changes needed)
const config: SubstitutionConfig = {
  similarityThreshold: 0.55,      // Default
  lookAheadWindow: 5,              // Default
  language: 'english',             // Default
  editDistanceWeight: 0.4,         // Default
  phoneticPatternWeight: 0.35,     // Default
  lengthSimilarityWeight: 0.25     // Default
};
```

### Step 4: Run Tests

```bash
# Run the test suite
npm test -- DETECTION/substitution-optimized.test.ts

# Expected output: All 40+ tests pass
```

### Step 5: Integration Testing

Test with real reading data:

```typescript
import { detectSubstitution } from './substitution-optimized';

// Test with sample reading session
const testCases = [
  { spoken: 'the', expected: 'the', position: 0 },
  { spoken: 'cat', expected: 'dog', position: 1 },
  { spoken: 'sat', expected: 'sat', position: 2 },
  // ... more test cases
];

testCases.forEach(test => {
  const result = detectSubstitution(
    test.spoken,
    test.expected,
    test.position,
    storyWords
  );
  console.log(`${test.spoken} vs ${test.expected}: ${result.matchType}`);
});
```

### Step 6: Performance Testing

Verify performance meets requirements:

```typescript
import { detectSubstitution } from './substitution-optimized';

// Measure execution time
const startTime = performance.now();

for (let i = 0; i < 1000; i++) {
  detectSubstitution('cat', 'dog', i % 100, storyWords);
}

const endTime = performance.now();
const avgTime = (endTime - startTime) / 1000;

console.log(`Average time per detection: ${avgTime.toFixed(3)}ms`);
// Expected: < 0.1ms per detection
```

### Step 7: Staging Deployment

Deploy to staging environment:

```bash
# Build staging version
npm run build:staging

# Deploy to staging
npm run deploy:staging

# Run smoke tests
npm run test:staging
```

### Step 8: Production Deployment

Deploy to production:

```bash
# Build production version
npm run build:production

# Deploy to production
npm run deploy:production

# Verify deployment
npm run verify:production
```

## Rollback Plan

If issues occur, rollback to previous version:

```bash
# Restore backup
cp DETECTION/substitution.ts.backup DETECTION/substitution.ts

# Revert imports
# (Update all files to use old import)

# Rebuild and redeploy
npm run build:production
npm run deploy:production
```

## Monitoring

### Key Metrics to Monitor

1. **Detection Accuracy**
   - Substitution detection rate
   - False positive rate
   - False negative rate

2. **Performance**
   - Average detection time
   - Peak detection time
   - Memory usage

3. **Error Rates**
   - Validation errors
   - Edge case failures
   - Unexpected exceptions

### Monitoring Setup

```typescript
// Add monitoring to detection function
import { detectSubstitution } from './substitution-optimized';

export function monitoredDetectSubstitution(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  storyWords: string[],
  config?: SubstitutionConfig
) {
  const startTime = performance.now();
  
  try {
    const result = detectSubstitution(
      spokenWord,
      expectedWord,
      currentPosition,
      storyWords,
      config
    );
    
    const duration = performance.now() - startTime;
    
    // Log metrics
    metrics.recordDetectionTime(duration);
    metrics.recordDetectionType(result.matchType);
    
    return result;
  } catch (error) {
    metrics.recordError(error);
    throw error;
  }
}
```

### Logging

```typescript
// Add detailed logging
import { detectSubstitution } from './substitution-optimized';

export function loggedDetectSubstitution(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  storyWords: string[],
  config?: SubstitutionConfig
) {
  logger.debug('Substitution detection started', {
    spokenWord,
    expectedWord,
    position: currentPosition,
    storyLength: storyWords.length
  });
  
  const result = detectSubstitution(
    spokenWord,
    expectedWord,
    currentPosition,
    storyWords,
    config
  );
  
  logger.debug('Substitution detection completed', {
    matchType: result.matchType,
    similarity: result.similarityScore,
    advance: result.advance
  });
  
  return result;
}
```

## Configuration Tuning

### For Different Scenarios

#### Scenario 1: Strict Assessment (Conservative)
```typescript
const config: SubstitutionConfig = {
  similarityThreshold: 0.65,
  editDistanceWeight: 0.5,
  phoneticPatternWeight: 0.3,
  lengthSimilarityWeight: 0.2
};
```

#### Scenario 2: Balanced (Default)
```typescript
const config: SubstitutionConfig = {
  similarityThreshold: 0.55,
  editDistanceWeight: 0.4,
  phoneticPatternWeight: 0.35,
  lengthSimilarityWeight: 0.25
};
```

#### Scenario 3: Lenient Assessment (Aggressive)
```typescript
const config: SubstitutionConfig = {
  similarityThreshold: 0.45,
  editDistanceWeight: 0.3,
  phoneticPatternWeight: 0.4,
  lengthSimilarityWeight: 0.3
};
```

## Troubleshooting

### Issue: Too Many False Positives

**Symptoms:** Words marked as substitutions that shouldn't be

**Solution:**
1. Increase `similarityThreshold` (e.g., 0.60)
2. Increase `editDistanceWeight` (e.g., 0.5)
3. Check ghost word filter

```typescript
const config: SubstitutionConfig = {
  similarityThreshold: 0.60,
  editDistanceWeight: 0.5
};
```

### Issue: Too Many False Negatives

**Symptoms:** Substitutions not being detected

**Solution:**
1. Decrease `similarityThreshold` (e.g., 0.50)
2. Decrease `editDistanceWeight` (e.g., 0.3)
3. Increase `phoneticPatternWeight` (e.g., 0.4)

```typescript
const config: SubstitutionConfig = {
  similarityThreshold: 0.50,
  editDistanceWeight: 0.3,
  phoneticPatternWeight: 0.4
};
```

### Issue: Performance Degradation

**Symptoms:** Detection taking too long

**Solution:**
1. Reduce `lookAheadWindow` (e.g., 3)
2. Cache similarity calculations
3. Use parallel processing

```typescript
const config: SubstitutionConfig = {
  lookAheadWindow: 3
};
```

### Issue: Language-Specific Issues

**Symptoms:** Tagalog words not detected correctly

**Solution:**
1. Set `language: 'tagalog'`
2. Adjust weights for Tagalog phonetics
3. Verify ghost word filter

```typescript
const config: SubstitutionConfig = {
  language: 'tagalog',
  phoneticPatternWeight: 0.4
};
```

## Performance Optimization

### Caching Strategy

```typescript
// Cache similarity calculations
const similarityCache = new Map<string, number>();

function getCachedSimilarity(word1: string, word2: string): number {
  const key = `${word1}:${word2}`;
  
  if (similarityCache.has(key)) {
    return similarityCache.get(key)!;
  }
  
  const sim = calculateSimilarity(word1, word2).score;
  similarityCache.set(key, sim);
  
  return sim;
}
```

### Parallel Processing

```typescript
// Process multiple detections in parallel
async function detectMultipleSubstitutions(
  spokenWords: string[],
  expectedWords: string[],
  storyWords: string[]
): Promise<SubstitutionResult[]> {
  return Promise.all(
    spokenWords.map((spoken, i) =>
      Promise.resolve(
        detectSubstitution(
          spoken,
          expectedWords[i],
          i,
          storyWords
        )
      )
    )
  );
}
```

## Validation

### Pre-Deployment Validation

```typescript
// Validate algorithm behavior
function validateAlgorithm(): boolean {
  const tests = [
    // Test 1: Exact match
    {
      spoken: 'dog',
      expected: 'dog',
      expected_type: 'no_match'
    },
    // Test 2: Clear substitution
    {
      spoken: 'cat',
      expected: 'dog',
      expected_type: 'substitution'
    },
    // Test 3: Mispronunciation
    {
      spoken: 'bat',
      expected: 'cat',
      expected_type: 'no_match'
    }
  ];
  
  return tests.every(test => {
    const result = detectSubstitution(
      test.spoken,
      test.expected,
      0,
      ['dog', 'runs']
    );
    return result.matchType === test.expected_type;
  });
}

if (!validateAlgorithm()) {
  throw new Error('Algorithm validation failed');
}
```

## Post-Deployment

### Day 1 Monitoring

- Monitor error rates
- Check performance metrics
- Verify accuracy
- Gather user feedback

### Week 1 Review

- Analyze detection patterns
- Compare with baseline
- Identify any issues
- Adjust configuration if needed

### Month 1 Analysis

- Full accuracy analysis
- Performance review
- User satisfaction survey
- Plan for optimizations

## Documentation Updates

Update the following documentation:

1. **README.md** - Add reference to optimized version
2. **API Documentation** - Update with new features
3. **User Guide** - Explain new capabilities
4. **Developer Guide** - Update integration instructions

## Team Communication

### Announcement

```
Subject: Substitution Detection Algorithm Upgrade

We're deploying an optimized substitution detection algorithm that:
- Improves accuracy with multi-factor similarity analysis
- Handles speech recognition errors better
- Provides detailed similarity breakdowns
- Maintains backward compatibility

Deployment: [Date]
Expected impact: Improved reading assessment accuracy
Rollback plan: Available if needed
```

### Training

- Conduct team training on new features
- Share documentation
- Provide code examples
- Answer questions

## Success Criteria

✓ All tests pass
✓ Performance meets requirements (< 0.1ms per detection)
✓ Accuracy improves by at least 5%
✓ No critical errors in production
✓ User satisfaction maintained or improved
✓ Documentation complete and accurate

## Conclusion

The optimized substitution detection algorithm is ready for production deployment. Follow this guide for a smooth, safe deployment with minimal risk.

For questions or issues, refer to:
- `SUBSTITUTION_OPTIMIZATION_GUIDE.md` - Detailed documentation
- `SUBSTITUTION_QUICK_REFERENCE.md` - Quick reference
- `substitution-optimized.test.ts` - Test examples
