# Reversal Integration Checklist

## ✅ Pre-Integration Verification

- [ ] Reversal detection files exist:
  - [ ] `DETECTION/reversal.ts`
  - [ ] `DETECTION/reversal.test.ts`
  - [ ] `DETECTION/reversal.property.ts`

- [ ] Frontend integration files exist:
  - [ ] `frontend/src/utils/reversalDetectionIntegration.ts`
  - [ ] `frontend/src/hooks/useReversalDetection.ts`

- [ ] Tests pass:
  ```bash
  npm test -- DETECTION/reversal.test.ts
  ```

## ✅ Step 1: Import Hook

**File:** `frontend/src/pages/teacher/ReadingSessionPage.tsx` (or your reading session component)

**Add at top:**
```typescript
import { useReversalDetection } from '@/hooks/useReversalDetection';
```

- [ ] Import added
- [ ] No TypeScript errors

## ✅ Step 2: Initialize Hook

**In component:**
```typescript
export const ReadingSessionPage = () => {
  // ... existing code ...
  
  // Get story words
  const storyWords = story.split(/\s+/).filter(word => word.length > 0);
  
  // Initialize reversal detection
  const reversalDetection = useReversalDetection(
    storyWords,
    language === 'tagalog' ? 'tagalog' : 'standard'
  );
  
  // ... rest of component ...
};
```

- [ ] Hook initialized
- [ ] Story words passed correctly
- [ ] Language preset set appropriately

## ✅ Step 3: Add to Detection Pipeline

**Find:** Your word detection/processing function (usually in Vosk message handler)

**Current code looks like:**
```typescript
// Old detection pipeline
if (correctResult.matchType === 'correct') {
  // handle correct
} else if (omissionResult.matchType === 'omission') {
  // handle omission ← PROBLEM: catches reversed words
}
```

**Update to:**
```typescript
// New detection pipeline with reversal check
if (correctResult.matchType === 'correct') {
  // handle correct
} else if (reversalDetection.hasReversal(
  reversalDetection.checkReversal(spokenWord, position)
)) {
  // handle reversal ← NEW: catches reversed words BEFORE omission
  const result = reversalDetection.checkReversal(spokenWord, position);
  wordStateManager.handleMiscueMarking('reversal', spokenWord);
} else if (omissionResult.matchType === 'omission') {
  // handle omission ← Now won't catch reversed words
}
```

- [ ] Reversal check added BEFORE omission check
- [ ] Reversal handling implemented
- [ ] No TypeScript errors

## ✅ Step 4: Test Integration

### Unit Test
```typescript
// In your test file
import { useReversalDetection } from '@/hooks/useReversalDetection';

test('should detect reversal before omission', () => {
  const storyWords = ['It', 'is', 'no', 'the', 'bed'];
  const reversalDetection = useReversalDetection(storyWords);
  
  // Student says "on" (reversal of "no")
  const result = reversalDetection.checkReversal('on', 0);
  
  expect(reversalDetection.hasReversal(result)).toBe(true);
  expect(reversalDetection.getOriginalWord(result)).toBe('no');
});
```

- [ ] Unit test passes
- [ ] Reversal correctly detected
- [ ] Original word correctly identified

### Manual Test
1. [ ] Load a story with reversible words (e.g., "no", "was", "dog")
2. [ ] Student reads a reversed word (e.g., "on" for "no")
3. [ ] Verify it's marked as REVERSAL (not OMISSION)
4. [ ] Verify position doesn't advance
5. [ ] Verify color coding shows reversal (pink background)

## ✅ Step 5: Verify Behavior

### Correct Behavior
- [ ] "on" for "no" → REVERSAL ✓
- [ ] "saw" for "was" → REVERSAL ✓
- [ ] "god" for "dog" → REVERSAL ✓
- [ ] Position doesn't advance on reversal ✓
- [ ] Color shows reversal (pink) ✓

### Incorrect Behavior (Should NOT happen)
- [ ] "on" for "no" → OMISSION ❌
- [ ] Position advances on reversal ❌
- [ ] Color shows omission (orange) ❌

## ✅ Step 6: Configuration

### Choose Preset
- [ ] `'standard'` - Default, 2+ character words (recommended)
- [ ] `'strict'` - 3+ character words, fewer false positives
- [ ] `'lenient'` - All words, more reversals detected
- [ ] `'tagalog'` - For Tagalog language

### Or Custom Config
```typescript
const reversalDetection = useReversalDetection(
  storyWords,
  'standard',
  {
    minWordLength: 3,
    language: 'english',
    confidenceThreshold: 1.0
  }
);
```

- [ ] Configuration chosen
- [ ] Tested with your stories

## ✅ Step 7: Performance Check

```typescript
// Verify cache is built once
console.log('Reversal detection initialized:', reversalDetection.isInitialized);
console.log('Cache size:', reversalDetection.state?.cache?.reversedToOriginal.size);
```

- [ ] Cache initialized once
- [ ] No performance degradation
- [ ] Lookups are fast (O(1))

## ✅ Step 8: Documentation

- [ ] Team notified of integration
- [ ] Documentation updated
- [ ] Code comments added
- [ ] Changelog updated

## ✅ Step 9: Deployment

### Pre-Deployment
- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] Build succeeds: `npm run build`

### Deployment
- [ ] Deploy to staging
- [ ] Test with real data
- [ ] Monitor for issues
- [ ] Deploy to production

### Post-Deployment
- [ ] Monitor error logs
- [ ] Check reversal detection accuracy
- [ ] Gather teacher feedback
- [ ] Adjust configuration if needed

## ✅ Troubleshooting

### Issue: Reversal not detected
- [ ] Check story contains the word
- [ ] Check word length meets minimum
- [ ] Check word is exactly reversed
- [ ] Verify hook is initialized

### Issue: False positives
- [ ] Switch to 'strict' preset
- [ ] Increase minWordLength
- [ ] Check normalization is working

### Issue: Performance slow
- [ ] Check story size (< 1000 words)
- [ ] Verify cache is pre-built
- [ ] Check for memory leaks

## ✅ Rollback Plan

If issues occur:
1. [ ] Revert reversal check from detection pipeline
2. [ ] Keep reversal detection code (for future use)
3. [ ] Notify team
4. [ ] Investigate issue
5. [ ] Re-deploy when fixed

## ✅ Success Criteria

- [ ] "on" for "no" detected as REVERSAL (not OMISSION)
- [ ] Position doesn't advance on reversal
- [ ] Color coding shows reversal (pink)
- [ ] No performance degradation
- [ ] All tests pass
- [ ] Teachers report improved accuracy

## ✅ Sign-Off

- [ ] Developer: _________________ Date: _______
- [ ] QA: _________________ Date: _______
- [ ] Product: _________________ Date: _______

## Quick Reference

**Files to modify:**
- `frontend/src/pages/teacher/ReadingSessionPage.tsx` (or your reading session component)

**Files to add:**
- `frontend/src/utils/reversalDetectionIntegration.ts` ✓ (already created)
- `frontend/src/hooks/useReversalDetection.ts` ✓ (already created)

**Files already exist:**
- `DETECTION/reversal.ts` ✓
- `DETECTION/reversal.test.ts` ✓
- `DETECTION/reversal.property.ts` ✓

**Documentation:**
- `frontend/REVERSAL_INTEGRATION_STEPS.md` - Detailed guide
- `frontend/REVERSAL_QUICK_REFERENCE.md` - Quick reference
- `DETECTION/REVERSAL_STORY_BASED_GUIDE.md` - Technical details
- `DETECTION/FIX_ON_NO_ISSUE.md` - Your specific issue

## Support

For questions or issues:
1. Check `frontend/REVERSAL_INTEGRATION_STEPS.md`
2. Review `frontend/REVERSAL_QUICK_REFERENCE.md`
3. Check test cases in `DETECTION/reversal.test.ts`
4. See `DETECTION/REVERSAL_STORY_BASED_GUIDE.md` for technical details
