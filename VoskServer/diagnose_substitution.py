#!/usr/bin/env python3
"""Diagnose why a word was marked as substitution"""

from word_matcher import match_word, check_pronunciation_match
from context_aware_corrector import correct_mishearing

def diagnose_word(spoken_word: str, expected_word: str, language: str = "english"):
    """
    Diagnose why a word was marked as substitution.
    
    Args:
        spoken_word: What Vosk heard
        expected_word: What was expected
        language: Language for matching
    """
    print("=" * 70)
    print("SUBSTITUTION DIAGNOSTIC")
    print("=" * 70)
    print()
    print(f"Spoken word (Vosk heard): '{spoken_word}'")
    print(f"Expected word (in story): '{expected_word}'")
    print(f"Language: {language}")
    print()
    print("-" * 70)
    print("CHECKING MATCHING SYSTEMS:")
    print("-" * 70)
    print()
    
    # Check 1: Exact match
    if spoken_word.lower() == expected_word.lower():
        print("✅ Exact match - Should be CORRECT")
        return
    
    # Check 2: Context correction
    corrected, was_corrected, reason = correct_mishearing(spoken_word, expected_word)
    if was_corrected:
        print(f"✅ Context correction would fix this:")
        print(f"   '{spoken_word}' → '{corrected}' ({reason})")
        print(f"   Should be marked as CORRECT")
        return
    else:
        print(f"❌ Context correction: No correction available")
        print(f"   Reason: {reason}")
    print()
    
    # Check 3: Pronunciation match
    is_match = check_pronunciation_match(spoken_word, expected_word, language)
    if is_match:
        print(f"✅ Pronunciation match - Should be CORRECT")
        return
    else:
        print(f"❌ Pronunciation match: No match found")
    print()
    
    # Check 4: Auto-generated variants
    try:
        from auto_pronunciation_generator import generate_variants
        variants = generate_variants(expected_word)
        if spoken_word.lower() in [v.lower() for v in variants]:
            print(f"✅ Auto-generated variant match - Should be CORRECT")
            print(f"   Variants: {variants[:10]}")
            return
        else:
            print(f"❌ Auto-generated variants: No match")
            print(f"   Variants: {variants[:10]}")
    except ImportError:
        print(f"⚠️  Auto-generator not available")
    print()
    
    # Conclusion
    print("-" * 70)
    print("CONCLUSION:")
    print("-" * 70)
    print(f"❌ Word marked as SUBSTITUTION")
    print(f"   This is a Vosk acoustic model error")
    print()
    print("RECOMMENDATIONS:")
    print(f"1. Add to pronunciation dictionary:")
    print(f"   '{expected_word}': ['{expected_word}', '{spoken_word}']")
    print()
    print(f"2. Add to context correction (if similar):")
    print(f"   ('{spoken_word}', '{expected_word}')")
    print()
    print(f"3. Improve audio quality (microphone, volume, noise)")
    print()
    print("=" * 70)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python diagnose_substitution.py <spoken_word> <expected_word> [language]")
        print()
        print("Example:")
        print("  python diagnose_substitution.py 'butt' 'but' english")
        sys.exit(1)
    
    spoken = sys.argv[1]
    expected = sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else "english"
    
    diagnose_word(spoken, expected, lang)
