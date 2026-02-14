#!/usr/bin/env python3
"""
Miscue Detection Team - Specialized workers for each miscue type

This module contains a team of specialized workers, each expert in
detecting one specific type of reading miscue according to DepEd Phil-IRI standards.

Team Structure:
    - Team Leader: MiscueDetectionManager (coordinates all workers)
    - Worker 1: MispronunciationDetector
    - Worker 2: OmissionDetector
    - Worker 3: SubstitutionDetector
    - Worker 4: InsertionDetector
    - Worker 5: RepetitionDetector
    - Worker 6: TranspositionDetector
    - Worker 7: ReversalDetector
    - Worker 8: SelfCorrectionDetector
"""

from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher
import re


def normalize_word(word: str) -> str:
    """Normalize a word for comparison."""
    return re.sub(r'[^\w]', '', word.lower()).strip()


def calculate_similarity(word1: str, word2: str) -> float:
    """Calculate similarity between two words (0.0 to 1.0)."""
    if not word1 or not word2:
        return 0.0
    return SequenceMatcher(None, word1, word2).ratio()


# ============================================================================
# WORKER 1: MISPRONUNCIATION DETECTOR
# ============================================================================
class MispronunciationDetector:
    """
    Expert in detecting mispronunciations.
    
    A mispronunciation occurs when a word is pronounced incorrectly but
    is similar enough to the expected word (75%+ similarity).
    
    Examples:
        - "cat" → "kat" (similar sound)
        - "running" → "runnin" (dropped ending)
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        self.similarity_threshold = 0.75
        print("✓ Worker 1 (Mispronunciation Detector) ready")
    
    def detect(self, spoken: str, expected: str) -> Optional[Dict]:
        """
        Detect if spoken word is a mispronunciation of expected word.
        
        Returns:
            Detection result or None if not a mispronunciation
        """
        spoken_norm = normalize_word(spoken)
        expected_norm = normalize_word(expected)
        
        # Calculate similarity
        similarity = calculate_similarity(spoken_norm, expected_norm)
        
        # Check for dropped endings (common in Tagalog)
        is_dropped_ending = (
            expected_norm.startswith(spoken_norm) and
            len(spoken_norm) >= 2 and
            len(expected_norm) - len(spoken_norm) <= 2
        )
        
        if is_dropped_ending or similarity >= self.similarity_threshold:
            return {
                "type": "mispronunciation",
                "spoken": spoken,
                "expected": expected,
                "similarity": similarity,
                "confidence": "high" if similarity >= 0.85 else "medium",
                "details": f"Mispronunciation: '{spoken}' instead of '{expected}' ({int(similarity*100)}% similar)"
            }
        
        return None


# ============================================================================
# WORKER 2: OMISSION DETECTOR
# ============================================================================
class OmissionDetector:
    """
    Expert in detecting omissions.
    
    An omission occurs when the reader skips one or more words.
    
    Examples:
        - Expected: "the cat sat"
        - Read: "the sat" (omitted "cat")
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        self.look_ahead_range = 2  # Look 2 words ahead
        print("✓ Worker 2 (Omission Detector) ready")
    
    def detect(self, spoken: str, expected_words: List[str], current_position: int, 
               pronunciation_match_func) -> Optional[Dict]:
        """
        Detect if reader skipped words (omission).
        
        Returns:
            Detection result or None if not an omission
        """
        # Check if spoken word matches a word ahead (skipped words in between)
        for i in range(1, min(self.look_ahead_range + 1, len(expected_words) - current_position)):
            future_word = expected_words[current_position + i]
            if pronunciation_match_func(spoken, future_word, self.language, allow_mishearings=False):
                # Found the word ahead - words in between were omitted
                return {
                    "type": "omission",
                    "spoken": spoken,
                    "skipped_words": expected_words[current_position:current_position + i],
                    "skipped_count": i,
                    "matched_position": current_position + i,
                    "confidence": "high",
                    "details": f"Omission: Skipped {i} word(s), found '{spoken}' at position +{i}"
                }
        
        return None


# ============================================================================
# WORKER 3: SUBSTITUTION DETECTOR
# ============================================================================
class SubstitutionDetector:
    """
    Expert in detecting substitutions.
    
    A substitution occurs when the reader says a completely different word
    (less than 75% similarity).
    
    Examples:
        - Expected: "cat"
        - Read: "dog" (completely different)
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        self.similarity_threshold = 0.75
        print("✓ Worker 3 (Substitution Detector) ready")
    
    def detect(self, spoken: str, expected: str) -> Optional[Dict]:
        """
        Detect if spoken word is a substitution of expected word.
        
        Returns:
            Detection result or None if not a substitution
        """
        spoken_norm = normalize_word(spoken)
        expected_norm = normalize_word(expected)
        
        # Calculate similarity
        similarity = calculate_similarity(spoken_norm, expected_norm)
        
        # If similarity is low, it's a substitution
        if similarity < self.similarity_threshold:
            return {
                "type": "substitution",
                "spoken": spoken,
                "expected": expected,
                "similarity": similarity,
                "confidence": "high" if similarity < 0.5 else "medium",
                "details": f"Substitution: '{spoken}' instead of '{expected}' ({int(similarity*100)}% similar)"
            }
        
        return None


# ============================================================================
# WORKER 4: INSERTION DETECTOR
# ============================================================================
class InsertionDetector:
    """
    Expert in detecting insertions.
    
    An insertion occurs when the reader adds a word that's not in the text.
    
    Examples:
        - Expected: "the cat"
        - Read: "the big cat" (inserted "big")
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        print("✓ Worker 4 (Insertion Detector) ready")
    
    def detect(self, spoken: str, expected: str, next_spoken: Optional[str],
               pronunciation_match_func) -> Optional[Dict]:
        """
        Detect if spoken word is an insertion.
        
        Requires the next spoken word to confirm insertion.
        
        Returns:
            Detection result or None if not an insertion
        """
        # Check if current word doesn't match expected
        if not pronunciation_match_func(spoken, expected, self.language):
            # Check if next spoken word matches expected
            if next_spoken and pronunciation_match_func(next_spoken, expected, self.language):
                # Current word was inserted!
                return {
                    "type": "insertion",
                    "inserted_word": spoken,
                    "expected": expected,
                    "confidence": "high",
                    "details": f"Insertion: '{spoken}' inserted before '{expected}'"
                }
        
        return None


# ============================================================================
# WORKER 5: REPETITION DETECTOR
# ============================================================================
class RepetitionDetector:
    """
    Expert in detecting repetitions.
    
    A repetition occurs when the reader says the same word twice.
    
    Examples:
        - Expected: "the cat"
        - Read: "the the cat" (repeated "the")
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        print("✓ Worker 5 (Repetition Detector) ready")
    
    def detect(self, spoken: str, last_spoken: Optional[str],
               pronunciation_match_func) -> Optional[Dict]:
        """
        Detect if spoken word is a repetition of the last word.
        
        Returns:
            Detection result or None if not a repetition
        """
        if last_spoken and pronunciation_match_func(spoken, last_spoken, self.language):
            return {
                "type": "repetition",
                "repeated_word": spoken,
                "confidence": "high",
                "details": f"Repetition: '{spoken}' repeated"
            }
        
        return None


# ============================================================================
# WORKER 6: TRANSPOSITION DETECTOR
# ============================================================================
class TranspositionDetector:
    """
    Expert in detecting transpositions.
    
    A transposition occurs when two words are swapped in order.
    
    Examples:
        - Expected: "is it"
        - Read: "it is" (transposed)
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        print("✓ Worker 6 (Transposition Detector) ready")
    
    def detect(self, spoken: str, expected: str, next_expected: Optional[str],
               pronunciation_match_func) -> Optional[Dict]:
        """
        Detect if spoken word is part of a transposition.
        
        Returns:
            Detection result or None if not a transposition
        """
        # Check if spoken word matches NEXT expected word
        if next_expected and pronunciation_match_func(spoken, next_expected, self.language, allow_mishearings=False):
            return {
                "type": "transposition_pending",
                "first_word": spoken,
                "expected_first": expected,
                "expected_second": next_expected,
                "confidence": "medium",
                "details": f"Transposition pending: '{spoken}' matches next word, waiting for '{expected}'"
            }
        
        return None


# ============================================================================
# WORKER 7: REVERSAL DETECTOR
# ============================================================================
class ReversalDetector:
    """
    Expert in detecting reversals.
    
    A reversal occurs when letters in a word are reversed.
    
    Examples:
        - Expected: "was"
        - Read: "saw" (reversed)
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        print("✓ Worker 7 (Reversal Detector) ready")
    
    def detect(self, spoken: str, expected: str) -> Optional[Dict]:
        """
        Detect if spoken word is a reversal of expected word.
        
        Returns:
            Detection result or None if not a reversal
        """
        spoken_norm = normalize_word(spoken)
        expected_norm = normalize_word(expected)
        
        # Check if spoken is the reverse of expected
        if len(spoken_norm) >= 2 and len(expected_norm) >= 2:
            if spoken_norm == expected_norm[::-1]:
                return {
                    "type": "reversal",
                    "spoken": spoken,
                    "expected": expected,
                    "confidence": "high",
                    "details": f"Reversal: '{spoken}' is reverse of '{expected}'"
                }
        
        return None


# ============================================================================
# WORKER 8: SELF-CORRECTION DETECTOR
# ============================================================================
class SelfCorrectionDetector:
    """
    Expert in detecting self-corrections.
    
    A self-correction occurs when the reader makes a mistake then
    immediately corrects it.
    
    Examples:
        - Expected: "cat"
        - Read: "dog... cat" (self-corrected)
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        print("✓ Worker 8 (Self-Correction Detector) ready")
    
    def detect(self, spoken: str, expected: str, last_match_result: Optional[Dict],
               pronunciation_match_func) -> Optional[Dict]:
        """
        Detect if spoken word is a self-correction.
        
        Returns:
            Detection result or None if not a self-correction
        """
        # Check if last result was a miscue
        if last_match_result and last_match_result.get("match_type") in ["substitution", "mispronunciation"]:
            # Check if current word matches the expected word from last result
            if pronunciation_match_func(spoken, expected, self.language):
                return {
                    "type": "selfCorrection",
                    "corrected_word": spoken,
                    "original_miscue": last_match_result.get("match_type"),
                    "confidence": "high",
                    "details": f"Self-correction: Corrected '{expected}'"
                }
        
        return None


# ============================================================================
# TEAM LEADER: MISCUE DETECTION MANAGER
# ============================================================================
class MiscueDetectionManager:
    """
    Team leader that coordinates all miscue detection workers.
    
    This manager assigns tasks to specialized workers and combines
    their results to determine the final miscue type.
    """
    
    def __init__(self, language: str = "english"):
        self.language = language
        
        print("\n" + "="*60)
        print("🏢 MISCUE DETECTION TEAM - Initializing")
        print("="*60)
        
        # Initialize all workers
        self.worker_1_mispronunciation = MispronunciationDetector(language)
        self.worker_2_omission = OmissionDetector(language)
        self.worker_3_substitution = SubstitutionDetector(language)
        self.worker_4_insertion = InsertionDetector(language)
        self.worker_5_repetition = RepetitionDetector(language)
        self.worker_6_transposition = TranspositionDetector(language)
        self.worker_7_reversal = ReversalDetector(language)
        self.worker_8_self_correction = SelfCorrectionDetector(language)
        
        print("="*60)
        print("✅ All workers ready! Team is operational.")
        print("="*60 + "\n")
    
    def detect_miscue(self, context: Dict) -> Dict:
        """
        Coordinate workers to detect miscue type.
        
        Args:
            context: Dictionary with all necessary context:
                - spoken: str
                - expected: str
                - expected_words: List[str]
                - current_position: int
                - last_spoken: Optional[str]
                - last_match_result: Optional[Dict]
                - next_spoken: Optional[str]
                - pronunciation_match_func: callable
        
        Returns:
            Detection result from the appropriate worker
        """
        spoken = context["spoken"]
        expected = context["expected"]
        
        # Priority order (check in this sequence):
        
        # 1. Check for REPETITION (Worker 5)
        if context.get("last_spoken"):
            result = self.worker_5_repetition.detect(
                spoken,
                context["last_spoken"],
                context["pronunciation_match_func"]
            )
            if result:
                print(f"   👷 Worker 5 detected: {result['type']}")
                return result
        
        # 2. Check for SELF-CORRECTION (Worker 8)
        if context.get("last_match_result"):
            result = self.worker_8_self_correction.detect(
                spoken,
                expected,
                context["last_match_result"],
                context["pronunciation_match_func"]
            )
            if result:
                print(f"   👷 Worker 8 detected: {result['type']}")
                return result
        
        # 3. Check for REVERSAL (Worker 7)
        result = self.worker_7_reversal.detect(spoken, expected)
        if result:
            print(f"   👷 Worker 7 detected: {result['type']}")
            return result
        
        # 4. Check for TRANSPOSITION (Worker 6)
        if context.get("next_expected"):
            result = self.worker_6_transposition.detect(
                spoken,
                expected,
                context["next_expected"],
                context["pronunciation_match_func"]
            )
            if result:
                print(f"   👷 Worker 6 detected: {result['type']}")
                return result
        
        # 5. Check for OMISSION (Worker 2)
        result = self.worker_2_omission.detect(
            spoken,
            context["expected_words"],
            context["current_position"],
            context["pronunciation_match_func"]
        )
        if result:
            print(f"   👷 Worker 2 detected: {result['type']}")
            return result
        
        # 6. Check for MISPRONUNCIATION (Worker 1)
        result = self.worker_1_mispronunciation.detect(spoken, expected)
        if result:
            print(f"   👷 Worker 1 detected: {result['type']}")
            return result
        
        # 7. Check for SUBSTITUTION (Worker 3)
        result = self.worker_3_substitution.detect(spoken, expected)
        if result:
            print(f"   👷 Worker 3 detected: {result['type']}")
            return result
        
        # 8. Check for INSERTION (Worker 4) - requires next word
        if context.get("next_spoken"):
            result = self.worker_4_insertion.detect(
                spoken,
                expected,
                context["next_spoken"],
                context["pronunciation_match_func"]
            )
            if result:
                print(f"   👷 Worker 4 detected: {result['type']}")
                return result
        
        # No miscue detected - word is correct
        return {
            "type": "correct",
            "spoken": spoken,
            "expected": expected,
            "confidence": "high",
            "details": f"Correct: '{spoken}' matches '{expected}'"
        }
