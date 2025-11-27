#!/usr/bin/env python3
"""
Word Matcher - Server-side word matching for reading sessions
Handles all word matching logic including pronunciation variants,
omissions, substitutions, and mispronunciations.
"""

from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher
import re

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


def normalize_word(word: str) -> str:
    """Normalize a word for comparison (lowercase, remove punctuation)."""
    return re.sub(r'[^\w]', '', word.lower()).strip()


def calculate_similarity(word1: str, word2: str) -> float:
    """Calculate similarity between two words (0.0 to 1.0)."""
    if not word1 or not word2:
        return 0.0
    return SequenceMatcher(None, word1, word2).ratio()


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
    
    # Common mishearings (Vosk-specific) - ONLY if allowed
    # Disabled by default for searching to prevent false matches
    if allow_mishearings:
        common_mishearings = {
            'a': ['the', 'uh', 'ah', 'ay'],
            'the': ['a', 'da', 'de'],
            'i': ['eye', 'aye'],
            'to': ['too', 'two']
        }
        
        if expected_norm in common_mishearings:
            if spoken_norm in common_mishearings[expected_norm]:
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
    
    # CONTEXT-AWARE CORRECTION: Fix common Vosk mishearings
    # Example: Child says "in", Vosk hears "it" → Correct to "in"
    if CONTEXT_CORRECTION_ENABLED:
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
    
    # TRANSPOSITION DETECTION: Check if spoken word matches the NEXT word
    # If it does, this might be a transposition (word order swap)
    # We need to wait for the following word to confirm
    # NOTE: This is called from match_word, not process_word, so we can't set state here
    # We return a special result that process_word will handle
    if current_position + 1 < len(expected_words):
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
    
    # CONSERVATIVE SEARCH: Check if spoken word matches nearby words only
    # This prevents jumping to repeated words later in the story
    # Example: If "Mia" appears at position 0 and position 23, and we're at position 15,
    # we should NOT jump to position 23 when we hear "Mia" - that's a different occurrence!
    look_ahead_range = 3   # Only look 3 words ahead (prevents false jumps to repeated words)
    look_behind_range = 5  # Look 5 words back (handles delayed words from Vosk buffering)
    
    # Check ahead (WITHOUT mishearings to prevent false matches)
    # Skip i=1 since we already checked for transposition above
    for i in range(2, min(look_ahead_range + 1, len(expected_words) - current_position)):
        future_word = expected_words[current_position + i]
        if check_pronunciation_match(spoken_word, future_word, language, allow_mishearings=False):
            # Found the spoken word ahead - mark as omission
            # IMPORTANT: Only look 3 words ahead to prevent jumping to repeated words
            return {
                "match_type": "omission",
                "advance": True,
                "new_position": current_position + i + 1,  # Jump to after the matched word
                "miscue_count": i,  # Count skipped words as miscues
                "skipped_count": i,
                "details": f"Omission: Skipped {i} word(s), found '{spoken_word}' at position +{i}"
            }
    
    # Check behind (for delayed words from Vosk buffering) - WITHOUT mishearings
    for i in range(1, min(look_behind_range + 1, current_position + 1)):
        past_word = expected_words[current_position - i]
        if check_pronunciation_match(spoken_word, past_word, language, allow_mishearings=False):
            # Found a delayed word! Mark as correct but don't move position backwards
            # This handles Vosk's buffering delays where words arrive out of order
            return {
                "match_type": "correct",
                "advance": False,  # Don't advance position (word was from the past)
                "new_position": current_position,  # Stay at current position
                "miscue_count": 0,
                "details": f"Delayed word: '{spoken_word}' from position -{i} (Vosk buffering delay)"
            }
    
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
    
    # Calculate similarity for mispronunciation vs substitution
    similarity = calculate_similarity(spoken_norm, expected_norm)
    
    # Check for dropped endings (common in Tagalog)
    is_dropped_ending = (
        expected_norm.startswith(spoken_norm) and
        len(spoken_norm) >= 2 and
        len(expected_norm) - len(spoken_norm) <= 2
    )
    
    if is_dropped_ending or similarity >= 0.75:
        # Mispronunciation - similar enough to be the same word
        return {
            "match_type": "mispronunciation",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": similarity,
            "details": f"Mispronunciation: '{spoken_word}' instead of '{expected_word}' ({int(similarity*100)}% similar)"
        }
    else:
        # Substitution - completely different word
        return {
            "match_type": "substitution",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": similarity,
            "details": f"Substitution: '{spoken_word}' instead of '{expected_word}' ({int(similarity*100)}% similar)"
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
        self.recent_words = []  # Track recent spoken words for insertion detection
        self.max_recent_words = 5  # Keep last 5 words
        self.words_read = 0
        self.pending_word = None  # Track pending word for insertion detection
        self.session_started = False  # Track if we've found the first word
        self.last_spoken_word = None  # Track last spoken word for repetition detection
        self.last_match_result = None  # Track last match result for self-correction detection
        self.transposition_pending = False  # Track if we're expecting a transposition confirmation
        self.transposition_first_word = None  # The first word of the transposition pair
    
    def process_word(self, spoken_word: str) -> Dict:
        """
        Process a spoken word and return match result.
        
        Args:
            spoken_word: Word recognized by Vosk
            
        Returns:
            Match result dictionary
        """
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
        
        # WAIT FOR FIRST WORD: Don't start matching until we find the FIRST word of the story
        # STRICT MODE: Only accept the first word (position 0) to start the session
        # This prevents false starts when Vosk hears phantom words or words from later in the story
        if not self.session_started:
            # Only check if spoken word matches the FIRST word of the story
            if check_pronunciation_match(spoken_word, self.expected_words[0], self.language):
                # Found the first word! Start the session
                print(f"   🎯 SESSION START: Found first word '{spoken_word}' at position 0")
                self.current_position = 0
                self.session_started = True
                expected_word = self.expected_words[0]
            else:
                # Not the first word yet - ignore this word
                return {
                    "match_type": "waiting_for_start",
                    "advance": False,
                    "new_position": 0,
                    "miscue_count": 0,
                    "details": f"Waiting for first word '{self.expected_words[0]}', ignoring '{spoken_word}'"
                }
        
        # TRANSPOSITION CONFIRMATION: Check if we're expecting the second word of a transposition
        if self.transposition_pending and self.transposition_first_word is not None:
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
        
        # REPETITION DETECTION: Check if the same word is spoken twice in a row
        # This must be checked BEFORE other logic to catch immediate repetitions
        if self.last_spoken_word is not None:
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
        
        # SELF-CORRECTION DETECTION: Check if previous word was wrong and current word is correct
        # This detects when a student says a wrong word then immediately corrects it
        if self.last_match_result is not None:
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
        
        # INSERTION DETECTION: Use pending word logic to detect insertions
        # When a word doesn't match, hold it as "pending" and wait for the next word
        # If the next word matches the expected word, the pending word was an insertion
        # If the next word doesn't match, the pending word was a substitution
        
        # Check if we have a pending word from the previous call
        if self.pending_word is not None:
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
                
                # Not self-correction, it's an INSERTION
                print(f"   ✅ INSERTION CONFIRMED: '{self.pending_word}' inserted before '{expected_word}'")
                
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
        
        # Check if word doesn't match - make it pending for insertion detection
        if result["match_type"] in ["substitution", "mispronunciation"]:
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
        
        # Word matched or is an omission - process normally
        self.pending_word = None
        
        # Update last spoken word for repetition detection
        self.last_spoken_word = spoken_word
        
        # Store result with spoken word for self-correction detection
        result["spoken_word"] = spoken_word
        self.last_match_result = result.copy()
        
        # Add to recent words buffer
        self.recent_words.append(spoken_word)
        if len(self.recent_words) > self.max_recent_words:
            self.recent_words.pop(0)
        
        # Update state
        if result["advance"]:
            self.current_position = result["new_position"]
            self.words_read += 1
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
