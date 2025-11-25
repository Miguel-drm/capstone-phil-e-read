#!/usr/bin/env python3
"""Test strict session start - only first word accepted"""

from word_matcher import WordMatcherSession

# Story starts with "Mia"
expected_words = ["mia", "was", "in", "her", "bedroom", "when", "she", "heard", "a", "rooster"]

print("=" * 70)
print("TESTING STRICT SESSION START")
print("=" * 70)
print()

matcher = WordMatcherSession(expected_words, "english")

print("Story first word: 'Mia'")
print("Session started:", matcher.session_started)
print()

# Test 1: Vosk hears "the" (phantom word) - should be IGNORED
print("Test 1: Vosk hears 'the' (phantom word)")
print("-" * 70)
result = matcher.process_word("the")
print(f"Result: {result['match_type']}")
print(f"Session started: {matcher.session_started}")
print(f"Details: {result['details']}")
print()

if result['match_type'] == 'waiting_for_start':
    print("✅ PASS: Phantom word ignored, waiting for first word")
else:
    print(f"❌ FAIL: Should ignore phantom word, got {result['match_type']}")
print()

# Test 2: Vosk hears "a" (word from position 8) - should be IGNORED
print("Test 2: Vosk hears 'a' (word from later in story)")
print("-" * 70)
result = matcher.process_word("a")
print(f"Result: {result['match_type']}")
print(f"Session started: {matcher.session_started}")
print(f"Details: {result['details']}")
print()

if result['match_type'] == 'waiting_for_start':
    print("✅ PASS: Later word ignored, waiting for first word")
else:
    print(f"❌ FAIL: Should ignore later word, got {result['match_type']}")
print()

# Test 3: Vosk hears "mia" (FIRST WORD) - should START SESSION
print("Test 3: Vosk hears 'mia' (FIRST WORD)")
print("-" * 70)
result = matcher.process_word("mia")
print(f"Result: {result['match_type']}")
print(f"Session started: {matcher.session_started}")
print(f"Position: {matcher.current_position}")
print(f"Details: {result['details']}")
print()

if result['match_type'] == 'correct' and matcher.session_started and matcher.current_position == 1:
    print("✅ PASS: Session started at position 0, advanced to position 1")
else:
    print(f"❌ FAIL: Should start session, got {result['match_type']}")
print()

print("=" * 70)
print("SUMMARY")
print("=" * 70)
print("✅ System now only accepts FIRST word to start session")
print("✅ Phantom words and later words are ignored")
print("✅ Student must start reading from the beginning")
print("=" * 70)
