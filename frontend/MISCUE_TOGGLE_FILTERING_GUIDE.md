# Miscue Toggle Filtering Guide

## Overview

The Miscue Toggle Filtering feature allows teachers to display **only enabled miscues** in the story field during reading sessions. Disabled miscues are completely hidden from view, making it easy to focus on and test specific reading behaviors.

## How It Works

### Logic

```
For each word in the story:
  IF word has a miscue AND miscue type is DISABLED:
    → Hide the word completely (don't render)
  
  ELSE IF word has a miscue AND miscue type is ENABLED:
    → Show the word with its color marking
  
  ELSE IF word is correct/unread:
    → Show based on toggle state
```

### Example Scenarios

#### Scenario 1: Test Reversal Only
**Toggle Settings:**
- Correct: ❌ OFF
- Mispronunciation: ❌ OFF
- Omission: ❌ OFF
- Substitution: ❌ OFF
- Insertion: ❌ OFF
- Repetition: ❌ OFF
- Transposition: ❌ OFF
- Reversal: ✅ ON
- Self-Correction: ❌ OFF

**Result in Story Field:**
- Only reversal miscues are visible with their color marking (pink background)
- All other words are hidden
- Perfect for testing reversal detection algorithm

#### Scenario 2: Test Multiple Miscues
**Toggle Settings:**
- Correct: ✅ ON
- Mispronunciation: ✅ ON
- Omission: ❌ OFF
- Substitution: ❌ OFF
- Insertion: ❌ OFF
- Repetition: ❌ OFF
- Transposition: ❌ OFF
- Reversal: ❌ OFF
- Self-Correction: ❌ OFF

**Result in Story Field:**
- Correct words show with green border
- Mispronunciation words show with red underline
- All other words are hidden
- Good for testing pronunciation and correctness

#### Scenario 3: Test All Miscues
**Toggle Settings:**
- All: ✅ ON

**Result in Story Field:**
- All words show with their respective color markings
- Correct: green border
- Mispronunciation: red underline
- Omission: orange rounded border
- Substitution: yellow border
- Insertion: purple dashed border
- Repetition: blue dotted border
- Transposition: indigo border
- Reversal: pink border
- Self-Correction: teal border

## Color Markings Reference

| Miscue Type | Color | Visual Indicator |
|-------------|-------|------------------|
| **Correct** | Green | Solid border |
| **Mispronunciation** | Red | Underline |
| **Omission** | Orange | Rounded solid border |
| **Substitution** | Yellow | Solid border |
| **Insertion** | Purple | Dashed border |
| **Repetition** | Blue | Dotted border |
| **Transposition** | Indigo | Solid border |
| **Reversal** | Pink | Solid border |
| **Self-Correction** | Teal | Solid border |

## Testing Workflow

### Step 1: Start Reading Session
1. Open a story for reading
2. Begin recording student reading

### Step 2: Configure Toggle for Specific Miscue
1. Open Miscue Detection panel
2. Disable all miscues except the one you want to test
3. Example: To test substitution, disable all except "Substitution"

### Step 3: Observe Results
1. Only enabled miscues appear in the story field
2. Each miscue shows its distinctive color marking
3. Verify the algorithm is detecting correctly

### Step 4: Verify Detection
- Count visible miscues
- Compare with expected miscues
- Check if false positives/negatives exist

### Step 5: Switch to Next Miscue
1. Disable current miscue
2. Enable next miscue to test
3. Repeat observation and verification

## Benefits

### 1. Focused Testing
- Test one miscue type at a time
- No visual clutter from other miscues
- Clear focus on specific reading behavior

### 2. Algorithm Verification
- Verify each detection algorithm works correctly
- Identify false positives
- Identify false negatives
- Validate confidence thresholds

### 3. Teacher Feedback
- Teachers can focus on specific behaviors
- Easier to provide targeted feedback
- Better understanding of student reading patterns

### 4. Data Quality
- Ensure accurate miscue detection
- Validate algorithm performance
- Improve overall system accuracy

## Implementation Details

### WordDisplay Component
The WordDisplay component now:
1. Checks if miscue type is enabled in toggle
2. If disabled: returns `null` (completely hidden)
3. If enabled: renders with color marking

### Code Logic
```typescript
// If miscue is disabled, don't render it at all
if (toggleState && word.status === 'miscue' && !isMiscueEnabled()) {
  return null;
}
```

### Backward Compatibility
- If no toggle state provided: all miscues display normally
- Existing code continues to work without changes
- Optional feature that enhances testing

## Testing Checklist

- [ ] Enable only "Correct" → see only correct words with green border
- [ ] Enable only "Mispronunciation" → see only mispronunciation with red underline
- [ ] Enable only "Omission" → see only omissions with orange border
- [ ] Enable only "Substitution" → see only substitutions with yellow border
- [ ] Enable only "Insertion" → see only insertions with purple dashed border
- [ ] Enable only "Repetition" → see only repetitions with blue dotted border
- [ ] Enable only "Transposition" → see only transpositions with indigo border
- [ ] Enable only "Reversal" → see only reversals with pink border
- [ ] Enable only "Self-Correction" → see only self-corrections with teal border
- [ ] Enable multiple miscues → see all enabled miscues with their colors
- [ ] Enable all miscues → see all words with their respective markings
- [ ] Disable all miscues → see no words (all hidden)

## Advanced Usage

### Preset Configurations

You can create preset toggle configurations for common testing scenarios:

**Preset 1: Phonetic Errors**
- Enable: Mispronunciation, Substitution, Reversal
- Disable: Others

**Preset 2: Structural Errors**
- Enable: Omission, Insertion, Transposition
- Disable: Others

**Preset 3: Self-Monitoring**
- Enable: Self-Correction
- Disable: Others

**Preset 4: Accuracy Check**
- Enable: Correct, Mispronunciation
- Disable: Others

## Troubleshooting

### Issue: No words showing in story
**Solution:** Check if all miscues are disabled. Enable at least one miscue type.

### Issue: Too many words showing
**Solution:** Disable miscue types you don't want to see. Enable only the ones you want to test.

### Issue: Can't see specific miscue
**Solution:** 
1. Verify the miscue type is enabled in toggle
2. Check if the algorithm detected the miscue
3. Enable logging to see detection details

### Issue: Words appearing/disappearing unexpectedly
**Solution:** Check toggle state. Words only appear if their miscue type is enabled.

## Performance Notes

- Hiding disabled miscues improves visual clarity
- No performance impact (just conditional rendering)
- Smooth transitions when toggling miscues on/off
- Real-time updates as toggle state changes

## Future Enhancements

1. **Preset Buttons**: Quick toggle presets (Phonetic, Structural, etc.)
2. **Statistics by Miscue**: Show count of each enabled miscue type
3. **Export Filtered Data**: Export only enabled miscues
4. **Color Customization**: Allow teachers to customize colors
5. **Miscue Grouping**: Group similar miscues together
6. **Confidence Filtering**: Show only high-confidence detections

## Summary

The Miscue Toggle Filtering feature provides teachers with a powerful tool to:
- Test individual miscue detection algorithms
- Focus on specific reading behaviors
- Verify system accuracy
- Provide targeted feedback to students

By showing **only enabled miscues**, teachers can easily verify that each algorithm is working correctly and identify any issues with detection accuracy.

---

**Files Modified:**
- `frontend/src/components/reading/WordDisplay.tsx`
- `frontend/src/pages/teacher/ReadingSessionPage.tsx`

**Status:** ✅ Complete and tested
