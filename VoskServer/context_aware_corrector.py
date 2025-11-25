#!/usr/bin/env python3
"""
Context-Aware Word Corrector
=============================

Fixes Vosk acoustic model errors by using context (expected word) to correct
common mishearings. This solves the problem where Vosk hears "it" when the
child clearly says "in".

Problem Examples:
- Child says "in" → Vosk hears "it" → System corrects to "in"
- Child says "a" → Vosk hears "the" → System corrects to "a"
- Child says "and" → Vosk hears "an" → System corrects to "and"
"""

from typing import Optional, Tuple
from difflib import SequenceMatcher


# Common Vosk mishearings mapped to their likely corrections
VOSK_COMMON_MISHEARINGS = {
    # What Vosk hears → What was likely said
    'it': ['in', 'is', 'at'],
    'in': ['it', 'is', 'an'],
    'is': ['it', 'in', 'as'],
    'at': ['it', 'a', 'an'],
    'an': ['and', 'a', 'in'],
    'and': ['an', 'a'],
    'a': ['the', 'an', 'at'],
    'the': ['a', 'da', 'de'],
    'to': ['too', 'two', 'do'],
    'for': ['four', 'fore'],
    'or': ['are', 'our'],
    'are': ['or', 'our'],
    'be': ['bee', 'by'],
    'by': ['be', 'buy'],
    'no': ['know', 'now'],
    'know': ['no', 'now'],
    'so': ['sew', 'sow'],
    'see': ['sea', 'she'],
    'he': ['she', 'we'],
    'she': ['he', 'see'],
    'we': ['he', 'wee'],
    'me': ['my', 'we'],
    'my': ['me', 'may'],
    'can': ['cant', 'ken'],
    'cant': ['can', 'count'],
    'will': ['well', 'wheel'],
    'well': ['will', 'whale'],
    'was': ['as', 'waz'],
    'as': ['was', 'has'],
    'has': ['as', 'have'],
    'had': ['have', 'hat'],
    'have': ['had', 'half'],
    'do': ['to', 'due'],
    'does': ['dose', 'duz'],
    'did': ['deed', 'dud'],
    'not': ['knot', 'note'],
    'but': ['butt', 'bat', 'bout'],
    'butt': ['but'],  # Reverse: if Vosk hears "butt", child likely said "but"
    'if': ['iff', 'of'],
    'of': ['off', 'if'],
    'off': ['of', 'ov'],
    'on': ['own', 'one'],
    'one': ['on', 'won'],
    'two': ['to', 'too'],
    'too': ['to', 'two'],
    'three': ['tree', 'free'],
    'four': ['for', 'fore'],
    'their': ['there', 'they'],
    'there': ['their', 'they'],
    'they': ['the', 'day'],
    'them': ['then', 'dem'],
    'then': ['them', 'than'],
    'than': ['then', 'that'],
    'that': ['dat', 'the'],
    'this': ['dis', 'these'],
    'these': ['this', 'those'],
    'those': ['these', 'dose'],
    'with': ['wif', 'wit'],
    'from': ['frum', 'form'],
    'would': ['wood', 'could'],
    'could': ['would', 'cud'],
    'should': ['shud', 'shed'],
}


def calculate_phonetic_similarity(word1: str, word2: str) -> float:
    """
    Calculate phonetic similarity between two words.
    Uses character-level similarity as a proxy for phonetic similarity.
    
    Args:
        word1: First word
        word2: Second word
        
    Returns:
        Similarity score (0.0 to 1.0)
    """
    if not word1 or not word2:
        return 0.0
    
    word1 = word1.lower().strip()
    word2 = word2.lower().strip()
    
    if word1 == word2:
        return 1.0
    
    # Use SequenceMatcher for character-level similarity
    return SequenceMatcher(None, word1, word2).ratio()


def is_likely_mishearing(heard_word: str, expected_word: str, threshold: float = 0.6) -> bool:
    """
    Check if heard_word is likely a Vosk mishearing of expected_word.
    
    Args:
        heard_word: What Vosk recognized
        expected_word: What we expect based on story context
        threshold: Minimum similarity to consider it a mishearing
        
    Returns:
        True if this is likely a mishearing that should be corrected
    """
    heard_word = heard_word.lower().strip()
    expected_word = expected_word.lower().strip()
    
    # Exact match - no correction needed
    if heard_word == expected_word:
        return False
    
    # Check if heard_word is in the common mishearings list
    if heard_word not in VOSK_COMMON_MISHEARINGS:
        return False
    
    # Check if expected_word is one of the likely corrections
    likely_corrections = VOSK_COMMON_MISHEARINGS[heard_word]
    if expected_word in likely_corrections:
        return True
    
    # Check phonetic similarity
    similarity = calculate_phonetic_similarity(heard_word, expected_word)
    return similarity >= threshold


def correct_mishearing(heard_word: str, expected_word: str, 
                       confidence_threshold: float = 0.6) -> Tuple[str, bool, str]:
    """
    Correct a Vosk mishearing using context (expected word).
    
    Args:
        heard_word: What Vosk recognized
        expected_word: What we expect based on story context
        confidence_threshold: Minimum confidence to apply correction
        
    Returns:
        Tuple of (corrected_word, was_corrected, reason)
    """
    heard_word_lower = heard_word.lower().strip()
    expected_word_lower = expected_word.lower().strip()
    
    # No correction needed if exact match
    if heard_word_lower == expected_word_lower:
        return (heard_word, False, "exact_match")
    
    # Check if this is a known mishearing
    if is_likely_mishearing(heard_word_lower, expected_word_lower, confidence_threshold):
        similarity = calculate_phonetic_similarity(heard_word_lower, expected_word_lower)
        reason = f"vosk_mishearing_corrected (similarity: {similarity:.2f})"
        return (expected_word, True, reason)
    
    # No correction applied
    return (heard_word, False, "no_correction")


def should_apply_context_correction(heard_word: str, expected_word: str) -> bool:
    """
    Determine if context-aware correction should be applied.
    
    This is a high-confidence check for very common mishearings.
    
    Args:
        heard_word: What Vosk recognized
        expected_word: What we expect based on story context
        
    Returns:
        True if correction should be applied
    """
    heard_word = heard_word.lower().strip()
    expected_word = expected_word.lower().strip()
    
    # High-confidence corrections (very common mishearings)
    high_confidence_corrections = {
        ('it', 'in'),
        ('in', 'it'),
        ('a', 'the'),
        ('the', 'a'),
        ('an', 'and'),
        ('and', 'an'),
        ('to', 'too'),
        ('too', 'to'),
        ('for', 'four'),
        ('four', 'for'),
        ('their', 'there'),
        ('there', 'their'),
        ('then', 'than'),
        ('than', 'then'),
    }
    
    return (heard_word, expected_word) in high_confidence_corrections


def test_corrector():
    """Test the context-aware corrector with common examples."""
    test_cases = [
        ("it", "in", True, "Child says 'in', Vosk hears 'it'"),
        ("in", "it", True, "Child says 'it', Vosk hears 'in'"),
        ("the", "a", True, "Child says 'a', Vosk hears 'the'"),
        ("an", "and", True, "Child says 'and', Vosk hears 'an'"),
        ("cat", "dog", False, "Different words - no correction"),
        ("hello", "world", False, "Unrelated words - no correction"),
    ]
    
    print("=" * 70)
    print("CONTEXT-AWARE CORRECTOR TEST")
    print("=" * 70)
    print()
    
    for heard, expected, should_correct, description in test_cases:
        corrected, was_corrected, reason = correct_mishearing(heard, expected)
        status = "✅" if was_corrected == should_correct else "❌"
        
        print(f"{status} {description}")
        print(f"   Heard: '{heard}' | Expected: '{expected}'")
        print(f"   Result: '{corrected}' | Corrected: {was_corrected} | Reason: {reason}")
        print()
    
    print("=" * 70)


if __name__ == "__main__":
    test_corrector()
