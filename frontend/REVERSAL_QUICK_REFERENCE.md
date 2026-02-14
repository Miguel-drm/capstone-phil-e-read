# Reversal Detection - Quick Reference Card

## Problem
Student says "on" (reversal of "no") → System marks as OMISSION ❌

## Solution
Story-based reversal detection → System marks as REVERSAL ✓

## Quick Integration (3 Steps)

### 1. Import Hook
```typescript
import { useReversalDetection } from '@/hooks/useReversalDetection';
```

### 2. Initialize
```typescript
const reversalDetection = useReversalDetection(storyWords, 'standard');
```

### 3. Check in Pipeline
```typescript
// BEFORE omission check
const result = reversalDetection.checkReversal(spokenWord, position);
if (reversalDetection.hasReversal(result)) {
  wordStateManager.handleMiscueMarking('reversal', spokenWord);
  return;
}
```

## API Reference

### Hook: `useReversalDetection(storyWords, preset?, customConfig?)`

**Parameters:**
- `storyWords: string[]` - Array of words from story
- `preset?: 'strict' | 'standard' | 'lenient' | 'tagalog'` - Configuration preset (default: 'standard')
- `customConfig?: ReversalConfig` - Optional custom configuration

**Returns:**
```typescript
{
  isInitialized: boolean,
  state: ReversalDetectionState | null,
  checkReversal: (spokenWord, position) => ReversalResult,
  checkDirectReversal: (spokenWord, expectedWord, position) => ReversalResult,
  hasReversal: (result) => boolean,
  getOriginalWord: (result) => string | null,
  formatResult: (result) => string,
  getConfig: () => ReversalConfig | null,
  updateConfig: (newConfig) => void
}
```

### Methods

#### `checkReversal(spokenWord, position)`
Check if word is reversal of ANY word in story (story-based)
```typescript
const result = reversalDetection.checkReversal('on', 0);
// Returns: { matchType: 'reversal', originalWord: 'no', ... }
```

#### `checkDirectReversal(spokenWord, expectedWord, position)`
Check if word is reversal of expected word (direct)
```typescript
const result = reversalDetection.checkDirectReversal('saw', 'was', 0);
// Returns: { matchType: 'reversal', expectedWord: 'was', ... }
```

#### `hasReversal(result)`
Check if reversal was detected
```typescript
if (reversalDetection.hasReversal(result)) {
  // Handle reversal
}
```

#### `getOriginalWord(result)`
Get the original word that was reversed
```typescript
const original = reversalDetection.getOriginalWord(result);
// Returns: 'no' (if result is reversal of 'no')
```

#### `formatResult(result)`
Format result for display
```typescript
const message = reversalDetection.formatResult(result);
// Returns: 'Reversal: "on" is "no" reversed'
```

## Configuration Presets

| Preset | Min Length | Use Case |
|--------|-----------|----------|
| `strict` | 3+ chars | Reduce false positives |
| `standard` | 2+ chars | Default, balanced |
| `lenient` | 1+ chars | Catch all reversals |
| `tagalog` | 2+ chars | Tagalog language |

## Detection Pipeline

```
Correct? → Direct Reversal? → Story Reversal? → Other Errors?
                                    ↑
                            (prevents false omission)
```

## Key Points

✓ Story-based detection MUST come BEFORE omission check
✓ Position NEVER advances on reversal
✓ Cache is pre-built for efficiency
✓ Handles normalization automatically
✓ Supports streaming recognition

## Example: Complete Integration

```typescript
import { useReversalDetection } from '@/hooks/useReversalDetection';
import { useWordStateManager } from '@/hooks/useWordStateManager';

export const ReadingSession = ({ story }) => {
  const storyWords = story.split(/\s+/);
  const wordStateManager = useWordStateManager();
  const reversalDetection = useReversalDetection(storyWords);

  const processWord = (spokenWord: string) => {
    const current = wordStateManager.getCurrentWord();
    
    // 1. Check correct
    if (spokenWord === current.text) {
      wordStateManager.handleCorrectMatch();
      return;
    }
    
    // 2. Check reversal (prevents false omission)
    const result = reversalDetection.checkReversal(spokenWord, current.index);
    if (reversalDetection.hasReversal(result)) {
      wordStateManager.handleMiscueMarking('reversal', spokenWord);
      return;
    }
    
    // 3. Other errors...
  };

  return <div>{/* UI */}</div>;
};
```

## Testing

```bash
# Run reversal tests
npm test -- DETECTION/reversal.test.ts

# Run with coverage
npm test -- DETECTION/reversal.test.ts --coverage
```

## Files

| File | Purpose |
|------|---------|
| `DETECTION/reversal.ts` | Core detection logic |
| `DETECTION/reversal.test.ts` | Unit tests |
| `frontend/src/utils/reversalDetectionIntegration.ts` | Integration utilities |
| `frontend/src/hooks/useReversalDetection.ts` | React hook |
| `frontend/REVERSAL_INTEGRATION_STEPS.md` | Detailed integration guide |

## Troubleshooting

**Reversal not detected?**
- Is word in story? Check `storyWords.includes(word)`
- Is word long enough? Check `minWordLength` setting
- Is it exactly reversed? Check `reverseWord(word) === spokenWord`

**False positives?**
- Use `strict` preset: `useReversalDetection(storyWords, 'strict')`
- Increase `minWordLength` to 3+

**Performance issues?**
- Cache is pre-built once - should be O(1) per lookup
- Check story size (should be < 1000 words)

## Support

📖 Full docs: `DETECTION/REVERSAL_STORY_BASED_GUIDE.md`
🧪 Tests: `DETECTION/reversal.test.ts`
🔧 Integration: `frontend/REVERSAL_INTEGRATION_STEPS.md`
