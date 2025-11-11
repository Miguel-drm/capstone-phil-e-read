# Question Validation Logic Improvement

## Problem
The old validation required ALL 4 choices (A, B, C, D) to be filled, but some stories only have 3 choices. This prevented teachers from creating tests with 3-choice questions.

## Old Logic
```typescript
// Required all 4 choices to be filled
if (trimmedChoices.some(c => !c)) return 'All choices must have text.';
```

This was too strict and didn't allow for 3-choice questions.

## New Logic

### Requirements
1. **Minimum 3 choices** - At least A, B, C must be filled
2. **Choice D is optional** - Can be left empty
3. **A, B, C are mandatory** - First 3 choices must always be filled
4. **Uniqueness check** - Only checks filled choices

### Implementation
```typescript
// IMPROVED LOGIC: Allow empty choice D, but require at least 3 choices (A, B, C)
const filledChoices = trimmedChoices.filter(c => c !== '');

// Must have at least 3 choices filled
if (filledChoices.length < 3) {
  return 'Each question must have at least 3 choices (A, B, C). Choice D is optional.';
}

// First 3 choices (A, B, C) must always be filled
if (!trimmedChoices[0] || !trimmedChoices[1] || !trimmedChoices[2]) {
  return 'Choices A, B, and C are required. Only choice D is optional.';
}

// Check uniqueness only for filled choices
const unique = new Set(filledChoices);
if (unique.size < filledChoices.length) return 'Choices must be unique.';
```

## Validation Rules

### ✅ Valid Scenarios
1. **3 choices (A, B, C filled, D empty)**
   ```
   A: aso
   B: pusa
   C: ibon
   D: [empty]
   ```
   ✓ Valid - minimum 3 choices met

2. **4 choices (A, B, C, D all filled)**
   ```
   A: aso
   B: pusa
   C: ibon
   D: isda
   ```
   ✓ Valid - all choices filled

### ❌ Invalid Scenarios
1. **Less than 3 choices**
   ```
   A: aso
   B: pusa
   C: [empty]
   D: [empty]
   ```
   ✗ Error: "Each question must have at least 3 choices (A, B, C). Choice D is optional."

2. **Choice A, B, or C empty (even if D is filled)**
   ```
   A: aso
   B: [empty]
   C: ibon
   D: isda
   ```
   ✗ Error: "Choices A, B, and C are required. Only choice D is optional."

3. **Duplicate choices**
   ```
   A: aso
   B: aso
   C: ibon
   D: [empty]
   ```
   ✗ Error: "Choices must be unique."

## Benefits

### 1. Flexibility
- Teachers can create 3-choice or 4-choice questions
- Matches real Phil-IRI test formats

### 2. Clear Error Messages
- Specific messages tell teachers exactly what's wrong
- Explains that D is optional

### 3. Data Integrity
- Still enforces minimum 3 choices
- Prevents duplicate answers
- Ensures A, B, C are always filled

## User Experience

### Before
- Teacher tries to create 3-choice question
- Gets error: "All choices must have text"
- Forced to add dummy text to choice D
- Confusing and frustrating

### After
- Teacher creates 3-choice question
- Leaves choice D empty
- Validation passes ✓
- Can save test successfully

## Testing

### Test Case 1: 3-Choice Question
```
Question: "Ano ang alaga ni Lola Nita?"
A: aso
B: pusa  
C: ibon
D: [empty]
Correct Answer: B
```
Expected: ✓ Passes validation

### Test Case 2: 4-Choice Question
```
Question: "Ano ang alaga ni Lola Nita?"
A: aso
B: pusa
C: ibon
D: isda
Correct Answer: B
```
Expected: ✓ Passes validation

### Test Case 3: Only 2 Choices
```
Question: "Ano ang alaga ni Lola Nita?"
A: aso
B: pusa
C: [empty]
D: [empty]
Correct Answer: A
```
Expected: ✗ Error message shown

### Test Case 4: Missing Choice B
```
Question: "Ano ang alaga ni Lola Nita?"
A: aso
B: [empty]
C: ibon
D: isda
Correct Answer: A
```
Expected: ✗ Error message shown

## Summary
The validation now properly supports both 3-choice and 4-choice questions while maintaining data integrity. Choice D is optional, but choices A, B, and C are always required.
