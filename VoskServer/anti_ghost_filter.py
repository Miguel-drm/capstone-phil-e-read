"""
Anti-Ghost Word Detection System for Real-Time Reading Assessment

This module provides a production-ready filtering engine that prevents Vosk
speech recognition artifacts ("ghost words") from affecting reading assessment
accuracy while maintaining proper miscue detection.

Design Principles:
- Story is the source of truth
- Speech recognition is noisy
- Cursor only moves on validated matches
- Noise never affects alignment
- Common words are NOT globally blocked (context-aware filtering only)
- Real-time safe (non-blocking, optimized for WebSocket streaming)

Author: Phil-IRI Reading Assessment System
"""

from typing import Dict, List, Optional, Tuple
import logging

# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# FILTER LAYER - Applied before matching logic
# ============================================================================

class GhostWordFilter:
    """
    Three-layer filtering system to eliminate ghost words before matching.
    
    Filters:
    1. Confidence Filter - Removes low-confidence recognitions
    2. Duration Filter - Removes ultra-short word durations
    3. Duplicate Filter - Prevents consecutive duplicate words
    """
    
    # Filter thresholds
    MIN_CONFIDENCE = 0.75
    MIN_DURATION = 0.15  # seconds
    
    @staticmethod
    def apply_confidence_filter(word_data: Dict) -> bool:
        """
        Filter 1: Confidence threshold
        
        Args:
            word_data: Dict with 'word', 'conf', 'start', 'end'
            
        Returns:
            True if word passes filter, False if should be rejected
        """
        conf = word_data.get('conf', 0.0)
        if conf < GhostWordFilter.MIN_CONFIDENCE:
            logger.debug(f"❌ Confidence filter: '{word_data.get('word')}' conf={conf:.2f} < {GhostWordFilter.MIN_CONFIDENCE}")
            return False
        return True
    
    @staticmethod
    def apply_duration_filter(word_data: Dict) -> bool:
        """
        Filter 2: Minimum duration threshold
        
        Filters out ultra-short durations that are likely noise or breath sounds.
        
        Args:
            word_data: Dict with 'word', 'conf', 'start', 'end'
            
        Returns:
            True if word passes filter, False if should be rejected
        """
        start = word_data.get('start', 0.0)
        end = word_data.get('end', 0.0)
        duration = end - start
        
        if duration < GhostWordFilter.MIN_DURATION:
            logger.debug(f"❌ Duration filter: '{word_data.get('word')}' duration={duration:.3f}s < {GhostWordFilter.MIN_DURATION}s")
            return False
        return True
    
    @staticmethod
    def apply_duplicate_filter(word: str, last_word: Optional[str]) -> bool:
        """
        Filter 3: Consecutive duplicate prevention
        
        Prevents immediate repetition of the same word (likely Vosk artifact).
        Note: This is different from legitimate repetition miscues, which are
        detected in the matching layer when a student intentionally repeats.
        
        Args:
            word: Current spoken word
            last_word: Previously accepted word
            
        Returns:
            True if word passes filter, False if should be rejected
        """
        if last_word and word.lower() == last_word.lower():
            logger.debug(f"❌ Duplicate filter: '{word}' == last_word '{last_word}'")
            return False
        return True
    
    @classmethod
    def filter_word(cls, word_data: Dict, last_word: Optional[str]) -> bool:
        """
        Apply all three filter layers.
        
        Args:
            word_data: Dict with 'word', 'conf', 'start', 'end'
            last_word: Previously accepted word
            
        Returns:
            True if word passes all filters, False if should be rejected
        """
        # Apply filters in order
        if not cls.apply_confidence_filter(word_data):
            return False
        
        if not cls.apply_duration_filter(word_data):
            return False
        
        word = word_data.get('word', '').strip()
        if not cls.apply_duplicate_filter(word, last_word):
            return False
        
        return True


# ============================================================================
# MATCHING LAYER - Position-aware word validation
# ============================================================================

class WordMatcher:
    """
    Position-aware word matching engine that validates spoken words against
    expected story text and classifies miscue types.
    
    Miscue Types:
    - correct: Spoken word matches expected word
    - omission: Spoken word matches next expected word (skipped current)
    - repetition: Spoken word matches one of previous 2 words
    - reversal: Spoken word is reverse of expected word
    - substitution: Spoken word is similar to expected (Levenshtein ≤ 1)
    - noise: Spoken word doesn't match any validation rule
    """
    
    # Matching parameters
    MAX_LEVENSHTEIN_DISTANCE = 1
    REPETITION_LOOKBACK = 2  # Check previous 2 words for repetition
    
    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        """
        Calculate Levenshtein (edit) distance between two strings.
        
        Optimized for real-time processing with early termination.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Minimum number of single-character edits (insertions, deletions, substitutions)
        """
        if s1 == s2:
            return 0
        
        len1, len2 = len(s1), len(s2)
        
        # Early termination for very different lengths
        if abs(len1 - len2) > WordMatcher.MAX_LEVENSHTEIN_DISTANCE:
            return abs(len1 - len2)
        
        # Create distance matrix
        if len1 < len2:
            s1, s2 = s2, s1
            len1, len2 = len2, len1
        
        # Use single row optimization for space efficiency
        previous_row = range(len2 + 1)
        
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                # Cost of insertions, deletions, or substitutions
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    @staticmethod
    def check_correct(spoken: str, expected: str) -> bool:
        """Check if spoken word matches expected word exactly."""
        return spoken.lower() == expected.lower()
    
    @staticmethod
    def check_omission(spoken: str, story_words: List[str], current_position: int) -> bool:
        """
        Check if spoken word matches next expected word (omission of current).
        
        Args:
            spoken: Spoken word
            story_words: Complete story word list
            current_position: Current position in story
            
        Returns:
            True if spoken matches next word (omission detected)
        """
        next_position = current_position + 1
        if next_position < len(story_words):
            next_word = story_words[next_position]
            return spoken.lower() == next_word.lower()
        return False
    
    @staticmethod
    def check_repetition(spoken: str, story_words: List[str], current_position: int) -> Tuple[bool, int]:
        """
        Check if spoken word matches one of the previous N words (repetition).
        
        Args:
            spoken: Spoken word
            story_words: Complete story word list
            current_position: Current position in story
            
        Returns:
            Tuple of (is_repetition, repeated_word_position)
        """
        lookback_start = max(0, current_position - WordMatcher.REPETITION_LOOKBACK)
        
        for i in range(current_position - 1, lookback_start - 1, -1):
            if i >= 0 and i < len(story_words):
                if spoken.lower() == story_words[i].lower():
                    return True, i
        
        return False, -1
    
    @staticmethod
    def check_reversal(spoken: str, expected: str) -> bool:
        """
        Check if spoken word is the reverse of expected word.
        
        Example: "was" vs "saw"
        """
        return spoken.lower() == expected.lower()[::-1]
    
    @staticmethod
    def check_substitution(spoken: str, expected: str) -> bool:
        """
        Check if spoken word is similar to expected (Levenshtein distance ≤ 1).
        
        Examples:
        - "cat" vs "cats" (insertion)
        - "running" vs "runing" (deletion)
        - "house" vs "mouse" (substitution)
        """
        distance = WordMatcher.levenshtein_distance(spoken, expected)
        return distance <= WordMatcher.MAX_LEVENSHTEIN_DISTANCE
    
    @classmethod
    def match_word(cls, spoken: str, story_words: List[str], current_position: int) -> Tuple[str, int]:
        """
        Match spoken word against story using position-aware validation rules.
        
        Validation order (CRITICAL - must be in this sequence):
        1. Correct match
        2. Omission (next word)
        3. Repetition (previous words)
        4. Reversal
        5. Substitution (similar word)
        6. Noise (no match)
        
        Args:
            spoken: Spoken word (already filtered)
            story_words: Complete story word list
            current_position: Current position in story
            
        Returns:
            Tuple of (miscue_type, new_position)
        """
        # Boundary check
        if current_position >= len(story_words):
            logger.debug(f"⚠️ Position {current_position} beyond story length {len(story_words)}")
            return "noise", current_position
        
        expected_word = story_words[current_position]
        
        # Rule 1: Correct match
        if cls.check_correct(spoken, expected_word):
            logger.debug(f"✅ Correct: '{spoken}' == '{expected_word}' at position {current_position}")
            return "correct", current_position + 1
        
        # Rule 2: Omission (spoken matches next word)
        if cls.check_omission(spoken, story_words, current_position):
            next_word = story_words[current_position + 1]
            logger.debug(f"⏭️ Omission: '{spoken}' == next word '{next_word}', skipped '{expected_word}'")
            return "omission", current_position + 2  # Skip current, move to word after next
        
        # Rule 3: Repetition (spoken matches previous word)
        is_repetition, repeated_position = cls.check_repetition(spoken, story_words, current_position)
        if is_repetition:
            repeated_word = story_words[repeated_position]
            logger.debug(f"🔁 Repetition: '{spoken}' == previous word '{repeated_word}' at position {repeated_position}")
            return "repetition", current_position  # Don't advance position
        
        # Rule 4: Reversal (spoken is reverse of expected)
        if cls.check_reversal(spoken, expected_word):
            logger.debug(f"🔄 Reversal: '{spoken}' is reverse of '{expected_word}'")
            return "reversal", current_position + 1
        
        # Rule 5: Substitution (spoken is similar to expected)
        if cls.check_substitution(spoken, expected_word):
            logger.debug(f"🔀 Substitution: '{spoken}' similar to '{expected_word}' (Levenshtein ≤ 1)")
            return "substitution", current_position + 1
        
        # Rule 6: Noise (no match found)
        logger.debug(f"🔇 Noise: '{spoken}' doesn't match any validation rule at position {current_position}")
        return "noise", current_position  # Don't advance position


# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================

def process_recognition_result(
    result_json: Dict,
    story_words: List[str],
    current_position: int,
    last_word: Optional[str]
) -> Dict:
    """
    Process Vosk recognition result with anti-ghost filtering and position-aware matching.
    
    This is the main entry point for the anti-ghost detection system.
    
    Processing Pipeline:
    1. Extract word data from Vosk result
    2. Apply three-layer ghost word filtering
    3. If word passes filters, apply position-aware matching
    4. Return result with miscue classification and position update
    
    Args:
        result_json: Vosk recognition result in format:
            {
                "result": [
                    {"word": "the", "conf": 0.82, "start": 0.00, "end": 0.34}
                ]
            }
        story_words: List of expected story words
        current_position: Current position in story (0-indexed)
        last_word: Previously accepted word (for duplicate filtering)
        
    Returns:
        Dict with:
            - accepted_word: str or None (None if filtered out)
            - miscue_type: "correct" | "repetition" | "substitution" | "reversal" | "omission" | "noise"
            - new_position: int (updated position)
            - last_word: str (updated last word)
            
    Example:
        >>> result = {
        ...     "result": [{"word": "cat", "conf": 0.95, "start": 0.0, "end": 0.5}]
        ... }
        >>> story = ["the", "cat", "sat"]
        >>> process_recognition_result(result, story, 1, "the")
        {
            'accepted_word': 'cat',
            'miscue_type': 'correct',
            'new_position': 2,
            'last_word': 'cat'
        }
    """
    # Extract word data from Vosk result
    result_list = result_json.get('result', [])
    
    if not result_list:
        logger.debug("⚠️ Empty result from Vosk")
        return {
            'accepted_word': None,
            'miscue_type': 'noise',
            'new_position': current_position,
            'last_word': last_word
        }
    
    # Process first word in result (Vosk typically sends one word per final result)
    word_data = result_list[0]
    spoken_word = word_data.get('word', '').strip()
    
    if not spoken_word:
        logger.debug("⚠️ Empty word in result")
        return {
            'accepted_word': None,
            'miscue_type': 'noise',
            'new_position': current_position,
            'last_word': last_word
        }
    
    # ========================================================================
    # FILTER LAYER - Apply ghost word filters
    # ========================================================================
    
    if not GhostWordFilter.filter_word(word_data, last_word):
        logger.debug(f"🚫 Ghost word filtered: '{spoken_word}'")
        return {
            'accepted_word': None,
            'miscue_type': 'noise',
            'new_position': current_position,
            'last_word': last_word  # Don't update last_word for filtered words
        }
    
    # ========================================================================
    # MATCHING LAYER - Position-aware validation
    # ========================================================================
    
    miscue_type, new_position = WordMatcher.match_word(
        spoken_word,
        story_words,
        current_position
    )
    
    # Update last_word only if word was accepted (not noise)
    updated_last_word = spoken_word if miscue_type != 'noise' else last_word
    
    logger.info(f"📝 Processed: '{spoken_word}' → {miscue_type} (pos: {current_position} → {new_position})")
    
    return {
        'accepted_word': spoken_word if miscue_type != 'noise' else None,
        'miscue_type': miscue_type,
        'new_position': new_position,
        'last_word': updated_last_word
    }


# ============================================================================
# HELPER FUNCTIONS FOR INTEGRATION
# ============================================================================

def configure_filter_thresholds(min_confidence: float = 0.75, min_duration: float = 0.15):
    """
    Configure filter thresholds for different use cases.
    
    Args:
        min_confidence: Minimum confidence threshold (0.0 - 1.0)
        min_duration: Minimum word duration in seconds
        
    Example:
        >>> # Stricter filtering for noisy environments
        >>> configure_filter_thresholds(min_confidence=0.85, min_duration=0.20)
        
        >>> # More lenient for quiet environments
        >>> configure_filter_thresholds(min_confidence=0.70, min_duration=0.12)
    """
    GhostWordFilter.MIN_CONFIDENCE = min_confidence
    GhostWordFilter.MIN_DURATION = min_duration
    logger.info(f"🔧 Filter thresholds updated: confidence={min_confidence}, duration={min_duration}s")


def get_filter_stats() -> Dict:
    """
    Get current filter configuration.
    
    Returns:
        Dict with current filter thresholds and matching parameters
    """
    return {
        'min_confidence': GhostWordFilter.MIN_CONFIDENCE,
        'min_duration': GhostWordFilter.MIN_DURATION,
        'max_levenshtein_distance': WordMatcher.MAX_LEVENSHTEIN_DISTANCE,
        'repetition_lookback': WordMatcher.REPETITION_LOOKBACK
    }


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Configure logging for demo
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(levelname)s: %(message)s'
    )
    
    print("=" * 70)
    print("Anti-Ghost Word Detection System - Demo")
    print("=" * 70)
    
    # Sample story
    story = ["the", "cat", "sat", "on", "the", "mat"]
    position = 0
    last = None
    
    print(f"\n📖 Story: {' '.join(story)}")
    print(f"📍 Starting position: {position}\n")
    
    # Test cases
    test_cases = [
        # (description, vosk_result)
        ("Correct word", {
            "result": [{"word": "the", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }),
        ("Low confidence (should filter)", {
            "result": [{"word": "cat", "conf": 0.60, "start": 0.5, "end": 0.8}]
        }),
        ("Ultra-short duration (should filter)", {
            "result": [{"word": "the", "conf": 0.90, "start": 0.8, "end": 0.85}]
        }),
        ("Correct word 'cat'", {
            "result": [{"word": "cat", "conf": 0.92, "start": 1.0, "end": 1.4}]
        }),
        ("Substitution 'sit' for 'sat'", {
            "result": [{"word": "sit", "conf": 0.88, "start": 1.5, "end": 1.9}]
        }),
    ]
    
    for desc, vosk_result in test_cases:
        print(f"\n{'─' * 70}")
        print(f"Test: {desc}")
        print(f"Input: {vosk_result}")
        
        result = process_recognition_result(vosk_result, story, position, last)
        
        print(f"Output: {result}")
        
        # Update state for next iteration
        if result['accepted_word']:
            position = result['new_position']
            last = result['last_word']
    
    print(f"\n{'=' * 70}")
    print(f"Final position: {position}")
    print(f"Final last_word: {last}")
    print("=" * 70)
