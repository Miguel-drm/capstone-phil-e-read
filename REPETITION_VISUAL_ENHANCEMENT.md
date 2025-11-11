# Repetition Visual Enhancement

## 🎨 Enhanced Repetition Display

Repetition miscues now have **extra visual indicators** to make them more noticeable:

### Visual Features:

1. **Blue Background** - `bg-blue-100`
2. **Blue Text** - `text-blue-800`
3. **Bold Border** - `border-2 border-blue-400`
4. **Wavy Underline** - Blue wavy underline (3px thick)
5. **Semi-Bold Font** - `font-semibold`

---

## 📊 How It Looks

### Before Enhancement:
```
Liam (just blue background)
```

### After Enhancement:
```
Liam (blue background + wavy underline)
~~~~
```

---

## 💻 Implementation

```typescript
// Add underline to repetition in className
repetition: 'bg-blue-100 text-blue-800 border-2 border-blue-400 underline decoration-4 decoration-blue-600'

// Add wavy underline in style
const getRepetitionStyle = (type: MiscueType | undefined) => {
  if (type === 'repetition' && showMiscueColors) {
    return {
      textDecoration: 'underline wavy',
      textDecorationColor: '#2563eb', // Blue
      textDecorationThickness: '3px'
    };
  }
  return {};
};
```

---

## 🔍 Debugging Repetition

### Check Console Logs:

When you repeat a word, you should see:
```
⚠️ REPETITION! Child repeated "liam" at word index 9
   Marking word #9 ("Liam") as repetition
```

### Check Visual:

After stopping recording, the repeated word should have:
- 🔵 Blue background
- 🔵 Blue border (2px)
- 🔵 Blue wavy underline
- 🔵 Blue text

### If Not Visible:

1. **Make sure you stopped recording** - Colors only show after stop
2. **Check console** - See which word index was marked
3. **Count words** - Verify the correct word is being marked
4. **Check miscue panel** - Should show "Repetition: 1"

---

## 🎯 Example

### Scenario: Repeat "Liam"

**Story:**
```
"...a boy named Liam was walking..."
```

**You say:**
```
"...a boy named Liam Liam was walking..."
```

**Detection:**
```
Console: ⚠️ REPETITION! Child repeated "liam" at word index 9
         Marking word #9 ("Liam") as repetition
```

**Visual Result (After Stop):**
```
...a boy named [Liam] was walking...
              ~~~~~~
              🔵 Blue background
              🔵 Wavy underline
```

---

## 💡 Why Underline?

The wavy underline provides:
1. **Extra Visual Cue** - Easier to spot
2. **Distinct from Other Miscues** - Unique style
3. **Accessibility** - Works for color blind users
4. **Professional Look** - Similar to spell-check underlines

---

## Summary

Repetition miscues now have:
- ✅ Blue background
- ✅ Blue border
- ✅ Blue wavy underline (NEW!)
- ✅ Semi-bold font
- ✅ Only visible after recording stops

**Result**: Repetitions are now highly visible and easy to identify! 🔵📚✨
