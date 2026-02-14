# Sequential Word Matching System - Complete Guide

## Problem Statement

### The Early-Word Triggering Bug

**Scenario:**
```
Expected: "Pam has a cat. It is on the bed."
User says: "Pam has a cat..."
Vosk detects: "Pam has a cat bed" (mistakenly detects "bed" early)

Current Behavior (WRONG):
- "Pam" → marked green ✓
- "has" → marked green ✓
- "a" → marked green ✓
- "cat" → marked green ✓
- "bed" → marked green ✓ (WRONG! Should wait for "It is on the")

Result: System skips "It is on the" and marks "bed" as correct
```

### Root Cause

The old system searched the **entire transcript**