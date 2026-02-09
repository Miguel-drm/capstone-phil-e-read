# Phil-E-Read System: Algorithm IPO Diagrams

## Feature 1: Multi-Delete Reading Sessions Algorithm

```
┌─────────────────────┐
│                     │
│      INPUTS         │
│                     │
└─────────────────────┘

┌─────────────────────┐
│  Teacher profile    │
│  data               │
│  - teacherId        │
│  - permissions      │
└─────────────────────┘

┌─────────────────────┐
│  Reading sessions   │
│  data               │
│  - sessionId        │
│  - studentName      │
│  - book title       │
│  - status           │
└─────────────────────┘

┌─────────────────────┐
│  User selection     │
│  data               │
│  - checkbox clicks  │
│  - select all       │
│  - session IDs      │
└─────────────────────┘

┌─────────────────────┐
│  Session results    │
│  data               │
│  - results Map      │
│  - student data     │
└─────────────────────┘

┌─────────────────────┐
│  Filter criteria    │
│  - story filter     │
│  - active tab       │
└─────────────────────┘


                    ║
                    ║
                    ▼

┌─────────────────────────────────────────┐
│                                         │
│    CONSTRAINT BASED ALGORITHM           │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  SESSION SELECTION AND                  │
│  VALIDATION                             │
│                                         │
│  • Verify teacher permissions           │
│  • Load active reading sessions         │
│  • Filter by story (if selected)        │
│  • Initialize selection Set             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  CONSTRAINT IDENTIFICATION              │
│  AND PREPARATION                        │
│                                         │
│  • Check session ownership              │
│  • Validate session IDs exist           │
│  • Verify deletion permissions          │
│  • Check for active students            │
│  • Prepare deletion constraints         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  SELECTION MANAGEMENT LOOP              │
│                                         │
│  FOR each user interaction:             │
│    IF checkbox clicked:                 │
│      • Toggle session in Set            │
│      • Update visual state              │
│    IF select all clicked:               │
│      • Get filtered sessions            │
│      • Add all IDs to Set               │
│    IF clear clicked:                    │
│      • Empty selection Set              │
│    UPDATE UI with selection count       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  CONFLICT DETECTION AND                 │
│  RESOLUTION                             │
│                                         │
│  • Check if sessions selected > 0       │
│  • Validate all IDs still exist         │
│  • Check for concurrent modifications   │
│  • Show confirmation dialog             │
│  • Wait for user confirmation           │
│  IF cancelled: ABORT and return         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  DELETION EXECUTION AND                 │
│  FINALIZATION                           │
│                                         │
│  • Set isDeleting = true                │
│  • Create deletion promises array       │
│  • Execute Promise.allSettled()         │
│  • Track success/failure counts         │
│  • Remove from readingSessions array    │
│  • Clean sessionResults Map             │
│  • Clear selectedSessions Set           │
│  • Set isDeleting = false               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  RESULT OUTPUT                          │
│                                         │
│  • Calculate deletion statistics        │
│  • Generate success/error message       │
│  • Update UI state                      │
│  • Trigger React re-render              │
│  • Show notification dialog             │
└─────────────────────────────────────────┘


                    ║
                    ║
                    ▼

┌─────────────────────────────────────────┐
│                                         │
│           OUTPUT                        │
│                                         │
└─────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  📊 Reading Sessions Dashboard              │    │
│  ├─────────────────────────────────────────────┤    │
│  │                                             │    │
│  │  ✓ 3 sessions selected                     │    │
│  │  [Clear selection]  [Delete Selected]      │    │
│  │                                             │    │
│  │  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │ ☑ Session 1  │  │ ☑ Session 2  │       │    │
│  │  │ Student: Ana │  │ Student: Ben │       │    │
│  │  │ Story: Pam   │  │ Story: Pam   │       │    │
│  │  └──────────────┘  └──────────────┘       │    │
│  │                                             │    │
│  │  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │ ☑ Session 3  │  │ ☐ Session 4  │       │    │
│  │  │ Student: Carl│  │ Student: Dana│       │    │
│  │  │ Story: Pam   │  │ Story: Map   │       │    │
│  │  └──────────────┘  └──────────────┘       │    │
│  │                                             │    │
│  │  ✅ Successfully deleted 3 sessions         │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
└───────────────────────────────────────────────────────┘

• Updated sessions list (filtered)
• Cleaned results Map
• Empty selection Set
• Success notification
• Updated session count
• Re-rendered UI components
```

---

## Feature 2: Reversal Detection Configuration Algorithm

```
┌─────────────────────┐
│                     │
│      INPUTS         │
│                     │
└─────────────────────┘

┌─────────────────────┐
│  Teacher profile    │
│  data               │
│  - teacherId        │
│  - grade level      │
│  - preferences      │
└─────────────────────┘

┌─────────────────────┐
│  Configuration      │
│  settings           │
│  - enabled toggle   │
│  - min word length  │
│  - custom pairs     │
│  - exclude words    │
└─────────────────────┘

┌─────────────────────┐
│  User input data    │
│  - word1 text       │
│  - word2 text       │
│  - exclude word     │
│  - button clicks    │
└─────────────────────┘

┌─────────────────────┐
│  Existing config    │
│  data               │
│  - localStorage     │
│  - default config   │
└─────────────────────┘

┌─────────────────────┐
│  Validation rules   │
│  - length check     │
│  - reverse check    │
│  - duplicate check  │
└─────────────────────┘


                    ║
                    ║
                    ▼

┌─────────────────────────────────────────┐
│                                         │
│    CONSTRAINT BASED ALGORITHM           │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  CONFIGURATION RETRIEVAL                │
│  AND INITIALIZATION                     │
│                                         │
│  • Load from localStorage               │
│  • Parse JSON configuration             │
│  • Merge with default config            │
│  • Initialize state variables           │
│  • Set up form fields                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  CONSTRAINT IDENTIFICATION              │
│  AND PREPARATION                        │
│                                         │
│  • Define validation rules:             │
│    - Both words required                │
│    - Same length constraint             │
│    - Different words constraint         │
│    - Reverse relationship constraint    │
│    - No duplicate constraint            │
│  • Prepare error messages               │
│  • Set validation thresholds            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  INPUT VALIDATION LOOP                  │
│                                         │
│  FOR each user input:                   │
│    Step 1: Normalize input              │
│      • Trim whitespace                  │
│      • Convert to lowercase             │
│                                         │
│    Step 2: Check existence              │
│      IF empty: SHOW "Required" error    │
│                                         │
│    Step 3: Check length                 │
│      IF length mismatch:                │
│        SHOW "Same length" error         │
│                                         │
│    Step 4: Check difference             │
│      IF words same:                     │
│        SHOW "Must differ" error         │
│                                         │
│    Step 5: Verify reversal              │
│      reversed = word1.reverse()         │
│      IF reversed ≠ word2:               │
│        SHOW "Not reversal" error        │
│                                         │
│    Step 6: Check duplicates             │
│      IF pair exists in config:          │
│        SHOW "Already exists" error      │
│                                         │
│    IF all pass: PROCEED to add          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  CONFLICT DETECTION AND                 │
│  RESOLUTION                             │
│                                         │
│  • Check for conflicting pairs          │
│  • Verify exclude list consistency      │
│  • Validate min length range (1-10)     │
│  • Check localStorage availability      │
│  • Handle storage quota errors          │
│  • Resolve configuration conflicts      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  SAVING AND FINALIZATION                │
│  OF CONFIGURATION                       │
│                                         │
│  • Serialize config to JSON             │
│  • Save to localStorage with key        │
│  • Update React state                   │
│  • Clear input fields                   │
│  • Show success message (3s timeout)    │
│  • Trigger re-render                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  RESULT OUTPUT                          │
│                                         │
│  • Generate configuration object        │
│  • Update UI components                 │
│  • Display success/error feedback       │
│  • Enable detection in sessions         │
│  • Log configuration changes            │
└─────────────────────────────────────────┘


                    ║
                    ║
                    ▼

┌─────────────────────────────────────────┐
│                                         │
│           OUTPUT                        │
│                                         │
└─────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  ⚙️ Reversal Detection Settings             │    │
│  ├─────────────────────────────────────────────┤    │
│  │                                             │    │
│  │  ✅ Settings saved successfully!            │    │
│  │                                             │    │
│  │  Enable Reversal Detection:  [ON] ●──○     │    │
│  │                                             │    │
│  │  Minimum Word Length:  [2] letters          │    │
│  │                                             │    │
│  │  Custom Reversal Pairs:                     │    │
│  │  ┌─────────────────────────────────────┐   │    │
│  │  │ was ↔ saw                      [×]  │   │    │
│  │  │ on ↔ no                        [×]  │   │    │
│  │  │ pot ↔ top                      [×]  │   │    │
│  │  │ bad ↔ dab                      [×]  │   │    │
│  │  └─────────────────────────────────────┘   │    │
│  │                                             │    │
│  │  Add New Pair:                              │    │
│  │  [word1] ↔ [word2]  [Add]                  │    │
│  │                                             │    │
│  │  Exclude Words:                             │    │
│  │  [the ×] [and ×] [or ×]                    │    │
│  │                                             │    │
│  │  [Reset to Defaults]  [Save Settings]      │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
└───────────────────────────────────────────────────────┘

• Persisted configuration in localStorage
• Active reversal detection rules
• Updated UI state
• Success notification
• Applied settings to reading sessions
• Configuration ready for use
```

---

## Combined System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│              PHIL-E-READ READING ASSESSMENT SYSTEM             │
│                                                                │
└────────────────────────────────────────────────────────────────┘


    INPUTS                  ALGORITHM                    OUTPUT
    
┌──────────┐           ┌──────────────┐           ┌──────────┐
│ Teacher  │           │  Multi-Delete│           │ Updated  │
│ Actions  │──────────▶│  Algorithm   │──────────▶│ Session  │
│          │           │              │           │ List     │
└──────────┘           └──────────────┘           └──────────┘
                              │
                              │
┌──────────┐                  │                   ┌──────────┐
│ Session  │                  │                   │ Success  │
│ Data     │──────────────────┤                   │ Messages │
│          │                  │                   │          │
└──────────┘                  │                   └──────────┘
                              │
                              │
┌──────────┐           ┌──────────────┐           ┌──────────┐
│ Config   │           │  Reversal    │           │ Saved    │
│ Settings │──────────▶│  Detection   │──────────▶│ Config   │
│          │           │  Algorithm   │           │          │
└──────────┘           └──────────────┘           └──────────┘
                              │
                              │
┌──────────┐                  │                   ┌──────────┐
│ User     │                  │                   │ Detection│
│ Input    │──────────────────┤                   │ Rules    │
│          │                  │                   │          │
└──────────┘                  │                   └──────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Reading Session │
                    │  Detection       │
                    │  (Runtime)       │
                    └──────────────────┘
```

---

## Algorithm Complexity Analysis

### Multi-Delete Algorithm
```
┌─────────────────────────────────────────────────────────┐
│ Operation              │ Time Complexity │ Space        │
├────────────────────────┼─────────────────┼──────────────┤
│ Selection Toggle       │ O(1)            │ O(n)         │
│ Select All             │ O(n)            │ O(n)         │
│ Validation             │ O(n)            │ O(1)         │
│ Parallel Deletion      │ O(n)            │ O(n)         │
│ State Update           │ O(n)            │ O(n)         │
│ UI Re-render           │ O(n)            │ O(n)         │
├────────────────────────┼─────────────────┼──────────────┤
│ Overall                │ O(n)            │ O(n)         │
└─────────────────────────────────────────────────────────┘

Where n = number of reading sessions
```

### Reversal Detection Algorithm
```
┌─────────────────────────────────────────────────────────┐
│ Operation              │ Time Complexity │ Space        │
├────────────────────────┼─────────────────┼──────────────┤
│ Load Config            │ O(1)            │ O(m)         │
│ Validation Pipeline    │ O(k)            │ O(1)         │
│ Duplicate Check        │ O(m)            │ O(1)         │
│ Add/Remove Pair        │ O(1)            │ O(m)         │
│ Save Config            │ O(m)            │ O(m)         │
│ Runtime Detection      │ O(m)            │ O(1)         │
├────────────────────────┼─────────────────┼──────────────┤
│ Overall                │ O(m)            │ O(m)         │
└─────────────────────────────────────────────────────────┘

Where:
  m = number of custom reversal pairs
  k = length of word (constant, typically < 20)
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                │
│  │   Reading    │         │   Profile    │                │
│  │   Sessions   │         │   Settings   │                │
│  │   Page       │         │   Page       │                │
│  └──────┬───────┘         └──────┬───────┘                │
│         │                        │                         │
│         │                        │                         │
│  ┌──────▼────────────────────────▼───────┐                │
│  │        State Management                │                │
│  │        (useState, useEffect)           │                │
│  └──────┬────────────────────┬────────────┘                │
│         │                    │                             │
│         │                    │                             │
│  ┌──────▼──────┐      ┌──────▼──────────┐                │
│  │  Multi-     │      │  Reversal       │                │
│  │  Delete     │      │  Detection      │                │
│  │  Logic      │      │  Logic          │                │
│  └──────┬──────┘      └──────┬──────────┘                │
│         │                    │                             │
└─────────┼────────────────────┼─────────────────────────────┘
          │                    │
          │                    │
┌─────────▼────────────────────▼─────────────────────────────┐
│                    SERVICES LAYER                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │ readingSessionService│    │ localStorage         │     │
│  │ - deleteSession()    │    │ - save/load config   │     │
│  └──────────┬───────────┘    └──────────┬───────────┘     │
│             │                           │                  │
└─────────────┼───────────────────────────┼──────────────────┘
              │                           │
              │                           │
┌─────────────▼───────────────────────────▼──────────────────┐
│                    BACKEND / STORAGE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │   Firebase       │         │   Browser        │        │
│  │   Firestore      │         │   localStorage   │        │
│  │   (Sessions)     │         │   (Config)       │        │
│  └──────────────────┘         └──────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Constraint Validation Matrix

### Multi-Delete Constraints
```
┌────────────────────────────────────────────────────────────┐
│ Constraint                │ Validation Method              │
├───────────────────────────┼────────────────────────────────┤
│ Teacher owns sessions     │ Check teacherId match          │
│ Sessions exist            │ Verify IDs in database         │
│ At least one selected     │ Check Set.size > 0             │
│ No concurrent deletion    │ Optimistic locking             │
│ User confirmation         │ Dialog approval required       │
│ Valid session IDs         │ UUID format validation         │
└────────────────────────────────────────────────────────────┘
```

### Reversal Detection Constraints
```
┌────────────────────────────────────────────────────────────┐
│ Constraint                │ Validation Method              │
├───────────────────────────┼────────────────────────────────┤
│ Both words required       │ Check !empty after trim        │
│ Same length               │ word1.length === word2.length  │
│ Words different           │ word1 !== word2                │
│ Reverse relationship      │ word1.reverse() === word2      │
│ No duplicates             │ Search existing pairs          │
│ Min length range          │ 1 <= value <= 10               │
│ Storage available         │ Try-catch localStorage         │
└────────────────────────────────────────────────────────────┘
```

