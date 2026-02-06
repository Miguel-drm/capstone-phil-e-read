#!/usr/bin/env python3
"""
Word Matcher - Server-side word matching for reading sessions
Handles all word matching logic including pronunciation variants,
omissions, substitutions, and mispronunciations.
"""

from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher
import re
import time

# Import timing validator
try:
    from timing_validator import TimingValidator
    TIMING_VALIDATOR_AVAILABLE = True
except ImportError:
    TIMING_VALIDATOR_AVAILABLE = False
    print("⚠ Timing validator not available")

# Import pronunciation dictionaries
try:
    from english_pronunciation_dictionary import PRONUNCIATION_DICT as ENGLISH_DICT
    ENGLISH_AVAILABLE = True
except ImportError:
    ENGLISH_AVAILABLE = False
    ENGLISH_DICT = {}

try:
    from tagalog_pronunciation_dictionary import PRONUNCIATION_DICT as TAGALOG_DICT
    TAGALOG_AVAILABLE = True
except ImportError:
    TAGALOG_AVAILABLE = False
    TAGALOG_DICT = {}

# Import auto pronunciation generator
try:
    from auto_pronunciation_generator import generate_variants
    AUTO_GENERATION_ENABLED = True
except ImportError:
    def generate_variants(word: str):
        return [word.lower().strip()]
    AUTO_GENERATION_ENABLED = False

# Import context-aware corrector
try:
    from context_aware_corrector import correct_mishearing, should_apply_context_correction
    CONTEXT_CORRECTION_ENABLED = True
    print("✓ Context-aware corrector loaded")
except ImportError:
    def correct_mishearing(heard, expected, threshold=0.6):
        return (heard, False, "not_available")
    def should_apply_context_correction(heard, expected):
        return False
    CONTEXT_CORRECTION_ENABLED = False

# Import phonetic similarity validator
try:
    from phonetic_similarity_validator import validate_substitution
    PHONETIC_VALIDATOR_ENABLED = True
    print("✓ Phonetic similarity validator loaded")
except ImportError:
    def validate_substitution(spoken, expected, threshold=0.60):
        # Fallback: use simple similarity
        from difflib import SequenceMatcher
        similarity = SequenceMatcher(None, spoken.lower(), expected.lower()).ratio()
        is_sub = similarity < threshold
        return (is_sub, f"{int(similarity*100)}% similar", similarity)
    PHONETIC_VALIDATOR_ENABLED = False


def normalize_word(word: str) -> str:
    """Normalize a word for comparison (lowercase, remove punctuation)."""
    return re.sub(r'[^\w]', '', word.lower()).strip()


def calculate_similarity(word1: str, word2: str) -> float:
    """Calculate similarity between two words (0.0 to 1.0)."""
    if not word1 or not word2:
        return 0.0
    return SequenceMatcher(None, word1, word2).ratio()


def is_semantically_related(word1: str, word2: str) -> bool:
    """
    Check if two words are semantically related (would make sense as a substitution).
    
    A true substitution should be semantically related to the expected word.
    If words are completely unrelated, it's likely a Vosk error, not a real substitution.
    
    Examples:
    - "cat" → "dog" = Related (both animals) → True substitution
    - "cat" → "bed" = Unrelated → Likely Vosk error
    - "happy" → "sad" = Related (both emotions) → True substitution
    - "run" → "walk" = Related (both actions) → True substitution
    
    Args:
        word1: First word
        word2: Second word
        
    Returns:
        True if words are semantically related (real substitution likely)
    """
    word1_norm = normalize_word(word1)
    word2_norm = normalize_word(word2)
    
    # Semantic categories - words that could reasonably be substituted
    semantic_groups = {
        # Animals
        'animals': {'cat', 'dog', 'bird', 'fish', 'pet', 'animal', 'puppy', 'kitten'},
        
        # Furniture/Objects
        'furniture': {'bed', 'chair', 'table', 'desk', 'sofa', 'couch', 'mat'},
        
        # Actions
        'actions': {'sit', 'run', 'walk', 'jump', 'play', 'sleep', 'nap', 'rest'},
        
        # Emotions
        'emotions': {'happy', 'sad', 'mad', 'glad', 'angry', 'upset'},
        
        # People
        'people': {'mom', 'dad', 'boy', 'girl', 'man', 'woman', 'child', 'baby'},
        
        # Places
        'places': {'home', 'house', 'school', 'park', 'room'},
        
        # Size/Descriptors
        'size': {'big', 'small', 'little', 'large', 'tiny', 'huge'},
        
        # Colors
        'colors': {'red', 'blue', 'green', 'yellow', 'black', 'white'},
        
        # Numbers
        'numbers': {'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'},
        
        # Common verbs
        'verbs': {'is', 'are', 'was', 'were', 'has', 'have', 'had', 'can', 'will', 'do', 'does'},
        
        # Articles/Determiners
        'articles': {'a', 'an', 'the', 'this', 'that', 'these', 'those'},
        
        # Prepositions
        'prepositions': {'on', 'in', 'at', 'by', 'to', 'from', 'with', 'off'},
    }
    
    # Check if both words are in the same semantic group
    for group_name, words in semantic_groups.items():
        if word1_norm in words and word2_norm in words:
            return True  # Same category - could be a real substitution
    
    # Check for rhyming words (children often substitute rhyming words)
    # Words that end with the same 2+ characters
    if len(word1_norm) >= 3 and len(word2_norm) >= 3:
        if word1_norm[-2:] == word2_norm[-2:]:
            return True  # Rhyming words - could be a real substitution
    
    return False  # Unrelated words - likely Vosk error


def is_likely_mishearing(spoken: str, expected: str) -> bool:
    """
    Check if spoken word is likely a Vosk mishearing rather than a real substitution.
    
    This reduces false substitutions by identifying common Vosk recognition errors:
    - Phonetically similar words (bed/bad, cat/cut)
    - Single letter differences (cat/bat, sit/set)
    - Common consonant confusions (b/p, d/t, g/k)
    - Vowel confusions (a/e/i/o/u)
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        
    Returns:
        True if this is likely a mishearing (should be mispronunciation, not substitution)
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Same length words with 1 character difference - likely mishearing
    if len(spoken_norm) == len(expected_norm):
        differences = sum(1 for a, b in zip(spoken_norm, expected_norm) if a != b)
        if differences == 1:
            return True  # Single character difference (cat/bat, sit/set)
    
    # Check for common consonant confusions
    consonant_pairs = [
        ('b', 'p'), ('d', 't'), ('g', 'k'),  # Voiced/unvoiced pairs
        ('f', 'v'), ('s', 'z'), ('th', 'f'),  # Fricatives
        ('m', 'n'), ('l', 'r'),  # Nasals and liquids
    ]
    
    for c1, c2 in consonant_pairs:
        # Check if words differ only by these consonants
        if spoken_norm.replace(c1, c2) == expected_norm or spoken_norm.replace(c2, c1) == expected_norm:
            return True
    
    # Check for vowel confusions (a/e/i/o/u)
    vowels = 'aeiou'
    spoken_consonants = ''.join(c for c in spoken_norm if c not in vowels)
    expected_consonants = ''.join(c for c in expected_norm if c not in vowels)
    
    # Same consonants, different vowels - likely mishearing
    if spoken_consonants == expected_consonants and len(spoken_consonants) > 0:
        return True
    
    # Check for common Vosk-specific mishearings
    # These are words that Vosk frequently confuses
    vosk_confusions = {
        'bed': ['bad', 'bet', 'bid'],
        'cat': ['cut', 'cot', 'kit'],
        'sit': ['set', 'sat'],
        'the': ['a', 'da', 'de'],
        'a': ['the', 'uh'],
        'it': ['at', 'et'],
        'on': ['an', 'in'],
        'is': ['as', 'us'],
    }
    
    # Check bidirectional confusions
    if expected_norm in vosk_confusions:
        if spoken_norm in vosk_confusions[expected_norm]:
            return True
    
    if spoken_norm in vosk_confusions:
        if expected_norm in vosk_confusions[spoken_norm]:
            return True
    
    return False


def is_reversal(spoken: str, expected: str) -> bool:
    """
    Check if spoken word is a reversal of expected word.
    
    A reversal occurs when letters are reversed:
    - "was" → "saw"
    - "on" → "no"
    - "pot" → "top"
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        
    Returns:
        True if spoken is the reverse of expected
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Check if spoken is the reverse of expected
    # Must be at least 2 characters to be a meaningful reversal
    if len(spoken_norm) >= 2 and len(expected_norm) >= 2:
        return spoken_norm == expected_norm[::-1]
    
    return False


def check_pronunciation_match(spoken: str, expected: str, language: str = "english", allow_mishearings: bool = True) -> bool:
    """
    Check if spoken word matches expected word using pronunciation dictionaries.
    
    Args:
        spoken: Word that was spoken
        expected: Expected word
        language: Language for pronunciation matching
        allow_mishearings: Whether to allow common Vosk mishearings (default True)
        
    Returns:
        True if words match (including pronunciation variants)
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Exact match
    if spoken_norm == expected_norm:
        return True
    
    # Check pronunciation dictionaries
    dict_to_use = ENGLISH_DICT if language == "english" else TAGALOG_DICT
    
    # Check if expected word has pronunciation variants
    if expected_norm in dict_to_use:
        variants = [normalize_word(v) for v in dict_to_use[expected_norm]]
        if spoken_norm in variants:
            return True
    
    # Check if spoken word has pronunciation variants that match expected
    if spoken_norm in dict_to_use:
        variants = [normalize_word(v) for v in dict_to_use[spoken_norm]]
        if expected_norm in variants:
            return True
    
    # AUTO-GENERATION: If not in dictionary, generate variants on-the-fly
    if AUTO_GENERATION_ENABLED and expected_norm not in dict_to_use:
        auto_variants = [normalize_word(v) for v in generate_variants(expected_norm)]
        if spoken_norm in auto_variants:
            print(f"🤖 Auto-matched: '{spoken}' -> '{expected}' (generated variant)")
            return True
    
    # Common mishearings (Vosk-specific) - ONLY for pronunciation variants
    # These should be CONSERVATIVE - only include variants that are truly interchangeable
    # DO NOT include words that sound completely different!
    common_mishearings = {
        'a': ['uh', 'ah', 'ay'],  # Article "a" pronunciations only
        'the': ['da', 'de', 'thee', 'thuh'],  # Article "the" pronunciations only
        'i': ['eye', 'aye'],
        'to': ['too', 'two'],
        'no': ['know'],  # Removed "now" - different word
        'sit': ['set'],
        'nap': ['knap'],
        'sad': ['said']  # "sad" matches "sad?"
    }
    
    # Check if spoken matches expected through mishearings
    if expected_norm in common_mishearings:
        if spoken_norm in common_mishearings[expected_norm]:
            return True
    
    # Check reverse - if expected matches spoken through mishearings
    if spoken_norm in common_mishearings:
        if expected_norm in common_mishearings[spoken_norm]:
            return True
    
    return False


def match_word(
    spoken_word: str,
    expected_word: str,
    expected_words: List[str],
    current_position: int,
    language: str = "english"
) -> Dict:
    """
    Match a spoken word against the expected word sequence.
    
    Args:
        spoken_word: Word recognized by Vosk
        expected_word: Expected word at current position
        expected_words: Full list of expected words
        current_position: Current position in expected words
        language: Language for pronunciation matching
        
    Returns:
        Dictionary with match result:
        {
            "match_type": "correct|omission|substitution|mispronunciation",
            "advance": bool,  # Whether to advance position
            "new_position": int,  # New position after match
            "miscue_count": int,  # Number of miscues (0 or 1)
            "details": str  # Human-readable description
        }
    """
    spoken_norm = normalize_word(spoken_word)
    expected_norm = normalize_word(expected_word)
    
    # CONTEXT-AWARE CORRECTION DISABLED: Causing false corrections
    # The context corrector was "fixing" words that were already correct
    # This added confusion instead of helping
    if False and CONTEXT_CORRECTION_ENABLED:
        corrected_word, was_corrected, reason = correct_mishearing(spoken_word, expected_word)
        if was_corrected:
            print(f"🔧 Context correction: '{spoken_word}' → '{corrected_word}' ({reason})")
            return {
                "match_type": "correct",
                "advance": True,
                "new_position": current_position + 1,
                "miscue_count": 0,
                "details": f"Correct (context-corrected): '{spoken_word}' → '{corrected_word}'"
            }
    
    # Check for exact match or pronunciation variant
    if check_pronunciation_match(spoken_word, expected_word, language):
        return {
            "match_type": "correct",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 0,
            "details": f"Correct: '{spoken_word}' matches '{expected_word}'"
        }
    
    # INSERTION DETECTION DISABLED: Was causing false positives when children read quickly
    # Example: Child says "Si Brownie ay" quickly, system incorrectly marked "ay" as insertion
    # Now we only detect insertions through omission logic (if word matches future position)
    
    # TRANSPOSITION DETECTION DISABLED: Too many false positives
    # The transposition logic was causing confusion by marking correct words as "pending"
    # Real transpositions are rare in reading, so we'll treat them as substitutions instead
    # This simplifies the logic and reduces false omissions
    if False and current_position + 1 < len(expected_words):
        next_word = expected_words[current_position + 1]
        if check_pronunciation_match(spoken_word, next_word, language, allow_mishearings=False):
            # Spoken word matches NEXT expected word - possible transposition!
            print(f"   🔄 TRANSPOSITION POSSIBLE: '{spoken_word}' matches next word '{next_word}', expecting '{expected_word}' next")
            return {
                "match_type": "transposition_pending",
                "advance": False,  # Don't advance yet - need to confirm with next word
                "new_position": current_position,
                "miscue_count": 0,  # Don't count yet - wait for confirmation
                "transposed_word": spoken_word,
                "expected_word": expected_word,
                "details": f"Transposition pending: '{spoken_word}' matches next word, waiting for '{expected_word}'"
            }
    
    # VOSK-OPTIMIZED SEARCH: Handle Vosk's word reordering
    # Vosk often outputs words out of order due to internal buffering
    # ONLY look behind - look-ahead causes too many false omissions
    look_behind_range = 5  # Look 5 words back (handles Vosk's word reordering)
    
    # Check behind ONLY (for delayed words from Vosk buffering)
    # This prevents marking delayed words as substitutions
    for i in range(1, min(look_behind_range + 1, current_position + 1)):
        past_word = expected_words[current_position - i]
        # Use EXACT match only (no pronunciation variants) to prevent false matches
        if normalize_word(spoken_word) == normalize_word(past_word):
            # Found a delayed word! Mark as correct but don't move position backwards
            # This handles Vosk's buffering delays where words arrive out of order
            return {
                "match_type": "correct",
                "advance": False,  # Don't advance position (word was from the past)
                "new_position": current_position,  # Stay at current position
                "miscue_count": 0,
                "details": f"Delayed word: '{spoken_word}' from position -{i} (Vosk buffering delay)"
            }
    
    # LOOK-AHEAD DISABLED: Causes too many false omissions due to Vosk's word reordering
    # Real omissions will be detected as substitutions, which is more accurate
    # Example: If child skips "a" and says "cat", we'll mark it as substitution
    # This is better than jumping ahead and marking multiple words as omissions
    
    # Check for REVERSAL first (before similarity check)
    # Reversal: letters are reversed (e.g., "was" → "saw", "on" → "no")
    if is_reversal(spoken_word, expected_word):
        return {
            "match_type": "reversal",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": 0.0,  # Reversal is a specific type of error
            "details": f"Reversal: '{spoken_word}' is reverse of '{expected_word}'"
        }
    
    # PHONETIC SIMILARITY VALIDATION:
    # Use advanced phonetic validator to determine if this is a true substitution
    # or just a mispronunciation/Vosk error
    
    is_true_substitution, validation_reason, phonetic_similarity = validate_substitution(
        spoken_word, 
        expected_word, 
        threshold=0.60
    )
    
    # Check for dropped endings (common in Tagalog)
    is_dropped_ending = (
        expected_norm.startswith(spoken_norm) and
        len(spoken_norm) >= 2 and
        len(expected_norm) - len(spoken_norm) <= 2
    )
    
    # Check for added endings (e.g., "thuh" for "a")
    is_added_ending = (
        spoken_norm.startswith(expected_norm) and
        len(expected_norm) >= 1 and
        len(spoken_norm) - len(expected_norm) <= 3
    )
    
    # Override validator if we detect dropped/added endings
    if is_dropped_ending or is_added_ending:
        is_true_substitution = False
        if is_dropped_ending:
            validation_reason = "dropped ending"
        else:
            validation_reason = "added ending"
    
    # INTELLIGENT CLASSIFICATION:
    # Use phonetic validator result to classify the miscue
    
    if not is_true_substitution:
        # MISPRONUNCIATION: Phonetically similar or Vosk confusion
        # The child attempted the correct word but said it slightly wrong
        # OR Vosk misheard a correct pronunciation
        
        print(f"   🔍 Phonetic validation: MISPRONUNCIATION - {validation_reason}")
        
        return {
            "match_type": "mispronunciation",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": phonetic_similarity,
            "validation_reason": validation_reason,
            "details": f"Mispronunciation: '{spoken_word}' instead of '{expected_word}' ({validation_reason})"
        }
    else:
        # TRUE SUBSTITUTION: Completely different word
        # The child said a different word (not just mispronounced)
        # Examples: "cat" → "dog", "run" → "walk"
        
        print(f"   🔍 Phonetic validation: SUBSTITUTION - {validation_reason}")
        
        return {
            "match_type": "substitution",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": phonetic_similarity,
            "validation_reason": validation_reason,
            "details": f"Substitution: '{spoken_word}' instead of '{expected_word}' ({validation_reason})"
        }


class WordMatcherSession:
    """
    Manages word matching state for a reading session.
    """
    
    def __init__(self, expected_words: List[str], language: str = "english"):
        """
        Initialize word matcher session.
        
        Args:
            expected_words: List of expected words in order
            language: Language for pronunciation matching
        """
        self.expected_words = expected_words
        self.language = language
        self.current_position = 0
        self.total_miscues = 0
        self.miscue_types = {
            "mispronunciation": 0,
            "omission": 0,
            "substitution": 0,
            "insertion": 0,
            "repetition": 0,
            "selfCorrection": 0,
            "reversal": 0,
            "transposition": 0
        }
        self.words_read = 0
        self.session_started = False  # Track if session has started
        
        # REMOVED: Unused state variables from disabled features
        # - recent_words, max_recent_words (insertion detection - disabled)
        # - pending_word (insertion detection - disabled)
        # - last_spoken_word (repetition detection - disabled)
        # - last_match_result (self-correction detection - disabled)
        # - transposition_pending, transposition_first_word (transposition - disabled)
        
        # Initialize smart buffer matcher for handling Vosk's word reordering
        try:
            from smart_buffer_matcher import SmartBufferMatcher
            # Use 8-word buffer for immediate response
            # Optimistic matching provides instant feedback when words arrive in order
            self.smart_buffer = SmartBufferMatcher(expected_words, buffer_size=8)
            self.use_smart_buffer = True
            print("✓ Smart buffer matcher initialized with 80-word buffer + optimistic matching")
        except ImportError:
            self.smart_buffer = None
            self.use_smart_buffer = False
            print("⚠ Smart buffer matcher not available")
        
        # Initialize timing validator for lag detection
        if TIMING_VALIDATOR_AVAILABLE:
            self.timing_validator = TimingValidator(expected_words, language)
            print("✓ Timing validator initialized (lag detection enabled)")
        else:
            self.timing_validator = None
    
    def process_word(self, spoken_word: str) -> Dict:
        """
        Process a spoken word and return match result.
        
        Args:
            spoken_word: Word recognized by Vosk
            
        Returns:
            Match result dictionary
        """
        # Use smart buffer if available
        if self.use_smart_buffer and self.smart_buffer:
            result = self.smart_buffer.add_word(spoken_word)
            
            # If buffer returned a result, use it
            if result:
                # Update our state from smart buffer
                self.current_position = result["new_position"]
                self.words_read = result["words_read"]
                self.total_miscues = result["total_miscues"]
                
                # Update miscue types
                if result["match_type"] in self.miscue_types:
                    self.miscue_types[result["match_type"]] += result["miscue_count"]
                
                # Add session state
                result["session_state"] = {
                    "current_position": self.current_position,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "miscue_types": self.miscue_types.copy(),
                    "progress": f"{self.current_position}/{len(self.expected_words)}"
                }
                
                return result
            else:
                # Still buffering - return a "buffering" status
                return {
                    "match_type": "buffering",
                    "advance": False,
                    "new_position": self.current_position,
                    "miscue_count": 0,
                    "details": "Buffering words for intelligent matching"
                }
        
        # Fallback to original logic if smart buffer not available
        if self.current_position >= len(self.expected_words):
            # Reached end of story
            return {
                "match_type": "end_of_story",
                "advance": False,
                "new_position": self.current_position,
                "miscue_count": 0,
                "details": "Reached end of story"
            }
        
        expected_word = self.expected_words[self.current_position]
        
        # SIMPLIFIED START: Just start from position 0
        # The old "wait for first word" logic was too strict and could ignore valid words
        if not self.session_started:
            self.session_started = True
            self.current_position = 0
            print(f"   🎯 SESSION START: Beginning at position 0")
        
        # TRANSPOSITION CONFIRMATION DISABLED: Detection is disabled, so this is never triggered
        if False and self.transposition_pending and self.transposition_first_word is not None:
            # We detected a transposition - now check if current word completes it
            # The current word should match the PREVIOUS expected word
            previous_expected = self.expected_words[self.current_position]
            if check_pronunciation_match(spoken_word, previous_expected, self.language):
                # CONFIRMED! This is a transposition
                print(f"   ✅ TRANSPOSITION CONFIRMED: '{self.transposition_first_word}' and '{spoken_word}' swapped")
                
                # Clear transposition state
                self.transposition_pending = False
                first_word = self.transposition_first_word
                self.transposition_first_word = None
                
                # Update position - we've now read both words (in wrong order)
                self.current_position += 2
                self.words_read += 2
                self.total_miscues += 1
                self.miscue_types["transposition"] += 1
                
                # Update last spoken word
                self.last_spoken_word = spoken_word
                
                # Add to recent words
                self.recent_words.append(spoken_word)
                if len(self.recent_words) > self.max_recent_words:
                    self.recent_words.pop(0)
                
                # Return transposition result
                transposition_result = {
                    "match_type": "transposition",
                    "advance": True,
                    "new_position": self.current_position,
                    "miscue_count": 1,
                    "first_word": first_word,
                    "second_word": spoken_word,
                    "details": f"Transposition: '{first_word}' and '{spoken_word}' swapped"
                }
                
                # Add session state
                transposition_result["session_state"] = {
                    "current_position": self.current_position,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "miscue_types": self.miscue_types.copy(),
                    "progress": f"{self.current_position}/{len(self.expected_words)}"
                }
                
                return transposition_result
            else:
                # Not a transposition - treat first word as substitution
                print(f"   ❌ TRANSPOSITION FAILED: '{spoken_word}' doesn't match expected '{previous_expected}'")
                self.transposition_pending = False
                self.transposition_first_word = None
                # Continue processing current word normally
        
        # REPETITION DETECTION DISABLED: Can misidentify Vosk duplicates as repetitions
        # Real repetitions are rare and hard to distinguish from Vosk processing delays
        if False and self.last_spoken_word is not None:
            if check_pronunciation_match(spoken_word, self.last_spoken_word, self.language):
                # Same word spoken twice - this is a REPETITION
                print(f"   🔁 REPETITION DETECTED: '{spoken_word}' repeated")
                
                # Update last spoken word
                self.last_spoken_word = spoken_word
                
                # Add to recent words
                self.recent_words.append(spoken_word)
                if len(self.recent_words) > self.max_recent_words:
                    self.recent_words.pop(0)
                
                # Return repetition result (don't advance position)
                repetition_result = {
                    "match_type": "repetition",
                    "advance": False,  # Don't advance - word was already read
                    "new_position": self.current_position,
                    "miscue_count": 1,
                    "repeated_word": spoken_word,
                    "details": f"Repetition: '{spoken_word}' repeated"
                }
                
                # Update miscue count
                self.total_miscues += 1
                self.miscue_types["repetition"] += 1
                
                # Add session state
                repetition_result["session_state"] = {
                    "current_position": self.current_position,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "miscue_types": self.miscue_types.copy(),
                    "progress": f"{self.current_position}/{len(self.expected_words)}"
                }
                
                return repetition_result
        
        # SELF-CORRECTION DETECTION DISABLED: Too complex, causing false positives
        # Self-corrections are rare and hard to detect reliably with Vosk's delays
        if False and self.last_match_result is not None:
            # Check if last result was a miscue (substitution or mispronunciation)
            if self.last_match_result.get("match_type") in ["substitution", "mispronunciation"]:
                # Check if current word matches the PREVIOUS expected word (the one they got wrong)
                previous_position = self.current_position - 1
                if previous_position >= 0:
                    previous_expected = self.expected_words[previous_position]
                    if check_pronunciation_match(spoken_word, previous_expected, self.language):
                        # Student corrected their mistake! This is SELF-CORRECTION
                        print(f"   ✅ SELF-CORRECTION DETECTED: Corrected '{previous_expected}' after saying '{self.last_match_result.get('spoken_word', 'unknown')}'")
                        
                        # Update last spoken word
                        self.last_spoken_word = spoken_word
                        
                        # Add to recent words
                        self.recent_words.append(spoken_word)
                        if len(self.recent_words) > self.max_recent_words:
                            self.recent_words.pop(0)
                        
                        # Return self-correction result (don't advance - word was already counted)
                        self_correction_result = {
                            "match_type": "selfCorrection",
                            "advance": False,  # Don't advance - correcting previous word
                            "new_position": self.current_position,
                            "miscue_count": 0,  # Self-correction is NOT counted as a miscue (it's a positive behavior)
                            "corrected_word": spoken_word,
                            "original_miscue": self.last_match_result.get("match_type"),
                            "details": f"Self-correction: Corrected '{previous_expected}'"
                        }
                        
                        # Track self-correction (for reporting, but don't add to total miscues)
                        self.miscue_types["selfCorrection"] += 1
                        
                        # Add session state
                        self_correction_result["session_state"] = {
                            "current_position": self.current_position,
                            "words_read": self.words_read,
                            "total_miscues": self.total_miscues,
                            "miscue_types": self.miscue_types.copy(),
                            "progress": f"{self.current_position}/{len(self.expected_words)}"
                        }
                        
                        # Clear last match result to prevent double detection
                        self.last_match_result = None
                        
                        return self_correction_result
        
        # INSERTION DETECTION DISABLED: Overly complex and rarely works correctly
        # The pending word logic was causing more confusion than it solved
        # Insertions are rare and will be treated as substitutions instead
        
        # Check if we have a pending word from the previous call
        if False and self.pending_word is not None:
            # We have a pending word - check if current word matches expected
            if check_pronunciation_match(spoken_word, expected_word, self.language):
                # Current word matches! But first check if this is a SELF-CORRECTION
                # Self-correction: pending word was wrong, current word corrects it
                # Example: "malaki... isang" where "isang" is expected
                
                # Check if current word matches the EXPECTED word (the one pending word failed to match)
                # If yes, this is self-correction, not insertion
                if self.current_position > 0:
                    # The pending word was trying to match the current expected word
                    # Now the student said the correct word - this is SELF-CORRECTION!
                    print(f"   ✅ SELF-CORRECTION DETECTED: Said '{self.pending_word}' then corrected to '{spoken_word}'")
                    
                    # Return self-correction result
                    self_correction_result = {
                        "match_type": "selfCorrection",
                        "advance": True,  # Advance because they got it right eventually
                        "new_position": self.current_position + 1,
                        "miscue_count": 0,  # Self-correction is positive, not counted as miscue
                        "corrected_word": spoken_word,
                        "wrong_word": self.pending_word,
                        "details": f"Self-correction: Said '{self.pending_word}' then corrected to '{spoken_word}'"
                    }
                    
                    # Clear pending word
                    self.pending_word = None
                    
                    # Update state
                    self.current_position = self_correction_result["new_position"]
                    self.words_read += 1
                    self.miscue_types["selfCorrection"] += 1
                    # Note: Don't increment total_miscues - self-correction is positive!
                    
                    # Update last spoken word
                    self.last_spoken_word = spoken_word
                    
                    # Add to recent words
                    self.recent_words.append(spoken_word)
                    if len(self.recent_words) > self.max_recent_words:
                        self.recent_words.pop(0)
                    
                    # Add session state
                    self_correction_result["session_state"] = {
                        "current_position": self.current_position,
                        "words_read": self.words_read,
                        "total_miscues": self.total_miscues,
                        "miscue_types": self.miscue_types.copy(),
                        "progress": f"{self.current_position}/{len(self.expected_words)}"
                    }
                    
                    return self_correction_result
                
                # Check if pending word exists in story vocabulary
                # If it does, it's NOT an insertion - just out of order (skip it)
                pending_word_in_story = any(
                    self._words_match(self.pending_word, expected.lower().strip())
                    for expected in self.expected_words
                )
                
                if pending_word_in_story:
                    # Word is in story - NOT an insertion, just out of order
                    # Skip it and continue with current word
                    print(f"   ⏭️ SKIPPING: '{self.pending_word}' is in story (not an insertion)")
                    self.pending_word = None
                    # Don't count as insertion - continue processing current word
                    # Fall through to normal processing below
                else:
                    # Not self-correction, it's an INSERTION (word not in story)
                    print(f"   ✅ INSERTION CONFIRMED: '{self.pending_word}' inserted before '{expected_word}' (not in story)")
                    
                    # Return insertion result for the pending word
                    insertion_result = {
                        "match_type": "insertion",
                        "advance": True,  # Advance position because we found the expected word
                        "new_position": self.current_position + 1,
                        "miscue_count": 1,
                        "inserted_word": self.pending_word,
                        "details": f"Insertion: '{self.pending_word}' inserted before '{expected_word}'"
                    }
                    
                    # Clear pending word
                    self.pending_word = None
                    
                    # Update state
                    self.current_position = insertion_result["new_position"]
                    self.words_read += 1
                    self.total_miscues += 1
                    self.miscue_types["insertion"] += 1
                
                    # Add to recent words
                    self.recent_words.append(spoken_word)
                    if len(self.recent_words) > self.max_recent_words:
                        self.recent_words.pop(0)
                    
                    # Add session state
                    insertion_result["session_state"] = {
                        "current_position": self.current_position,
                        "words_read": self.words_read,
                        "total_miscues": self.total_miscues,
                        "miscue_types": self.miscue_types.copy(),
                        "progress": f"{self.current_position}/{len(self.expected_words)}"
                    }
                    
                    return insertion_result
                
                # If we skipped the pending word, continue to process current word below
            else:
                # Current word doesn't match either - pending word was a SUBSTITUTION
                print(f"   ⚠️ SUBSTITUTION CONFIRMED: '{self.pending_word}' substituted for '{self.expected_words[self.current_position - 1]}'")
                
                # The pending word was a substitution, now process current word normally
                self.pending_word = None
                # Continue to process current word below
        
        # Match the current word
        result = match_word(
            spoken_word,
            expected_word,
            self.expected_words,
            self.current_position,
            self.language
        )
        
        # TIMING VALIDATION: Check if Vosk is lagging and correct if needed
        if self.timing_validator and result.get("new_position"):
            correction = self.timing_validator.correct_position(
                spoken_word,
                result["new_position"],
                self.current_position
            )
            
            if correction["corrected"]:
                # Apply timing correction
                print(f"   ✅ Applied timing correction: position {result['new_position']} → {correction['corrected_position']}")
                result["new_position"] = correction["corrected_position"]
                result["timing_corrected"] = True
                result["lag_words"] = correction.get("lag_words", 0)
        
        # Check for TRANSPOSITION PENDING - set state and wait for next word
        if result["match_type"] == "transposition_pending":
            # Set transposition pending state
            self.transposition_pending = True
            self.transposition_first_word = spoken_word
            print(f"   ⏸️ TRANSPOSITION PENDING: '{spoken_word}' - waiting for next word to confirm")
            
            return {
                "match_type": "pending",
                "advance": False,
                "new_position": self.current_position,
                "miscue_count": 0,
                "details": f"Transposition pending: waiting for next word"
            }
        
        # DISABLED: Pending word logic causes too many false omissions
        # When a child says "a cat" quickly, Vosk might hear "da cat"
        # The old logic would mark "da" as pending, then mark "a" and "cat" as omissions
        # New approach: Accept mispronunciations and substitutions immediately
        # Only use pending for very specific cases (transposition)
        if False and result["match_type"] in ["substitution", "mispronunciation"]:
            # Word doesn't match - hold it as pending
            print(f"   ⏸️ PENDING: '{spoken_word}' doesn't match '{expected_word}' - waiting for next word")
            self.pending_word = spoken_word
            
            return {
                "match_type": "pending",
                "advance": False,
                "new_position": self.current_position,
                "miscue_count": 0,
                "details": f"Pending: '{spoken_word}' doesn't match '{expected_word}', waiting for next word"
            }
        
        # REMOVED: State tracking for disabled features
        # All the pending_word, last_spoken_word, last_match_result, and recent_words
        # tracking has been removed since those features are disabled
        
        # Update state
        if result["advance"]:
            self.current_position = result["new_position"]
            self.words_read += 1
            
            # Track timing for lag detection
            if self.timing_validator:
                self.timing_validator.add_word(spoken_word, self.current_position, time.time())
        elif "new_position" in result:
            # Position correction without advancing
            self.current_position = result["new_position"]
        
        if result["miscue_count"] > 0:
            self.total_miscues += result["miscue_count"]
            match_type = result["match_type"]
            if match_type in self.miscue_types:
                self.miscue_types[match_type] += result["miscue_count"]
        
        # Add session state to result
        result["session_state"] = {
            "current_position": self.current_position,
            "words_read": self.words_read,
            "total_miscues": self.total_miscues,
            "miscue_types": self.miscue_types.copy(),
            "progress": f"{self.current_position}/{len(self.expected_words)}"
        }
        
        return result
    
    def get_metrics(self, elapsed_time: float) -> Dict:
        """
        Calculate reading metrics.
        
        Args:
            elapsed_time: Elapsed time in seconds
            
        Returns:
            Dictionary with metrics
        """
        total_words = len(self.expected_words)
        
        # Calculate WPM
        wpm = 0
        if elapsed_time > 0:
            wpm = int((self.words_read / elapsed_time) * 60)
        
        # Calculate accuracy
        accuracy = 0.0
        if self.words_read > 0:
            correct_words = self.words_read - self.total_miscues
            accuracy = (correct_words / self.words_read) * 100
        
        # Calculate oral reading score
        oral_reading_score = 0.0
        if total_words > 0:
            correct_words = self.words_read - self.total_miscues
            oral_reading_score = (correct_words / total_words) * 100
            oral_reading_score = max(0.0, min(100.0, oral_reading_score))
        
        return {
            "wpm": wpm,
            "accuracy": round(accuracy, 1),
            "oral_reading_score": round(oral_reading_score, 1),
            "words_read": self.words_read,
            "total_words": total_words,
            "total_miscues": self.total_miscues,
            "miscue_types": self.miscue_types.copy(),
            "elapsed_time": round(elapsed_time, 1),
            "progress_percent": round((self.current_position / total_words) * 100, 1) if total_words > 0 else 0
        }
