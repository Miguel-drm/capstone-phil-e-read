# Reversal Detection System - Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    READING SESSION PAGE                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Story Loads (Text or PDF)                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Extract Words from Story                                 │  │
│  │ Example: ["map", "saw", "dog", "pat", "rat"]            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Call buildReversedStoryCache(wordArray)                  │  │
│  │ Returns: Map<reversed, original>                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Store in React State: reversedWordsCache                 │  │
│  │ {                                                        │  │
│  │   "pam" → "map",                                         │  │
│  │   "was" → "saw",                                         │  │
│  │   "god" → "dog",                                         │  │
│  │   "tap" → "pat",                                         │  │
│  │   "tar" → "rat"                                          │  │
│  │ }                                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Log Cache to Console                                     │  │
│  │ 🔄 Reversal detection cache built: 5 reversed words      │  │
│  │    Reversed words: "pam" (← "map"), ...                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Word Recognition Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SPEAKS A WORD                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Vosk Speech Recognition                                  │  │
│  │ Input: Audio from microphone                             │  │
│  │ Output: Recognized text (e.g., "pam")                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Vocabulary Filter                                        │  │
│  │ Check if word is in story vocabulary                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Correct Word Detection                                   │  │
│  │ Is "pam" == expected word? NO                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ REVERSAL DETECTION ← NEW FEATURE                         │  │
│  │ Call detectReversalInStory("pam", words, position)       │  │
│  │                                                          │  │
│  │ Function checks:                                         │  │
│  │ 1. Is "pam" in reversedWordsCache? YES                   │  │
│  │ 2. "pam" maps to "map"                                   │  │
│  │ 3. Is "map" in story? YES                                │  │
│  │ 4. Return: matchType = 'reversal'                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Log Reversal Detection                                   │  │
│  │ 🔍 Checking if "pam" is reversal of any word in cache:   │  │
│  │    ["pam" (← "map"), "was" (← "saw"), ...]               │  │
│  │ 🔄 Reversal detected: "pam" is reverse of "map"          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Mark as Reversal Miscue                                  │  │
│  │ - Increment miscue count                                 │  │
│  │ - Mark word as 'reversal' type                           │  │
│  │ - Position does NOT advance                              │  │
│  │ - Continue to next word                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Detection Pipeline

```
                    Spoken Word
                         ↓
                    ┌─────────────┐
                    │ Vocabulary  │
                    │   Filter    │
                    └─────────────┘
                         ↓
                    ┌─────────────┐
                    │  Correct    │
                    │   Word?     │
                    └─────────────┘
                    ↙           ↘
                  YES            NO
                   ↓              ↓
              ADVANCE      ┌─────────────┐
              POSITION     │  Reversal   │
                           │ Detection?  │
                           └─────────────┘
                           ↙           ↘
                         YES            NO
                          ↓              ↓
                      MARK AS      ┌─────────────┐
                      REVERSAL     │  Omission   │
                      (NO ADVANCE) │ Detection?  │
                                   └─────────────┘
                                   ↙           ↘
                                 YES            NO
                                  ↓              ↓
                              MARK AS      MARK AS
                              OMISSION     INCORRECT
                              (ADVANCE)    (NO ADVANCE)
```

## Cache Building Process

```
Story Text
    ↓
"The map was on the dog"
    ↓
Split into words
    ↓
["The", "map", "was", "on", "the", "dog"]
    ↓
Normalize (lowercase, remove punctuation)
    ↓
["the", "map", "was", "on", "the", "dog"]
    ↓
Filter by minimum length (3+ chars)
    ↓
["map", "was", "dog"]
    ↓
Reverse each word
    ↓
["pam", "saw", "god"]
    ↓
Create Map: reversed → original
    ↓
{
  "pam" → "map",
  "saw" → "was",
  "god" → "dog"
}
    ↓
Store in React state
    ↓
Log to console
```

## Console Output Timeline

```
Timeline of Console Logs During Reading Session
═══════════════════════════════════════════════════════════════

[Story Loads]
📖 [Teacher] Setting words: 6 words
🔄 Reversal detection cache built: 3 reversed words available
   Reversed words: "pam" (← "map"), "saw" (← "was"), "god" (← "dog")

[User speaks "pam"]
🎯 Vosk recognized (final): "pam"
✅ Vocabulary filter: Accepted "pam"
🔍 Checking if "pam" is reversal of any word in cache: 
   ["pam" (← "map"), "saw" (← "was"), "god" (← "dog")]
🔄 Reversal detected: Reversal detected in story: "pam" is the reverse of "map" (found in story)

[User speaks "map"]
🎯 Vosk recognized (final): "map"
✅ Vocabulary filter: Accepted "map"
✅ Client-side detection: Correct word match

[User speaks "was"]
🎯 Vosk recognized (final): "was"
✅ Vocabulary filter: Accepted "was"
✅ Client-side detection: Correct word match

[User speaks "saw"]
🎯 Vosk recognized (final): "saw"
✅ Vocabulary filter: Accepted "saw"
🔍 Checking if "saw" is reversal of any word in cache:
   ["pam" (← "map"), "saw" (← "was"), "god" (← "dog")]
🔄 Reversal detected: Reversal detected in story: "saw" is the reverse of "was" (found in story)
```

## State Management

```
React Component State
═════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│ const [words, setWords] = useState<string[]>([])        │
│ Example: ["map", "was", "dog", "pat", "rat"]           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ const [reversedWordsCache, setReversedWordsCache] =     │
│   useState<Map<string, string>>(new Map())              │
│                                                         │
│ Example:                                                │
│ Map {                                                   │
│   "pam" → "map",                                        │
│   "was" → "saw",                                        │
│   "god" → "dog",                                        │
│   "tap" → "pat",                                        │
│   "tar" → "rat"                                         │
│ }                                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ const [currentWordIndex, setCurrentWordIndex] =         │
│   useState<number>(0)                                   │
│ Example: 0 (pointing to "map")                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ const [miscueTypes, setMiscueTypes] = useState({...})   │
│ Example: {                                              │
│   correct: 3,                                           │
│   reversal: 2,  ← Incremented when reversal detected   │
│   omission: 1,                                          │
│   substitution: 0,                                      │
│   ...                                                   │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
Operation Performance
═════════════════════════════════════════════════════════════

Cache Building:
  Input: 100 words
  Time: ~5ms
  Memory: ~1KB
  
Cache Lookup:
  Operation: Map.get(reversedWord)
  Time: O(1) - constant time
  Latency: < 1μs
  
Reversal Detection:
  Input: Spoken word
  Time: < 1ms
  Includes: Normalization + cache lookup + logging
  
Total Detection Pipeline:
  Input: Audio from microphone
  Time: ~50-100ms
  Includes: Vosk recognition + vocabulary filter + detection
```

## Error Handling

```
Error Scenarios
═════════════════════════════════════════════════════════════

Scenario 1: Empty Story
  Cache size: 0
  Log: "🔄 Reversal detection cache built: 0 reversed words available"
  Behavior: No reversals can be detected

Scenario 2: No Reversible Words
  Cache size: 0
  Log: "🔄 Reversal detection cache built: 0 reversed words available"
  Behavior: No reversals can be detected

Scenario 3: Short Words (< 3 chars)
  Example: "at", "to", "is"
  Behavior: Not cached (minimum length requirement)
  Reason: Too short to be meaningful reversals

Scenario 4: Cache Not Initialized
  Log: "🔍 Checking if "pam" is reversal - cache empty or not initialized"
  Behavior: Reversal detection skipped, continue to omission
```

---

This flow diagram shows how the reversal detection system works from story load through word recognition and miscue detection.
