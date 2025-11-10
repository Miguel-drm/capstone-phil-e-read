# Miscue Types Observation Panel - UI Guide

## 🎨 New Visual Display

A comprehensive observation panel has been added to the reading session page that displays all 7 Phil-IRI miscue types in real-time.

## 📊 Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Miscue Types Detection (Phil-IRI)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 1. Mispro... │  │ 2. Omission  │  │ 3. Substit.. │         │
│  │ Maling Bigkas│  │ Pagkakaltas  │  │ Pagpapalit   │         │
│  │              │  │              │  │              │         │
│  │     0        │  │     0        │  │     0        │         │
│  │              │  │              │  │              │         │
│  │ Wrong pronun │  │ Skipped word │  │ Different wd │         │
│  │ Example: ... │  │ Example: ... │  │ Example: ... │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 4. Insertion │  │ 5. Repetition│  │ 6. Transpos..│         │
│  │ Pagsisisingit│  │ Pag-uulit    │  │ Pagpapalit..│         │
│  │              │  │              │  │              │         │
│  │     0        │  │     0        │  │     0        │         │
│  │              │  │              │  │              │         │
│  │ Added extra  │  │ Repeated wd  │  │ Word order   │         │
│  │ Example: ... │  │ Example: ... │  │ Example: ... │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ 7. Reversal  │                                               │
│  │ Paglilipat   │                                               │
│  │              │                                               │
│  │     0        │                                               │
│  │              │                                               │
│  │ Reversed ltrs│                                               │
│  │ Example: ... │                                               │
│  └──────────────┘                                               │
│                                                                  │
│  💡 Observation Tip: Watch the cards light up in real-time...  │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Card States

### Inactive State (No Miscues)
- **Background**: White
- **Border**: Gray (border-gray-200)
- **Count**: Gray text (text-gray-400)
- **Appearance**: Subtle, faded

### Active State (Miscues Detected)
- **Background**: Colored (matches miscue type)
- **Border**: Bold colored border
- **Count**: Bold colored text
- **Appearance**: Highlighted with shadow

## 🌈 Color Coding

Each miscue type has a unique color for easy identification:

| Miscue Type | Color | Background | Border |
|-------------|-------|------------|--------|
| 1. Mispronunciation | Red | bg-red-100 | border-red-400 |
| 2. Omission | Orange | bg-orange-100 | border-orange-400 |
| 3. Substitution | Yellow | bg-yellow-100 | border-yellow-400 |
| 4. Insertion | Green | bg-green-100 | border-green-400 |
| 5. Repetition | Blue | bg-blue-100 | border-blue-400 |
| 6. Transposition | Purple | bg-purple-100 | border-purple-400 |
| 7. Reversal | Pink | bg-pink-100 | border-pink-400 |

## 📱 Responsive Design

- **Mobile (1 column)**: Cards stack vertically
- **Tablet (2 columns)**: Cards in 2-column grid
- **Desktop (3 columns)**: Cards in 3-column grid

## 📋 Card Information

Each card displays:

1. **Number & Name**: "1. Mispronunciation"
2. **Filipino Translation**: "Maling Bigkas" (italic)
3. **Count**: Large number showing occurrences
4. **Description**: Brief explanation of the error type
5. **Example**: Real-world example of the miscue

## 🔄 Real-Time Updates

### Before Recording Starts:
```
All cards are white/gray (inactive state)
All counts show: 0
```

### During Recording:
```
When a mispronunciation is detected:
  ✅ Card 1 lights up (red background)
  ✅ Count increases: 0 → 1 → 2...
  ✅ Shadow appears for emphasis

When an omission is detected:
  ✅ Card 2 lights up (orange background)
  ✅ Count increases
  
... and so on for all 7 types
```

### Example Active State:
```
┌──────────────────────────┐
│ 1. Mispronunciation      │  ← RED BACKGROUND
│ Maling Bigkas            │
│                          │
│         3                │  ← BOLD RED NUMBER
│                          │
│ Wrong pronunciation      │
│ (60%+ similar)           │
│ Example: "beautifull"    │
│ → "beautiful"            │
└──────────────────────────┘
```

## 🎓 Educational Benefits

### For Teachers:
1. **Instant Pattern Recognition**: See which error types dominate
2. **Visual Feedback**: Color-coded cards make it easy to spot issues
3. **Real-Time Monitoring**: Watch miscues as they happen
4. **Data-Driven Decisions**: Use counts to plan interventions

### For Observation:
1. **Clear Categorization**: Each miscue type is clearly labeled
2. **Examples Provided**: Teachers can understand what each type means
3. **Filipino Translations**: Supports bilingual educators
4. **Count Tracking**: Quantitative data for each type

## 🔍 Observation Workflow

1. **Start Recording**: All cards are inactive (white)
2. **Student Reads**: Watch the story content
3. **Miscues Detected**: Cards light up in real-time
4. **Pattern Analysis**: See which cards have highest counts
5. **Post-Session**: Review the final counts for each type

## 💡 Usage Tips

### During Session:
- Keep an eye on which cards light up most frequently
- Note if certain miscue types cluster together
- Watch for patterns (e.g., many omissions = rushing)

### After Session:
- Review the final counts in each card
- Compare to previous sessions
- Plan targeted interventions based on dominant miscue types

### For Research:
- Screenshot the panel for documentation
- Track miscue type trends over time
- Compare patterns across different students

## 🎯 Console Integration

The panel works in sync with console logging:

```javascript
// When a miscue is detected:
Console: ⚠️ MISPRONUNCIATION! Child said "beautifull" instead of "beautiful" (85% similar)
UI: Card 1 lights up, count increases

Console: ⚠️ OMISSION! Child skipped "shiny" and said "on" (word #51)
UI: Card 2 lights up, count increases

Console: ⚠️ INSERTION! Child added 3 extra word(s): [the, big, red, ball]
UI: Card 4 lights up, count increases by 3
```

## 📊 Data Persistence

All counts are saved to the database:

```typescript
{
  miscues: 10,
  miscueTypes: {
    mispronunciation: 3,  // Card 1
    omission: 1,          // Card 2
    substitution: 2,      // Card 3
    insertion: 3,         // Card 4
    repetition: 1,        // Card 5
    transposition: 0,     // Card 6
    reversal: 0           // Card 7
  }
}
```

## 🎨 Visual Example

### Scenario: Student makes 3 mispronunciations, 1 omission, 2 substitutions

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Miscue Types Detection (Phil-IRI)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 1. Mispro... │  │ 2. Omission  │  │ 3. Substit.. │         │
│  │ 🔴 RED BG    │  │ 🟠 ORANGE BG │  │ 🟡 YELLOW BG │         │
│  │              │  │              │  │              │         │
│  │     3 ✨     │  │     1 ✨     │  │     2 ✨     │         │
│  │              │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 4. Insertion │  │ 5. Repetition│  │ 6. Transpos..│         │
│  │ ⚪ WHITE BG  │  │ ⚪ WHITE BG  │  │ ⚪ WHITE BG  │         │
│  │              │  │              │  │              │         │
│  │     0        │  │     0        │  │     0        │         │
│  │              │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ 7. Reversal  │                                               │
│  │ ⚪ WHITE BG  │                                               │
│  │              │                                               │
│  │     0        │                                               │
│  │              │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## ✅ Implementation Complete

The observation panel is now live and ready for:
- ✅ Real-time miscue detection
- ✅ Visual feedback with color coding
- ✅ Educational examples for each type
- ✅ Responsive design for all devices
- ✅ Data persistence to database
- ✅ Console log integration

**Perfect for classroom observation, research, and teacher training!** 🎯📚✨
