# Stuck Detection & Manual Skip Feature

## 🎯 Problem Solved

When the system gets stuck on a word (speech recognition is working but word matching fails), users can now:
1. **Automatic recovery** after 10 seconds
2. **Manual skip** button to advance immediately

---

## 🔧 Automatic Stuck Detection

### How It Works

```typescript
// Timer resets every time word changes
if (currentWordIndex !== lastWordIndexRef.current) {
  // Clear old timer
  clearTimeout(stuckTimerRef.current);
  
  // Set new 10-second timer
  stuckTimerRef.current = setTimeout(() => {
    console.warn(`⚠️ STUCK DETECTION: Been on word for 10+ seconds`);
    
    // Try to find any word in transcript
    for (let i = currentWordIndex; i < currentWordIndex + 10; i++) {
      if (transcriptWords.some(w => isWordMatch(w, realWords[i]))) {
        // Found a match! Advance to it
        setCurrentWordIndex(i + 1);
        break;
      }
    }
    
    // If no match found, skip current word
    if (!advanced) {
      setCurrentWordIndex(prev => prev + 1);
    }
  }, 10000); // 10 seconds
}
```

### Behavior

**Scenario 1: Word found in transcript**
```
Time 0s: Stuck on "picked"
Time 5s: Still on "picked"
Time 10s: ⚠️ STUCK DETECTION triggered
         Searches transcript for next 10 words
         Finds "sidewalk" at position +5
         ✅ Advances to "sidewalk"
```

**Scenario 2: No word found**
```
Time 0s: Stuck on "picked"
Time 10s: ⚠️ STUCK DETECTION triggered
         Searches transcript
         No match found
         ✅ Skips "picked" (counts as omission)
```

### Console Output

```
⚠️ STUCK DETECTION: Been on word "picked" for 10+ seconds
   Transcript has content: "sidewalk it up and saw"
   Attempting to find word in transcript and advance...
   ✅ Found "sidewalk" at position 29, advancing...
```

---

## ⏭️ Manual Skip Button

### UI Location

Located next to the Stop button during recording:

```
[▶️ Start] [⏸️ Pause] [⏹️ Stop] [⏭️ Skip] [✅ Complete]
```

### Button Appearance

- **Color**: Gray gradient (from-gray-500 to-gray-600)
- **Icon**: Fast-forward double arrows
- **Text**: "Skip" (on large screens)
- **Tooltip**: "Skip current word (counts as omission)"

### Behavior

When clicked:
1. Advances to next word immediately
2. Counts as **omission** miscue
3. Marks word with orange color (omission)
4. Logs to console

### Code

```typescript
<button
  onClick={() => {
    console.log(`⏭️ Manual skip: Advancing from word ${currentWordIndex}`);
    setCurrentWordIndex(prev => prev + 1);
    setWordsRead(prev => prev + 1);
    setMiscues(prev => prev + 1);
    setMiscueTypes(prev => ({ ...prev, omission: prev.omission + 1 }));
    setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'omission'));
  }}
  className="... bg-gradient-to-r from-gray-500 to-gray-600 ..."
  title="Skip current word (counts as omission)"
>
  <ForwardIcon />
  <span>Skip</span>
</button>
```

### Console Output

```
⏭️ Manual skip: Advancing from word 24 ("picked")
```

---

## 🎯 Use Cases

### Use Case 1: Difficult Word

**Problem:**
- Child struggles with "ancient"
- Tries multiple times
- System doesn't recognize attempts
- Gets stuck for 30+ seconds

**Solution:**
- Teacher clicks "Skip" button
- System advances to next word
- Counts as omission
- Reading continues smoothly

### Use Case 2: Background Noise

**Problem:**
- Loud noise during "picked"
- Speech recognition hears noise
- Word matching fails
- Stuck on "picked"

**Solution:**
- After 10 seconds, automatic recovery
- Or teacher clicks "Skip" immediately
- System advances
- Reading continues

### Use Case 3: Accent/Pronunciation

**Problem:**
- Child says "picked" with strong accent
- System doesn't recognize it
- Stuck on word

**Solution:**
- Automatic recovery after 10 seconds
- Searches transcript for any recognizable word
- Advances to next match
- Or teacher skips manually

---

## 📊 Statistics Tracking

### Automatic Recovery

```typescript
// Logged to console
⚠️ STUCK DETECTION: Been on word "picked" for 10+ seconds
   Transcript has content: "sidewalk it up"
   Attempting to find word in transcript and advance...
   ✅ Found "sidewalk" at position 29, advancing...
```

### Manual Skip

```typescript
// Logged to console
⏭️ Manual skip: Advancing from word 24 ("picked")

// Counted as omission
miscueTypes.omission += 1
wordMiscues.set(24, 'omission')
```

---

## 🎨 Visual Feedback

### Skipped Word Appearance

When word is skipped (manually or automatically):
- **Background**: 🟠 Orange (omission color)
- **Border**: Bold orange border
- **Text**: Orange text
- **Remains visible** after session for review

### Example

```
Story: "He picked it up and saw"

After skip:
┌────┐ ┌──────────────┐ ┌────┐ ┌────┐ ┌─────┐ ┌─────┐
│ He │ │ picked       │ │ it │ │ up │ │ and │ │ saw │
│    │ │ 🟠 ORANGE    │ │    │ │    │ │     │ │     │
│    │ │ (skipped)    │ │    │ │    │ │     │ │     │
└────┘ └──────────────┘ └────┘ └────┘ └─────┘ └─────┘
```

---

## ⚙️ Configuration

### Stuck Timer Duration

Currently set to **10 seconds**. Can be adjusted:

```typescript
// Change timeout duration
setTimeout(() => {
  // Stuck detection logic
}, 10000); // 10 seconds (10000ms)

// Recommended values:
// - 5000ms (5 sec) - Aggressive recovery
// - 10000ms (10 sec) - Balanced (current)
// - 15000ms (15 sec) - Patient recovery
```

### Search Range

Currently searches **next 10 words**. Can be adjusted:

```typescript
// Search next N words
for (let i = currentWordIndex; i < currentWordIndex + 10; i++) {
  // Search logic
}

// Recommended values:
// - 5 words - Conservative
// - 10 words - Balanced (current)
// - 20 words - Aggressive
```

---

## 🔍 Debugging

### Check If Stuck

Look for these console messages:

```
⚠️ STUCK DETECTION: Been on word "picked" for 10+ seconds
   Transcript has content: "sidewalk it up and saw"
```

### Check Manual Skip

```
⏭️ Manual skip: Advancing from word 24 ("picked")
```

### Check Recovery Success

```
✅ Found "sidewalk" at position 29, advancing...
```

### Check Recovery Failure

```
❌ Could not find any matching word, skipping current word
```

---

## 💡 Best Practices

### For Teachers:

1. **Wait for automatic recovery** (10 seconds) if possible
2. **Use manual skip** if student is frustrated
3. **Note skipped words** for later review
4. **Practice difficult words** after session

### For Students:

1. **Try saying the word clearly** multiple times
2. **Wait for automatic skip** if stuck
3. **Don't get frustrated** - system will recover
4. **Continue reading** after skip

---

## 🎯 Benefits

### Automatic Recovery:
- ✅ No manual intervention needed
- ✅ Finds next recognizable word
- ✅ Continues reading smoothly
- ✅ Logs for debugging

### Manual Skip:
- ✅ Immediate control for teacher
- ✅ Prevents student frustration
- ✅ Counts as omission (accurate)
- ✅ Visual feedback (orange color)

### Combined:
- ✅ Never permanently stuck
- ✅ Flexible recovery options
- ✅ Maintains accurate assessment
- ✅ Better user experience

---

## 📈 Impact

### Before:
- ❌ Could get stuck indefinitely
- ❌ Required page refresh
- ❌ Lost session progress
- ❌ Frustrated users

### After:
- ✅ Automatic recovery after 10 seconds
- ✅ Manual skip button available
- ✅ Session continues smoothly
- ✅ Happy users!

---

## Summary

The stuck detection and manual skip features ensure:
- 🔄 **Automatic recovery** after 10 seconds
- ⏭️ **Manual skip** button for immediate control
- 🟠 **Proper tracking** (counts as omission)
- 🎨 **Visual feedback** (orange highlighting)
- 📊 **Console logging** for debugging
- ✅ **Never stuck** permanently

**Result**: A robust, user-friendly system that handles edge cases gracefully! 🎯✨
