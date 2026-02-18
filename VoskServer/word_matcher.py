#!/usr/bin/env python3
"""
Word Matcher - Simple server-side word matching for reading sessions
Handles basic word matching logic.
"""

from typing import Dict, List, Optional
from difflib import SequenceMatcher
import re
import time

# Dictionary API integration
try:
    from dictionary_api_service import get_dictionary_service
    DICTIONARY_API_AVAILABLE = True
    print("✓ Dictionary API service loaded")
except ImportError:
    DICTIONARY_API_AVAILABLE = False
    print("⚠ Dictionary API service not available")


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


# Import timing validator for lag detection
try:
    from timing_validator import TimingValidator
    TIMING_VALIDATOR_AVAILABLE = True
    print("✓ Timing validator loaded")
except ImportError:
    TIMING_VALIDATOR_AVAILABLE = False
    print("⚠ Timing validator not available")


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
    - "was" -> "saw"
    - "on" -> "no"
    - "pot" -> "top"
    
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


def check_pronunciation_match(spoken: str, expected: str, language: str = "english") -> bool:
    """
    Simple check if spoken word matches expected word.
    """
    spoken_norm = normalize_word(spoken)
    expected_norm = normalize_word(expected)
    
    # Exact match
    if spoken_norm == expected_norm:
        return True
    
    # Use Dictionary API for phonetic matching (if available)
    if DICTIONARY_API_AVAILABLE:
        dictionary = get_dictionary_service()
        
        if dictionary.check_word_exists(spoken_norm) and dictionary.check_word_exists(expected_norm):
            spoken_phonetics = dictionary.get_phonetics(spoken_norm)
            expected_phonetics = dictionary.get_phonetics(expected_norm)
            
            if spoken_phonetics and expected_phonetics:
                for sp in spoken_phonetics:
                    if sp in expected_phonetics:
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
    Simple word matching - checks if spoken word matches expected word.
    
    Args:
        spoken_word: Word recognized by Vosk
        expected_word: Expected word at current position
        expected_words: Full list of expected words
        current_position: Current position in expected words
        language: Language for pronunciation matching
        
    Returns:
        Dictionary with match result
    """
    spoken_norm = normalize_word(spoken_word)
    expected_norm = normalize_word(expected_word)
    
    # Check for exact match
    if check_pronunciation_match(spoken_word, expected_word, language):
        return {
            "match_type": "correct",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 0,
            "details": f"Correct: '{spoken_word}' matches '{expected_word}'"
        }
    
    # Check for reversal (was → saw, on → no)
    if is_reversal(spoken_word, expected_word):
        return {
            "match_type": "reversal",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": 0.0,
            "details": f"Reversal: '{spoken_word}' is reverse of '{expected_word}'"
        }
    
    # Calculate similarity for classification
    similarity = calculate_similarity(spoken_norm, expected_norm)
    
    # Check for dropped/added endings
    is_dropped_ending = (
        expected_norm.startswith(spoken_norm) and
        len(spoken_norm) >= 2 and
        len(expected_norm) - len(spoken_norm) <= 2
    )
    
    is_added_ending = (
        spoken_norm.startswith(expected_norm) and
        len(expected_norm) >= 1 and
        len(spoken_norm) - len(expected_norm) <= 3
    )
    
    # Classify as mispronunciation if similar or dropped/added ending
    if similarity > 0.60 or is_dropped_ending or is_added_ending:
        return {
            "match_type": "mispronunciation",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": similarity,
            "details": f"Mispronunciation: '{spoken_word}' instead of '{expected_word}'"
        }
    else:
        # Different word - substitution
        return {
            "match_type": "substitution",
            "advance": True,
            "new_position": current_position + 1,
            "miscue_count": 1,
            "similarity": similarity,
            "details": f"Substitution: '{spoken_word}' instead of '{expected_word}'"
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
        
        # State variables for miscue detection features
        self.recent_words = []  # Track recent words for insertion detection
        self.max_recent_words = 5  # Maximum number of recent words to track
        self.pending_word = None  # Pending word for insertion detection
        self.last_spoken_word = None  # Last spoken word for repetition detection
        self.last_match_result = None  # Last match result for self-correction detection
        self.transposition_pending = False  # Transposition detection state
        self.transposition_first_word = None  # First word in transposition pair
        
        # Initialize smart buffer matcher for handling Vosk's word reordering
        try:
            from smart_buffer_matcher import SmartBufferMatcher
            # Use 80-word buffer for maximum accuracy with Vosk's severe reordering
            # Optimistic matching provides instant feedback when words arrive in order
            self.smart_buffer = SmartBufferMatcher(expected_words, buffer_size=80)
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
    
    def _words_match(self, word1: str, word2: str) -> bool:
        """
        Helper method to check if two words match (case-insensitive).
        
        Args:
            word1: First word
            word2: Second word
            
        Returns:
            True if words match
        """
        return normalize_word(word1) == normalize_word(word2)
    
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
        
        # TRANSPOSITION CONFIRMATION: Check if this completes a transposition
        if True and self.transposition_pending and self.transposition_first_word is not None:
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
        
        # REPETITION DETECTION: Check if same word spoken twice
        if True and self.last_spoken_word is not None:
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
        
        # SELF-CORRECTION DETECTION: Check if student corrected their mistake
        if True and self.last_match_result is not None:
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
        
        # INSERTION DETECTION: Check if we have a pending word from the previous call
        # Check if we have a pending word from the previous call
        if True and self.pending_word is not None:
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
        
        # PENDING WORD LOGIC: Hold word as pending to detect insertions
        # When a child says "a cat" quickly, Vosk might hear "da cat"
        # Hold "da" as pending to see if next word helps clarify
        if True and result["match_type"] in ["substitution", "mispronunciation"]:
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
        
        
        # Update state tracking for miscue detection features
        # Track last spoken word for repetition detection
        self.last_spoken_word = spoken_word
        
        # Track last match result for self-correction detection
        self.last_match_result = result.copy()
        self.last_match_result["spoken_word"] = spoken_word
        
        # Add to recent words for insertion detection
        self.recent_words.append(spoken_word)
        if len(self.recent_words) > self.max_recent_words:
            self.recent_words.pop(0)
        
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
