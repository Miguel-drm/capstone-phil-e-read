# Sequential Word Matching - Complete Implementation Guide

## Problem Statement

The current system marks words as correct (green) if they appear **anywhere** in the recognized transcript, causing the **early-word triggering bug**:

### Example of the Bug
```
Expected sentence: "Pam has a cat. It is on the bed."
User says: "Pam has a cat..."

Vosk mistakenly detects "bed" early (from later in sentence)
↓
When user reaches "on the", the word "bed" is automatically marked correct
because it was already detected earlier
↓
INCORRECT: Word marked green out of sequence
```

## Solution: Strict Sequential Word Matching

Only match the **NEXT expected word** in 