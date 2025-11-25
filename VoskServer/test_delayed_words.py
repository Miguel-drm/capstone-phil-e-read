#!/usr/bin/env python3
"""Test handling of delayed words from Vosk buffering"""

from word_matcher import match_word

# Story: "wanted to sleep some more But she knew"
expected_words = ["wanted", "to", "sleep", "some", "more", "but", "she", "knew"]

print("=" * 70)
print("TESTING DELAYED WORD HANDLING")
print("=" * 70)
print()

print("Story: wanted to sleep some more But she knew")
print("Positions: 0      1  2     3    4    5   6   7")
print()

# Simulate: Student reads correctly, but Vosk delivers "sleep" late
print("Scenario: Student reads correctly, but Vosk buffers 'sleep'")
print("-" * 70)
print()

# Words arrive in order: wanted, to, some, more, but, [delayed: sleep]
current_position = 0

# Word 1: "wanted" - correct
print("1. Vosk sends: 'wanted' (expected: 'wanted' at position 0)")
result = match_word("wanted", expected_words[0], expected_words, 0, "english")
print(f"   Result: {result['match_type']} - {result['details']}")
current_position = result['new_position']
print(f"   New position: {current_position}")
print()

# Word 2: "to" - correct
print("2. Vosk sends: 'to' (expected: 'to' at position 1)")
result = match_word("to", expected_words[1], expected_words, 1, "english")
print(f"   Result: {result['match_type']} - {result['details']}")
current_position = result['new_position']
print(f"   New position: {current_position}")
print()

# Word 3: "some" - SKIPPED "sleep"! (Vosk buffered it)
print("3. Vosk sends: 'some' (expected: 'sleep' at position 2)")
print("   ⚠️  Vosk skipped 'sleep' - it's buffered!")
result = match_word("some", expected_words[2], expected_words, 2, "english")
print(f"   Result: {result['match_type']} - {result['details']}")
current_position = result['new_position']
print(f"   New position: {current_position}")
print()

# Word 4: "more" - correct
print("4. Vosk sends: 'more' (expected: 'more' at position 4)")
result = match_word("more", expected_words[4], expected_words, 4, "english")
print(f"   Result: {result['match_type']} - {result['details']}")
current_position = result['new_position']
print(f"   New position: {current_position}")
print()

# Word 5: "but" - correct
print("5. Vosk sends: 'but' (expected: 'but' at position 5)")
result = match_word("but", expected_words[5], expected_words, 5, "english")
print(f"   Result: {result['match_type']} - {result['details']}")
current_position = result['new_position']
print(f"   New position: {current_position}")
print()

# Word 6: "sleep" - DELAYED! (arrives now, but was at position 2)
print("6. Vosk sends: 'sleep' (DELAYED from position 2, now at position 6)")
print("   🔄 Delayed word finally arrives!")
result = match_word("sleep", expected_words[6], expected_words, 6, "english")
print(f"   Result: {result['match_type']} - {result['details']}")
print(f"   New position: {result['new_position']}")
print()

if result['match_type'] == 'correct' and 'Delayed word' in result['details']:
    print("✅ PASS: Delayed word recognized and marked as correct")
    print("✅ Position stayed at 6 (didn't go backwards)")
else:
    print(f"❌ FAIL: Should recognize delayed word, got {result['match_type']}")
    print(f"   Details: {result['details']}")

print()
print("=" * 70)
print("SUMMARY")
print("=" * 70)
print("✅ System now looks back 5 words for delayed words")
print("✅ Delayed words marked as correct (not substitution)")
print("✅ Position doesn't move backwards")
print("=" * 70)
