#!/usr/bin/env python3
"""Auto Pronunciation Variant Generator"""
import re
from typing import List, Set

def generate_variants(word: str, language: str = 'auto') -> List[str]:
    """Generate pronunciation variants for a word.
    
    Args:
        word: The word to generate variants for
        language: 'english', 'tagalog', or 'auto' (auto-detect)
    
    Returns:
        List of pronunciation variants
    """
    word = word.lower().strip()
    if not word or len(word) < 2:
        return [word]
    
    # Auto-detect language if not specified
    if language == 'auto':
        language = _detect_language(word)
    
    variants = set([word])
    
    if language == 'tagalog':
        variants.update(_tagalog_vowel_variations(word))
        variants.update(_tagalog_consonant_variations(word))
        variants.update(_tagalog_prefix_variations(word))
        variants.update(_tagalog_reduplication_variations(word))
        variants.update(_tagalog_ng_variations(word))
    else:  # English
        variants.update(_vowel_substitutions(word))
        variants.update(_consonant_variations(word))
        variants.update(_silent_letter_variations(word))
        variants.update(_double_letter_variations(word))
        variants.update(_common_child_patterns(word))
        variants.update(_ending_variations(word))
    
    valid_variants = [v for v in variants if len(v) >= 2]
    return sorted(valid_variants)

def _detect_language(word: str) -> str:
    """Detect if word is likely Tagalog or English."""
    # Tagalog indicators: ng, repeated syllables, common prefixes
    tagalog_patterns = [
        r'ng',  # ng is very common in Tagalog
        r'^(mag|nag|pag|um|in|i|ka|ma|na)',  # Common Tagalog prefixes
        r'(.{2,})\1',  # Reduplication (e.g., bubulong)
        r'[aeiou]{2,}',  # Multiple vowels together
    ]
    
    for pattern in tagalog_patterns:
        if re.search(pattern, word):
            return 'tagalog'
    
    return 'english'

def _tagalog_vowel_variations(word: str) -> Set[str]:
    """Generate Tagalog vowel pronunciation variants."""
    variants = set()
    
    # Common Tagalog vowel substitutions
    vowel_rules = [
        (r'o', 'u'),  # o ↔ u (very common: bulong/bolong)
        (r'u', 'o'),  # u ↔ o
        (r'e', 'i'),  # e ↔ i
        (r'i', 'e'),  # i ↔ e
        (r'a', 'e'),  # a ↔ e (less common)
    ]
    
    for pattern, replacement in vowel_rules:
        # Replace each occurrence one at a time
        for match in re.finditer(pattern, word):
            pos = match.start()
            variant = word[:pos] + replacement + word[pos+1:]
            if variant != word:
                variants.add(variant)
    
    return variants

def _tagalog_consonant_variations(word: str) -> Set[str]:
    """Generate Tagalog consonant pronunciation variants."""
    variants = set()
    
    # Common Tagalog consonant variations
    consonant_rules = [
        (r'd', 'r'),  # d ↔ r
        (r'r', 'd'),  # r ↔ d
        (r'p', 'b'),  # p ↔ b (voicing)
        (r'b', 'p'),  # b ↔ p
        (r't', 'd'),  # t ↔ d (voicing)
        (r'k', 'g'),  # k ↔ g (voicing)
    ]
    
    for pattern, replacement in consonant_rules:
        for match in re.finditer(pattern, word):
            pos = match.start()
            variant = word[:pos] + replacement + word[pos+1:]
            if variant != word:
                variants.add(variant)
    
    return variants

def _tagalog_prefix_variations(word: str) -> Set[str]:
    """Generate variants by removing/modifying Tagalog prefixes."""
    variants = set()
    
    # Common Tagalog prefixes
    prefixes = [
        r'^mag',  # mag-laro → laro
        r'^nag',  # nag-luto → luto
        r'^pag',  # pag-kain → kain
        r'^um',   # um-inom → inom
        r'^in',   # in-inom → inom
        r'^i',    # i-binubulong → binubulong
        r'^ka',   # ka-ibigan → ibigan
        r'^ma',   # ma-laki → laki
        r'^na',   # na-ligo → ligo
    ]
    
    for prefix_pattern in prefixes:
        if re.match(prefix_pattern, word):
            variant = re.sub(prefix_pattern, '', word)
            if variant and len(variant) >= 2:
                variants.add(variant)
    
    return variants

def _tagalog_reduplication_variations(word: str) -> Set[str]:
    """Generate variants for reduplicated Tagalog words."""
    variants = set()
    
    # Check for reduplication patterns (e.g., bubulong from bu-bulong)
    # Pattern: repeated syllables at the start
    match = re.match(r'^(.{2,4})\1(.*)$', word)
    if match:
        # Remove one instance of reduplication
        base = match.group(1) + match.group(2)
        if len(base) >= 2:
            variants.add(base)
    
    # Also try removing first 2-3 characters if they seem reduplicated
    if len(word) >= 4:
        for i in range(2, min(5, len(word))):
            if word[:i] == word[i:i*2]:
                variant = word[i:]
                if len(variant) >= 2:
                    variants.add(variant)
    
    return variants

def _tagalog_ng_variations(word: str) -> Set[str]:
    """Generate variants for ng sound variations."""
    variants = set()
    
    # ng is a single sound in Tagalog but might be heard differently
    if 'ng' in word:
        # ng → n
        variant = word.replace('ng', 'n')
        if variant != word and len(variant) >= 2:
            variants.add(variant)
        
        # ng → nang (expansion)
        variant = word.replace('ng', 'nang')
        if variant != word:
            variants.add(variant)
    
    return variants

def _vowel_substitutions(word: str) -> Set[str]:
    """Generate variants with vowel substitutions."""
    variants = set()
    vowel_rules = [
        (r'ea', ['e', 'u', 'ee', 'a']),
        (r'ai', ['a', 'ay', 'e', 'i']),
        (r'oo', ['u', 'o', 'ew']),
        (r'ou', ['o', 'ow', 'u', 'oo']),
        (r'ow', ['o', 'ou', 'aw']),
        (r'ee', ['e', 'i', 'ea']),
        (r'ie', ['i', 'y', 'ee', 'e']),
        (r'igh', ['i', 'y', 'ie']),
        (r'ay', ['a', 'ai', 'ey', 'e']),
        (r'ey', ['e', 'ay', 'i', 'y']),
    ]
    for pattern, replacements in vowel_rules:
        if re.search(pattern, word):
            for replacement in replacements:
                variant = re.sub(pattern, replacement, word, count=1)
                if variant != word:
                    variants.add(variant)
    return variants

def _consonant_variations(word: str) -> Set[str]:
    """Generate variants with consonant variations."""
    variants = set()
    consonant_rules = [
        (r'th', ['t', 'd', 'f']),
        (r'ph', ['f']),
        (r'gh', ['f', '']),
        (r'ck', ['k', 'c']),
        (r'qu', ['kw', 'k', 'q']),
        (r'x', ['ks', 'z', 'x']),
        (r'c(?=[eiy])', ['s']),
        (r'g(?=[eiy])', ['j']),
    ]
    for pattern, replacements in consonant_rules:
        if re.search(pattern, word):
            for replacement in replacements:
                variant = re.sub(pattern, replacement, word, count=1)
                if variant != word and len(variant) >= 2:
                    variants.add(variant)
    return variants

def _silent_letter_variations(word: str) -> Set[str]:
    """Generate variants by removing silent letters."""
    variants = set()
    silent_rules = [
        (r'^k(?=n)', ''),
        (r'^w(?=r)', ''),
        (r'g(?=n)', ''),
        (r'mb$', 'm'),
        (r'e$', ''),
        (r'([wgr])h', r'\1'),
        (r'l(?=[kmf])', ''),
    ]
    for pattern, replacement in silent_rules:
        if re.search(pattern, word):
            variant = re.sub(pattern, replacement, word)
            if variant != word and len(variant) >= 2:
                variants.add(variant)
    return variants

def _double_letter_variations(word: str) -> Set[str]:
    """Generate variants with double/single letter variations."""
    variants = set()
    variant = re.sub(r'(.)\1', r'\1', word)
    if variant != word and len(variant) >= 2:
        variants.add(variant)
    for i, char in enumerate(word):
        if char.isalpha() and char not in 'aeiou':
            if i > 0 and word[i-1] == char:
                continue
            if i < len(word) - 1 and word[i+1] == char:
                continue
            variant = word[:i+1] + char + word[i+1:]
            if len(variant) >= 2:
                variants.add(variant)
    return variants

def _common_child_patterns(word: str) -> Set[str]:
    """Generate variants based on common child pronunciation patterns."""
    variants = set()
    child_rules = [
        (r'r', 'w'),
        (r'l', 'w'),
        (r'th', 'f'),
        (r'th', 'v'),
        (r's', 'th'),
        (r'[^aeiou]$', ''),
    ]
    for pattern, replacement in child_rules:
        if re.search(pattern, word):
            variant = re.sub(pattern, replacement, word, count=1)
            if variant != word and len(variant) >= 2:
                variants.add(variant)
    return variants

def _ending_variations(word: str) -> Set[str]:
    """Generate variants with common ending variations."""
    variants = set()
    if word.endswith('ing'):
        variants.add(word[:-1])
        variants.add(word[:-3])
    if word.endswith('ed'):
        variants.add(word[:-2] + 't')
        variants.add(word[:-2])
        variants.add(word[:-1])
    if word.endswith('s') and len(word) > 2:
        variants.add(word[:-1])
    if word.endswith('ly'):
        variants.add(word[:-2] + 'lee')
        variants.add(word[:-2])
    return variants

def test_generator():
    """Test the pronunciation variant generator."""
    print("=" * 70)
    print("PRONUNCIATION VARIANT GENERATOR TEST")
    print("=" * 70)
    print()
    
    print("ENGLISH WORDS:")
    print("-" * 70)
    english_words = ["heard", "said", "been", "with", "the", "know", "write"]
    for word in english_words:
        variants = generate_variants(word, 'english')
        print(f"{word:15} -> {', '.join(variants[:8])}")
    
    print()
    print("TAGALOG WORDS:")
    print("-" * 70)
    tagalog_words = ["ibinubulong", "kumain", "maglaro", "bubulong", "nagluto", "pagkain"]
    for word in tagalog_words:
        variants = generate_variants(word, 'tagalog')
        print(f"{word:15} -> {', '.join(variants[:10])}")
    
    print()
    print("AUTO-DETECT:")
    print("-" * 70)
    auto_words = ["ibinubulong", "heard", "maglaro", "write"]
    for word in auto_words:
        variants = generate_variants(word, 'auto')
        detected = _detect_language(word)
        print(f"{word:15} ({detected:7}) -> {', '.join(variants[:8])}")
    
    print()
    print("=" * 70)

if __name__ == "__main__":
    test_generator()
