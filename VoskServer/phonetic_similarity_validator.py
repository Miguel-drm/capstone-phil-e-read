#!/usr/bin/env python3
"""
Phonetic Similarity Validator - Prevents false substitutions
Validates substitutions by checking phonetic similarity between spoken and expected words.

This prevents marking words as substitutions when they are:
1. Phonetically similar (cow/crow = 80% similar)
2. Pronunciation variants (the/da, a/uh)
3. Common Vosk mishearings (bed/bad, cat/cut)

Only marks as substitution when words are truly different:
- cow/truck = 0% similar → TRUE substitution
- cat/dog = semantically related → TRUE substitution
- bed/bad = phonetically similar → MISPRONUNCIATION (not substitution)
"""

import re
from typing import Tuple
from difflib import SequenceMatcher


def normalize_word(word: str) -> str:
    """Normalize a word for comparison (lowercase, remove punctuation)."""
    return re.sub(r'[^\w]', '', word.lower()).strip()


def calculate_phonetic_similarity(word1: str, word2: str) -> float:
    """
    Calculate phonetic similarity between two words (0.0 to 1.0).
    
    Uses multiple similarity metrics:
    1. Character-level similarity (SequenceMatcher)
    2. Phonetic pattern matching (consonants, vowels)
    3. Sound-alike detection (rhyming, similar endings)
    
    Args:
        word1: First word
        word2: Second word
        
    Returns:
        Similarity score from 0.0 (completely different) to 1.0 (identical)
    """
    word1_norm = normalize_word(word1)
    word2_norm = normalize_word(word2)
    
    if not word1_norm or not word2_norm:
        return 0.0
    
    # 1. Character-level similarity
    char_similarity = SequenceMatcher(None, word1_norm, word2_norm).ratio()
    
    # 2. Consonant pattern similarity (important for phonetics)
    vowels = 'aeiou'
    consonants1 = ''.join(c for c in word1_norm if c not in vowels)
    consonants2 = ''.join(c for c in word2_norm if c not in vowels)
    
    consonant_similarity = 0.0
    if consonants1 and consonants2:
        consonant_similarity = SequenceMatcher(None, consonants1, consonants2).ratio()
    
    # 3. Rhyming/ending similarity (children often confuse rhyming words)
    ending_similarity = 0.0
    if len(word1_norm) >= 2 and len(word2_norm) >= 2:
        # Check last 2-3 characters
        ending_len = min(3, len(word1_norm), len(word2_norm))
        ending1 = word1_norm[-ending_len:]
        ending2 = word2_norm[-ending_len:]
        ending_similarity = SequenceMatcher(None, ending1, ending2).ratio()
    
    # 4. Starting similarity (important for word recognition)
    starting_similarity = 0.0
    if len(word1_norm) >= 2 and len(word2_norm) >= 2:
        starting_len = min(3, len(word1_norm), len(word2_norm))
        starting1 = word1_norm[:starting_len]
        starting2 = word2_norm[:starting_len]
        starting_similarity = SequenceMatcher(None, starting1, starting2).ratio()
    
    # Weighted average of all similarity metrics
    # Character similarity is most important, followed by consonants
    total_similarity = (
        char_similarity * 0.40 +           # 40% weight on overall character match
        consonant_similarity * 0.30 +      # 30% weight on consonant pattern
        ending_similarity * 0.15 +         # 15% weight on rhyming
        starting_similarity * 0.15         # 15% weight on starting sound
    )
    
    return total_similarity


def is_pronunciation_variant(spoken: str, expected: str) -> bool:
    """
    Check if spoken word is a known pronunciation variant of expected word.
    
    These are words that sound the same but are transcribed differently by Vosk:
    - "the" → "da", "de", "thee", "thuh"
    - "a" → "uh", "ah", "ay"
    - "to" → "too", "two"
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        
    Returns:
        True if spoken is a pronunciation variant of expected
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Known pronunciation variants (bidirectional)
    pronunciation_variants = {
        'a': ['uh', 'ah', 'ay', 'eh'],
        'the': ['da', 'de', 'thee', 'thuh', 'duh'],
        'to': ['too', 'two'],
        'i': ['eye', 'aye'],
        'no': ['know'],
        'sit': ['set'],
        'nap': ['knap'],
        'sad': ['said'],
        'it': ['et', 'at'],
        'on': ['an'],
        'is': ['as'],
    }
    
    # Check if expected has variants that match spoken
    if expected_norm in pronunciation_variants:
        if spoken_norm in pronunciation_variants[expected_norm]:
            return True
    
    # Check reverse - if spoken has variants that match expected
    if spoken_norm in pronunciation_variants:
        if expected_norm in pronunciation_variants[spoken_norm]:
            return True
    
    return False


def is_common_vosk_confusion(spoken: str, expected: str) -> bool:
    """
    Check if this is a common Vosk recognition error.
    
    Vosk frequently confuses certain words due to acoustic similarity:
    - bed/bad, bet, bid
    - cat/cut, cot, kit
    - sit/set, sat
    
    These should be marked as mispronunciations, not substitutions.
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        
    Returns:
        True if this is a common Vosk confusion
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Common Vosk confusions (bidirectional)
    vosk_confusions = {
        'bed': ['bad', 'bet', 'bid', 'bead'],
        'cat': ['cut', 'cot', 'kit', 'caught'],
        'sit': ['set', 'sat', 'seat'],
        'mat': ['met', 'mitt', 'matte'],
        'pat': ['pet', 'pit', 'pot'],
        'bat': ['bet', 'bit', 'bot'],
        'hat': ['hit', 'hot', 'hut'],
        'can': ['ken', 'con'],
        'pan': ['pen', 'pin', 'pun'],
        'man': ['men', 'min'],
    }
    
    # Check if expected has confusions that match spoken
    if expected_norm in vosk_confusions:
        if spoken_norm in vosk_confusions[expected_norm]:
            return True
    
    # Check reverse
    if spoken_norm in vosk_confusions:
        if expected_norm in vosk_confusions[spoken_norm]:
            return True
    
    return False


def has_single_letter_difference(spoken: str, expected: str) -> bool:
    """
    Check if words differ by only one letter (common mispronunciation).
    
    Examples:
    - cat/bat (first letter)
    - sit/set (middle letter)
    - bed/bet (last letter)
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        
    Returns:
        True if words differ by exactly one letter
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Must be same length
    if len(spoken_norm) != len(expected_norm):
        return False
    
    # Count differences
    differences = sum(1 for a, b in zip(spoken_norm, expected_norm) if a != b)
    
    return differences == 1


def has_consonant_confusion(spoken: str, expected: str) -> bool:
    """
    Check if words differ only by confused consonants.
    
    Common consonant confusions:
    - b/p (voiced/unvoiced)
    - d/t (voiced/unvoiced)
    - g/k (voiced/unvoiced)
    - f/v (fricatives)
    - m/n (nasals)
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        
    Returns:
        True if words differ only by confused consonants
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Consonant confusion pairs
    consonant_pairs = [
        ('b', 'p'), ('d', 't'), ('g', 'k'),  # Voiced/unvoiced
        ('f', 'v'), ('s', 'z'),              # Fricatives
        ('m', 'n'), ('l', 'r'),              # Nasals and liquids
    ]
    
    for c1, c2 in consonant_pairs:
        # Check if replacing one consonant makes words match
        if spoken_norm.replace(c1, c2) == expected_norm:
            return True
        if spoken_norm.replace(c2, c1) == expected_norm:
            return True
    
    return False


def has_vowel_confusion(spoken: str, expected: str) -> bool:
    """
    Check if words have same consonants but different vowels.
    
    Example: bed/bad/bid (same consonants b-d, different vowels)
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        
    Returns:
        True if words have same consonants, different vowels
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    vowels = 'aeiou'
    
    # Extract consonants
    spoken_consonants = ''.join(c for c in spoken_norm if c not in vowels)
    expected_consonants = ''.join(c for c in expected_norm if c not in vowels)
    
    # Same consonants, different vowels
    return (spoken_consonants == expected_consonants and 
            len(spoken_consonants) > 0 and 
            spoken_norm != expected_norm)


def validate_substitution(spoken: str, expected: str, threshold: float = 0.60) -> Tuple[bool, str, float]:
    """
    Validate if a word should be marked as substitution or mispronunciation.
    
    Returns:
        Tuple of (is_substitution, reason, similarity_score)
        
        is_substitution: True if this is a TRUE substitution (different word)
                        False if this is a mispronunciation (same word, said wrong)
        
        reason: Human-readable explanation
        
        similarity_score: Phonetic similarity (0.0 to 1.0)
    
    Examples:
        validate_substitution("cow", "crow")
        → (False, "phonetically similar (85%)", 0.85)
        
        validate_substitution("cow", "truck")
        → (True, "completely different words (15%)", 0.15)
        
        validate_substitution("bed", "bad")
        → (False, "common Vosk confusion", 0.75)
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Calculate phonetic similarity
    similarity = calculate_phonetic_similarity(spoken, expected)
    
    # 1. Check for pronunciation variants (highest priority)
    if is_pronunciation_variant(spoken, expected):
        return (False, "pronunciation variant", 1.0)
    
    # 2. Check for common Vosk confusions
    if is_common_vosk_confusion(spoken, expected):
        return (False, "common Vosk confusion", similarity)
    
    # 3. Check for single letter difference
    if has_single_letter_difference(spoken, expected):
        return (False, "single letter difference", similarity)
    
    # 4. Check for consonant confusion
    if has_consonant_confusion(spoken, expected):
        return (False, "consonant confusion", similarity)
    
    # 5. Check for vowel confusion
    if has_vowel_confusion(spoken, expected):
        return (False, "vowel confusion", similarity)
    
    # 6. Check phonetic similarity threshold
    if similarity >= threshold:
        return (False, f"phonetically similar ({int(similarity*100)}%)", similarity)
    
    # 7. If we get here, words are truly different → TRUE SUBSTITUTION
    return (True, f"different words ({int(similarity*100)}% similar)", similarity)


def test_validator():
    """Test the phonetic similarity validator with examples."""
    print("\n🧪 Testing Phonetic Similarity Validator\n")
    
    test_cases = [
        # Should be MISPRONUNCIATION (not substitution)
        ("cow", "crow", False, "phonetically similar"),
        ("bed", "bad", False, "common Vosk confusion"),
        ("cat", "cut", False, "vowel confusion"),
        ("sit", "set", False, "single letter difference"),
        ("the", "da", False, "pronunciation variant"),
        ("a", "uh", False, "pronunciation variant"),
        
        # Should be TRUE SUBSTITUTION
        ("cow", "truck", True, "completely different"),
        ("cat", "dog", True, "different animals"),
        ("happy", "sad", True, "different emotions"),
        ("run", "walk", True, "different actions"),
    ]
    
    print("Testing substitution validation:\n")
    for spoken, expected, should_be_sub, description in test_cases:
        is_sub, reason, similarity = validate_substitution(spoken, expected)
        
        status = "✅" if is_sub == should_be_sub else "❌"
        sub_type = "SUBSTITUTION" if is_sub else "MISPRONUNCIATION"
        
        print(f"{status} '{spoken}' → '{expected}'")
        print(f"   Result: {sub_type}")
        print(f"   Reason: {reason}")
        print(f"   Similarity: {int(similarity*100)}%")
        print(f"   Expected: {description}\n")


if __name__ == "__main__":
    test_validator()
