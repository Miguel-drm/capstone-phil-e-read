# Debugging Guide - Understanding Console Logs

## Enhanced Logging

The system now has detailed logging to help understand what's happening during word matching.

## Console Log Flow

### 1. Full Transcript Search
```
🔎 Searching for "saw" in full transcript: [He, picked, it, up, and, saw, that]
   ✓ Found match: "saw" matches "saw"
✅ FOUND "saw" in full transcript! Advancing...
```

**What this means:**
- System checks if the expected word is ANYWHERE in the transcript
- If found, advances immediately (fastest path)
- No need for complex matching

### 2. Recent Words Check
```
🔍 Checking 5 RECENT words: [it, up, and, saw, that]
   (2 are NEW from position 5)
```

**What this means:**
- Shows last 5 words from transcript
- Shows how many are NEW (not yet processed)
- Used for matching if word not in full transcript

### 3. Direct Match
```
✅ MATCH! "saw" = "saw"
```

**What this means:**
- Found exact or very close match
- Advances 1 word

### 4. Contains Match
```
✅ CONTAINS MATCH! "loski" contains "lost"
```

**What this means:**
- Spoken word contains the expected word
- Used for fast reading
- Advances 1 word

### 5. Compound Match (2 words)
```
🔬 Compound check: "henoticed" vs "he" + "noticed"
  Exact concat: true
  Contains both in order: true
  Similarity to "henoticed": 100%
  Is blend: true (has "he" and "ed")
✅ COMPOUND MATCH! "henoticed" = "he" + "noticed"
📈 Advancing 2 words from 15 to 17
```

**What this means:**
- Child joined 2 words together
- Multiple validation methods confirm it
- Advances 2 words

### 6. 3-Word Compound Match
```
✅ 3-WORD COMPOUND MATCH! "henoticedsome" = "he" + "noticed" + "something"
📈 Advancing 3 words from 15 to 18
```

**What this means:**
- Child joined 3 words together (very fast reading)
- Advances 3 words

### 7. No Match Found
```
❌ No match found in recent words
```

**What this means:**
- Word not found in recent words
- System will check for miscues

## Common Issues and Solutions

### Issue 1: Word Not Found in Transcript

**Console:**
```
🔎 Searching for "saw" in full transcript: [He, picked, it, up, and]
   ✗ "saw" NOT found in transcript
🔍 Checking 5 RECENT words: [He, picked, it, up, and]
❌ No match found in recent words
```

**Cause:** Speech recognition hasn't picked up "saw" yet

**Solution:** Wait for speech recognition to update, or speak more clearly

### Issue 2: Word in Transcript But Not Matching

**Console:**
```
🔎 Searching for "saw" in full transcript: [He, picked, it, up, and, was, that]
   ✗ "saw" NOT found in transcript
```

**Cause:** Transcript has "was" but you're looking for "saw" (reversal not detected in full transcript check)

**Solution:** The system should catch this in the reversal detection later

### Issue 3: Compound Word Not Detected

**Console:**
```
🔬 Compound check: "henoticed" vs "he" + "noticed"
  Exact concat: false
  Contains both in order: false
  Similarity to "henoticed": 11%  ← LOW!
  Is blend: false
❌ No match found
```

**Cause:** Similarity calculation is wrong or word is actually different

**Solution:** Check if the spoken word is actually "henoticed" or something else

### Issue 4: Too Many Compound Checks

**Console:**
```
🔬 Compound check: "pick" vs "saw" + "that"
🔬 Compound check: "it" vs "saw" + "that"
🔬 Compound check: "up" vs "saw" + "that"
```

**Cause:** System is checking RECENT words (including already-matched words)

**This is normal:** System checks all recent words to catch fast reading

## What to Look For

### ✅ Good Signs:
- "FOUND in full transcript" - Fast path working
- "MATCH!" - Direct match found
- "COMPOUND MATCH!" - Joined words detected
- High similarity percentages (70%+)

### ⚠️ Warning Signs:
- "NOT found in transcript" - Word missing
- Low similarity percentages (<50%)
- Many "No match found" messages
- Miscue warnings when reading correctly

### ❌ Problem Signs:
- Word clearly in transcript but not found
- Similarity showing 0% or 11% for identical words
- False omissions/substitutions
- Getting stuck on a word

## Debugging Steps

1. **Check Full Transcript Search:**
   - Is the word in the transcript list?
   - Does it show "Found match"?

2. **Check Recent Words:**
   - Is the word in the recent 5 words?
   - Are there NEW words to process?

3. **Check Compound Detection:**
   - What's the similarity percentage?
   - Are the validation methods working?

4. **Check Miscue Detection:**
   - Is it counting false miscues?
   - Are the miscue types correct?

## Example: Successful Fast Reading

```
🎤 Full transcript: "The lost key one quiet evening a boy named liam was walking home"

🔎 Searching for "The" in full transcript: [The, lost, key, one, quiet, evening, a, boy, named, liam, was, walking, home]
   ✓ Found match: "The" matches "The"
✅ FOUND "The" in full transcript! Advancing...

🔎 Searching for "lost" in full transcript: [The, lost, key, one, quiet, evening, a, boy, named, liam, was, walking, home]
   ✓ Found match: "lost" matches "lost"
✅ FOUND "lost" in full transcript! Advancing...

🔎 Searching for "key" in full transcript: [The, lost, key, one, quiet, evening, a, boy, named, liam, was, walking, home]
   ✓ Found match: "key" matches "key"
✅ FOUND "key" in full transcript! Advancing...

... continues smoothly ...
```

## Tips

1. **Read the logs from top to bottom** - They show the processing order
2. **Look for the "FOUND in full transcript" message** - This is the fastest path
3. **Check similarity percentages** - Should be 70%+ for compounds
4. **Watch for false miscues** - If you read correctly but get miscues, there's a bug
5. **Note the word index** - Helps track progress through the story

This logging will help identify exactly where and why matching fails! 🔍✅
