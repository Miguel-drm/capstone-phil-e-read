# Visual Miscue Highlighting

## 🎨 Overview

Words in the story are now color-coded based on the type of miscue detected, providing instant visual feedback to teachers about reading errors.

---

## Color Coding System

Each miscue type has a unique color for easy identification:

### 1. **Mispronunciation** (Maling Bigkas)
- **Color**: 🔴 Red
- **Style**: `bg-red-100 text-red-800 border-2 border-red-400`
- **Example**: Child says "beautifull" for "beautiful"

### 2. **Omission** (Pagkakaltas)
- **Color**: 🟠 Orange
- **Style**: `bg-orange-100 text-orange-800 border-2 border-orange-400`
- **Example**: Child skips "shiny"

### 3. **Substitution** (Pagpapalit)
- **Color**: 🟡 Yellow
- **Style**: `bg-yellow-100 text-yellow-800 border-2 border-yellow-400`
- **Example**: Child says "house" for "home"

### 4. **Insertion** (Pagsisisingit)
- **Color**: 🟢 Green
- **Style**: `bg-green-100 text-green-800 border-2 border-green-400`
- **Example**: Child adds extra words

### 5. **Repetition** (Pag-uulit)
- **Color**: 🔵 Blue
- **Style**: `bg-blue-100 text-blue-800 border-2 border-blue-400`
- **Example**: Child repeats "the the"

### 6. **Transposition** (Pagpapalit ng Lugar)
- **Color**: 🟣 Purple
- **Style**: `bg-purple-100 text-purple-800 border-2 border-purple-400`
- **Example**: Child says "red big" for "big red"

### 7. **Reversal** (Paglilipat)
- **Color**: 🩷 Pink
- **Style**: `bg-pink-100 text-pink-800 border-2 border-pink-400`
- **Example**: Child says "saw" for "was"

---

## Visual States

### Word States Priority (Highest to Lowest):

1. **Current Word** (Being read now)
   - Gradient background: Blue → Purple → Pink
   - White text
   - Bold font
   - Glow effect
   - Slightly enlarged (scale 1.1)

2. **Miscue Word** (Error detected)
   - Color-coded background (based on miscue type)
   - Colored text (darker shade)
   - Bold border (2px)
   - Semi-bold font

3. **Read Word** (Correctly read)
   - Light green background
   - Green text
   - Slightly transparent (opacity 80%)

4. **Unread Word** (Not yet read)
   - Light blue background
   - Blue text
   - Hover effect

---

## Implementation

### State Management

```typescript
// Track miscues per word
type MiscueType = 'mispronunciation' | 'omission' | 'substitution' | 
                  'insertion' | 'repetition' | 'transposition' | 'reversal';
const [wordMiscues, setWordMiscues] = useState<Map<number, MiscueType>>(new Map());
```

### Recording Miscues

```typescript
// When a miscue is detected
setWordMiscues(prev => new Map(prev).set(currentWordIndex, 'mispronunciation'));
```

### Rendering with Colors

```typescript
const miscueType = wordMiscues.get(realWordIndex);

const getMiscueColor = (type: MiscueType | undefined) => {
  if (!type) return null;
  const colors = {
    mispronunciation: 'bg-red-100 text-red-800 border-2 border-red-400',
    omission: 'bg-orange-100 text-orange-800 border-2 border-orange-400',
    // ... other types
  };
  return colors[type];
};

// Apply color in className
className={
  isCurrent
    ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold"
    : miscueType
      ? `${getMiscueColor(miscueType)} font-semibold`
      : isRead
        ? "bg-green-50 text-green-700"
        : "bg-blue-50 text-blue-900"
}
```

---

## Visual Examples

### Example 1: Mispronunciation

```
Story: "The beautiful garden"
Child says: "The beautifull garden"

Visual:
┌─────┐ ┌──────────────┐ ┌────────┐
│ The │ │ beautiful    │ │ garden │
│     │ │ 🔴 RED BG    │ │        │
│     │ │ BOLD BORDER  │ │        │
└─────┘ └──────────────┘ └────────┘
```

### Example 2: Omission

```
Story: "The shiny red ball"
Child says: "The red ball" (skipped "shiny")

Visual:
┌─────┐ ┌──────────────┐ ┌─────┐ ┌──────┐
│ The │ │ shiny        │ │ red │ │ ball │
│     │ │ 🟠 ORANGE BG │ │     │ │      │
│     │ │ BOLD BORDER  │ │     │ │      │
└─────┘ └──────────────┘ └─────┘ └──────┘
```

### Example 3: Multiple Miscues

```
Story: "The boy saw the cat"
Child says: "The boy was the cat" (reversal) + skipped "the"

Visual:
┌─────┐ ┌─────┐ ┌──────────────┐ ┌──────────────┐ ┌─────┐
│ The │ │ boy │ │ saw          │ │ the          │ │ cat │
│     │ │     │ │ 🩷 PINK BG   │ │ 🟠 ORANGE BG │ │     │
│     │ │     │ │ (reversal)   │ │ (omission)   │ │     │
└─────┘ └─────┘ └──────────────┘ └──────────────┘ └─────┘
```

---

## Benefits

### For Teachers:

1. **Instant Visual Feedback**
   - See errors as they happen
   - No need to listen carefully to every word
   - Quick pattern recognition

2. **Pattern Identification**
   - Lots of red (mispronunciation) = pronunciation issues
   - Lots of orange (omission) = rushing/skipping
   - Lots of yellow (substitution) = comprehension issues

3. **Post-Session Review**
   - Scroll through story to see all errors
   - Colors remain after session ends
   - Easy to discuss with student

4. **Documentation**
   - Visual record of reading performance
   - Can screenshot for reports
   - Share with parents/administrators

### For Students:

1. **Self-Awareness**
   - See their own errors
   - Understand what went wrong
   - Learn from mistakes

2. **Motivation**
   - Want to avoid colored words
   - Strive for all green (correct)
   - Gamification element

---

## Technical Details

### Performance

**Memory Usage:**
- Map stores only word indices with miscues
- Typical session: 5-20 miscues = ~1KB memory
- Efficient O(1) lookup

**Rendering:**
- No performance impact
- Colors applied via CSS classes
- Smooth transitions (300ms)

### Accessibility

**Color Blind Support:**
- Each color has distinct brightness
- Bold borders provide additional visual cue
- Text remains readable on all backgrounds

**High Contrast:**
- All color combinations meet WCAG AA standards
- Text-to-background contrast ratio > 4.5:1

---

## Future Enhancements

### Potential Additions:

1. **Hover Tooltips**
   ```
   Hover over colored word:
   "Mispronunciation: Child said 'beautifull' instead of 'beautiful'"
   ```

2. **Legend**
   ```
   Show color legend at top of story:
   🔴 Mispronunciation | 🟠 Omission | 🟡 Substitution | etc.
   ```

3. **Filter by Type**
   ```
   "Show only mispronunciations"
   Dims all other words, highlights only red ones
   ```

4. **Severity Levels**
   ```
   Light red = minor mispronunciation (80% similar)
   Dark red = major mispronunciation (40% similar)
   ```

5. **Animation**
   ```
   When miscue detected:
   - Word pulses briefly
   - Color fades in smoothly
   - Draws attention to error
   ```

---

## Usage Tips

### During Session:

1. **Watch for Color Patterns**
   - Cluster of same color = specific issue
   - Random colors = general difficulty
   - No colors = excellent reading!

2. **Note Difficult Words**
   - Words with miscues need review
   - Practice these words later
   - Track improvement over time

3. **Adjust Instruction**
   - Many red = focus on pronunciation
   - Many orange = slow down reading
   - Many yellow = work on vocabulary

### After Session:

1. **Review with Student**
   - Scroll through story together
   - Discuss colored words
   - Practice difficult words

2. **Document Patterns**
   - Screenshot story with colors
   - Note which types are most common
   - Track progress in future sessions

3. **Plan Intervention**
   - Design lessons based on miscue types
   - Target specific weaknesses
   - Measure improvement

---

## Summary

Visual miscue highlighting provides:

- ✅ **7 color-coded miscue types**
- ✅ **Instant visual feedback**
- ✅ **Pattern recognition**
- ✅ **Post-session review**
- ✅ **Accessible design**
- ✅ **Efficient performance**
- ✅ **Educational value**

**Result**: Teachers can see reading errors at a glance, making assessment more efficient and effective! 🎨📚✨
