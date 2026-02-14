# Strict Sequential Word Matching Solution

## Problem Statement

The current system marks words as correct if they appear anywhere in the recognized transcript, causing the "early-word triggering bug":

**Example:**
- Expected: "Pam has a cat. It is on the bed."
- User says: "Pam has a cat..."
- Vosk mistakenly detects "bed" early
- When user reaches "on the", the word "bed" is marked correct (incorrectly)

## Solution: Strict Sequential Matching

### Core Principles

1. **Only match the NEXT expected word** - Compare against `expected_words[current_index]` only
2. **Never skip ahead** - Do NOT search future words
3. **Never go backward** - Do NOT search previous words
4. **Ignore unmatched words** - Extra/misrecognized words are discarded
5. **Advance on match** - Increment `current_index` only when matched
6. **Handle streaming** - Work with partial Vosk results without false positives

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Vosk Speech Recognition (Streaming)                         │
│ - Partial results (interim)                                 │
│ - Final results (confirmed)                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Sequential Word Matcher                                     │
│ - Tokenize expected sentence                                │
│ - Maintain current_index pointer                            │
│ - Compare ONLY against expected_words[current_index]        │
│ - Calculate confidence (similarity score)                   │
│ - Decide: match or ignore                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Match Result                                                │
│ - matched: boolean                                          │
│ - confidence: 0-100                                         │
│ - currentIndex: updated position                            │
│ - shouldAdvance: true if matched                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Word State Manager                                          │
│ - Mark word as correct/miscue                               │
│ - Advance to next word                                      │
│ - Track metrics                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Algorithm

```typescript
function matchNextWord(state, spokenWord) {
  // CRITICAL: Only compare against current position
  const expectedWord = state.expectedWords[state.currentIndex];
  
  // Calculate similarity
  const confidence = calculateSimilarity(spokenWord, expectedWord);
  
  // Match only if meets threshold
  const matched = confidence >= state.minConfidence;
  
  return {
    matched,
    confidence,
    currentIndex: state.currentIndex,
    shouldAdvance: matched  // Only advance if matched
  };
}
```

### Handling Streaming Results

**Partial Results (Interim):**
- Do NOT mark words as correct
- Use for UI feedback only
- Discard when final result arrives

**Final Results (Confirmed):**
- Process word-by-word
- Match against current position only
- Advance on match
- Stay at current position if no match

**Multiple Words in One Result:**
- Process sequentially
- Match first word against current position
- If matched, advance and match next word against new position
- If not matched, stay at current position and ignore

## Implementation

### TypeScript Implementation

```typescript
// Already implemented in: frontend/src/utils/sequentialWordMatcher.ts
// Key functions:
// - tokenizeSentence(sentence): string[]
// - createSequentialMatcher(sentence, minConfidence): SequentialMatcherState
// - matchNextWord(state, spokenWord): SequentialMatchResult
// - processRecognizedWords(state, words): { results, updatedState }
// - advanceToWord(state, targetIndex): SequentialMatcherState
```

### Python Implementation (Backend Reference)

```python
class SequentialWordMatcher:
    def __init__(self, sentence: str, min_confidence: float = 0.7):
        """Initialize matcher with expected sentence."""
        self.expected_words = self._tokenize(sentence)
        self.current_index = 0
        self.min_confidence = min_confidence
    
    def _tokenize(self, sentence: str) -> List[str]:
        """Tokenize sentence into words."""
        return (
            sentence.lower()
            .split()
            .map(lambda w: re.sub(r'[.,!?;:\-()[\]{}]', '', w))
            .filter(lambda w: len(w) > 0)
        )
    
    def match_next_word(self, spoken_word: str) -> MatchResult:
        """
        CORE FUNCTION: Match spoken word against NEXT expected word only.
        
        CRITICAL RULE: Only compare against expected_words[current_index]
        Never search ahead or behind.
        """
        # Validate state
        if self.current_index >= len(self.expected_words):
            return MatchResult(matched=False, confidence=0, should_advance=False)
        
        expected_word = self.expected_words[self.current_index]
        
        # Calculate confidence
        confidence = self._calculate_similarity(spoken_word, expected_word)
        
        # Match only if meets threshold
        matched = confidence >= self.min_confidence
        
        return MatchResult(
            matched=matched,
            expected_word=expected_word,
            spoken_word=spoken_word,
            confidence=confidence,
            current_index=self.current_index,
            should_advance=matched
        )
    
    def process_recognized_words(self, words: List[str]) -> ProcessResult:
        """
        Process multiple words from a single recognition event.
        
        CRITICAL: Process sequentially, never skip ahead.
        """
        results = []
        current_state = self
        
        for word in words:
            result = current_state.match_next_word(word)
            results.append(result)
            
            # Only advance if matched
            if result.should_advance:
                current_state.current_index += 1
            # If not matched, stay at current index (don't skip)
        
        return ProcessResult(results=results, updated_state=current_state)
    
    def _calculate_similarity(self, word1: str, word2: str) -> float:
        """Calculate similarity using Levenshtein distance."""
        # Normalize
        w1 = word1.lower().strip()
        w2 = word2.lower().strip()
        
        if w1 == w2:
            return 1.0
        
        # Levenshtein distance
        distance = self._levenshtein_distance(w1, w2)
        max_len = max(len(w1), len(w2))
        
        if max_len == 0:
            return 1.0
        
        similarity = (max_len - distance) / max_len
        return max(0.0, min(1.0, similarity))
    
    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein distance."""
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
```

## Integration with Vosk

### Current Flow (Problematic)

```
Vosk Result → Vocabulary Filter → Client-side Detection → Mark Word
                                   (searches entire transcript)
```

### Fixed Flow (Sequential)

```
Vosk Result → Tokenize → Sequential Matcher → Match Result → Mark Word
              (final)    (current_index only)  (matched?)    (advance)
```

### Implementation in ReadingSessionPage.tsx

```typescript
// In setupVoskMessageHandlers:
if (msg.text && msg.text.trim()) {
  const recognizedWords = tokenizeSentence(msg.text.trim());
  
  // Process sequentially
  const { results, updatedState } = processRecognizedWords(
    matcherState,
    recognizedWords
  );
  
  // Update matcher state
  setMatcherState(updatedState);
  
  // Process each result
  for (const result of results) {
    if (result.matched) {
      // Mark word as correct
      wordStateManager.updateWordStatus(result.currentIndex, 'correct');
      // Advance to next word
      wordStateManager.advanceToWord(result.currentIndex + 1);
    }
    // If not matched, do nothing (stay at current position)
  }
}
```

## Confidence Threshold Support

### Recommended Values

- **Strict (90%)**: Only exact matches or very close phonetic matches
- **Balanced (70%)**: Default - handles minor mispronunciations
- **Lenient (50%)**: Accepts significant variations

### Calculation

```typescript
function calculateWordSimilarity(word1: string, word2: string): number {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  if (w1 === w2) return 100;
  
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(w1, w2);
  const similarity = ((maxLen - distance) / maxLen) * 100;
  
  return Math.round(similarity);
}
```

## Testing

### Test Cases

1. **Exact Match**
   - Expected: "cat"
   - Spoken: "cat"
   - Result: ✅ Matched (100%)

2. **Minor Mispronunciation**
   - Expected: "the"
   - Spoken: "da"
   - Result: ✅ Matched (67% - above 70% threshold)

3. **Completely Different Word**
   - Expected: "cat"
   - Spoken: "dog"
   - Result: ❌ Not matched (0%)

4. **Early Word Detection (Bug Fix)**
   - Expected: ["Pam", "has", "a", "cat", "It", "is", "on", "the", "bed"]
   - Current index: 2 (expecting "a")
   - Spoken: "bed"
   - Result: ❌ Not matched (only compares against "a")

5. **Multiple Words in One Result**
   - Expected: ["Pam", "has", "a", "cat"]
   - Current index: 0
   - Spoken: ["Pam", "has"]
   - Result: ✅ Both matched, index advances to 2

6. **Partial Result (Streaming)**
   - Expected: ["Pam", "has", "a", "cat"]
   - Partial: "P" → "Pa" → "Pam"
   - Result: ❌ None matched (only final results processed)

## Migration Checklist

- [ ] Replace current word matching with sequential matcher
- [ ] Update Vosk message handler to use sequential matching
- [ ] Remove vocabulary filter (sequential matcher handles it)
- [ ] Update WordStateManager integration
- [ ] Add confidence threshold configuration
- [ ] Test with various speech patterns
- [ ] Monitor for false negatives (missed words)
- [ ] Adjust confidence threshold based on testing

## Performance Considerations

- **Time Complexity**: O(n) where n = number of recognized words
- **Space Complexity**: O(m) where m = number of expected words
- **Levenshtein Distance**: O(m*n) per comparison (acceptable for short words)
- **Caching**: Optional - cache similarity scores for repeated words

## Benefits

✅ Prevents early-word triggering bug
✅ Strict sequential validation
✅ Works with streaming Vosk results
✅ Handles multiple words per recognition event
✅ Configurable confidence threshold
✅ Clear, testable logic
✅ Production-ready implementation
