#!/usr/bin/env python3
"""Auto Pronunciation Variant Generator"""
import re
from typing import List, Set

def generate_variants(word: str) -> List[str]:
    word = word.lower().strip()
    if not word or len(word) < 2:
        return [word]
    variants = set([word])
    variants.update(_vowel_substitutions(word))
    variants.update(_consonant_variations(word))
    variants.update(_silent_letter_variations(word))
    variants.update(_double_letter_variations(word))
    variants.update(_common_child_patterns(word))
    variants.update(_ending_variations(word))
    valid_variants = [v for v in variants if len(v) >= 2]
    return sorted(valid_variants)

def _vowel_substitutions(word: str) -> Set[str]:
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
    variants = set()
    consonant_rules = [
        (r'th', ['t', 'd', 'f']),
        (r'ph', ['f']),
        (r'gh', ['f', '']),
        (r'ck', ['k', 'c']),
    ]
    for pattern, replacements in consonant_rules:
        if re.search(pattern, word):
            for replacement in replacements:
                variant = re.sub(pattern, replacement, word, count=1)
                if variant != word and len(variant) >= 2:
                    variants.add(variant)
    return variants

def _silent_letter_variations(word: str) -> Set[str]:
    variants = set()
    silent_rules = [
        (r'^k(?=n)', ''),
        (r'^w(?=r)', ''),
        (r'g(?=n)', ''),
        (r'mb$', 'm'),
        (r'e$', ''),
    ]
    for pattern, replacement in silent_rules:
        if re.search(pattern, word):
            variant = re.sub(pattern, replacement, word)
            if variant != word and len(variant) >= 2:
                variants.add(variant)
    return variants

def _double_letter_variations(word: str) -> Set[str]:
    variants = set()
    variant = re.sub(r'(.)\1', r'\1', word)
    if variant != word and len(variant) >= 2:
        variants.add(variant)
    return variants

def _common_child_patterns(word: str) -> Set[str]:
    variants = set()
    child_rules = [
        (r'r', 'w'),
        (r'l', 'w'),
        (r'th', 'f'),
        (r'th', 'v'),
    ]
    for pattern, replacement in child_rules:
        if re.search(pattern, word):
            variant = re.sub(pattern, replacement, word, count=1)
            if variant != word and len(variant) >= 2:
                variants.add(variant)
    return variants

def _ending_variations(word: str) -> Set[str]:
    variants = set()
    if word.endswith('ing'):
        variants.add(word[:-1])
        variants.add(word[:-3])
    if word.endswith('ed'):
        variants.add(word[:-2] + 't')
        variants.add(word[:-2])
    if word.endswith('s') and len(word) > 2:
        variants.add(word[:-1])
    return variants

if __name__ == "__main__":
    test_words = ["heard", "said", "with", "the"]
    print("Testing pronunciation variants:")
    for word in test_words:
        variants = generate_variants(word)
        print(f"{word}: {variants[:5]}")
